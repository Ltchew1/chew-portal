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
  bureau           TEXT NOT NULL CHECK (bureau IN ('equifax', 'experian', 'transunion')),
  content           TEXT NOT NULL,
  generated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  downloaded_at    TIMESTAMPTZ -- set the first time the client actually downloads it
);

CREATE INDEX IF NOT EXISTS idx_generated_letters_user_id ON generated_letters(user_id);

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
  bureau           TEXT NOT NULL CHECK (bureau IN ('equifax', 'experian', 'transunion')),
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
