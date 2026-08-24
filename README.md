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
every room — name, icon, tagline, feature list, route, required status,
and whether it's actually built — read by the hub's room picker, each
room's sub-nav, and each room's access gate alike. Seven rooms today
(Credit, Credit Builder, Business, Funding, Financial Intelligence, Money
Systems, Referral Hub); adding another later (Real Estate, Land, ...) is
one more entry in that array plus a matching route folder — the grid
(`auto-fit` + `grid-auto-flow: dense`) and the shared `RoomGate`/
`RoomComingSoon` components scale to any count without layout changes.

Each room's `features` array is a real, specific teaser of what's coming
— e.g. Credit lists "Disputes — all 3 bureaus + secondaries," "Furnisher
disputes," "Method of Verification (MOV) requests," "CFPB & FTC
escalation paths." These are planned features named specifically, not
vague marketing copy — `built: false` stays honest until they exist.

### The hub design system — glass, gold light, gallery composition

The hub (`app/dashboard/lab/page.js`) is styled as a "gallery wall": Credit
(the one built room) is featured — spans two grid columns on tablet+, an
"Available now" badge, a larger icon badge, a persistent resting glow —
while the six unbuilt rooms render as muted, desaturated "dormant" tiles
so the one real destination is unmistakable at a glance, never competing
with placeholders for attention.

- **The living gold light — one signature, three loci.** Per the portal
  constitution, this is locked as *one* treatment (a soft, slow, breathing
  radial glow), not a general-purpose effect to scatter around: behind the
  hero (`.lab-hub-bg`, `living-glow-breathe` keyframe, 9s cycle), pulsing
  under the primary action (`.room-tile--featured .enter-affordance`,
  `enter-glow-breathe`, 3.2s cycle), and tracing a room's edge on hover
  (`a.room-tile:hover` — border + box-shadow ignite). Nothing else on the
  page glows — the eyebrow, hero title, and CHEW mark are deliberately
  quiet (see the "what changed" note below) so these three carry all the
  light.
- **Glass/obsidian tiles** (`.room-tile`) — layered charcoal-to-black
  gradient, `backdrop-filter: blur(20px) saturate(1.1)`, an inset top
  highlight, a soft radial gold tint anchored top-left. A distinct
  `:active` press state (scale down, faster transition) on top of the
  hover lift, for tactile feedback.
- **`GoldProgressRing`** (`app/components/lab/GoldProgressRing.js`) — an
  animated gold ring that fills on mount. The hub uses it to show rooms
  *ready to enter* — built AND status-unlocked, not just status-unlocked —
  so it can never overclaim ("7 of 7 rooms open" would be false for a Paid
  client when only 1 of those 7 has content).
- **`RevealOnScroll`** (`app/components/lab/RevealOnScroll.js`) — staggers
  each room tile's fade-rise-in via `IntersectionObserver`, polymorphic
  enough to render as the tile's own `<Link>` (built + unlocked rooms) or a
  plain `<div>` (locked/unbuilt), so there's no extra wrapper duplicating
  the tile's visual classes around an inner link.
- **Feature teaser lists** (`.room-feature-list`) — `flex-grow` absorbs
  leftover card height (not the tagline), so the "Enter"/"Coming to your
  Lab" affordance stays bottom-aligned across a row even when rooms list
  different numbers of features (Business lists 6, Financial Intelligence
  lists 3).
- **The mark** (`.lab-mark`) — the CHEW logo, framed in a quiet gold
  hairline ring at the top of the hero, no glow of its own — it sits
  inside the ambient light rather than competing with it.
- **The creed** (`.lab-creed`) — "We all Chew. You eat. Then you feed the
  next," set small, Light Gold, wide-tracked, at the foot of the hub. Said
  once, quietly, per the constitution's explicit placement rule.

An unbuilt-but-status-unlocked room (e.g. Business for a Paid client)
shows "Coming to your Lab" with **no lock icon** — a lock there would
misleadingly imply a status restriction when the real reason is just that
the room isn't built yet. The lock icon is reserved for rooms that are
actually gated above the client's current status.

**What changed from the previous pass, and why:** the portal constitution
describes the living gold light as one signature treatment in exactly
three places, not a general effect. The prior pass had drifted into
several independent glow instances — a light-sweep animation across the
Credit tile, a text-shadow glow on the hero eyebrow, another on the hero
title, a glow around the CHEW mark. Each was reasonable in isolation, but
together they diluted the one signature the constitution calls "the
brand's heartbeat" — and the constitution explicitly warns against
"excessive glowing borders." Removed the sweep and the eyebrow/title/mark
glows; kept exactly the three loci above. Files: `app/globals.css` (removed
`shimmer-sweep`/`.room-shimmer`, `.lab-mark`'s box-shadow, the eyebrow/title
`text-shadow`s; added `living-glow-breathe`), `app/dashboard/lab/page.js`
(removed the `.room-shimmer` span). Verify by comparing the hub before/
after — fewer distinct light sources, same three, each reads as more
intentional.

