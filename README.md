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

**4. Test it**
- Visit your new `.vercel.app` URL
- Click Sign Up, create a real test account
- You should land on `/dashboard` and see your own name in "Welcome back"
- Click the account icon (top right) → Sign Out → confirm you're logged out
  and redirected correctly

## What's real right now

- Sign up / sign in / sign out — fully working, real Clerk accounts
- `/dashboard` — protected; visiting it while signed out redirects to sign-in
  automatically (this is the middleware doing its job)
- Brand styling — matches joinchew.com's colors and fonts already

## What's next (not built yet, on purpose)

Appointments, Documents, Dispute Tracking, and AI Guidance are shown as
labeled "Coming Soon" cards on the dashboard — intentionally, so nothing
appears to work before it actually does. See `CHEW_MASTER_CONTEXT.md` in the
main website repo for the phased plan for each of these.
