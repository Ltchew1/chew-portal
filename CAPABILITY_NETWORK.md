# CHEW Capability Network — Architecture & Status

This document describes the internal system behind "CHEW connects a client
to a real provider for a real need": providers, capabilities, pairings,
handoffs, outcomes, and the audit trail that ties them together. It is
current as of the Network Proof & Provider Qualification pass.

**Activation status: `NETWORK_ROUTING_LIVE = false` (see `lib/networkRouting.js`).**
Nothing in Ask CHEW, recommendations, notifications, or navigation reads
from the Capability Graph while this flag is off. There are **zero
production providers** seeded. Everything described below is real,
working backend code, verified end-to-end against a real database — but
it is not reachable from any client-facing surface yet, and flipping the
flag is a separate, deliberate decision from building the plumbing.

## Why this exists

CHEW frequently identifies a real need (a GED, a licensing question, a
dispute that needs specialist help) that CHEW itself cannot resolve. The
Capability Network is the internal machinery for: registering what a
provider can actually do and for whom, qualifying that provider against a
real standard (not a status flag someone flipped), matching a need to a
qualified provider, capturing explicit consent before anything is shared,
recording what happened, and making every step of that chain inspectable
later without guessing.

## Provider lifecycle

`lib/providers.js` — `LIFECYCLE_STATES`, `LIFECYCLE_TRANSITIONS`,
`canTransitionLifecycle()`, `transitionProviderLifecycle()`.

```
discovered ──▶ under_review ──▶ verified ──▶ approved ──▶ pilot ──▶ live
                    │               │            │          │        │
                    ▼               ▼            ▼          ▼        ▼
               discovered       under_review   verified   suspended  suspended,
                                                                      retired
suspended ──▶ pilot | live | retired
retired  (terminal — no transitions out)
```

Only `pilot` and `live` are ever routable (`ROUTABLE_LIFECYCLE_STATES` in
`lib/providers.js`). `retired` is terminal on purpose: re-onboarding a
retired provider is treated as a new decision, not a resume.

**`transitionProviderLifecycle()` is the only code path that can ever
change a provider's `lifecycle_status`.** `updateProvider()` (the
qualification-field editor) explicitly cannot touch it. Every transition:

- runs inside a transaction with `SELECT ... FOR UPDATE` (row-locked
  against concurrent transitions),
- is validated against `LIFECYCLE_TRANSITIONS` — an invalid move throws,
  naming the actual valid next states,
- writes a permanent row to `provider_lifecycle_events`
  (`from_status`, `to_status`, `note`, `changed_by`, `created_at`) in the
  same transaction as the status change, so the two can never drift apart.

## Provider qualification standard

A provider is not "vetted" because a checkbox somewhere says so. Two
functions in `lib/providers.js` implement the actual standard from the
directive, and every routing/matching function defers to them — a
provider is never selectable just because a row exists for it:

- **`isReadyForRouting(provider)`** — boolean gate. Requires: lifecycle
  state in `{pilot, live}`; `identityVerified` and `serviceVerified` both
  `true`; `licensingVerified` not `'pending'`; every one of jurisdiction,
  service geography, official website, licensing note, contact method,
  intake process, disclosure text, data-sharing notes, and escalation
  process present as non-empty text; capacity status not `'unavailable'`;
  and `nextReviewAt` not in the past.
- **`explainRoutingReadiness(provider)`** — the same standard, but
  returns *every* failing reason at once (`{ ready, reasons[] }`), not a
  boolean and not just the first failure. This is what Admin → Network
  renders so "why can't this pairing route right now" is a direct read,
  not a guess. Reason strings map to the directive's required categories:
  provider not approved / provider paused / provider retired, identity
  not verified, service not verified, missing licensing verification,
  jurisdiction/geography not documented, missing official source, missing
  handoff method, missing disclosure/data-sharing/escalation language,
  capacity unavailable, required verification expired.

`disclosure_text` is never auto-generated. A provider with empty
`disclosure_text` can never pass either gate — affiliation, compensation,
and licensing disclosure language is written by a human for that specific
relationship, not templated.

