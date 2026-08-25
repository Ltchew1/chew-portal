// lib/disputeItems.js
//
// Dispute items the CLIENT flags from their own credit report. The system
// never creates, classifies, or pre-selects one of these — every field
// here is client-authored input. `reason` is a value the client actively
// picks (see ATTESTATION_STATEMENTS in lib/creditRoomCompliance.js); there
// is no system-suggested reason, no "AI thinks this looks disputable"
// field, and the DB schema has nowhere to put one even if code tried
// (db/schema.sql's CHECK constraint only allows the client's own two
// categories: not_mine, not_authorized).

import { query } from './db';
import { ensureUserRow } from './users';
import { logEvent } from './events';

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
  const item = rows[0];
  await logEvent({
    userId, room: 'credit', eventType: 'item_flagged',
    subject: `${item.creditor_name} (${item.bureau})`,
    newState: { reason, bureau },
    severity: 'info',
  });
  return item;
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

// Fetches full item details for letter composition — filtered to items
// this user actually owns, never trusting the id list alone (mirrors the
// same discipline as getOwnedDisputeItem). Called only after
// assertItemsAttested() has already confirmed every id is both owned and
// attested; this is the data fetch, not the gate.
export async function getItemsForLetter(clerkUserId, disputeItemIds) {
  const { rows } = await query(
    `SELECT di.id, di.bureau, di.creditor_name AS "creditorName",
            di.account_number AS "accountNumber", di.reason
     FROM dispute_items di
     JOIN users u ON u.id = di.user_id
     WHERE u.clerk_user_id = $1 AND di.id = ANY($2::bigint[])
     ORDER BY di.created_at ASC`,
    [clerkUserId, disputeItemIds]
  );
  return rows;
}

// Lets a client remove a mistake before it becomes part of the permanent
// record — but only while it's still unattested. The WHERE clause is the
// actual boundary: an attested item never matches status = 'flagged', so
// this can't delete one no matter what calls it. Returns whether a row was
// actually deleted (false = not found, not owned, or already attested).
export async function deleteUnattestedItem(clerkUserId, disputeItemId) {
  const { rowCount } = await query(
    `DELETE FROM dispute_items
     WHERE id = $1
       AND status = 'flagged'
       AND user_id = (SELECT id FROM users WHERE clerk_user_id = $2)`,
    [disputeItemId, clerkUserId]
  );
  return rowCount > 0;
}
