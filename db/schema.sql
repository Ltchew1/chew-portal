-- db/schema.sql
--
-- CHEW Portal persistence layer. Plain SQL, no ORM.
--
-- Run this against DATABASE_URL_UNPOOLED (Neon's direct/unpooled connection
-- string) — see README's "Database setup" section for the exact command.
-- Safe to re-run: every statement is idempotent (CREATE ... IF NOT EXISTS).
--
-- Design notes:
--   - `client_status` is append-only (one row per status change, not a
--     single mutable column). The current status is "the latest row for
--     this user" — this doubles as a full audit trail of who changed a
--     client's access level and when, which matters once status gates a
--     paid feature.
--   - `attestations` is the legal record that the CLIENT — not CHEW —
--     decided an item looks unrecognized/unauthorized. It is written once
--     per dispute item and is never edited or deleted by the app.
--   - Nothing in this schema models sending, filing, or transmitting a
--     dispute. `generated_letters` and `dispute_tracker_entries` record
--     what the CLIENT generated/downloaded and what the CLIENT later
--     reports back — there is no "sent_at" or bureau-delivery concept.

-- One row per Clerk-authenticated person. Everything else hangs off this.
CREATE TABLE IF NOT EXISTS users (
  id             BIGSERIAL PRIMARY KEY,
  clerk_user_id  TEXT NOT NULL UNIQUE,
  email          TEXT,
  first_name     TEXT,
  last_name      TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Added post-Layer-1: whether this client has completed the first-visit
-- guided tour at /dashboard/lab (see lib/tour.js). ADD COLUMN IF NOT
-- EXISTS keeps this file safe to re-run like everything above it.
ALTER TABLE users ADD COLUMN IF NOT EXISTS has_completed_tour BOOLEAN NOT NULL DEFAULT false;

-- Added for the letter generator: the client's own return address, used
-- as the return-address block on every letter they generate. Captured
-- once (see lib/users.js's getMailingAddress/updateMailingAddress), never
-- required until the client actually generates their first letter.
ALTER TABLE users ADD COLUMN IF NOT EXISTS mailing_address_line1 TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mailing_address_line2 TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mailing_city TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mailing_state TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mailing_postal_code TEXT;

-- Append-only status history. Current status for a user = the row with the
-- latest created_at (see lib/clientStatus.js). Never UPDATE or DELETE rows
-- here — insert a new one to change status, so the history stays intact.
CREATE TABLE IF NOT EXISTS client_status (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT NOT NULL REFERENCES users(id),
  status       TEXT NOT NULL CHECK (status IN ('applicant', 'accepted', 'paid')),
  set_by       TEXT NOT NULL, -- clerk_user_id of the admin who set it, or 'system'
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_status_user_id ON client_status(user_id, created_at DESC);

-- An item the CLIENT has flagged from their own credit report as something
-- they don't recognize or didn't authorize. CHEW/the app never inserts a
-- row here on the client's behalf and never sets a suggested/default value
-- for `reason`.
CREATE TABLE IF NOT EXISTS dispute_items (
  id              BIGSERIAL PRIMARY KEY,
  user_id         BIGINT NOT NULL REFERENCES users(id),
  bureau          TEXT NOT NULL CHECK (bureau IN ('equifax', 'experian', 'transunion')),
  creditor_name   TEXT NOT NULL,
  account_number  TEXT, -- client-entered, may be partial/masked as shown on their report
  reason          TEXT NOT NULL CHECK (reason IN ('not_mine', 'not_authorized')),
  client_notes    TEXT, -- free text the client wrote in their own words
  status          TEXT NOT NULL DEFAULT 'flagged' CHECK (status IN ('flagged', 'attested', 'letter_generated', 'archived')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dispute_items_user_id ON dispute_items(user_id);

-- Widened for the letter generator's secondary-bureau coverage (LexisNexis,
-- Innovis — see lib/creditAddresses.js). DROP + re-ADD is idempotent: an
-- unnamed column-level CHECK gets Postgres's default name
-- (<table>_<column>_check), so this produces the same end state every run.
ALTER TABLE dispute_items DROP CONSTRAINT IF EXISTS dispute_items_bureau_check;
ALTER TABLE dispute_items ADD CONSTRAINT dispute_items_bureau_check
  CHECK (bureau IN ('equifax', 'experian', 'transunion', 'lexisnexis', 'innovis'));

-- The legal record: the client's own attestation on one dispute item.
-- One attestation per item (UNIQUE on dispute_item_id) — it is written once
-- and stands as the record of client decision-making, not re-editable.
CREATE TABLE IF NOT EXISTS attestations (
  id                BIGSERIAL PRIMARY KEY,
  user_id           BIGINT NOT NULL REFERENCES users(id),
  dispute_item_id   BIGINT NOT NULL UNIQUE REFERENCES dispute_items(id),
  statement_text    TEXT NOT NULL, -- exact wording the client checked/attested to
  attested_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attestations_user_id ON attestations(user_id);

-- A letter the client generated and downloaded. `content` is stored so the
-- client can re-download later; there is no field anywhere for a bureau
-- delivery address/method/status because the app never transmits it.
CREATE TABLE IF NOT EXISTS generated_letters (
  id               BIGSERIAL PRIMARY KEY,
  user_id          BIGINT NOT NULL REFERENCES users(id),
  bureau           TEXT CHECK (bureau IN ('equifax', 'experian', 'transunion', 'lexisnexis', 'innovis')),
  content           TEXT NOT NULL,
  generated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  downloaded_at    TIMESTAMPTZ -- set the first time the client actually downloads it
);

CREATE INDEX IF NOT EXISTS idx_generated_letters_user_id ON generated_letters(user_id);

-- Widened for the full escalation ladder (see lib/letterContent.js):
-- Stage 1 bureau, Stage 2 furnisher, Stage 3 secondary bureau, Stage 4
-- CFPB/FTC. `bureau` above stays set only for bureau/secondary_bureau
-- letters (hence nullable now); recipient_name/address are the actual
-- mailing target for every stage, including furnishers, who have no
-- universal address — the client's own item supplies it.
ALTER TABLE generated_letters ALTER COLUMN bureau DROP NOT NULL;
ALTER TABLE generated_letters ADD COLUMN IF NOT EXISTS stage SMALLINT NOT NULL DEFAULT 1 CHECK (stage BETWEEN 1 AND 4);
ALTER TABLE generated_letters ADD COLUMN IF NOT EXISTS recipient_type TEXT NOT NULL DEFAULT 'bureau'
  CHECK (recipient_type IN ('bureau', 'furnisher', 'secondary_bureau', 'cfpb', 'ftc'));
ALTER TABLE generated_letters ADD COLUMN IF NOT EXISTS recipient_name TEXT;
ALTER TABLE generated_letters ADD COLUMN IF NOT EXISTS recipient_address TEXT;
ALTER TABLE generated_letters ADD COLUMN IF NOT EXISTS fcra_citation TEXT;
-- Client-reported account of what happened with the prior stage, used only
-- for Stage 3/4 letters (e.g. "no response after 30 days") — captured once
-- at generation time so the complaint/escalation can cite the specific
-- prior failure, per the constitution. Not a tracker; just this letter's
-- own record of why it exists.
ALTER TABLE generated_letters ADD COLUMN IF NOT EXISTS escalation_notes TEXT;
-- Letter Quality Supremacy pass: the same content composeDisputeLetter/
-- composeEscalationNarrative always produced, now also captured as
-- structured sections (sender/recipient blocks, subject, salutation,
-- opening, itemized entries, legal paragraph, closing, signature) instead
-- of only a flat string — this is what lib/letterPdf.js lays out with
-- real typographic hierarchy. `content` (the flat string) is kept
-- unchanged as the plain-text record/on-screen preview; this column is
-- additive, nullable, and only ever populated at generation time — never
-- backfilled or edited after the fact, same immutability rule as content.
ALTER TABLE generated_letters ADD COLUMN IF NOT EXISTS structured_content JSONB;

-- Which dispute items a given letter covers (a letter can bundle multiple
-- items to the same bureau).
CREATE TABLE IF NOT EXISTS generated_letter_items (
  letter_id        BIGINT NOT NULL REFERENCES generated_letters(id),
  dispute_item_id  BIGINT NOT NULL REFERENCES dispute_items(id),
  PRIMARY KEY (letter_id, dispute_item_id)
);

-- Client-reported tracker entries: the client tells the portal what they
-- did and what happened, for their own timeline/reminders. Nothing here is
-- read by, or written to, a bureau.
CREATE TABLE IF NOT EXISTS dispute_tracker_entries (
  id               BIGSERIAL PRIMARY KEY,
  user_id          BIGINT NOT NULL REFERENCES users(id),
  dispute_item_id  BIGINT REFERENCES dispute_items(id),
  letter_id        BIGINT REFERENCES generated_letters(id),
  bureau           TEXT NOT NULL CHECK (bureau IN ('equifax', 'experian', 'transunion', 'lexisnexis', 'innovis')),
  mailed_date      DATE, -- client-entered: when THEY say they mailed it
  status           TEXT NOT NULL DEFAULT 'preparing' CHECK (
                     status IN ('preparing', 'mailed', 'awaiting_response', 'response_received', 'resolved')
                   ),
  response_type    TEXT CHECK (response_type IN ('verified', 'updated', 'deleted', 'no_response')),
  response_date    DATE,
  client_notes     TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dispute_tracker_user_id ON dispute_tracker_entries(user_id);

-- Same widening as dispute_items, in case this table was already created
-- (by an earlier run of this file) before secondary bureaus existed.
ALTER TABLE dispute_tracker_entries DROP CONSTRAINT IF EXISTS dispute_tracker_entries_bureau_check;
ALTER TABLE dispute_tracker_entries ADD CONSTRAINT dispute_tracker_entries_bureau_check
  CHECK (bureau IN ('equifax', 'experian', 'transunion', 'lexisnexis', 'innovis'));

-- Widened for the tracker UI (built after the escalation ladder existed):
-- a tracked letter can go to a furnisher, the CFPB, or the FTC, none of
-- which have a "bureau" — bureau alone can no longer be the required
-- field. recipient_type/recipient_name mirror generated_letters so a
-- tracker entry can describe any stage; bureau stays for entries that
-- really are one, and is left NULL otherwise.
ALTER TABLE dispute_tracker_entries ALTER COLUMN bureau DROP NOT NULL;
ALTER TABLE dispute_tracker_entries ADD COLUMN IF NOT EXISTS recipient_type TEXT NOT NULL DEFAULT 'bureau'
  CHECK (recipient_type IN ('bureau', 'furnisher', 'secondary_bureau', 'cfpb', 'ftc'));
ALTER TABLE dispute_tracker_entries ADD COLUMN IF NOT EXISTS recipient_name TEXT;

-- One tracker entry per generated letter — "start tracking" creates it
-- once; re-clicking on an already-tracked letter should not be able to
-- fork a second timeline for the same physical letter. Partial index
-- (not a table constraint) so it only applies where letter_id is set.
CREATE UNIQUE INDEX IF NOT EXISTS idx_dispute_tracker_letter_id
  ON dispute_tracker_entries(letter_id) WHERE letter_id IS NOT NULL;

-- ============================================================================
-- Shared intelligence foundations (CHEW: The Lab home — "Goal Graph" and
-- "Score Path Engine"). Deliberately room-agnostic: `goals.room` is the only
-- thing that scopes a row to Credit today, so a future room (Funding,
-- Business, ...) can reuse the same table rather than growing its own copy.
-- Same discipline as everything above: every value here is something the
-- CLIENT told CHEW, not something CHEW pulled from a bureau, lender, or any
-- third party. See lib/goals.js, lib/creditScore.js, lib/homeIntelligence.js.
-- ============================================================================

CREATE TABLE IF NOT EXISTS goals (
  id            BIGSERIAL PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES users(id),
  room          TEXT NOT NULL CHECK (room IN ('credit', 'credit-builder', 'business', 'funding', 'intelligence', 'money-systems')),
  goal_type     TEXT NOT NULL, -- e.g. 'credit_score' — the only type in use today
  target_value  TEXT NOT NULL, -- kept as text: a goal's shape varies by type (a score, a dollar amount, ...)
  target_date   DATE,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'achieved', 'abandoned')),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);

-- One active goal per (user, room, goal_type) — setting a new target score
-- replaces the old one rather than accumulating parallel "active" goals the
-- UI would have to disambiguate.
CREATE UNIQUE INDEX IF NOT EXISTS idx_goals_active_unique
  ON goals(user_id, room, goal_type) WHERE status = 'active';

-- Client self-reported score readings — CHEW has no bureau connection and
-- never will inside this compliance boundary (see the Credit room's
-- no-transmission lock); this is the client telling CHEW what they saw on
-- their own pulled report or a score-monitoring app, purely so the Score
-- Path Engine has a "current position" to measure a goal against.
CREATE TABLE IF NOT EXISTS credit_score_snapshots (
  id             BIGSERIAL PRIMARY KEY,
  user_id        BIGINT NOT NULL REFERENCES users(id),
  bureau         TEXT CHECK (bureau IN ('equifax', 'experian', 'transunion', 'overall')),
  score          SMALLINT NOT NULL CHECK (score BETWEEN 300 AND 900),
  reported_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  source_note    TEXT, -- optional, client's own words (e.g. "from my bank's app")
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CHEW's first universal fact/provenance vocabulary (see lib/factProvenance.js)
-- applied to its first real fact: the score value itself. Nullable and never
-- backfilled — an existing row recorded before this column existed has no
-- trustworthy provenance to claim, so it stays NULL (lib/factProvenance.js
-- reads a NULL/unrecognized value as 'unknown', never guesses). Every row
-- inserted through lib/creditScore.js's recordScoreSnapshot() from this point
-- forward sets it to 'member_provided' — the only way a score reaches this
-- table today; see that file's own comment.
ALTER TABLE credit_score_snapshots ADD COLUMN IF NOT EXISTS source_type TEXT;
ALTER TABLE credit_score_snapshots DROP CONSTRAINT IF EXISTS credit_score_snapshots_source_type_check;
ALTER TABLE credit_score_snapshots ADD CONSTRAINT credit_score_snapshots_source_type_check
  CHECK (source_type IS NULL OR source_type IN (
    'member_provided', 'document_provided', 'reviewed_with_chew',
    'connected_source', 'chew_derived', 'external_response', 'unknown'
  ));

CREATE INDEX IF NOT EXISTS idx_credit_score_snapshots_user_id ON credit_score_snapshots(user_id);

-- ============================================================================
-- CHEW Intelligence Core v1 — the "one brain" consolidation. Every room's
-- signals engine (see lib/homeIntelligence.js) reads and writes through
-- these five tables instead of re-deriving its own ad-hoc state, so a
-- second room (Credit Builder, Business, ...) plugs into the same
-- architecture rather than growing a parallel one. See lib/events.js,
-- lib/barriers.js, lib/opportunities.js, lib/recommendations.js,
-- lib/notifications.js, lib/intelligenceCore.js.
--
-- Common language: Person -> Goal -> Current State -> Signals -> Barriers /
-- Opportunities -> Actions (Recommendations) -> Events -> Outcomes.
-- ============================================================================

-- The universal event log. Every meaningful thing the client does anywhere
-- in the portal is logged here, at the source of truth (inside the same
-- write path/transaction as the action itself) — this replaces ad-hoc
-- "diff two timestamps" logic for "What Changed" with a real, append-only
-- record. Nothing here is system-inferred activity; source is 'client'
-- for everything a person did, reserved 'system' for CHEW's own derived
-- events (e.g. "a barrier was auto-resolved").
CREATE TABLE IF NOT EXISTS chew_events (
  id               BIGSERIAL PRIMARY KEY,
  user_id          BIGINT NOT NULL REFERENCES users(id),
  room             TEXT NOT NULL,
  event_type       TEXT NOT NULL, -- e.g. 'item_flagged', 'letter_generated', 'score_logged'
  subject          TEXT NOT NULL, -- plain-English: "Letter to Experian", "706 (overall)"
  occurred_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  source           TEXT NOT NULL DEFAULT 'client' CHECK (source IN ('client', 'system')),
  previous_state   JSONB,
  new_state        JSONB,
  severity         TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'watch', 'action_needed', 'risk', 'positive')),
  requires_action  BOOLEAN NOT NULL DEFAULT false,
  related_goal_id  BIGINT REFERENCES goals(id),
  metadata         JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chew_events_user_id ON chew_events(user_id, occurred_at DESC);

-- Persistent barriers — "something is interfering with a goal" as a real,
-- trackable row instead of text a function recomputes and throws away each
-- page load. `source_key` is a stable fingerprint (e.g.
-- 'stalled_response:<tracker_entry_id>') so the reconciler in
-- lib/intelligenceCore.js can upsert idempotently: re-detecting the same
-- underlying condition never creates a duplicate row, and when the
-- condition clears, that exact row is the one marked resolved — which is
-- what makes "You fixed it" possible.
CREATE TABLE IF NOT EXISTS barriers (
  id                BIGSERIAL PRIMARY KEY,
  user_id           BIGINT NOT NULL REFERENCES users(id),
  room              TEXT NOT NULL,
  related_goal_id   BIGINT REFERENCES goals(id),
  source_key        TEXT NOT NULL, -- fingerprint of the underlying condition
  title             TEXT NOT NULL,
  what_happened     TEXT NOT NULL,
  what_it_hurts     TEXT NOT NULL,
  why               TEXT NOT NULL,
  severity          TEXT NOT NULL CHECK (severity IN ('watch', 'action_needed', 'risk')),
  do_this_now       TEXT NOT NULL,
  do_not_do         TEXT,
  what_success_looks_like TEXT NOT NULL,
  recheck_trigger   TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved')),
  detected_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at       TIMESTAMPTZ,
  resolution_note   TEXT
);

CREATE INDEX IF NOT EXISTS idx_barriers_user_id ON barriers(user_id);
-- One active barrier per (user, source_key) — re-detecting the same
-- condition on the next page load updates the existing row, never forks a
-- second one. A resolved barrier's key is free to be reused by a later,
-- unrelated recurrence of the same condition type.
CREATE UNIQUE INDEX IF NOT EXISTS idx_barriers_active_source_key
  ON barriers(user_id, source_key) WHERE status = 'active';

-- Opportunities — the same architecture, opposite direction: upside CHEW
-- noticed, tracked symmetrically with barriers rather than as disposable
-- text.
CREATE TABLE IF NOT EXISTS opportunities (
  id                BIGSERIAL PRIMARY KEY,
  user_id           BIGINT NOT NULL REFERENCES users(id),
  room              TEXT NOT NULL,
  related_goal_id   BIGINT REFERENCES goals(id),
  source_key        TEXT NOT NULL,
  title             TEXT NOT NULL,
  what_improved     TEXT NOT NULL,
  why_it_matters    TEXT NOT NULL,
  what_it_unlocked  TEXT,
  suggested_action  TEXT NOT NULL,
  confidence        TEXT NOT NULL DEFAULT 'medium' CHECK (confidence IN ('low', 'medium', 'high')),
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_opportunities_user_id ON opportunities(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_opportunities_active_source_key
  ON opportunities(user_id, source_key) WHERE status = 'active';

-- Opportunity history snapshots — Economic Weather's historical layer.
-- Each row is a point-in-time capture of a room's canonical, persisted
-- active opportunity IDs (opportunities.id, the same identity Radar, Life
-- Map, and opportunity_unlocked events already use — never a title or a
-- count). `active_ids`/`newly_unlocked_ids` are canonicalized (deduped,
-- numerically sorted, comma-joined) before being stored so that database
-- row order or reconciliation-pass array order can never fake a state
-- change. A new row is only ever inserted when the canonical active_ids
-- set actually differs from the most recent one for (user_id, room) — see
-- lib/economicWeather.js's recordOpportunitySnapshotIfChanged, the same
-- read-then-compare-then-skip discipline as barriers/opportunities/
-- recommendations. `newly_unlocked_ids` is a transition marker for the
-- exact pass it was captured on (which opportunity IDs were brand new,
-- per the same isNew signal transitions.js uses for opportunity_unlocked
-- events) — never a permanent status on the opportunity itself.
CREATE TABLE IF NOT EXISTS opportunity_history_snapshots (
  id                    BIGSERIAL PRIMARY KEY,
  user_id               BIGINT NOT NULL REFERENCES users(id),
  room                  TEXT NOT NULL,
  active_ids            TEXT NOT NULL DEFAULT '',
  newly_unlocked_ids    TEXT NOT NULL DEFAULT '',
  active_count          INT NOT NULL DEFAULT 0,
  captured_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opportunity_history_snapshots_lookup
  ON opportunity_history_snapshots(user_id, room, captured_at DESC);

-- Barrier history snapshots — Friction History's historical layer, the
-- same architecture as opportunity_history_snapshots above (see that
-- table's comment for the canonicalization/dedup reasoning, identical
-- here) applied to barriers.id instead of opportunities.id. A barrier
-- with no counterpart "streak" column on purpose — how many consecutive
-- snapshots a given barrier ID has survived is derived by walking these
-- rows backwards (see lib/frictionHistory.js's computePersistenceStreaks),
-- never a separately stored counter that could drift from the real rows
-- it's summarizing. `newly_detected_ids` mirrors newly_unlocked_ids's
-- one-shot-per-transition role, named for barrier vocabulary.
CREATE TABLE IF NOT EXISTS barrier_history_snapshots (
  id                    BIGSERIAL PRIMARY KEY,
  user_id               BIGINT NOT NULL REFERENCES users(id),
  room                  TEXT NOT NULL,
  active_ids            TEXT NOT NULL DEFAULT '',
  newly_detected_ids    TEXT NOT NULL DEFAULT '',
  active_count          INT NOT NULL DEFAULT 0,
  captured_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_barrier_history_snapshots_lookup
  ON barrier_history_snapshots(user_id, room, captured_at DESC);

-- Recommendation history — every Next Best Move CHEW has shown is kept,
-- not overwritten, so a client can inspect "why did CHEW tell me that" and
-- see it change over time. `observed` is the plain-English list of what
-- CHEW was looking at when it produced this recommendation;
-- `what_would_change_this` is the honest list of what would make CHEW
-- recompute. Only one recommendation is active per (user, room) at a time —
-- setting a new one supersedes the last.
CREATE TABLE IF NOT EXISTS recommendations (
  id                       BIGSERIAL PRIMARY KEY,
  user_id                  BIGINT NOT NULL REFERENCES users(id),
  room                     TEXT NOT NULL,
  related_goal_id          BIGINT REFERENCES goals(id),
  action_text              TEXT NOT NULL,
  reason                   TEXT NOT NULL,
  observed                 JSONB NOT NULL DEFAULT '[]',
  what_would_change_this   JSONB NOT NULL DEFAULT '[]',
  href                     TEXT,
  status                   TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'superseded')),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  superseded_at            TIMESTAMPTZ,
  superseded_reason        TEXT
);

CREATE INDEX IF NOT EXISTS idx_recommendations_user_id ON recommendations(user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_recommendations_active_room
  ON recommendations(user_id, room) WHERE status = 'active';

-- In-app notifications — architected now per the intelligence directive
-- ("architect notification channels now, even if only in-app"). email/push/
-- sms delivery is a later, separately-authorized integration; this table is
-- the channel-agnostic event feed those would eventually read from.
CREATE TABLE IF NOT EXISTS notifications (
  id               BIGSERIAL PRIMARY KEY,
  user_id          BIGINT NOT NULL REFERENCES users(id),
  room             TEXT NOT NULL,
  type             TEXT NOT NULL CHECK (type IN (
                     'critical_action', 'plan_at_risk', 'opportunity_found', 'back_on_track',
                     'milestone', 'chew_noticed', 'reassessment_complete'
                   )),
  title            TEXT NOT NULL,
  body             TEXT NOT NULL,
  href             TEXT,
  related_event_id BIGINT REFERENCES chew_events(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id, created_at DESC);

-- ============================================================================
-- CHEW Capability Graph — "who can solve what, for whom, where, and when."
-- Prepared per the network/affiliation directive: real database models,
-- real matching/consent/handoff logic (see lib/capabilities.js,
-- lib/providers.js, lib/capabilityGraph.js, lib/providerHandoff.js), with
-- ZERO rows seeded and nothing wired into any user-facing surface yet.
-- "Build ahead. Do not expose ahead." — the founder adds real providers and
-- flips them to 'ready' only when a real, disclosed, licensed relationship
-- actually exists; until then every query against this graph correctly
-- returns nothing, by construction, not by a UI-level hack.
-- ============================================================================

-- A need CHEW can recognize (e.g. 'insurance_review', 'website_build') —
-- distinct from a provider: a capability can exist with zero ready
-- providers behind it, which is the honest default state for all of them
-- today.
CREATE TABLE IF NOT EXISTS capabilities (
  id           BIGSERIAL PRIMARY KEY,
  key          TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  description  TEXT NOT NULL,
  category     TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per execution provider. `classification` is the internal
-- relationship taxonomy from the directive — never exposed to the client
-- directly (see lib/providers.js's classification->public-disclosure
-- mapping); `disclosure_text` is the ONLY client-facing affiliation copy,
-- and it is deliberately never auto-generated from a template — a human
-- (the founder, with counsel where warranted) must write it before a
-- provider can ever be marked 'ready'. See lib/providers.js's
-- isReadyForRouting() for the full checklist this table exists to enforce.
CREATE TABLE IF NOT EXISTS providers (
  id                  BIGSERIAL PRIMARY KEY,
  name                TEXT NOT NULL,
  classification      TEXT NOT NULL CHECK (classification IN (
                        'chew_direct', 'affiliated_enterprise', 'independent_professional',
                        'external_provider', 'future_managed_service'
                      )),
  service_status      TEXT NOT NULL DEFAULT 'draft' CHECK (service_status IN ('draft', 'ready', 'paused', 'retired')),
  jurisdiction         TEXT,
  licensing_note       TEXT, -- required content before 'ready' (see isReadyForRouting) — e.g. "N/A, no license required"
  contact_method       TEXT, -- internal routing detail, not directly rendered to a client in v1
  intake_process       TEXT,
  disclosure_text      TEXT, -- founder-authored; the only affiliation copy ever shown to a client
  data_sharing_notes   TEXT,
  escalation_process   TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Which providers can serve which capabilities, and the specifics of that
-- pairing (a provider might be ready for one capability and not another).
CREATE TABLE IF NOT EXISTS capability_providers (
  id                    BIGSERIAL PRIMARY KEY,
  capability_id         BIGINT NOT NULL REFERENCES capabilities(id),
  provider_id           BIGINT NOT NULL REFERENCES providers(id),
  is_active             BOOLEAN NOT NULL DEFAULT false, -- a second gate on top of providers.service_status
  eligibility_notes     TEXT,
  client_profile_fit    TEXT,
  prerequisite_steps    JSONB NOT NULL DEFAULT '[]',
  documents_needed      JSONB NOT NULL DEFAULT '[]',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_capability_providers_pair ON capability_providers(capability_id, provider_id);
CREATE INDEX IF NOT EXISTS idx_capability_providers_capability ON capability_providers(capability_id);

-- The closed-loop handoff record — CHEW never sends client data to a
-- provider without an explicit, logged consent step first (see
-- lib/providerHandoff.js). `fields_disclosed` is exactly what the client
-- was shown and agreed to before `consented_at` is set; nothing can
-- transition to 'handed_off' without it.
CREATE TABLE IF NOT EXISTS provider_handoffs (
  id                 BIGSERIAL PRIMARY KEY,
  user_id            BIGINT NOT NULL REFERENCES users(id),
  capability_id      BIGINT NOT NULL REFERENCES capabilities(id),
  provider_id        BIGINT NOT NULL REFERENCES providers(id),
  related_goal_id    BIGINT REFERENCES goals(id),
  status             TEXT NOT NULL DEFAULT 'consent_pending' CHECK (status IN (
                        'consent_pending', 'consent_given', 'handed_off', 'outcome_received', 'declined'
                      )),
  fields_disclosed   JSONB NOT NULL DEFAULT '[]', -- exactly what was shown to the client pre-consent
  consented_at       TIMESTAMPTZ,
  handed_off_at      TIMESTAMPTZ,
  outcome_note       TEXT,
  outcome_received_at TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provider_handoffs_user_id ON provider_handoffs(user_id);

-- Widened toward the Universal Handoff Protocol's fuller shape: why this
-- handoff exists (need_type/reason), how urgent (urgency), and links back
-- into the universal event log at both ends — the event that surfaced the
-- need, and the event an outcome creates when it lands — so a handoff is
-- traceable in the same timeline as everything else a client did, not a
-- side channel.
ALTER TABLE provider_handoffs ADD COLUMN IF NOT EXISTS need_type TEXT;
ALTER TABLE provider_handoffs ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE provider_handoffs ADD COLUMN IF NOT EXISTS urgency TEXT CHECK (urgency IN ('low', 'normal', 'high'));
ALTER TABLE provider_handoffs ADD COLUMN IF NOT EXISTS origin_event_id BIGINT REFERENCES chew_events(id);
ALTER TABLE provider_handoffs ADD COLUMN IF NOT EXISTS outcome_event_id BIGINT REFERENCES chew_events(id);

-- ============================================================================
-- Universal feature-status registry — "hidden UI is not security." Every
-- room and named capability in the portal (built or not) gets one row here,
-- and lib/features.js's getFeatureAccess() is the one server-side gate
-- every page/route for a non-'live' feature must call before rendering or
-- mutating anything. See db/schema.sql's seed block below for today's real
-- statuses — this table is the actual source of truth the UI reads from,
-- not documentation describing a separate convention.
-- ============================================================================

CREATE TABLE IF NOT EXISTS features (
  id                   BIGSERIAL PRIMARY KEY,
  feature_key          TEXT NOT NULL UNIQUE,
  name                 TEXT NOT NULL,
  room                 TEXT,
  description          TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'locked' CHECK (status IN ('internal', 'preview', 'locked', 'beta', 'live')),
  visibility           TEXT NOT NULL DEFAULT 'hidden' CHECK (visibility IN ('hidden', 'teaser', 'visible')),
  allowed_roles        JSONB NOT NULL DEFAULT '[]',
  beta_cohort          JSONB NOT NULL DEFAULT '[]', -- clerk_user_ids explicitly approved for a 'beta' feature
  route                TEXT,
  api_namespace        TEXT,
  launch_requirements  TEXT,
  compliance_status    TEXT,
  readiness_gates      JSONB NOT NULL DEFAULT '{}', -- {product,design,engineering,data,compliance,support,analytics: bool}
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seeded here, not via an admin UI that doesn't exist — these rows describe
-- THIS codebase's own rooms/capabilities, so they belong in the migration
-- that ships them, same as everything else in this file. Idempotent
-- (INSERT ... ON CONFLICT), safe to re-run.
INSERT INTO features (feature_key, name, room, description, status, visibility, route, readiness_gates) VALUES
  ('room_credit', 'Credit', 'credit', 'Report education, self-flagging, letters, tracker, and score path.', 'live', 'visible', '/dashboard/lab/credit', '{"product":true,"design":true,"engineering":true,"data":true,"compliance":true,"support":true,"analytics":false}'),
  ('war_room', 'My CHEW War Room', NULL, 'Cross-room command-center view of reconciled Intelligence Core state.', 'live', 'visible', '/dashboard/lab/war-room', '{"product":true,"design":true,"engineering":true,"data":true,"compliance":true,"support":false,"analytics":false}'),
  ('credit_secret_weapon', 'Your Credit Secret Weapon', 'credit', 'Strategic synthesis view of the Credit room''s reconciled intelligence.', 'live', 'visible', '/dashboard/lab/credit/secret-weapon', '{"product":true,"design":true,"engineering":true,"data":true,"compliance":true,"support":false,"analytics":false}'),
  ('capability_graph', 'CHEW Capability Graph', NULL, 'Network routing to affiliated/external providers. No providers seeded yet.', 'internal', 'hidden', NULL, '{"product":false,"design":false,"engineering":true,"data":false,"compliance":false,"support":false,"analytics":false}'),
  ('credit_evidence_vault', 'Evidence Vault', 'credit', 'Client-owned recordkeeping — what evidence you have and where it pertains to. Metadata only, no file storage.', 'live', 'visible', '/dashboard/lab/credit/evidence', '{"product":true,"design":true,"engineering":true,"data":true,"compliance":true,"support":false,"analytics":false}'),
  ('room_credit_builder', 'Credit Builder', 'credit-builder', 'Tradeline strategy, secured cards, rent reporting, AU strategy.', 'locked', 'teaser', '/dashboard/lab/credit-builder', '{}'),
  ('room_business', 'Business', 'business', 'Entity formation, EIN/Sunbiz filings, operating agreements, business credit stack.', 'locked', 'teaser', '/dashboard/lab/business', '{}'),
  ('room_funding', 'Funding', 'funding', 'Funding readiness, lender criteria, lines of credit, grants.', 'locked', 'teaser', '/dashboard/lab/funding', '{}'),
  ('room_intelligence', 'Financial Intelligence', 'intelligence', 'Business survival data, licensing guides, financial literacy library.', 'locked', 'teaser', '/dashboard/lab/intelligence', '{}'),
  ('room_money_systems', 'Money Systems', 'money-systems', 'Cash flow, budgeting, banking access, habit building, tracking tools.', 'locked', 'teaser', '/dashboard/lab/money-systems', '{}'),
  ('room_referral', 'Referral Hub', 'referral', 'Invite your circle, track referral status.', 'locked', 'teaser', '/dashboard/lab/referral', '{}')
ON CONFLICT (feature_key) DO UPDATE SET
  name = EXCLUDED.name, room = EXCLUDED.room, description = EXCLUDED.description, route = EXCLUDED.route;
-- Deliberately does NOT overwrite status/visibility/readiness_gates on
-- conflict — this file re-runs on every deploy, and a status the founder
-- changed by hand (e.g. flipping a room to 'preview' for internal testing)
-- must never get silently reverted back to its seed default by the next
-- deploy. Only the descriptive metadata stays migration-controlled.

CREATE INDEX IF NOT EXISTS idx_features_room ON features(room);

-- ============================================================================
-- Evidence Vault v1 — client-owned recordkeeping (see lib/evidenceVault.js).
-- Deliberately scoped to METADATA, not file storage: this app has no blob-
-- storage integration (S3/Vercel Blob/etc.) and none should be wired up
-- without the founder choosing a provider and supplying real credentials —
-- see README's "Requires external integration" note. `storage_status`
-- stays 'logged_only' for every row today; a real upload feature adds
-- alongside this schema later, once that integration exists, rather than
-- faking file storage that doesn't.
-- ============================================================================

CREATE TABLE IF NOT EXISTS evidence_records (
  id                      BIGSERIAL PRIMARY KEY,
  user_id                 BIGINT NOT NULL REFERENCES users(id),
  category                TEXT NOT NULL CHECK (category IN (
                            'credit_report', 'screenshot', 'mailing_receipt', 'certified_mail',
                            'response', 'statement', 'contract', 'license', 'business_document',
                            'school_document', 'certification', 'financial_document', 'client_note', 'other'
                          )),
  title                   TEXT NOT NULL,
  description             TEXT,
  occurred_date           DATE, -- when the evidence pertains to (e.g. the mailing date), not when logged
  storage_status          TEXT NOT NULL DEFAULT 'logged_only' CHECK (storage_status IN ('logged_only', 'stored_externally')),
  related_tracker_entry_id BIGINT REFERENCES dispute_tracker_entries(id),
  related_goal_id         BIGINT REFERENCES goals(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evidence_records_user_id ON evidence_records(user_id);
CREATE INDEX IF NOT EXISTS idx_evidence_records_tracker_entry ON evidence_records(related_tracker_entry_id);

-- ============================================================================
-- Provider qualification lifecycle + outcome/consent depth — see
-- CAPABILITY_NETWORK.md for the full model. Renames the old cosmetic
-- draft/ready/paused/retired status into a real, audited lifecycle with
-- entry criteria at each stage; every transition is logged, not just
-- overwritten. Still true: zero providers seeded in production, and
-- NETWORK_ROUTING_LIVE (lib/networkRouting.js) still gates everything —
-- this migration changes what a "ready" provider actually has to prove,
-- not whether any client can reach one.
-- ============================================================================

-- Idempotent rename: only fires the first time this runs against a given
-- database (a second run finds no `service_status` column left to rename).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'providers' AND column_name = 'service_status') THEN
    ALTER TABLE providers RENAME COLUMN service_status TO lifecycle_status;
  END IF;
END $$;

ALTER TABLE providers DROP CONSTRAINT IF EXISTS providers_service_status_check;
ALTER TABLE providers DROP CONSTRAINT IF EXISTS providers_lifecycle_status_check;
ALTER TABLE providers ADD CONSTRAINT providers_lifecycle_status_check
  CHECK (lifecycle_status IN ('discovered', 'under_review', 'verified', 'approved', 'pilot', 'live', 'suspended', 'retired'));
ALTER TABLE providers ALTER COLUMN lifecycle_status SET DEFAULT 'discovered';

-- The qualification checklist itself, as real columns a routing gate can
-- actually check — not implied by a single status flag. identity_verified/
-- service_verified/licensing_verified default to unverified; nothing
-- reaches 'approved' honestly without a human having actually set these.
ALTER TABLE providers ADD COLUMN IF NOT EXISTS official_website TEXT;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS service_geography TEXT;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS capacity_status TEXT CHECK (capacity_status IN ('available', 'limited', 'unavailable'));
ALTER TABLE providers ADD COLUMN IF NOT EXISTS expected_response_time TEXT;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS pricing_model TEXT;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS contract_status TEXT;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS outcome_reporting_capability TEXT;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS last_verified_at DATE;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS next_review_at DATE;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS internal_owner TEXT;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS evidence_notes TEXT;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS identity_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS service_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS licensing_verified TEXT NOT NULL DEFAULT 'pending'
  CHECK (licensing_verified IN ('verified', 'not_applicable', 'pending'));

-- Every lifecycle transition, audited — "not cosmetic labels." Whoever
-- (or whatever) moved a provider from one stage to the next, and why, is
-- reconstructable later without guessing.
CREATE TABLE IF NOT EXISTS provider_lifecycle_events (
  id           BIGSERIAL PRIMARY KEY,
  provider_id  BIGINT NOT NULL REFERENCES providers(id),
  from_status  TEXT,
  to_status    TEXT NOT NULL,
  note         TEXT,
  changed_by   TEXT, -- clerk_user_id of the admin who made the change, or 'system'
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provider_lifecycle_events_provider ON provider_lifecycle_events(provider_id);

-- Handoff depth: consent versioning/revocation, a real outcome taxonomy
-- instead of complete/failed, and an explicit simulated-transmission flag
-- so a test proof (or any handoff to a provider CHEW has no live
-- transmission channel to yet) is labeled as such in the data itself, not
-- just in a comment.
ALTER TABLE provider_handoffs ADD COLUMN IF NOT EXISTS consent_version TEXT;
ALTER TABLE provider_handoffs ADD COLUMN IF NOT EXISTS consent_revoked_at TIMESTAMPTZ;
ALTER TABLE provider_handoffs ADD COLUMN IF NOT EXISTS consent_recipient_name TEXT; -- snapshot at consent time
ALTER TABLE provider_handoffs ADD COLUMN IF NOT EXISTS is_simulated_transmission BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE provider_handoffs ADD COLUMN IF NOT EXISTS outcome_requires_followup BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE provider_handoffs ADD COLUMN IF NOT EXISTS outcome_source TEXT;
ALTER TABLE provider_handoffs ADD COLUMN IF NOT EXISTS outcome_metadata JSONB NOT NULL DEFAULT '{}';
ALTER TABLE provider_handoffs ADD COLUMN IF NOT EXISTS outcome_classification TEXT CHECK (outcome_classification IN (
  'successful', 'partially_successful', 'user_not_eligible', 'provider_declined', 'user_abandoned',
  'user_no_response', 'provider_no_response', 'wrong_match', 'missing_documentation',
  'provider_capacity_issue', 'escalated', 'cancelled', 'problem_complaint', 'outcome_unknown'
));

ALTER TABLE provider_handoffs DROP CONSTRAINT IF EXISTS provider_handoffs_status_check;
ALTER TABLE provider_handoffs ADD CONSTRAINT provider_handoffs_status_check
  CHECK (status IN ('consent_pending', 'consent_given', 'handed_off', 'outcome_received', 'declined', 'cancelled'));
