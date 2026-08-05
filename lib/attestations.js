// lib/attestations.js
//
// The attestation gate's actual enforcement — not just UI. Two rules live
// here, in code, backed by the database, not just in copy:
//
//   1. recordAttestation() only accepts the exact canonical statement text
//      for the item's reason (ATTESTATION_STATEMENTS). A client can't
//      attest to different wording than what they were actually shown,
//      and the `attestations` table has a UNIQUE constraint on
//      dispute_item_id — the database itself refuses a second attestation
//      on the same item, not just the application code.
//
//   2. assertItemsAttested() is the hard stop. Layer 4c's letter generator
//      MUST call this before generating anything, and it throws if even
//      one requested item lacks a persisted attestation row. "No
//      attestation = no generation" is enforced against the database on
//      every call, not against client-side state that a request could
//      spoof.

import { query, withTransaction } from './db';
import { getOwnedDisputeItem } from './disputeItems';
import { ATTESTATION_STATEMENTS } from './creditRoomCompliance';

export class AttestationError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

export async function recordAttestation({ clerkUserId, disputeItemId, statementText }) {
  const item = await getOwnedDisputeItem(clerkUserId, disputeItemId);
  if (!item) {
    throw new AttestationError('Dispute item not found for this account.', 'NOT_FOUND');
  }

  const expectedStatement = ATTESTATION_STATEMENTS[item.reason];
  if (statementText !== expectedStatement) {
    throw new AttestationError(
      'Attestation text does not match the required statement for this item.',
      'STATEMENT_MISMATCH'
    );
  }

  return withTransaction(async (client) => {
    const existing = await client.query(
      'SELECT id FROM attestations WHERE dispute_item_id = $1',
      [disputeItemId]
    );
    if (existing.rows.length > 0) {
      throw new AttestationError('This item has already been attested.', 'ALREADY_ATTESTED');
    }

    const userRow = await client.query('SELECT user_id FROM dispute_items WHERE id = $1', [disputeItemId]);
    const userId = userRow.rows[0].user_id;

    const { rows } = await client.query(
      `INSERT INTO attestations (user_id, dispute_item_id, statement_text)
       VALUES ($1, $2, $3)
       RETURNING id, dispute_item_id, statement_text, attested_at`,
      [userId, disputeItemId, statementText]
    );

    await client.query(
      `UPDATE dispute_items SET status = 'attested', updated_at = now() WHERE id = $1`,
      [disputeItemId]
    );

    return rows[0];
  });
}

// The hard gate a letter-generation route calls before generating anything
// for these items. Throws AttestationError('MISSING_ATTESTATIONS') naming
// which item ids lack a persisted attestation row, and
// AttestationError('NOT_FOUND') if any id doesn't belong to this user.
export async function assertItemsAttested(clerkUserId, disputeItemIds) {
  const { rows } = await query(
    `SELECT di.id, (a.id IS NOT NULL) AS attested
     FROM dispute_items di
     JOIN users u ON u.id = di.user_id
     LEFT JOIN attestations a ON a.dispute_item_id = di.id
     WHERE u.clerk_user_id = $1 AND di.id = ANY($2::bigint[])`,
    [clerkUserId, disputeItemIds]
  );

  const foundIds = new Set(rows.map((r) => r.id));
  const missingOwnership = disputeItemIds.filter((id) => !foundIds.has(id));
  const missingAttestation = rows.filter((r) => !r.attested).map((r) => r.id);

  if (missingOwnership.length > 0) {
    throw new AttestationError(
      `Item(s) not found for this account: ${missingOwnership.join(', ')}`,
      'NOT_FOUND'
    );
  }
  if (missingAttestation.length > 0) {
    throw new AttestationError(
      `Cannot generate a letter — these items have not been attested: ${missingAttestation.join(', ')}`,
      'MISSING_ATTESTATIONS'
    );
  }
}