### Qualification fields (`providers` table)

Identity/status: `name`, `classification`, `lifecycle_status`.
Verification: `identity_verified`, `service_verified`, `licensing_verified`
(`pending` / `verified` / `not_required`), `last_verified_at`,
`next_review_at`, `internal_owner`, `evidence_notes`.
Service definition: `jurisdiction`, `service_geography`, `licensing_note`,
`official_website`, `capacity_status`, `expected_response_time`,
`pricing_model`.
Operational: `contact_method`, `intake_process`, `contract_status`,
`outcome_reporting_capability`.
Client-facing: `disclosure_text`, `data_sharing_notes`,
`escalation_process` — the only fields ever shown to a client, via
`shapeForClient()` in `lib/capabilityGraph.js`, which strips
`classification`, contact details, and internal notes before anything
reaches a client-facing shape.

## Matching gate

`lib/capabilityGraph.js` — `matchCapability(capabilityKey)` is the one
path a client-facing surface would ever call. It returns a provider only
if **both** gates pass: `capability_providers.is_active` for that specific
pairing, **and** `isReadyForRouting()` for the provider. A provider can be
ready for one capability and not another — readiness lives on the pairing
row (`capability_providers`), not just the provider.

`listCapabilityProviderPairs()` is the admin-facing version: for every
pairing it returns `readyToRoute`, `blockReasons` (from
`explainRoutingReadiness`, plus `'Pairing not marked active for this
capability'` when relevant), and a separate `blockedByGlobalSwitch` flag —
kept separate from `blockReasons` on purpose, because "routing is off
network-wide" is a fact about the whole system, not a gap in this specific
pairing. A pairing that is otherwise fully ready still reads as ready.

## Consent

`lib/providerHandoff.js` — `recordConsent()`, `revokeConsent()`.

- `recordConsent()` requires `consentVersion` — the exact version string
  of the consent language the client agreed to — and throws if it's
  missing. There is no path to consenting without stating which version
  of the language was shown.
- Consent is stored as `consented_at` (timestamp), `consent_version`,
  `consent_revoked_at` (nullable), and `consent_recipient_name` (who would
  receive the shared fields, captured at handoff creation from the
  matched provider).
- `fields_disclosed` (JSONB array) on the handoff row is required and
  non-empty at handoff creation — "no silent data-sharing assumptions."
  What will be shared must be named explicitly before a handoff can exist
  at all, independent of when consent is later given.
- `revokeConsent()` only succeeds while the handoff hasn't already been
  handed off (`status != 'handed_off'`) and consent hasn't already been
  revoked — the WHERE clause itself is the enforcement, not an
  application-level check layered on top.
- `markHandedOff()`'s WHERE clause requires
  `consented_at IS NOT NULL AND consent_revoked_at IS NULL` — a handoff
  cannot be marked handed off without valid, unrevoked consent, enforced
  at the query level, not just by call-order convention.

## Handoff lifecycle

Status values on `provider_handoffs`: `consent_pending → consent_given →
handed_off → outcome_received`, with `cancelled` as an explicit exit.

`is_simulated_transmission` (boolean) labels the one honest gap in the
current proof: CHEW does not yet have a live transmission channel to any
real external provider. When a handoff is marked handed off with
`simulated: true`, that is recorded on the row itself and named in the
`handoff_acknowledged` event's subject line — not hidden, not implied to
be a real transmission. The capability and provider records themselves
are still real and independently verifiable; only the transmission step
is a stand-in until a real channel exists.

## Outcome taxonomy

`OUTCOME_CLASSIFICATIONS` in `lib/providerHandoff.js` — 14 values, not
just complete/failed: `successful`, `partially_successful`,
`user_not_eligible`, `provider_declined`, `user_abandoned`,
`user_no_response`, `provider_no_response`, `wrong_match`,
`missing_documentation`, `provider_capacity_issue`, `escalated`,
`cancelled`, `problem_complaint`, `outcome_unknown`.

