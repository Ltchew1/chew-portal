// lib/transitions.js
//
// Canonical transition events — the one place "did a real state change
// just happen, and what is it called" gets decided. Today's Barrier
// Dissolve, Life Map's dissolve integration, and any future consumer all
// call buildTransitionEvents() on the same reconciled room object instead
// of independently deciding whether something is "new" — one real
// transition produces exactly one event, with one stable identity and one
// name, no matter how many surfaces render it.
//
// Not a persisted ledger yet. lib/intelligenceCore.js's reconcileRoom is
// currently the only producer of transitions (resolvedBarriers,
// newlyActiveOpportunities — both empty on every pass after the one where
// the transition actually happened), and Today's single page load is
// currently the only consumer, so a table earns its keep once a second
// producer (e.g. Network handoff outcomes) or a "show me history"
// consumer exists. The id scheme below (eventType:entityType:entityId:
// occurredAt) is deliberately shaped like a ledger row's natural key, so
// adopting a persisted version later is a storage change, not an
// identity change — a future migration would add a table with columns
// (event_id, event_type, entity_type, entity_id, occurred_at,
// previous_state, resulting_state, reconciliation_run_id, source,
// metadata) and this function's callers would not need to change.

export function transitionEventId({ eventType, entityType, entityId, occurredAt }) {
  return `${eventType}:${entityType}:${entityId}:${new Date(occurredAt).toISOString()}`;
}

// `room` is a reconciled room object (e.g. reconcileCreditIntelligence's
// result) — resolvedBarriers/newlyActiveOpportunities are real, full
// prior-state rows only on the exact pass the transition was detected
// (see lib/intelligenceCore.js). Two distinct event types on purpose:
// a barrier clearing and an opportunity becoming active are different
// causal facts and must never be collapsed into one generic "unlocked."
// "PATH OPEN" (a room/pathway becoming reachable) is deliberately not a
// transition type here: clientStatus and feature-flag changes carry no
// timestamped record a client can read as "just happened," so there is
// no real transition to name — adding it would mean inventing one.
export function buildTransitionEvents(room) {
  if (!room) return [];
  const barrierEvents = (room.resolvedBarriers ?? []).map((b) => ({
    id: transitionEventId({ eventType: 'barrier_cleared', entityType: 'barrier', entityId: b.id, occurredAt: b.resolvedAt }),
    eventType: 'barrier_cleared',
    entityType: 'barrier',
    entityId: b.id,
    occurredAt: b.resolvedAt,
    title: b.title,
    whatHappened: b.whatHappened,
    doThisNow: b.doThisNow,
    resolutionNote: b.resolutionNote,
  }));
  const opportunityEvents = (room.newlyActiveOpportunities ?? []).map((o) => ({
    id: transitionEventId({ eventType: 'opportunity_unlocked', entityType: 'opportunity', entityId: o.id, occurredAt: o.createdAt }),
    eventType: 'opportunity_unlocked',
    entityType: 'opportunity',
    entityId: o.id,
    occurredAt: o.createdAt,
    title: o.title,
    whatImproved: o.whatImproved,
    whyItMatters: o.whyItMatters,
    suggestedAction: o.suggestedAction,
  }));
  // recommendation.previous only exists on the exact pass
  // setRecommendation() (lib/recommendations.js) detected a genuinely
  // different actionText and superseded the old row — same one-shot
  // guarantee as the two event types above, for the same reason (the next
  // page load reads the new active recommendation, which has no
  // `previous`).
  const recommendationEvents = room.recommendation?.previous ? [{
    id: transitionEventId({ eventType: 'recommendation_changed', entityType: 'recommendation', entityId: room.recommendation.id, occurredAt: room.recommendation.createdAt }),
    eventType: 'recommendation_changed',
    entityType: 'recommendation',
    entityId: room.recommendation.id,
    occurredAt: room.recommendation.createdAt,
    title: room.recommendation.actionText,
    reason: room.recommendation.reason,
    previousActionText: room.recommendation.previous.actionText,
  }] : [];
  return [...barrierEvents, ...opportunityEvents, ...recommendationEvents];
}
