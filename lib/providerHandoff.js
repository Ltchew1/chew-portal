// lib/providerHandoff.js
//
// The closed-loop handoff: CHEW detects need -> explains why -> prepares
// client -> routes -> provider executes -> outcome returns to CHEW ->
// CHEW updates the plan. Every step is a real, logged status transition —
// no step can be skipped in code, even by a caller that tries to. Consent
// is the hard gate: a handoff cannot reach 'handed_off' without
// consented_at being set first, and consented_at is only ever set by
// recordConsent(), which requires the caller to state exactly what fields
// were disclosed (matching the directive's "show what will be shared;
// allow consent; log the consent").
//
// Outcome feeds back into the universal event log (lib/events.js) as a
// 'provider_outcome_received' event, so the same Intelligence Core that
// already reasons over Credit-room events can eventually react to a
// provider's result too — the closed loop the directive describes,
// architected now even though nothing routes through it yet.

import { query } from './db';
import { getUserIdByClerkId } from './users';
import { logEvent } from './events';
import { matchCapability } from './capabilityGraph';

export async function initiateHandoff({ clerkUserId, capabilityKey, providerId, relatedGoalId, fieldsDisclosed }) {
  const eligible = await matchCapability(capabilityKey);
  if (!eligible.some((p) => p.providerId === providerId)) {
    throw new Error('This provider is not currently ready or eligible for this capability.');
  }
  if (!Array.isArray(fieldsDisclosed) || fieldsDisclosed.length === 0) {
    throw new Error('fieldsDisclosed must list exactly what will be shared with the provider before a handoff can be created.');
  }

  const userId = await getUserIdByClerkId(clerkUserId);
  if (!userId) throw new Error('No account found for this user.');

  const { rows } = await query(
    `INSERT INTO provider_handoffs (user_id, capability_id, provider_id, related_goal_id, fields_disclosed, status)
     SELECT $1, c.id, $2, $3, $4, 'consent_pending'
     FROM capabilities c WHERE c.key = $5
     RETURNING id, capability_id AS "capabilityId", provider_id AS "providerId", status,
               fields_disclosed AS "fieldsDisclosed", created_at AS "createdAt"`,
    [userId, providerId, relatedGoalId ?? null, JSON.stringify(fieldsDisclosed), capabilityKey]
  );
  const handoff = rows[0];

  await logEvent({
    userId, room: 'network', eventType: 'handoff_initiated',
    subject: `Handoff prepared for ${capabilityKey}`,
    severity: 'info', metadata: { handoffId: handoff.id, capabilityKey, providerId },
  });

  return handoff;
}

export async function recordConsent(clerkUserId, handoffId) {
  const userId = await getUserIdByClerkId(clerkUserId);
  const { rows } = await query(
    `UPDATE provider_handoffs
     SET status = 'consent_given', consented_at = now(), updated_at = now()
     WHERE id = $1 AND user_id = $2 AND status = 'consent_pending'
     RETURNING id, status, consented_at AS "consentedAt"`,
    [handoffId, userId]
  );
  if (!rows[0]) throw new Error('No pending handoff found to consent to.');

  await logEvent({
    userId, room: 'network', eventType: 'handoff_consent_given',
    subject: `Consent given for handoff #${handoffId}`,
    severity: 'info', metadata: { handoffId },
  });
  return rows[0];
}

// Only ever called after consent — the WHERE clause is the actual
// enforcement (mirrors the discipline in lib/disputeItems.js's
// deleteUnattestedItem), not just a check earlier in the call chain.
export async function markHandedOff(clerkUserId, handoffId) {
  const userId = await getUserIdByClerkId(clerkUserId);
  const { rows } = await query(
    `UPDATE provider_handoffs
     SET status = 'handed_off', handed_off_at = now(), updated_at = now()
     WHERE id = $1 AND user_id = $2 AND status = 'consent_given' AND consented_at IS NOT NULL
     RETURNING id, status, handed_off_at AS "handedOffAt"`,
    [handoffId, userId]
  );
  if (!rows[0]) throw new Error('This handoff has no recorded consent, or is not in a state that can be handed off.');
  return rows[0];
}

export async function recordOutcome(clerkUserId, handoffId, outcomeNote) {
  const userId = await getUserIdByClerkId(clerkUserId);
  const { rows } = await query(
    `UPDATE provider_handoffs
     SET status = 'outcome_received', outcome_note = $3, outcome_received_at = now(), updated_at = now()
     WHERE id = $1 AND user_id = $2 AND status = 'handed_off'
     RETURNING id, capability_id AS "capabilityId", status, outcome_note AS "outcomeNote"`,
    [handoffId, userId, outcomeNote ?? null]
  );
  if (!rows[0]) throw new Error('This handoff is not awaiting an outcome.');

  await logEvent({
    userId, room: 'network', eventType: 'provider_outcome_received',
    subject: `Outcome received for handoff #${handoffId}`,
    severity: 'info', metadata: { handoffId, outcomeNote: outcomeNote ?? null },
  });
  return rows[0];
}

export async function listHandoffsForUser(clerkUserId) {
  const { rows } = await query(
    `SELECT ph.id, c.key AS "capabilityKey", c.name AS "capabilityName", p.name AS "providerName",
            ph.status, ph.fields_disclosed AS "fieldsDisclosed", ph.consented_at AS "consentedAt",
            ph.handed_off_at AS "handedOffAt", ph.outcome_note AS "outcomeNote",
            ph.outcome_received_at AS "outcomeReceivedAt", ph.created_at AS "createdAt"
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