`recordOutcome()` requires a valid classification, stores `outcome_note`,
`outcome_source`, `outcome_metadata` (JSONB, structured), and
`outcome_requires_followup` (boolean — defaults from
`FOLLOWUP_DEFAULT_TRUE`, a fixed set of classifications that inherently
need a next step, but can be overridden explicitly by the caller). The
resulting `chew_events` row is linked back onto the handoff via
`outcome_event_id`, so the row and its audit event are never disconnected.
If `outcome_requires_followup` is true, a second `followup_required`
event is logged immediately — the loop closes with an explicit next step,
never a silent dead end.

This taxonomy is intentionally granular enough that later analytics
(match success rate, provider response/completion rate, abandonment rate,
time-to-outcome, failure distribution by capability/provider/jurisdiction,
repeated-failure and escalation rates) can be computed directly from
existing columns and events — **that analytics suite is explicitly not
built in this pass**, but nothing in this data model prevents building it
later.

## Audit / event trail

Three things interlock, each answering a different question:

- **`chew_events`** (`lib/events.js`) — the universal "what happened"
  log, one row per material transition, `room = 'network'` for this
  system. Event types added this pass: `need_detected`,
  `capability_matched`, `handoff_initiated`, `handoff_consent_given`,
  `handoff_acknowledged`, `provider_outcome_received`,
  `followup_required`.
- **`provider_lifecycle_events`** — provider-specific audit trail for
  status changes only (`from_status`/`to_status`/`note`/`changed_by`),
  written exclusively by `transitionProviderLifecycle()`.
- **`provider_handoffs`** — the row itself carries enough state
  (`origin_event_id`, `outcome_event_id`, timestamps at every stage) to
  cross-reference back into `chew_events` without reconstructing anything
  from inference.

Given one `handoff_id`, the full chain — need detected, why it matched,
consent language and timestamp, handoff creation, acknowledgment
(simulated or not), outcome and classification, and whether follow-up is
required — is reconstructable by reading these three sources together.
This was verified directly in the end-to-end proof (see below): a
6-event trail was read back and matched the actual sequence of calls,
in order, with no gaps.

`lib/events.js` also exports `listAllEvents({ room, limit })` for the
admin cross-user event trail view — the equivalent of `listAllHandoffs()`
in `lib/providerHandoff.js` for handoffs.

## Admin surface (`/dashboard/admin/network`)

Gated by `getAdminAccess()` — `Clerk publicMetadata.chewInternal === true`,
non-admins get a plain `notFound()` (404), not a "staff only" page.
Deliberately not visually polished this pass — operational clarity over
polish, per the directive.

Renders: provider list with lifecycle-transition buttons (only the moves
`LIFECYCLE_TRANSITIONS` actually allows are shown), a qualification-field
editor per provider, verification checkboxes, capability/provider
pairings with `readyToRoute` / `blockReasons` / `blockedByGlobalSwitch`
per row, the full handoff list across all users
(`listAllHandoffs()`), lifecycle event history per provider
(`listLifecycleEvents()`), and the network event trail
(`listAllEvents({ room: 'network' })`). Every admin API route re-checks
`getAdminAccess()` itself — the admin UI does not hide anything that the
underlying route would still serve to a non-admin caller.

## The network proof

One realistic need was run through the entire chain above, end to end,
against a real (sandbox-local) PostgreSQL 16 database, with
`NETWORK_ROUTING_LIVE = false` throughout and zero effect on production.

