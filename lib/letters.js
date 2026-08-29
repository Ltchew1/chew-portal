// lib/letters.js
//
// DB access for generated letters. generateDisputeLetter() and
// generateEscalationLetter() are the only two write paths, and both call
// assertItemsAttested() (or verify the prior letter's ownership, for the
// escalation case — every item in it was already attested to get there)
// before composing or persisting anything. "No attested item, no letter"
// is enforced here, against the database, not in the UI.

import { query, withTransaction } from './db';
import { ensureUserRow } from './users';
import { assertItemsAttested } from './attestations';
import { getItemsForLetter } from './disputeItems';
import { getTrackerEntryForLetter } from './disputeTracker';
import { composeDisputeLetter, composeEscalationNarrative } from './letterContent';
import { BUREAU_ADDRESSES, BUREAU_LABELS, CFPB_ADDRESS } from './creditAddresses';
import { FCRA_CITATIONS, ESCALATION_FAILURE_CITATIONS } from './fcraCitations';
import { logEvent } from './events';
import { scanForPlaceholderArtifacts, validateDisputeLetterFacts, assertLetterQuality } from './letterQuality';

// A CFPB/FTC complaint is a federal filing, not a rough guess — it must
// never assert a timing or response fact the client hasn't actually
// logged. This is the honest gate for each failureReason that makes such
// an assertion (see fcraCitations.js's ESCALATION_FAILURE_CITATIONS —
// no_response literally states "More than 30 days ... have passed",
// verified_without_explanation asserts a specific response was received),
// checked against the client's own Dispute Tracker entry for the prior
// letter, never against generated_at (a letter can sit generated for days
// before it's actually mailed — there is no bureau-delivery signal here).
const REINVESTIGATION_WINDOW_DAYS = 30;

