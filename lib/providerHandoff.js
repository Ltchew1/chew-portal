// lib/providerHandoff.js
//
// The closed-loop handoff: CHEW detects need -> explains why -> prepares
// client -> routes -> provider executes -> outcome returns to CHEW ->
// CHEW updates the plan. Every step is a real, logged status transition —
// no step can be skipped in code, even by a caller that tries to. Consent
// is the hard gate: a handoff cannot reach 'handed_off' without
// consented_at being set first, and consented_at is only ever set by
// recordConsent(), which requires the caller to state exactly what fields
// were disclosed, under a specific, versioned consent-language string
// (matching the directive's "show what will be shared; allow consent;
// log the consent; preserve the version of the consent language").
//
// Full event trail: need_detected -> capability_matched -> handoff_initiated
// -> handoff_consent_given -> handoff_acknowledged -> provider_outcome_received
// (-> followup_required, if the outcome calls for it). Every transition
// writes a chew_events row, so one handoff is reconstructable later
// without guessing what happened.

import { query } from './db';
import { getUserIdByClerkId } from './users';
import { logEvent } from './events';
import { matchCapability } from './capabilityGraph';

export const OUTCOME_CLASSIFICATIONS = [
  'successful', 'partially_successful', 'user_not_eligible', 'provider_declined', 'user_abandoned',
  'user_no_response', 'provider_no_response', 'wrong_match', 'missing_documentation',
  'provider_capacity_issue', 'escalated', 'cancelled', 'problem_complaint', 'outcome_unknown',
];

// Outcomes that mean the loop needs a next step, not just a closed record
// — used as the default for outcome_requires_followup when the caller
// doesn't specify one explicitly.
const FOLLOWUP_DEFAULT_TRUE = new Set([
  'partially_successful', 'provider_no_response', 'user_no_response', 'wrong_match',
  'missing_documentation', 'provider_capacity_issue', 'escalated', 'problem_complaint', 'outcome_unknown',
]);

const HANDOFF_COLUMNS = `
  ph.id, ph.capability_id AS "capabilityId", ph.provider_id AS "providerId", ph.related_goal_id AS "relatedGoalId",
  ph.status, ph.fields_disclosed AS "fieldsDisclosed", ph.need_type AS "needType", ph.reason, ph.urgency,
  ph.origin_event_id AS "originEventId", ph.outcome_event_id AS "outcomeEventId",
  ph.consent_version AS "consentVersion", ph.consented_at AS "consentedAt", ph.consent_revoked_at AS "consentRevokedAt",
  ph.consent_recipient_name AS "consentRecipientName", ph.is_simulated_transmission AS "isSimulatedTransmission",
  ph.handed_off_at AS "handedOffAt", ph.outcome_classification AS "outcomeClassification",
  ph.outcome_note AS "outcomeNote", ph.outcome_source AS "outcomeSource", ph.outcome_metadata AS "outcomeMetadata",
  ph.outcome_requires_followup AS "outcomeRequiresFollowup", ph.outcome_received_at AS "outcomeReceivedAt",
  ph.created_at AS "createdAt", ph.updated_at AS "updatedAt"
`;

export async function initiateHandoff({
  clerkUserId, capabilityKey, providerId, relatedGoalId, fieldsDisclosed,
  needType, reason, urgency, originEventId,
}) {
  const eligible = await matchCapability(capabilityKey);
  // String-normalized on purpose: node-postgres returns bigint columns
  // (providerId here) as strings to avoid precision loss, but a caller —
  // e.g. a future API route doing Number(body.providerId) — will very
  // naturally pass a JS number. Strict === between "5" and 5 is false,
  // which would silently reject a real, eligible match.
  const match = eligible.find((p) => String(p.providerId) === String(providerId));
  if (!match) {
    throw new Error('This provider is not currently ready or eligible for this capability.');
  }
  if (!Array.isArray(fieldsDisclosed) || fieldsDisclosed.length === 0) {
    throw new Error('fieldsDisclosed must list exactly what will be shared with the provider before a handoff can be created.');
  }
  if (urgency && !['low', 'normal', 'high'].includes(urgency)) {
    throw new Error("urgency must be 'low', 'normal', or 'high'");
  }

  const userId = await getUserIdByClerkId(clerkUserId);
  if (!userId) throw new Error('No account found for this user.');

  const { rows } = await query(
    `INSERT INTO provider_handoffs
       (user_id, capability_id, provider_id, related_goal_id, fields_disclosed, status,
        need_type, reason, urgency, origin_event_id, consent_recipient_name)
     SELECT $1, c.id, $2, $3, $4, 'consent_pending', $6, $7, $8, $9, $10
     FROM capabilities c WHERE c.key = $5
     RETURNING ${HANDOFF_COLUMNS.replace(/ph\./g, '')}`,
    [userId, providerId, relatedGoalId ?? null, JSON.stringify(fieldsDisclosed), capabilityKey,
      needType ?? null, reason ?? null, urgency ?? 'normal', originEventId ?? null, match.providerName]
  );
  const handoff = rows[0];

  await logEvent({
    userId, room: 'network', eventType: 'handoff_initiated',
    subject: `Handoff prepared for ${capabilityKey}`,
    severity: 'info', metadata: { handoffId: handoff.id, capabilityKey, providerId, needType, urgency },
  });

  return handoff;
}

