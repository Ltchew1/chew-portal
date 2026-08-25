// lib/intelligenceCore.js
//
// CHEW Intelligence Core — the reconciler that turns lib/homeIntelligence.js's
// pure, recomputed-every-time signals into the persistent objects the rest
// of the platform reads: active barriers, active opportunities, the
// current recommendation (with history), and in-app notifications.
//
// This is the one place that writes to those tables. Every room's
// getXIntelligence() (today, only Credit) stays a pure signal computation;
// this file is what makes "one brain" real — a single reconciliation path
// every room runs through, rather than each room inventing its own
// persistence. Idempotent by design (see upsertBarrier/upsertOpportunity's
// sourceKey and setRecommendation's "no-op if unchanged" check), so it's
// safe to call on every page load that needs current state — re-detecting
// the same condition twice never creates a duplicate row or a duplicate
// notification.

import { getUserIdByClerkId } from './users';
import { getCreditIntelligence } from './homeIntelligence';
import { upsertBarrier, resolveStaleBarriers, listActiveBarriers } from './barriers';
import { upsertOpportunity, resolveStaleOpportunities, listActiveOpportunities } from './opportunities';
import { setRecommendation, listRecommendationHistory } from './recommendations';
import { createNotification } from './notifications';

const BARRIER_NOTIFICATION_TYPE = { risk: 'plan_at_risk', action_needed: 'critical_action', watch: 'chew_noticed' };

async function reconcileRoom(clerkUserId, userId, room, intel) {
  const notifications = [];

  // --- Barriers -------------------------------------------------------------
  const activeBarriers = [];
  for (const candidate of intel.barrierCandidates) {
    const barrier = await upsertBarrier({ userId, room, ...candidate });
    activeBarriers.push(barrier);
    if (barrier.isNew) {
      notifications.push({
        userId, room, type: BARRIER_NOTIFICATION_TYPE[barrier.severity] ?? 'chew_noticed',
        title: barrier.title, body: barrier.whatHappened,
      });
    }
  }
  const resolvedBarriers = await resolveStaleBarriers(
    userId, room, intel.barrierCandidates.map((b) => b.sourceKey),
    'This is no longer interfering with your plan.'
  );
  for (const resolved of resolvedBarriers) {
    notifications.push({
      userId, room, type: 'back_on_track',
      title: `You fixed it: ${resolved.title}`,
      body: 'This barrier is no longer interfering with your plan.',
    });
  }

  // --- Opportunities ----------------------------------------------------------
  const activeOpportunities = [];
  for (const candidate of intel.opportunityCandidates) {
    const opportunity = await upsertOpportunity({ userId, room, ...candidate });
    activeOpportunities.push(opportunity);
    if (opportunity.isNew) {
      notifications.push({
        userId, room, type: 'opportunity_found',
        title: opportunity.title, body: opportunity.whatImproved,
      });
    }
  }
  await resolveStaleOpportunities(userId, room, intel.opportunityCandidates.map((o) => o.sourceKey));

  // --- Recommendation (Next Best Move, persisted + history) ------------------
  let recommendation = null;
  if (intel.nextBestMove) {
    const observed = [
      ...intel.chewNoticed,
      ...activeBarriers.map((b) => b.title),
    ];
    const result = await setRecommendation({
      userId, clerkUserId, room,
      relatedGoalId: intel.goal?.id ?? null,
      actionText: intel.nextBestMove.action,
      reason: intel.nextBestMove.why,
      observed,
      whatWouldChangeThis: [intel.nextBestMove.next],
      href: intel.nextBestMove.href,
    });
    recommendation = result;
    if ('previous' in result && result.previous) {
      notifications.push({
        userId, room, type: 'reassessment_complete',
        title: 'Your recommendation changed',
        body: `CHEW now recommends: ${result.actionText}`,
        href: result.href,
      });
    }
  }

  // --- Persist notifications, then return everything the caller needs -------
  const createdNotifications = [];
  for (const n of notifications) {
    createdNotifications.push(await createNotification(n));
  }

  return { activeBarriers, activeOpportunities, recommendation, newNotifications: createdNotifications };
}

// The Credit room's full reconciliation pass — pure signal computation
// (getCreditIntelligence) plus the persistence step above, returned as one
// object so a page only needs one call.
export async function reconcileCreditIntelligence(clerkUserId) {
  const [userId, intel] = await Promise.all([
    getUserIdByClerkId(clerkUserId),
    getCreditIntelligence(clerkUserId),
  ]);
  if (!userId) {
    // No users row yet (brand-new client, never touched Credit) — nothing
    // to reconcile against, and intel is already the honest "not started"
    // shape from getCreditIntelligence.
    return { ...intel, activeBarriers: [], activeOpportunities: [], recommendation: null, newNotifications: [] };
  }
  const reconciled = await reconcileRoom(clerkUserId, userId, 'credit', intel);
  return { ...intel, ...reconciled };
}

// The home page's entry point — merges every room's reconciled intelligence
// into one view. Today there is exactly one contributing room; a second
// room adds a sibling reconcileXIntelligence() here and its result joins
// this same array.
export async function reconcileHomeIntelligence(clerkUserId) {
  const credit = await reconcileCreditIntelligence(clerkUserId);
  return { rooms: [credit] };
}

export async function getRecommendationHistory(clerkUserId, room, limit) {
  return listRecommendationHistory(clerkUserId, room, limit);
}

export async function getBarriersAndOpportunities(clerkUserId, room) {
  const [barriers, opportunities] = await Promise.all([
    listActiveBarriers(clerkUserId, room),
    listActiveOpportunities(clerkUserId, room),
  ]);
  return { barriers, opportunities };
}