function daysSince(dateValue) {
  const ms = Date.now() - new Date(dateValue).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function assertEscalationReasonIsSupported(failureReason, trackerEntry) {
  if (failureReason === 'no_response' || failureReason === 'furnisher_ignored') {
    if (!trackerEntry?.mailedDate) {
      throw new Error(
        'Log this letter as mailed in your Dispute Tracker, with the date you mailed it, before reporting no response — ' +
        'CHEW needs to know when the clock actually started.'
      );
    }
    const elapsed = daysSince(trackerEntry.mailedDate);
    if (elapsed < REINVESTIGATION_WINDOW_DAYS) {
      throw new Error(
        `It's only been ${elapsed} day(s) since you logged this letter as mailed. The law gives a reinvestigation up to ` +
        `${REINVESTIGATION_WINDOW_DAYS} days (45 if you submitted more information) — wait until at least ` +
        `${REINVESTIGATION_WINDOW_DAYS} days have passed before reporting no response.`
      );
    }
  } else if (failureReason === 'verified_without_explanation') {
    if (trackerEntry?.responseType !== 'verified') {
      throw new Error(
        'Log the bureau\'s response as "Verified" in your Dispute Tracker before selecting this reason — ' +
        'CHEW only lets you cite a response you\'ve actually recorded.'
      );
    }
  }
}

// One-and-done: an item's bureau and creditor are fixed fields, so "a
// letter already exists for this item at this recipientType" always means
// the exact same recipient, never just a similar one — there is no
// legitimate reason to generate a second bureau letter for the same item
// to the same bureau. Escalation-ladder progression (bureau, then the
// furnisher directly, then a secondary bureau) is unaffected: each of
// those is a different recipientType, so it passes this check and is
// still a fresh, non-duplicate submission.
async function findItemsAlreadyLetteredToRecipient(disputeItemIds, recipientType) {
  const { rows } = await query(
    `SELECT DISTINCT gli.dispute_item_id AS id
     FROM generated_letter_items gli
     JOIN generated_letters gl ON gl.id = gli.letter_id
     WHERE gli.dispute_item_id = ANY($1::bigint[]) AND gl.recipient_type = $2`,
    [disputeItemIds, recipientType]
  );
  return rows.map((r) => r.id);
}

// Stage 1/2/3: a standard dispute letter to a bureau, secondary bureau, or
// furnisher. Every item must share the recipient the letter is addressed
// to (a letter goes to one place) — enforced here, not just in the UI.
export async function generateDisputeLetter({
  clerkUserId, email, firstName, lastName, member,
  disputeItemIds, recipientType, recipientAddressOverride, stage, escalationNotes,
}) {
  // THE GATE. First line, before anything else touches these items.
  await assertItemsAttested(clerkUserId, disputeItemIds);

  const duplicates = await findItemsAlreadyLetteredToRecipient(disputeItemIds, recipientType);
  if (duplicates.length > 0) {
    throw new Error(
      `A letter has already been generated to this same recipient for item(s): ${duplicates.join(', ')}. ` +
      'To follow up on a response you already received, use the escalation flow instead of generating another dispute letter.'
    );
  }

  const userId = await ensureUserRow({ clerkUserId, email, firstName, lastName });
  const items = await getItemsForLetter(clerkUserId, disputeItemIds);
  if (items.length !== disputeItemIds.length) {
    throw new Error('Some items could not be loaded for this letter.');
  }

  let recipientName;
  let recipientAddressLines;
  let bureauForRecord = null;

  if (recipientType === 'bureau' || recipientType === 'secondary_bureau') {
    const bureau = items[0].bureau;
    if (!items.every((item) => item.bureau === bureau)) {
      throw new Error('All items in one letter must be from the same bureau.');
    }
    recipientName = BUREAU_LABELS[bureau];
    recipientAddressLines = BUREAU_ADDRESSES[bureau];
    bureauForRecord = bureau;
  } else if (recipientType === 'furnisher') {
    const creditor = items[0].creditorName;
    if (!items.every((item) => item.creditorName === creditor)) {
      throw new Error('All items in one furnisher letter must be with the same creditor.');
    }
    if (!recipientAddressOverride?.length) {
      throw new Error('A mailing address for the furnisher is required.');
    }
    recipientName = creditor;
    recipientAddressLines = recipientAddressOverride;
  } else {
    throw new Error(`Unsupported recipientType for a dispute letter: ${recipientType}`);
  }

  const { content, sections } = composeDisputeLetter({
    member, items, recipientType, recipientName, recipientAddressLines, escalationNotes,
  });
  // Pre-persist quality gate — see lib/letterQuality.js's header comment.
  // A backstop, not the primary check (the API route already required a
  // complete address and a non-empty item list); this is the independent
  // check against the actually-composed text.
  assertLetterQuality([
    ...validateDisputeLetterFacts({ member, sections, recipientAddressLines, items }),
    ...scanForPlaceholderArtifacts(content),
  ]);
  const citationCode = FCRA_CITATIONS[recipientType]?.code ?? null;

  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO generated_letters
         (user_id, bureau, content, structured_content, stage, recipient_type, recipient_name, recipient_address, fcra_citation, escalation_notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, generated_at`,
      [userId, bureauForRecord, content, JSON.stringify(sections), stage, recipientType, recipientName, recipientAddressLines.join('\n'), citationCode, escalationNotes ?? null]
    );
    const letterId = rows[0].id;

    for (const item of items) {
      await client.query(
        'INSERT INTO generated_letter_items (letter_id, dispute_item_id) VALUES ($1, $2)',
        [letterId, item.id]
      );
      await client.query(
        `UPDATE dispute_items SET status = 'letter_generated', updated_at = now() WHERE id = $1`,
        [item.id]
      );
    }

    await logEvent({
      client, userId, room: 'credit', eventType: 'letter_generated',
      subject: recipientName,
      severity: 'info', metadata: { letterId, stage, recipientType },
    });

    return { id: letterId, content, generatedAt: rows[0].generated_at };
  });
}

// Stage 4: a CFPB/FTC complaint narrative escalating from a prior letter.
// No fresh dispute_item_ids from the client here — the items are whatever
// the prior letter (which the client owns and which only exists because
// its own items passed the attestation gate) already covers.
export async function generateEscalationLetter({
  clerkUserId, email, firstName, lastName, member,
  priorLetterId, recipientType, failureReason, failureDetail,
}) {
  if (!['cfpb', 'ftc'].includes(recipientType)) {
    throw new Error(`Unsupported recipientType for an escalation: ${recipientType}`);
  }

  const priorLetter = await getOwnedLetter(clerkUserId, priorLetterId);
  if (!priorLetter) {
    throw new Error('The prior letter for this escalation could not be found on this account.');
  }

  const trackerEntry = await getTrackerEntryForLetter(clerkUserId, priorLetterId);
  assertEscalationReasonIsSupported(failureReason, trackerEntry);

  const userId = await ensureUserRow({ clerkUserId, email, firstName, lastName });
  const items = await getItemsForExistingLetter(priorLetterId);

  const { content } = composeEscalationNarrative({
    member, items, recipientType,
    priorRecipientName: priorLetter.recipientName,
    failureReason, failureDetail,
  });
  assertLetterQuality(scanForPlaceholderArtifacts(content));

  const failure = ESCALATION_FAILURE_CITATIONS[failureReason];
  const notesForRecord = [failure?.label, failureDetail].filter(Boolean).join(' — ') || null;

  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO generated_letters
         (user_id, bureau, content, stage, recipient_type, recipient_name, recipient_address, fcra_citation, escalation_notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, generated_at`,
      [
        userId,
        null,
        content,
        4,
        recipientType,
        recipientType === 'cfpb' ? 'Consumer Financial Protection Bureau' : 'Federal Trade Commission',
        recipientType === 'cfpb' ? CFPB_ADDRESS.join('\n') : null,
        failure?.text ?? failureDetail ?? null,
        notesForRecord,
      ]
    );
    const letterId = rows[0].id;

    for (const item of items) {
      await client.query(
        'INSERT INTO generated_letter_items (letter_id, dispute_item_id) VALUES ($1, $2)',
        [letterId, item.id]
      );
    }

    await logEvent({
      client, userId, room: 'credit', eventType: 'escalation_generated',
      subject: `${recipientType === 'cfpb' ? 'CFPB' : 'FTC'}, re: ${priorLetter.recipientName}`,
      severity: 'watch', metadata: { letterId, priorLetterId, recipientType, failureReason },
    });

    return { id: letterId, content, generatedAt: rows[0].generated_at };
  });
}

