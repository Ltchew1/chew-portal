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