**Typography note:** the constitution asks for a Canela/Ogg-style display
serif — both are commercial foundry fonts with no free-to-embed license.
Swapped in **Fraunces** (Google Fonts) in `app/layout.js` and everywhere
`app/globals.css` referenced Playfair Display — it's built on the same
idea (warm, high-contrast, "soft" old-style display forms) and is the
standard open substitute for exactly this look. If a Canela/Ogg license is
purchased later, that's the one link to swap.

**Palette note:** exact hex values from the founder's brief were applied
directly to the existing CSS custom properties (`--black`, `--gold`, etc. —
names unchanged, only values updated) so every component that already
consumed them picked up the new palette automatically. The one deliberate
follow-on change: the old blue "steel" accent (used for page eyebrows,
one badge variant, and the Tasks progress bar) has been retired from all
decorative/brand uses — gold is the only light source now, per the
constitution. `--steel-light` remains only for the non-decorative
`:focus-visible` outline, where a color distinct from gold's hover/active
states is a genuine accessibility aid, not a brand accent.

**Referral Hub's route** is `/dashboard/lab/referral` (not `-hub`) to match
the constitution's explicit route list; the room's display name stays
"Referral Hub."

### First-visit guided tour

A client's first time reaching `/dashboard/lab` (once they clear the
Accepted gate), they see a short cinematic welcome
(`app/components/lab/tour/TourExperience.js`) instead of the room picker —
four steps, gold-line reveal, a glowing primary CTA — before "Enter The
Lab" hands them into the hub. Every return visit skips straight to the
hub. `users.has_completed_tour` (added to Layer 1's schema, `ADD COLUMN IF
NOT EXISTS` so `npm run db:migrate` picks it up on an existing database)
is the persisted flag; `POST /api/lab/tour/complete` sets it, then the
client calls `router.refresh()` so the same Server Component re-renders as
the hub instead — no separate tour URL.

Each tour step carries an inert `voiceoverId` (`tourSteps.js`) — a clean,
unused hook for an AI-voiceover pass later. The tour never waits on audio
to advance today.

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
- **Letters** (`/dashboard/lab/credit/letters`) — the full escalation
  ladder: Stage 1 (bureau), Stage 2 (furnisher), Stage 3 (secondary bureau —
  LexisNexis/Innovis), Stage 4 (CFPB or FTC complaint narrative, built from
  a prior letter's items plus the client's own account of what went wrong).
  `LetterGenerator.js` groups the client's attested items by bureau and
  derives Stage 1 vs. Stage 3 automatically from `PRIMARY_BUREAUS` /
  `SECONDARY_BUREAUS` (`lib/creditAddresses.js`) — the client never has to
  understand that distinction themselves. `lib/letters.js` calls
  `assertItemsAttested()` first, before any letter is composed or
  persisted — no exceptions, regardless of what the UI shows. Letter text
  itself comes from `lib/letterContent.js`: curated, hand-written phrase
  variants selected with `Math.random()` at generation time and then
  persisted as-is (never regenerated on re-read) — deliberately not an LLM
  call, so every possible sentence the compliance scanners need to audit is
  fully known in advance. FCRA citations (`lib/fcraCitations.js`) are
  matched to the recipient — §611 for bureaus and secondary bureaus, §623
  for furnishers, §609 held back as background-only education (Report
  Walkthrough) to avoid the "609 letter" credit-repair myth. Real,
  web-search-verified mailing addresses for all five bureaus plus the CFPB
  live in `lib/creditAddresses.js`; the CFPB accepts mail or online, the FTC
  is online-only (no mailing address), and the UI says so. Requires a
  mailing address on file first (`MailingAddressForm.js`,
  `/api/lab/credit/mailing-address`) since every letter needs a return
  address. Generated letters are download/print-only — see "No-transmission
  lock" above.
- Dispute tracker and education library are not built yet.
  `CreditRoomSubNav` shows them as "coming soon."

## What's real right now

- Sign up / sign in / sign out — fully working, real Clerk accounts
- `/dashboard` — protected; visiting it while signed out redirects to sign-in
  automatically (this is the middleware doing its job)
- Client status model (Applicant/Accepted/Paid) — stored in Postgres,
  mirrored to Clerk, gates The Lab and its rooms server-side (see above)
- CHEW: The Lab — glass-and-gold room picker hub (`/dashboard/lab`) with
  seven rooms; Credit is fully real (guardrail framework, Report
  Walkthrough, Self-Flagging Tool, and the full Letters generator — all
  four escalation stages, all backed by Postgres). The other six
  rooms are honest "coming to your Lab" placeholders with specific,
  real feature teasers. The first-visit guided tour is real and persisted
  (see above), and correctly distinguishes "just finished the tour" from a
  true return visit. There's no goal-setting feature yet, so the hub shows
  real, computed room-access progress (rooms ready to enter) rather than a
  fabricated "goal."
- Brand styling — matches joinchew.com's colors and fonts already

## What's next (not built yet, on purpose)

Appointments, Documents, Dispute Tracking, and AI Guidance are shown as
labeled "Coming Soon" cards on the dashboard — intentionally, so nothing
appears to work before it actually does. See `CHEW_MASTER_CONTEXT.md` in the
main website repo for the phased plan for each of these.
