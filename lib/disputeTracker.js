// lib/disputeTracker.js
//
// DB access for the Dispute Tracker. Every entry tracks one already-
// generated letter — there is no path to create a tracker entry without a
// real letter behind it, so recipient_type/recipient_name/bureau are
// copied from generated_letters at creation time rather than re-derived
// or editable later. Everything after that (mailed date, status, what
// happened) is the client's own report of what they did — nothing here is
// read from, or written to, a bureau; see db/schema.sql's table comment.

import { query } from './db';
import { getOwnedLetter } from './letters';
import { getUserIdByClerkId } from './users';
import { logEvent } from './events';

const VALID_STATUSES = ['preparing', 'mailed', 'awaiting_response', 'response_received', 'resolved'];
const VALID_RESPONSE_TYPES = ['verified', 'updated', 'deleted', 'no_response'];

export { VALID_STATUSES, VALID_RESPONSE_TYPES };

// Letters this client has generated but hasn't started tracking yet —
// drives the "start tracking" prompts on the Tracker page.
export async function listUntrackedLetters(clerkUserId) {
  const { rows } = await query(
    `SELECT gl.id, gl.stage, gl.recipient_type AS "recipientType", gl.recipient_name AS "recipientName",
            gl.bureau, gl.generated_at AS "generatedAt"
     FROM generated_letters gl
     JOIN users u ON u.id = gl.user_id
     LEFT JOIN dispute_tracker_entries dte ON dte.letter_id = gl.id
     WHERE u.clerk_user_id = $1 AND dte.id IS NULL
     ORDER BY gl.generated_at DESC`,
    [clerkUserId]
  );
  return rows;
}

export async function listTrackerEntriesForUser(clerkUserId) {
  const { rows } = await query(
    `SELECT dte.id, dte.letter_id AS "letterId", dte.recipient_type AS "recipientType",
            dte.recipient_name AS "recipientName", dte.bureau, dte.mailed_date AS "mailedDate",
            dte.status, dte.response_type AS "responseType", dte.response_date AS "responseDate",
            dte.client_notes AS "clientNotes", dte.created_at AS "createdAt", dte.updated_at AS "updatedAt",
            gl.stage
     FROM dispute_tracker_entries dte
     JOIN users u ON u.id = dte.user_id
     LEFT JOIN generated_letters gl ON gl.id = dte.letter_id
     WHERE u.clerk_user_id = $1
     ORDER BY dte.created_at DESC`,
    [clerkUserId]
  );
  return rows;
}

export async function getOwnedTrackerEntry(clerkUserId, entryId) {
  const { rows } = await query(
    `SELECT dte.id, dte.status
     FROM dispute_tracker_entries dte
     JOIN users u ON u.id = dte.user_id
     WHERE u.clerk_user_id = $1 AND dte.id = $2`,
    [clerkUserId, entryId]
  );
  return rows[0] ?? null;
}

// Starts tracking a letter the client already generated. Ownership of the
// letter is re-checked here (getOwnedLetter), not trusted from the request
// body — same discipline as every other write path in the Credit room.
export async function createTrackerEntryForLetter(clerkUserId, letterId) {
  const letter = await getOwnedLetter(clerkUserId, letterId);
  if (!letter) {
    throw new Error('That letter could not be found on this account.');
  }

  const { rows } = await query(
    `INSERT INTO dispute_tracker_entries
       (user_id, letter_id, bureau, recipient_type, recipient_name, status)
     SELECT u.id, $2, $3, $4, $5, 'preparing'
     FROM users u WHERE u.clerk_user_id = $1
     ON CONFLICT DO NOTHING
     RETURNING id, letter_id AS "letterId", bureau, recipient_type AS "recipientType",
               recipient_name AS "recipientName", status, created_at AS "createdAt"`,
    [clerkUserId, letterId, letter.bureau, letter.recipientType, letter.recipientName]
  );

  if (!rows[0]) {
    throw new Error('This letter is already being tracked.');
  }
  const entry = rows[0];
  const userId = await getUserIdByClerkId(clerkUserId);
  await logEvent({
    userId, room: 'credit', eventType: 'tracking_started',
    subject: entry.recipientName,
    severity: 'info', metadata: { trackerEntryId: entry.id, letterId },
  });
  return entry;
}

// Client-reported update — mailed date, status, and (once a response has
// actually come in) response type/date and notes. Only touches fields that
// were actually passed, so marking "mailed" doesn't require re-sending
// notes the client already wrote.
export async function updateTrackerEntry(clerkUserId, entryId, { status, mailedDate, responseType, responseDate, clientNotes }) {
  const owned = await getOwnedTrackerEntry(clerkUserId, entryId);
  if (!owned) {
    throw new Error('That tracker entry could not be found on this account.');
  }
  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    throw new Error(`status must be one of: ${VALID_STATUSES.join(', ')}`);
  }
  if (responseType !== undefined && responseType !== null && !VALID_RESPONSE_TYPES.includes(responseType)) {
    throw new Error(`responseType must be one of: ${VALID_RESPONSE_TYPES.join(', ')}`);
  }

  const { rows } = await query(
    `UPDATE dispute_tracker_entries dte
     SET status = COALESCE($3, status),
         mailed_date = COALESCE($4, mailed_date),
         response_type = COALESCE($5, response_type),
         response_date = COALESCE($6, response_date),
         client_notes = COALESCE($7, client_notes),
         updated_at = now()
     FROM users u
     WHERE dte.user_id = u.id AND u.clerk_user_id = $1 AND dte.id = $2
     RETURNING dte.id, dte.letter_id AS "letterId", dte.bureau, dte.recipient_type AS "recipientType",
               dte.recipient_name AS "recipientName", dte.mailed_date AS "mailedDate", dte.status,
               dte.response_type AS "responseType", dte.response_date AS "responseDate",
               dte.client_notes AS "clientNotes", dte.updated_at AS "updatedAt"`,
    [clerkUserId, entryId, status ?? null, mailedDate ?? null, responseType ?? null, responseDate ?? null, clientNotes ?? null]
  );
  const entry = rows[0];

  if (status && status !== owned.status) {
    const userId = await getUserIdByClerkId(clerkUserId);
    if (status === 'mailed') {
      await logEvent({
        userId, room: 'credit', eventType: 'letter_mailed',
        subject: entry.recipientName,
        previousState: { status: owned.status }, newState: { status, mailedDate: entry.mailedDate },
        severity: 'info', metadata: { trackerEntryId: entry.id },
      });
    } else if (status === 'response_received') {
      await logEvent({
        userId, room: 'credit', eventType: 'response_logged',
        subject: entry.recipientName,
        previousState: { status: owned.status }, newState: { status, responseType: entry.responseType },
        severity: entry.responseType === 'no_response' ? 'watch' : entry.responseType === 'verified' ? 'watch' : 'positive',
        metadata: { trackerEntryId: entry.id, responseType: entry.responseType },
      });
    } else if (status === 'resolved') {
      await logEvent({
        userId, room: 'credit', eventType: 'dispute_resolved',
        subject: entry.recipientName,
        previousState: { status: owned.status }, newState: { status },
        severity: 'positive', metadata: { trackerEntryId: entry.id },
      });
    }
  }

  return entry;
}