export async function listLettersForUser(clerkUserId) {
  const { rows } = await query(
    `SELECT gl.id, gl.stage, gl.recipient_type AS "recipientType", gl.recipient_name AS "recipientName",
            gl.bureau, gl.generated_at AS "generatedAt", gl.downloaded_at AS "downloadedAt"
     FROM generated_letters gl
     JOIN users u ON u.id = gl.user_id
     WHERE u.clerk_user_id = $1
     ORDER BY gl.generated_at DESC`,
    [clerkUserId]
  );
  return rows;
}

export async function getOwnedLetter(clerkUserId, letterId) {
  const { rows } = await query(
    `SELECT gl.id, gl.stage, gl.recipient_type AS "recipientType", gl.recipient_name AS "recipientName",
            gl.bureau, gl.content, gl.structured_content AS "structuredContent",
            gl.generated_at AS "generatedAt", gl.downloaded_at AS "downloadedAt"
     FROM generated_letters gl
     JOIN users u ON u.id = gl.user_id
     WHERE u.clerk_user_id = $1 AND gl.id = $2`,
    [clerkUserId, letterId]
  );
  return rows[0] ?? null;
}

export async function getItemsForExistingLetter(letterId) {
  const { rows } = await query(
    `SELECT di.id, di.bureau, di.creditor_name AS "creditorName",
            di.account_number AS "accountNumber", di.reason,
            di.client_notes AS "clientNotes"
     FROM generated_letter_items gli
     JOIN dispute_items di ON di.id = gli.dispute_item_id
     WHERE gli.letter_id = $1
     ORDER BY di.created_at ASC`,
    [letterId]
  );
  return rows;
}

export async function markDownloaded(clerkUserId, letterId) {
  await query(
    `UPDATE generated_letters gl
     SET downloaded_at = COALESCE(downloaded_at, now())
     FROM users u
     WHERE gl.user_id = u.id AND u.clerk_user_id = $1 AND gl.id = $2`,
    [clerkUserId, letterId]
  );
}