- **Capability**: GED Testing Navigation (education-navigation lane —
  the directive's preferred, lowest-risk first capability).
- **Provider**: GED Testing Service (ged.com) — independently confirmed
  via web search as the sole official GED test administrator in the
  U.S./Canada. This is a real, verifiable organization; no data about it
  was fabricated.
- **What was simulated**: only the transmission boundary. CHEW has no
  live handoff channel to GED Testing Service yet, so `markHandedOff()`
  was called with `simulated: true`, which is recorded on the handoff row
  (`is_simulated_transmission`) and named in the event subject line. The
  capability record, the provider record, its qualification fields, the
  matching logic, the consent flow, and the outcome are all real code
  executing real queries — nothing about the *decision-making* was
  simulated, only the final send.
- **Chain executed**: capability + provider created → provider qualified
  (all required fields, both verification flags, licensing verified) →
  moved through 4 real lifecycle transitions with an audited trail
  (`discovered → under_review → verified → approved → pilot`) → paired
  with the capability and marked active → a real user record created → a
  `need_detected` event logged → `matchCapability()` run for real and
  confirmed to return the provider with no internal fields leaked
  (`shapeForClient()` verified directly) → `capability_matched` event →
  `initiateHandoff()` → `recordConsent()` with a versioned consent string
  → `markHandedOff()` (simulated, labeled) → `recordOutcome()` classified
  `successful` → the resulting 6-event trail
  (`need_detected → capability_matched → handoff_initiated →
  handoff_consent_given → handoff_acknowledged → provider_outcome_received`)
  read back and confirmed reconstructable.

### Test result

57 passed, 0 failed. Positive path (the full chain above, including
confirming zero client-visible leakage of internal fields) and negative/
security path both green:

- unauthorized admin access,
- invalid lifecycle transitions (including attempting to move out of the
  terminal `retired` state),
- matching gate correctly excluding an unqualified/incomplete provider,
- `explainRoutingReadiness()` returning multiple simultaneous reasons,
  including a deliberately-expired `next_review_at` surfacing as
  "Required verification expired,"
- handoff rejected for an ineligible provider,
- handoff rejected with no consent,
- handoff rejected after consent was revoked,
- invalid outcome classification rejected,
- data-type confusion: the string `"false"` sent for a verification flag
  does **not** coerce to `true` (this caught a real bug — see below),
- cross-user ownership isolation on both `getOwnedHandoff()` and
  `recordConsent()` — one user cannot read or consent to another user's
  handoff.

### Bugs found and fixed by this proof

All three were boolean-coercion or type-mismatch bugs, found specifically
because the proof deliberately tested data-type confusion against a real
database (not mocks), which exposed that node-postgres returns
`BIGSERIAL`/bigint columns as JS strings:

1. `lib/providers.js` `updateProvider()` — `Boolean(fields.identityVerified)`
   would have treated the string `"false"` as `true` (any non-empty
   string is truthy in JS). Fixed to a strict `typeof === 'boolean'`
   check; anything else is treated as "not provided," never coerced.
2. `app/api/admin/network/pairings/route.js` — identical risk on the
   pairing `isActive` flag. Fixed to `body.isActive === true`.
3. `lib/providerHandoff.js` `initiateHandoff()` — compared a
   Postgres-bigint-as-string `providerId` against a caller-supplied value
   with strict `===`, which would silently reject a genuinely eligible
   match if the caller passed a JS number instead of a string (the exact
   pattern already used in the sibling pairings route). Fixed to a
   string-normalized comparison.

## What remains intentionally disabled

- `NETWORK_ROUTING_LIVE` is `false`. No client-facing surface (Ask CHEW,
  recommendations, notifications, navigation) reads the Capability Graph.
- Zero providers exist in production. The GED Testing Service proof ran
  only against a local, disconnected sandbox database.
- No real transmission channel to any external provider exists yet —
  every future handoff will need `simulated: true` until one is built.
- Not built this pass, per the directive: CHEW Life Map UI, Opportunity
  Ladder UI, Unlock Engine UI, the six locked rooms, a provider
  marketplace, a client-facing provider directory, autonomous provider
  activation, AI-driven provider selection without deterministic gates,
  automated regulated recommendations, and the closed-loop analytics
  suite itself (match/response/abandonment rates etc.) — the data model
  is verified not to prevent building it later, but it isn't built now.

## Known external dependency

Actually reaching GED Testing Service (or any future provider) requires a
real handoff channel — at minimum an agreed intake method (their own
website flow is the only one that exists today) and, if CHEW ever
transmits client-identifying information on a client's behalf, likely a
data-sharing agreement. Until that exists, any live handoff for this
pairing would still need `is_simulated_transmission = true`, honestly
labeled, exactly as it was in this proof.
