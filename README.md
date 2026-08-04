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
access to status-restricted sections like the Credit Lab. The
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

## What's real right now

- Sign up / sign in / sign out — fully working, real Clerk accounts
- `/dashboard` — protected; visiting it while signed out redirects to sign-in
  automatically (this is the middleware doing its job)
- Client status model (Applicant/Accepted/Paid) — stored in Postgres,
  mirrored to Clerk, gates the Credit Lab server-side (see above)
- Brand styling — matches joinchew.com's colors and fonts already

## What's next (not built yet, on purpose)

Appointments, Documents, Dispute Tracking, and AI Guidance are shown as
labeled "Coming Soon" cards on the dashboard — intentionally, so nothing
appears to work before it actually does. See `CHEW_MASTER_CONTEXT.md` in the
main website repo for the phased plan for each of these.
