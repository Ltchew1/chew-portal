// lib/disputeItems.js
//
// Dispute items the CLIENT flags from their own credit report. The system
// never creates, classifies, or pre-selects one of these — every field
// here is client-authored input. `reason` is a value the client actively
// picks (see ATTESTATION_STATEMENTS in lib/creditLabCompliance.js); there
// is no system-suggested reason, no "AI thinks this looks disputable"
// field, and the DB schema has nowhere to put one even if code tried
// (db/schema.sql's CHECK constraint only allows the client's own two
// categories: not_mine, not_authorized).

import { query } from './db';
import { ensureUserRow } from './users';

export async function createDisputeItem({
  clerkUserId, email, firstName, lastName, bureau, creditorName, accountNumber, reason, clientNotes,
}) {
  const userId = await ensureUserRow({ clerkUserId, email, firstName, lastName });
  const { rows } = await query(
    `INSERT INTO dispute_items (user_id, bureau, creditor_name, account_number, reason, client_notes)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, bureau, creditor_name, account_number, reason, client_notes, status, created_at`,
    [userId, bureau, creditorName, accountNumber ?? null, reason, clientNotes ?? null]
  );
  return rows[0];
}

export async function listDisputeItemsForUser(clerkUserId) {
  const { rows } = await query(
    `SELECT di.id, di.bureau, di.creditor_name, di.account_number, di.reason,
            di.client_notes, di.status, di.created_at,
            a.attested_at
     FROM dispute_items di
     JOIN users u ON u.id = di.user_id
     LEFT JOIN attestations a ON a.dispute_item_id = di.id
     WHERE u.clerk_user_id = $1
     ORDER BY di.created_at DESC`,
    [clerkUserId]
  );
  return rows;
}

// Ownership check used by the attestation route and, later, the letter
// generator — never trust a dispute_item_id from a request body alone.
export async function getOwnedDisputeItem(clerkUserId, disputeItemId) {
  const { rows } = await query(
    `SELECT di.id, di.bureau, di.creditor_name, di.reason, di.status
     FROM dispute_items di
     JOIN users u ON u.id = di.user_id
     WHERE u.clerk_user_id = $1 AND di.id = $2`,
    [clerkUserId, disputeItemId]
  );
  return rows[0] ?? null;
}
