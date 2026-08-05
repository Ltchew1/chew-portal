# CHEW Portal

The real, working start of the Client Portal — Clerk authentication (sign in,
sign up, sign out all genuinely functional), a protected dashboard, and honest
"Coming Soon" placeholders for everything not built yet (documents, disputes,
AI guidance). Nothing here fakes functionality that doesn't exist.

## Important: this is a separate project from the main joinchew.com site

This needs its own GitHub repo and its own Vercel project — it's a real Next.js
application, different from the static HTML site. Keep them separate; don't
upload this into the same repo as the marketing site.

## Deploy this for the first time

**1. GitHub**
- Create a new repo, e.g. `chew-portal`
- Upload every file and folder here **except `.env.local`** — do not drag that
  specific file in, it has your real secret key in it
- `.gitignore` is already set up to help prevent this if you ever use real git
  instead of the web upload

**2. Vercel**
- vercel.com → Add New → Project → import `chew-portal`
- Deploy (it may show an error before env vars are set — that's expected, fix
  in the next step)

**3. Environment variables**
- Vercel project → Settings → Environment Variables → add all four keys from
  `.env.example`, using the real values from `.env.local` (visible only on
  your own computer, never uploaded)
- Redeploy after adding them

**4. Database setup (Neon Postgres)**
- Create a free project at [neon.tech](https://neon.tech)
- In the Neon dashboard's "Connect" panel, copy **both** connection strings:
  - the pooled one → `DATABASE_URL`
  - the direct/unpooled one → `DATABASE_URL_UNPOOLED`
- Add both to `.env.local` (dev) and Vercel → Settings → Environment
  Variables (prod) — see `.env.example` for the exact variable names
- Apply the schema: `npm run db:migrate` (runs `db/schema.sql` against
  `DATABASE_URL_UNPOOLED` — safe to re-run, every statement is
  `CREATE ... IF NOT EXISTS`)
- Confirm it worked: `npm run db:verify` (connects with `DATABASE_URL` and
  checks all expected tables exist)
- Redeploy on Vercel after adding the env vars there too

**5. Test it**
- Visit your new `.vercel.app` URL
- Click Sign Up, create a real test account
- You should land on `/dashboard` and see your own name in "Welcome back"
- Click the account icon (top right) → Sign Out → confirm you're logged out
  and redirected correctly

## Client status (Applicant / Accepted / Paid)

Every client has a status — `applicant`, `accepted`, or `paid` — that gates
access to status-restricted sections like The Lab and its rooms. The
`client_status` table is the source of truth and full audit trail (append-
only: every change is a new row, never an edit); Clerk's `publicMetadata` on
the user holds a mirror of the current status so server components can
check it on every request without a DB round trip.

There's no admin UI for this yet, so status is set manually:

```
npm run status:set -- --email=client@example.com --status=paid --set-by=you@chew.com
npm run status:set -- --clerk-user-id=user_abc123 --status=accepted --set-by=you@chew.com --note="signed program agreement"
```

Requires `CLERK_SECRET_KEY` and `DATABASE_URL` in `.env.local`. `--set-by`
is required and goes into the audit trail — use your own email or name.
New accounts default to `applicant` (nothing to run for that case).

## CHEW: The Lab

The Lab (`/dashboard/lab`, Accepted status required just to see the room
picker) is a hub of focused "rooms," each a different part of a client's
financial infrastructure. `lib/rooms.js` is the single source of truth for
every room — name, icon, tagline, route, required status, and whether it's
actually built — read by the hub's room picker, each room's sub-nav, and
each room's access gate alike.

| Room | Route | Required status | Built |
|---|---|---|---|
| Credit | `/dashboard/lab/credit` | Paid | Yes |
| Credit Builder | `/dashboard/lab/credit-builder` | Accepted | No — "coming to your Lab" |
| Business | `/dashboard/lab/business` | Accepted | No |
| Funding | `/dashboard/lab/funding` | Accepted | No |
| Financial Intelligence | `/dashboard/lab/intelligence` | Accepted | No |
| Money Systems | `/dashboard/lab/money-systems` | Accepted | No |

Gating is layered: `app/dashboard/lab/layout.js` requires Accepted just to
enter The Lab at all; each room's own `layout.js` (via the shared
`app/components/lab/RoomGate.js`) can require more on top of that — Credit
requires Paid. Every gate runs independently on every request, including
API routes (`app/api/lab/credit/**` re-checks access itself; the page gate
above it doesn't protect it).

### Credit room — legal guardrail framework

Credit is client-executed dispute *education*, never a service CHEW
performs on the client's behalf — this is what keeps it outside Florida's
Credit Service Organization statute (817.7001 et seq.). The rule is
enforced in code, not just copy:

- **Attestation gate** (`app/components/lab/credit/AttestationGate.js`,
  `lib/attestations.js`) — a client must check the exact required statement
  per flagged item before it counts as attested. The statement text is
  checked server-side against the one canonical wording in
  `lib/creditRoomCompliance.js`; the `attestations` table has a `UNIQUE`
  constraint on `dispute_item_id`, so the database itself refuses a second
  attestation on the same item. `assertItemsAttested()` is the hook a
  future letter generator must call before generating anything — "no
  attestation = no generation" is enforced there, against the database.
- **Client-decision enforcement** — nothing in the schema or code has a
  field for a system-suggested or auto-labeled "disputable" item; `reason`
  is always a value the client actively picks (see `FlagItemForm.js` — the
  reason radios have no default checked value).
- **Standing disclosures** (`app/components/lab/credit/StandingDisclosures.js`)
  — shown at Credit room entry and again before attestation, in the same
  voice as `DisclaimerBar`.
- **Accuracy guard / no promised outcomes** — `lib/creditRoomCompliance.js`
  holds the one approved wording for all compliance copy, plus a
  forbidden-phrase list checked by `npm run compliance:copy`. This list
  applies Lab-wide (not just Credit) — no room may promise a guaranteed
  outcome, approval, or funding amount.
- **No-transmission lock** — `npm run compliance:no-transmission` fails the
  build if any `app/api/lab/**` route (any room) makes an outbound network
  call, or if banned identifiers like `sendDispute`/`submitToBureau` appear
  anywhere in the app. Letters are architected download/print-only from the
  start; there is no bureau-facing code path to remove later.

Run both checks together with `npm run compliance:check`.

### Credit room features

- **Report Walkthrough** (`/dashboard/lab/credit/walkthrough`) — how to
  pull free reports from all three bureaus at annualcreditreport.com, and
  what each report section means in plain English. Pure education, no DB
  reads/writes. Copy describes what each field *is*, never whether a given
  entry looks wrong — that stays the client's call (accuracy guard).
- **Self-Flagging Tool** (`/dashboard/lab/credit/flag`) — `FlagItemForm.js`
  creates a flagged item (bureau, creditor, account number, reason — reason
  radios have no default, the client must actively pick one);
  `AttestationGate.js` lists everything flagged so far and is where the
  client attests. Flagging and attesting are two separate, deliberate
  actions, not one click. An unattested item can be removed
  (`DELETE /api/lab/credit/dispute-items/[id]`) to fix a mistake — once
  attested, it can't be; `deleteUnattestedItem()` enforces that with a
  `WHERE status = 'flagged'` clause, not just in the UI.
- Letter generator, dispute tracker, and education library are not built
  yet. `CreditRoomSubNav` shows them as "coming soon."

## What's real right now

- Sign up / sign in / sign out — fully working, real Clerk accounts
- `/dashboard` — protected; visiting it while signed out redirects to sign-in
  automatically (this is the middleware doing its job)
- Client status model (Applicant/Accepted/Paid) — stored in Postgres,
  mirrored to Clerk, gates The Lab and its rooms server-side (see above)
- CHEW: The Lab — room picker hub (`/dashboard/lab`) with six rooms; Credit
  is fully real (guardrail framework, Report Walkthrough, Self-Flagging
  Tool, all backed by Postgres). The other five rooms are honest "coming to
  your Lab" placeholders. The guided-tour onboarding and the richer
  goal/progress hub design are not built yet.
- Brand styling — matches joinchew.com's colors and fonts already

## What's next (not built yet, on purpose)

Appointments, Documents, Dispute Tracking, and AI Guidance are shown as
labeled "Coming Soon" cards on the dashboard — intentionally, so nothing
appears to work before it actually does. See `CHEW_MASTER_CONTEXT.md` in the
main website repo for the phased plan for each of these.