// consentText/consentVersion are required, not optional — "no silent
// data-sharing assumptions." The exact language the client agreed to is
// part of the permanent record, not just a boolean flag.
export async function recordConsent(clerkUserId, handoffId, { consentVersion } = {}) {
  if (!consentVersion?.trim()) {
    throw new Error('consentVersion is required — record exactly which version of the consent language the client agreed to.');
  }
  const userId = await getUserIdByClerkId(clerkUserId);
  const { rows } = await query(
    `UPDATE provider_handoffs
     SET status = 'consent_given', consented_at = now(), consent_version = $3, updated_at = now()
     WHERE id = $1 AND user_id = $2 AND status = 'consent_pending'
     RETURNING id, status, consented_at AS "consentedAt", consent_version AS "consentVersion"`,
    [handoffId, userId, consentVersion.trim()]
  );
  if (!rows[0]) throw new Error('No pending handoff found to consent to.');

  await logEvent({
    userId, room: 'network', eventType: 'handoff_consent_given',
    subject: `Consent given for handoff #${handoffId}`,
    severity: 'info', metadata: { handoffId, consentVersion: consentVersion.trim() },
  });
  return rows[0];
}

export async function revokeConsent(clerkUserId, handoffId) {
  const userId = await getUserIdByClerkId(clerkUserId);
  const { rows } = await query(
    `UPDATE provider_handoffs
     SET consent_revoked_at = now(), updated_at = now()
     WHERE id = $1 AND user_id = $2 AND consented_at IS NOT NULL AND consent_revoked_at IS NULL AND status != 'handed_off'
     RETURNING id, consent_revoked_at AS "consentRevokedAt"`,
    [handoffId, userId]
  );
  if (!rows[0]) throw new Error('No revocable consent found — either none was given, it was already revoked, or the handoff already occurred.');
  return rows[0];
}

// Represents "provider acknowledgment" in the directive's event chain.
// Only ever called after consent AND only if that consent hasn't been
// revoked — both enforced in the WHERE clause itself (mirrors the
// discipline in lib/disputeItems.js's deleteUnattestedItem), not just
// checked earlier in the call chain. `simulated: true` labels a handoff
// where CHEW has no live transmission channel to the provider yet — the
// capability/provider record is still real, only the transmission step
// itself is a stand-in.
export async function markHandedOff(clerkUserId, handoffId, { simulated = false } = {}) {
  const userId = await getUserIdByClerkId(clerkUserId);
  const { rows } = await query(
    `UPDATE provider_handoffs
     SET status = 'handed_off', handed_off_at = now(), is_simulated_transmission = $3, updated_at = now()
     WHERE id = $1 AND user_id = $2 AND status = 'consent_given'
       AND consented_at IS NOT NULL AND consent_revoked_at IS NULL
     RETURNING id, status, handed_off_at AS "handedOffAt", is_simulated_transmission AS "isSimulatedTransmission"`,
    [handoffId, userId, simulated]
  );
  if (!rows[0]) throw new Error('This handoff has no valid, unrevoked consent, or is not in a state that can be handed off.');

  await logEvent({
    userId, room: 'network', eventType: 'handoff_acknowledged',
    subject: `Handoff #${handoffId} acknowledged${simulated ? ' (simulated transmission)' : ''}`,
    severity: 'info', metadata: { handoffId, simulated },
  });
  return rows[0];
}

