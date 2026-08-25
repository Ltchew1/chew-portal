// lib/evidenceVault.js
//
// Evidence Vault v1 — client-owned recordkeeping, deliberately scoped to
// metadata rather than file storage (see db/schema.sql's comment on
// `evidence_records`: no blob-storage provider is wired into this app,
// and none should be faked). What this gives a client today: a
// structured log of what evidence they have, where it pertains to
// (a Dispute Tracker entry, a goal), and when — genuinely useful
// recordkeeping, not a placeholder pretending to be a file vault.

import { query } from './db';
import { getUserIdByClerkId } from './users';
import { logEvent } from './events';

const CATEGORIES = [
  'credit_report', 'screenshot', 'mailing_receipt', 'certified_mail', 'response', 'statement',
  'contract', 'license', 'business_document', 'school_document', 'certification',
  'financial_document', 'client_note', 'other',
];

export { CATEGORIES };

export async function createEvidenceRecord({ clerkUserId, category, title, description, occurredDate, relatedTrackerEntryId, relatedGoalId }) {
  if (!CATEGORIES.includes(category)) {
    throw new Error(`category must be one of: ${CATEGORIES.join(', ')}`);
  }
  const userId = await getUserIdByClerkId(clerkUserId);
  if (!userId) throw new Error('No account found for this user.');

  const { rows } = await query(
    `INSERT INTO evidence_records (user_id, category, title, description, occurred_date, related_tracker_entry_id, related_goal_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, category, title, description, occurred_date AS "occurredDate", storage_status AS "storageStatus",
               related_tracker_entry_id AS "relatedTrackerEntryId", related_goal_id AS "relatedGoalId",
               created_at AS "createdAt"`,
    [userId, category, title, description ?? null, occurredDate ?? null, relatedTrackerEntryId ?? null, relatedGoalId ?? null]
  );
  const record = rows[0];

  await logEvent({
    userId, room: 'credit', eventType: 'document_logged', subject: title,
    severity: 'info', metadata: { evidenceRecordId: record.id, category },
  });

  return record;
}

export async function listEvidenceForUser(clerkUserId) {
  const { rows } = await query(
    `SELECT er.id, er.category, er.title, er.description, er.occurred_date AS "occurredDate",
            er.storage_status AS "storageStatus", er.related_tracker_entry_id AS "relatedTrackerEntryId",
            er.related_goal_id AS "relatedGoalId", er.created_at AS "createdAt"
     FROM evidence_records er
     JOIN users u ON u.id = er.user_id
     WHERE u.clerk_user_id = $1
     ORDER BY er.created_at DESC`,
    [clerkUserId]
  );
  return rows;
}

export async function listEvidenceForTrackerEntry(clerkUserId, trackerEntryId) {
  const { rows } = await query(
    `SELECT er.id, er.category, er.title, er.description, er.occurred_date AS "occurredDate", er.created_at AS "createdAt"
     FROM evidence_records er
     JOIN users u ON u.id = er.user_id
     WHERE u.clerk_user_id = $1 AND er.related_tracker_entry_id = $2
     ORDER BY er.created_at DESC`,
    [clerkUserId, trackerEntryId]
  );
  return rows;
}

// Owner-scoped in the WHERE clause itself, same discipline as
// deleteUnattestedItem — a record can't be deleted by anyone but the
// client who logged it, enforced against the database, not just checked
// earlier in the call chain.
export async function deleteEvidenceRecord(clerkUserId, evidenceId) {
  const { rowCount } = await query(
    `DELETE FROM evidence_records
     WHERE id = $1 AND user_id = (SELECT id FROM users WHERE clerk_user_id = $2)`,
    [evidenceId, clerkUserId]
  );
  return rowCount > 0;
}
