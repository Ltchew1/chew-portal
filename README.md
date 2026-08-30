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
- **Dispute Tracker** (`/dashboard/lab/credit/tracker`) — the client's own
  record of what they did with each letter and what happened, never a
  bureau-status lookup (`lib/disputeTracker.js`, `db/schema.sql`'s
  `dispute_tracker_entries` table comment: "Nothing here is read by, or
  written to, a bureau"). Every tracker entry starts from an already-
  generated letter — "Start tracking" on the Tracker page (or the prompt
  linked from the Letters page) creates one entry per letter, copying its
  recipient info at that moment; a partial unique index on `letter_id`
  keeps one letter from forking two timelines. From there it's a simple,
  client-paced flow: log the date you mailed it, then whenever you know,
  log what happened (verified / updated / deleted / never heard back) with
  an optional note, then mark it resolved if you want to. The one
  "intelligent" piece is informational, not a countdown: once a bureau or
  secondary-bureau letter is marked mailed, the page notes FCRA §611's
  ~30-day response window and, only after that window has passed, mentions
  that a CFPB/FTC complaint citing "no response" is an option — furnisher
  and escalation entries don't get this note, since §623 carries no
  equivalent statutory deadline and it would be inaccurate to imply one.
- Education library is not built yet. `CreditRoomSubNav` shows it as
  "coming soon."

## Shared intelligence foundations (the "Living Economic Intelligence" layer)

CHEW's product direction is to become more than a room-by-room portal — an
intelligence layer that watches a client's own data, tells them what
changed, and names one dominant next action, room by room, without ever
fabricating certainty it doesn't have. This is the first phase of that
layer: the reusable primitives, proven end-to-end on the one room that has
real client data (Credit), built so a second room can plug into the same
engine rather than growing its own copy.

**Everything below follows the same rule as the rest of this app: CHEW has
no bureau connection, no lender connection, and no third-party data feed of
any kind. Every input is either something the client already did inside
the portal (flagged an item, generated a letter, logged a tracker update)
or something the client typed in directly (a score they saw, a target they
want). Nothing is pulled, scraped, or inferred from outside.**

### Goal Graph (`goals` table, `lib/goals.js`)

A deliberately room-agnostic table: `room` + `goal_type` + `target_value`,
one active goal per (user, room, goal_type) — setting a new target is an
upsert (`ON CONFLICT ... WHERE status = 'active'`), never a second parallel
goal to reconcile. Only Credit populates it today
(`goal_type = 'credit_score'`), but the shape is generic on purpose — a
funding revenue target or a business-readiness milestone can reuse this
exact table later instead of a bespoke one.

### Score Path Engine (`credit_score_snapshots` table, `lib/creditScore.js`)

The client logs a score they've actually seen (their own report, a bank
app, wherever — `bureau` is optional) and sets a target via the same Goal
Graph. `computeScorePath()` is a **pure function** — given a goal and a
snapshot, it returns exact numbers only: `target`, `current`, `gap`
(subtraction, never estimated), and three explicitly-labeled factor lists —
**controllable** (what the client can actually act on, including a real
count of their own open dispute items), **time-dependent** (ages on a fixed
clock, not something CHEW can accelerate), and **unknown** (what CHEW
plainly can't see). There is no fabricated "N days to your target" —
`reassessmentTrigger` is event-based ("the next time you log an updated
score"), because CHEW has no way to know when a bureau will actually act.
This directly follows the "Precision Doctrine, never fake precision" rule:
exact where the math is exact, honestly qualitative everywhere else. Lives
on the Credit room overview page (`ScoreGoal.js`) — set a target, log a
score, see the gap, expand "what's behind this gap" for the full factor
breakdown.

### The Next-Best-Move / Plan-Status / CHEW-Noticed engine (`lib/homeIntelligence.js`)

The shared "signals" primitive: `buildCreditIntelligence()` is a **pure
function** over data the caller already fetched (dispute items, letters,
tracker entries, mailing address, goal, score snapshots) — no DB access
inside it, directly unit-testable, same pattern as `lib/letterContent.js`.
`getCreditIntelligence()` is the thin loader that fetches and calls it;
`getHomeIntelligence()` is the home page's entry point and is written to
merge a second room's `getXIntelligence()` into the same result once one
exists. From real data alone (no fabrication for rooms/data that don't
exist yet) it derives:

- **Plan status** — On Track / Watch / Action Needed / Plan at Risk, one
  value, ranked by real severity (a letter mailed >30 days ago with no
  logged response — FCRA §611's window — outranks an unattested item, which
  outranks an untracked letter, etc.)
- **The one dominant Next Best Move** — `{ action, why, effect, supports,
  avoid, next, href }`, always exactly one, chosen by the same priority
  order as plan status
- **"CHEW Noticed"** — secondary, non-obvious observations (multiple
  flagged items with the same bureau, more than one stalled letter, a
  logged score that already clears the target)
- **"What Changed"** — a rolling 14-day activity feed built from timestamps
  the app already stores (flagged/generated/logged events), not a new
  tracked "last visited" cursor
- **Opportunities** — deliberately modest for Credit today (e.g. "a
  resolved item may already be reflected in a fresh report") — the
  directive's Opportunity Radar is not extended into rooms with no real
  data behind them yet; see "Deferred" below

Verified by executing the pure function directly against 12 constructed
scenarios (not just reading the code) — every plan-status branch, the
30-day stall detection, multi-item grouping, and the score-gap math all
produced correct output, including the exact day-offset date math.

### Ask CHEW (`lib/askChew.js`, `AskChew.js`, `/api/home/ask`)

A **deterministic keyword router**, not a chatbot and not an LLM call — the
same reasoning as the letter generator's phrase banks: an answer engine's
output space isn't fully known in advance, so it can't be held to this
app's compliance-auditability bar. Ask CHEW matches free text ("I don't
recognize an account," "I want a 750") to the right page in the portal and
says so plainly. A genuine miss is shown as a miss, with a manual way
forward — never a vague non-answer dressed up as understanding. Asking
about a real thing in an unbuilt room (e.g. "I want to buy a laundromat")
correctly names the room and says it isn't open yet, rather than a dead
link pretending to work.

### Home experience (`/dashboard/lab`)

For a returning (post-tour) visitor, the hub now opens with Ask CHEW and
the current room-intelligence block (Plan Status, Next Best Move, What
Changed, CHEW Noticed, Opportunities) above the existing room gallery —
matching the directive's home hierarchy while leaving the tour and gallery
themselves untouched. A first-time visitor still sees the cinematic tour
exactly as before.

## CHEW Intelligence Core v1 — the "one brain" consolidation

After the first pass above, the direction shifted deliberately: consolidate
what had been separate pieces (Goal Graph, Score Path, Next Best Move, Plan
Status, CHEW Noticed, What Changed, Ask CHEW) into one architecture *before*
multiplying rooms — so a second room extends a real system instead of
copying a pattern that then drifts. Common language throughout: **Person →
Goal → Current State → Signals → Barriers/Opportunities → Actions
(Recommendations) → Events → Outcomes.**

### The universal event log (`chew_events` table, `lib/events.js`)

The most important piece, architecturally: every meaningful write path in
the app (`createDisputeItem`, `recordAttestation`, `generateDisputeLetter`,
`generateEscalationLetter`, `createTrackerEntryForLetter`,
`updateTrackerEntry`, `setActiveGoal`, `recordScoreSnapshot`) now logs a
`chew_events` row **at the source of truth**, inside the same write path
(and, where one already existed, the same DB transaction) as the action
itself. "What Changed" no longer re-diffs timestamps across four different
tables — it reads this one event stream (`eventToText()` in
`lib/homeIntelligence.js`). Every other signal (barriers, notifications)
can eventually key off the same stream instead of each inventing its own
notion of "did anything happen."

### Persistent barrier & opportunity objects (`lib/barriers.js`, `lib/opportunities.js`)

Interference and upside are no longer disposable strings recomputed and
thrown away every page load — they're real rows, upserted by a stable
`sourceKey` fingerprint of the underlying condition (e.g.
`stalled_response:<tracker_entry_id>`). Re-detecting the same condition
never forks a duplicate; when the condition clears, that exact row is
marked `resolved` — which is what makes "You fixed it" possible instead of
a barrier just silently vanishing. Both follow the platform's now-explicit
communication grammar: barriers carry `whatHappened → whatItHurts → why →
severity → doThisNow → doNotDo → whatSuccessLooksLike → recheckTrigger`;
opportunities carry the positive mirror (`whatImproved → whyItMatters →
whatItUnlocked → suggestedAction → confidence`). `lib/homeIntelligence.js`
generates the *candidates* (pure); `lib/intelligenceCore.js` reconciles
them against the database (upsert active ones, resolve stale ones).

### Recommendation history — "Why CHEW told me that" (`lib/recommendations.js`)

Every Next Best Move is now a persisted row, not an overwritten value.
Setting a new recommendation is a no-op if the action text hasn't actually
changed (no churn from recomputing the same thing on every page load); a
genuinely different one supersedes the old, keeping full history. The
`RecommendationExplainer` component (a "Why?" toggle next to every Next
Best Move, on the home page and in the War Room) shows what CHEW observed,
the reason, and what would actually change the recommendation — inspectable
intelligence, not a black box.

### In-app notifications (`notifications` table, `lib/notifications.js`)

Architected now, per the directive, even though delivery is in-app only:
email/push/SMS are later, separately-authorized integrations that would
read from this same table rather than needing a second model bolted on.
`lib/intelligenceCore.js`'s reconciler is the only thing that creates a
notification, and only at real moments — a new barrier, a barrier resolved
("You fixed it"), a new opportunity, or a recommendation that changed.
Shown on the Lab home via `NotificationsPanel` (display-only for v1; mark-
as-read interaction is a real next increment, not built here).

### CHEW Intelligence Core (`lib/intelligenceCore.js`)

The reconciler that ties all of the above together — the one place that
writes to `barriers`/`opportunities`/`recommendations`/`notifications`.
Idempotent by design (upsert-by-key, no-op-if-unchanged), so it's safe to
call on every page load that needs current state. `reconcileHomeIntelligence()`
is the multi-room merge point the home page (and War Room, and Secret
Weapon) actually calls — `lib/homeIntelligence.js` stays the pure per-room
signal layer underneath it.

### My CHEW War Room (`/dashboard/lab/war-room`) and Your Credit Secret Weapon (`/dashboard/lab/credit/secret-weapon`)

Built now, using only verified existing data — per the directive, "the
containers themselves do not [need more data]." War Room aggregates
Mission / Current Position / Plan Status / Next Best Move / CHEW Noticed /
Active Barriers / What CHEW Is Watching / Completed & Pending Moves /
Evidence (placeholder until the Evidence Vault ships) / Plan Changes, from
the same reconciled intelligence shown elsewhere — a different, command-
center lens on real data, not a new data source. Secret Weapon
(`lib/secretWeapon.js`, pure) synthesizes Your Target / What Matters Most /
What Doesn't Matter Right Now / Your Strongest Advantage / Your Biggest
Constraint / a 3-move sequence / What Could Knock You Off Track / What CHEW
Will Watch / What Unlocks Next. Both degrade honestly to "not enough logged
yet" for a client with no Credit activity, and both get more sophisticated
automatically as CHEW knows more — no separate "upgrade" needed.

### Ask CHEW, upgraded toward a dispatcher

Ask CHEW's router (`lib/askChew.js`) now carries an optional `dispatch` tag
per intent, and the one currently wired end-to-end is the score/target
intent: "I want a 750" is parsed (`parseScoreTarget()`) and, if the client's
Credit access is independently verified, actually sets the score goal
server-side (`app/api/home/ask/route.js`) — Ask CHEW activates a system
instead of only linking to it. This is the pattern every other intent grows
into over time, not a claim that it's done for all of them yet.

### Deferred from the master intelligence directive

Still genuinely deferred, none of it faked: a full Decision Lab
(what-if modeling), Counterfactual/Pre-Mortem engines, an Evidence Vault, a
true personal economic Digital Twin, email/push/SMS notification delivery,
and Opportunity/Blind-Spot radar beyond Credit's grounded signals.
Extending the Intelligence Core to a second room (Credit Builder is the
natural next candidate — it already has a real build sequence in
`lib/rooms.js`'s feature list) is next in line, now that the shared
architecture exists to extend rather than copy. Decision Lab and a real
Digital Twin need a broader financial-profile data model (income, debts,
assets) that doesn't exist yet and deserve their own scoping pass, since
giving confident directives on investment/property/business decisions is a
materially different scope than Credit's FCRA-bounded dispute education.

## What's real right now

- Sign up / sign in / sign out — fully working, real Clerk accounts
- `/dashboard` — protected; visiting it while signed out redirects to sign-in
  automatically (this is the middleware doing its job)
- Client status model (Applicant/Accepted/Paid) — stored in Postgres,
  mirrored to Clerk, gates The Lab and its rooms server-side (see above)
- CHEW: The Lab — glass-and-gold room picker hub (`/dashboard/lab`) with
  seven rooms; Credit is fully real (guardrail framework, Report
  Walkthrough, Self-Flagging Tool, the full Letters generator across all
  four escalation stages, the Dispute Tracker, the Score Path Engine, and
  the Secret Weapon synthesis — all backed by Postgres). The other six
  rooms are honest "coming to your Lab" placeholders with specific, real
  feature teasers. The first-visit guided tour is real and persisted (see
  above), and correctly distinguishes "just finished the tour" from a true
  return visit. A returning visitor's hub now opens with Ask CHEW, recent
  in-app notifications, and a real, reconciled Plan Status / Next Best Move
  (with a "why did CHEW tell me that" explainer) / Active Barriers / What
  Changed / CHEW Noticed block, all driven by the client's own Credit room
  activity through the CHEW Intelligence Core (see above) — the room-access
  ring below it is still real, computed progress, not a fabricated "goal."
  My CHEW War Room (`/dashboard/lab/war-room`) gives the same reconciled
  state a command-center view, with recommendation history ("Plan
  Changes").
- Brand styling — matches joinchew.com's colors and fonts already

## Admin → Network — adding a company doesn't require editing code

The Capability Graph (previous phase: `providers`, `capabilities`,
`capability_providers`, `provider_handoffs` — all real, all unreachable
by any client because nothing is seeded) now has a real internal tool
behind it instead of requiring a migration + hand-written seed row per
company.

- **`app/dashboard/admin/layout.js`** gates the entire `/dashboard/admin/*`
  tree to internal staff (`isInternalUser()` — Clerk
  `publicMetadata.chewInternal === true`, same trust model as
  `clientStatus`). A signed-in client who isn't staff gets Next's plain
  404, not an "admins only" page — the admin surface's existence isn't
  something a normal customer needs to know about. Every API route under
  `/api/admin/network/*` independently re-checks the same gate — the page
  gate and the API gate are two separate checks, not one shared assumption.
- **`app/dashboard/admin/network`** (`NetworkAdmin.js`) is the real tool:
  add a capability, add a provider/entity (with every field
  `isReadyForRouting()` requires — jurisdiction, licensing note, intake
  process, disclosure text, data-sharing notes, escalation process), flip
  a provider's status as its readiness checklist fills in, and link a
  provider to a capability (active/inactive, eligibility notes,
  prerequisites, documents needed). The pairings table shows whether each
  link would actually pass `matchCapability()`'s gates right now — the
  same read the client-facing matching function would do, visible to
  whoever's deciding when to activate something.
- **`lib/providers.js` gained `updateProvider()`** — a real partial update
  (COALESCE per field), so filling in one more readiness field at a time
  doesn't require re-sending the whole row.
- **`lib/capabilityGraph.js` gained `upsertCapabilityProviderPair()`** and
  **`listCapabilityProviderPairs()`** — the linking write path and the
  admin-facing read (which, unlike `matchCapability()`, is allowed to see
  every internal field, since this view is staff-only).
- **`provider_handoffs` widened** toward the fuller Universal Handoff
  Protocol shape: `need_type`, `reason`, `urgency`, and — closing the loop
  precisely — `origin_event_id`/`outcome_event_id` linking a handoff to
  the exact `chew_events` rows that surfaced the need and later recorded
  the result, so a future recommendation recalculation can trace back to
  *which* handoff caused a change, not just that something happened.

Still true from the previous phase and unchanged by this one: zero
providers are seeded, `NETWORK_ROUTING_LIVE` is still `false`, and nothing
in Ask CHEW, notifications, or recommendations queries this graph. Admin
tooling existing doesn't change what's exposed to a client — it changes
how a founder gets a real company into the system without asking for a
code change.

## Evidence Vault v1 — client-owned recordkeeping, not file storage

Deliberately scoped: this app has no blob-storage integration (S3, Vercel
Blob, or similar) and none is wired up here — that needs the founder to
choose a provider and supply real credentials, which is out of scope for
this pass (see "Requires external integration" below). What's real instead
is a structured **log**: category, title, notes, the date it pertains to,
and an optional link to a Dispute Tracker entry — genuinely useful
recordkeeping ("what do I have and where"), not a placeholder pretending
to hold files.

- `evidence_records` table + `lib/evidenceVault.js` — full CRUD, owner-
  scoped in the SQL itself (not just checked earlier in the call chain,
  same discipline as `deleteUnattestedItem`).
- Logging a record writes a `document_logged` chew_event — it shows up in
  "What Changed" the same as any other Credit room activity, and the
  Intelligence Core's event stream (not a separate, uncounted action).
- Registered in the feature registry as `credit_evidence_vault`,
  `status='live'` (it's real) — both API routes independently re-check
  this via `getFeatureAccess()`, not just the Credit room's own status
  gate, matching every other route added this phase.
- UI (`/dashboard/lab/credit/evidence`) says plainly, in the client-facing
  copy itself, that this isn't a file upload — no ambiguity about what the
  feature actually does.

## Universal feature-status system — "hidden UI is not security"

Every room and named capability now has one row in the `features` table
(`lib/features.js`), and every page/route behind a non-`live` feature calls
`getFeatureAccess(featureKey)` itself, server-side, before rendering or
mutating anything — no middleware wildcard, no CSS-only hiding, no trusting
a frontend flag. Statuses: `internal` (Clerk `publicMetadata.chewInternal`
staff only), `preview` (same), `locked` (nobody, no exceptions — not even
staff; use `preview` for internal testing instead), `beta` (an explicit
`beta_cohort` allowlist of clerk_user_ids), `live` (production). A feature
key with no registry row fails closed.

- **`lib/rooms.js`'s old `built: true/false` flag is gone.** It was a
  second, driftable source of truth alongside the new registry; the Lab
  hub, Ask CHEW, and each room's own placeholder now all resolve "is this
  actually released" from the same `features` table via
  `roomFeatureKey(slug)` — one source of truth, not two that could
  disagree.
- **The 6 not-yet-built rooms** (Credit Builder, Business, Funding,
  Financial Intelligence, Money Systems, Referral Hub) render
  `LockedFeatureCard` — a premium "Coming to CHEW" presentation with no
  `<button>`, no `<Link>`, no click target at all (never an ugly disabled
  button, and never a real affordance pretending to work). Copy status
  label ("Coming Soon" / "In Development") comes from the registry, not a
  hardcoded string.
- **Ask CHEW re-verifies room status server-side on every call**
  (`app/api/home/ask/route.js`), independent of its own keyword match —
  routing to a locked room never happens, and the response uses the
  directive's sanctioned elegant copy (`lib/featureCopy.js`) rather than
  naming what's specifically missing.
- **War Room and Secret Weapon** — built and shipped as real, live
  features in the prior phase — are now registered in the same table
  (`war_room`, `credit_secret_weapon`, both `status='live'`) and their
  pages independently call `getFeatureAccess()` too, so a future status
  change in the database takes effect immediately with no code change.
- **The Capability Graph** (network/provider routing, previous phase) is
  registered as `capability_graph`, `status='internal'` — consistent
  documentation, no behavior change; it was already unreachable by
  construction.
- Verified by direct execution against `evaluateFeatureAccess()` (the pure
  decision function `getFeatureAccess()` wraps): live/locked/beta/internal/
  preview all behave correctly, including that `locked` denies internal
  staff too, a missing registry row fails closed, an unrecognized status
  string fails closed, and `chewInternal: "true"` (string, not boolean)
  correctly does **not** grant internal access — a real type-confusion bug
  class this test specifically ruled out.
- `isReadyToGoLive()` / `releaseGateStatus()` turn the directive's Release
  Gate checklist (Product/Design/Engineering/Data/Compliance/Support/
  Analytics) into a real read of each feature's `readiness_gates` — for
  whoever decides a feature is ready to flip to `live`, never used to grant
  access itself.

`npm run compliance:check` and `npx next build` both pass clean.

## CHEW Capability Graph — built ahead, not exposed ahead

Per the network/affiliation directive: CHEW is meant to eventually route a
client to specialized help it doesn't perform itself — an affiliated
company, an independent licensed professional, an external provider —
without ever collapsing those distinct businesses into "CHEW," and without
ever hiding a material affiliation either. Since **zero real providers
exist yet**, the only honest thing to build right now is the real backend
architecture, fully working and tested, with **nothing wired into any
surface a client can reach.**

- **`capabilities` / `providers` / `capability_providers` / `provider_handoffs`
  tables** (`lib/capabilities.js`, `lib/providers.js`, `lib/capabilityGraph.js`,
  `lib/providerHandoff.js`) — real database models and real matching/consent/
  handoff logic, per the directive's "prepare: database models; provider
  records; routing logic; ... intake schemas; handoff architecture."
- **`isReadyForRouting()`** (`lib/providers.js`) turns the directive's
  provider-readiness checklist (status, jurisdiction, licensing, contact/
  routing method, intake process, disclosure language, data-sharing notes,
  escalation process) into an actual gate every field must pass — not a
  policy document. `disclosure_text` is never auto-generated from a
  classification template; a provider can't reach 'ready' without a human
  (the founder, with counsel where warranted) having written real
  disclosure copy for that specific relationship.
- **`shapeForClient()`** (`lib/capabilityGraph.js`) is the one place "do not
  expose internal classifications unnecessarily to the customer" is
  enforced in code — a client-facing match result never carries
  `classification`, `contactMethod`, or `licensingNote`, only the curated
  `disclosure` field plus what's needed to act (intake process,
  prerequisites, documents). Verified by direct execution, including that a
  provider missing even one readiness field (or one with a whitespace-only
  disclosure) is correctly excluded.
- **`provider_handoffs`** implements the closed loop
  (detect → explain → prepare → route → execute → outcome → CHEW
  recalculates) as real status transitions: a handoff cannot reach
  `handed_off` without `consented_at` being set first, and `consented_at`
  is only ever set by a call that states exactly which fields were
  disclosed — the directive's "show what will be shared; allow consent;
  log the consent." An outcome logs a `provider_outcome_received` event
  into the same universal event log the Credit room's Intelligence Core
  already reads (see above), so a future recommendation can react to a
  provider's result the same way it reacts to a Credit room event today.
- **`lib/networkRouting.js`** is the explicit gate: `NETWORK_ROUTING_LIVE =
  false`. Nothing in Ask CHEW, notifications, recommendations, or
  navigation checks the Capability Graph while it's false — this isn't a
  UI-level hide, the graph is simply never queried from any client-facing
  code path yet. `getExpansionNotice()` holds the directive's sanctioned
  generic, non-specific expansion copy ("CHEW is expanding the network of
  services available through the platform"), ready to place — deliberately
  **not wired into the Lab hub in this pass**, since the hub's existing
  room gallery already communicates expansion honestly (five real "coming
  to your Lab" tiles), and a vague added line would be filler rather than
  useful, an actual product-design call for the founder rather than
  something to guess at.

Turning this on for real, later: seed a real `capabilities` row, seed a
real `providers` row with founder-authored (and counsel-reviewed, where the
relationship warrants it) disclosure/licensing/data-sharing text, mark it
`ready`, link it via `capability_providers` with `is_active = true`, and
only then flip `NETWORK_ROUTING_LIVE` and wire one real intent into Ask
CHEW pointing at `matchCapability()`. Nothing about that sequence requires
touching this phase's code again.

## What's next (not built yet, on purpose)

Appointments, Documents, Dispute Tracking, and AI Guidance are shown as
labeled "Coming Soon" cards on the dashboard — intentionally, so nothing
appears to work before it actually does. See `CHEW_MASTER_CONTEXT.md` in the
main website repo for the phased plan for each of these.