// outcomeClassification is required — "do not use only complete/failed."
// Writes the outcome, links the resulting event back onto the handoff row
// (outcome_event_id), and — if the outcome calls for it — logs a
// follow-up-required event too, closing the loop with an explicit next
// step rather than a silent dead end.
export async function recordOutcome(clerkUserId, handoffId, {
  outcomeClassification, outcomeNote, outcomeSource, outcomeMetadata, requiresFollowup,
}) {
  if (!OUTCOME_CLASSIFICATIONS.includes(outcomeClassification)) {
    throw new Error(`outcomeClassification must be one of: ${OUTCOME_CLASSIFICATIONS.join(', ')}`);
  }
  const userId = await getUserIdByClerkId(clerkUserId);
  const followup = requiresFollowup ?? FOLLOWUP_DEFAULT_TRUE.has(outcomeClassification);

  const { rows } = await query(
    `UPDATE provider_handoffs
     SET status = 'outcome_received', outcome_classification = $3, outcome_note = $4, outcome_source = $5,
         outcome_metadata = $6, outcome_requires_followup = $7, outcome_received_at = now(), updated_at = now()
     WHERE id = $1 AND user_id = $2 AND status = 'handed_off'
     RETURNING id, capability_id AS "capabilityId", status, outcome_classification AS "outcomeClassification",
               outcome_note AS "outcomeNote", outcome_requires_followup AS "outcomeRequiresFollowup"`,
    [handoffId, userId, outcomeClassification, outcomeNote ?? null, outcomeSource ?? null,
      JSON.stringify(outcomeMetadata ?? {}), followup]
  );
  if (!rows[0]) throw new Error('This handoff is not awaiting an outcome.');

  const event = await logEvent({
    userId, room: 'network', eventType: 'provider_outcome_received',
    subject: `Outcome for handoff #${handoffId}: ${outcomeClassification.replace(/_/g, ' ')}`,
    severity: FOLLOWUP_DEFAULT_TRUE.has(outcomeClassification) ? 'watch' : 'positive',
    metadata: { handoffId, outcomeClassification, outcomeNote: outcomeNote ?? null },
  });
  await query('UPDATE provider_handoffs SET outcome_event_id = $2 WHERE id = $1', [handoffId, event.id]);

  if (followup) {
    await logEvent({
      userId, room: 'network', eventType: 'followup_required',
      subject: `Follow-up needed on handoff #${handoffId}`,
      severity: 'watch', metadata: { handoffId, outcomeClassification },
    });
  }

  return { ...rows[0], outcomeEventId: event.id };
}

export async function getOwnedHandoff(clerkUserId, handoffId) {
  const { rows } = await query(
    `SELECT ${HANDOFF_COLUMNS}
     FROM provider_handoffs ph
     JOIN users u ON u.id = ph.user_id
     WHERE u.clerk_user_id = $1 AND ph.id = $2`,
    [clerkUserId, handoffId]
  );
  return rows[0] ?? null;
}

export async function listHandoffsForUser(clerkUserId) {
  const { rows } = await query(
    `SELECT ${HANDOFF_COLUMNS}, c.key AS "capabilityKey", c.name AS "capabilityName", p.name AS "providerName"
     FROM provider_handoffs ph
     JOIN users u ON u.id = ph.user_id
     JOIN capabilities c ON c.id = ph.capability_id
     JOIN providers p ON p.id = ph.provider_id
     WHERE u.clerk_user_id = $1
     ORDER BY ph.created_at DESC`,
    [clerkUserId]
  );
  return rows;
}

// Admin -> Network's full-network view — every handoff, any user, with the
// event trail reconstructable per row.
export async function listAllHandoffs() {
  const { rows } = await query(
    `SELECT ${HANDOFF_COLUMNS}, c.key AS "capabilityKey", c.name AS "capabilityName", p.name AS "providerName", u.clerk_user_id AS "clerkUserId"
     FROM provider_handoffs ph
     JOIN users u ON u.id = ph.user_id
     JOIN capabilities c ON c.id = ph.capability_id
     JOIN providers p ON p.id = ph.provider_id
     ORDER BY ph.created_at DESC`
  );
  return rows;
}
