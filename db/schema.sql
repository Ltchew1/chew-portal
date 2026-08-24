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
