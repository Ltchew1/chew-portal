// lib/users.js
//
// The one place app code (as opposed to the standalone scripts, which are
// plain CommonJS and can't import this ESM module — see scripts/loadEnv.js)
// upserts a `users` row from a Clerk profile. Every Lab table hangs off
// users.id, not the Clerk user id directly, so this runs before any
// dispute_items/attestations write.

import { query } from './db';

export async function ensureUserRow({ clerkUserId, email, firstName, lastName }) {
  const { rows } = await query(
    `INSERT INTO users (clerk_user_id, email, first_name, last_name)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (clerk_user_id)
     DO UPDATE SET email = EXCLUDED.email, first_name = EXCLUDED.first_name,
                   last_name = EXCLUDED.last_name, updated_at = now()
     RETURNING id`,
    [clerkUserId, email ?? null, firstName ?? null, lastName ?? null]
  );
  return rows[0].id;
}

// Read-only id lookup for call sites that only need the numeric users.id
// and know the row already exists (ownership was already checked
// upstream) — NEVER use ensureUserRow for this: it's an upsert, and
// calling it with only a clerkUserId would overwrite a real stored
// email/name with NULL on every subsequent call.
export async function getUserIdByClerkId(clerkUserId) {
  const { rows } = await query('SELECT id FROM users WHERE clerk_user_id = $1', [clerkUserId]);
  return rows[0]?.id ?? null;
}

// The client's own return address, used as the return-address block on
// every letter they generate (lib/letterContent.js). Read/write pair for
// the Letter Generator's address form.
export async function getMailingAddress(clerkUserId) {
  const { rows } = await query(
    `SELECT first_name AS "firstName", last_name AS "lastName",
            mailing_address_line1 AS "addressLine1", mailing_address_line2 AS "addressLine2",
            mailing_city AS "city", mailing_state AS "state", mailing_postal_code AS "postalCode"
     FROM users WHERE clerk_user_id = $1`,
    [clerkUserId]
  );
  return rows[0] ?? null;
}

export async function updateMailingAddress({ clerkUserId, addressLine1, addressLine2, city, state, postalCode }) {
  await query(
    `UPDATE users
     SET mailing_address_line1 = $2, mailing_address_line2 = $3,
         mailing_city = $4, mailing_state = $5, mailing_postal_code = $6,
         updated_at = now()
     WHERE clerk_user_id = $1`,
    [clerkUserId, addressLine1 || null, addressLine2 || null, city || null, state || null, postalCode || null]
  );
}

export function hasCompleteMailingAddress(address) {
  return Boolean(address?.addressLine1 && address?.city && address?.state && address?.postalCode);
}
