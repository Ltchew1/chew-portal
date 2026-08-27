// lib/portalReactions.js
//
// Global Portal State Layer — the real routing mechanism REACTION_CONTRACT
// used to only document. buildPortalReactions(room) is now the single
// entry point every Today surface calls (directly or via a value threaded
// down from app/dashboard/page.js) instead of each surface independently
// calling buildTransitionEvents/buildCrossSystemDomino and re-deciding
// "does this event apply to me." This file adds no new domain detection —
// it only reads facts lib/transitions.js and lib/todayIntelligence.js's
// buildCrossSystemDomino already established (barrier_cleared,
// opportunity_unlocked, a genuinely changed recommendation), ranks them,
// and normalizes them into one shape every surface can filter for itself.
//
// Deliberately NOT a god object: buildPortalReactions returns plain,
// independent pieces (level, events, domino, reactions) rather than one
// opaque blob a surface has to reach into and interpret. Each surface
// keeps owning its own rendering — this layer only guarantees the input
// facts are identical everywhere, computed once.
//
// MOMENT LEVELS — real, not decorative:
//   micro       — only informational-tier activity this window (see
//                 lib/todayIntelligence.js's EVENT_IMPORTANCE); nothing
//                 the member would call progress.
//   meaningful  — one real thing changed: an opportunity went active, or
//                 the recommended move changed.
//   major       — a real barrier cleared.
//   landmark    — a barrier cleared AND it co-occurred with another real
//                 transition in the same pass (the same condition
//                 buildCrossSystemDomino already calls "active") — the
//                 strongest signal this system can currently prove,
//                 reserved for exactly that case, never assigned by
//                 count of events alone.
//
// STABLE STATE vs. PRESENTATION — every normalized reaction separates the
// two on purpose:
//   stableStateEffect — what is durably true in the database/derived state
//                       right now (a barrier resolved, an opportunity is
//                       active, a recommendation was superseded). True
//                       whether or not any surface ever renders it.
//   oneShotEffect     — what a surface is allowed to show exactly once
//                       (a dissolve, an emerge, a focus-shift animation).
//                       Purely presentational: skipping it, replaying the
//                       page, or a surface not existing yet never changes
//                       what's stably true.
//
// REPLAY — always 'never', not because a seen-flag is tracked, but because
// none can recur: resolvedBarriers/newlyActiveOpportunities/
// recommendation.previous are only populated by lib/intelligenceCore.js
// and lib/recommendations.js on the exact pass the transition happened
// (see lib/transitions.js's header comment). The next read of the same
// room naturally produces an empty transitionEvents array — replay is
// impossible by construction, the same guarantee computeMomentLevel below
// has always relied on.
//
// CO-OCCURRING EVENTS — buildCrossSystemDomino's `active` flag is computed
// once per buildPortalReactions(room) call and threaded into every
// reaction's `coOccurring` list and into the landmark-level decision; two
// events detected in the same pass fold into ONE moment (landmark, one
// set of co-occurring facts), never two separate spikes competing for
// the member's attention.
//
// CERTAINTY — every reaction here is 'direct': built from one verified
// event, never inferred. Cross-system co-occurrence is reported as
// coOccurring facts (true statements about same-pass timing), never
// upgraded into a causal claim — see buildCrossSystemDomino's own note.
//
// SURFACE_CONTRACT documents what each surface is allowed to consume from
// a buildPortalReactions() result — the boundary a future surface should
// respect rather than reaching further into the object than it needs to.
import { buildTransitionEvents } from './transitions';
import { buildCrossSystemDomino } from './todayIntelligence';

export const SURFACE_CONTRACT = {
  today: 'the dominant moment level (for the page-level summary line) plus the change story headline, a CHEW Move change, and one important unlock — never the full reaction list.',
  chewMove: 'recommendation_changed reactions only.',
  barrierDissolve: 'barrier_cleared reactions only, plus the shared domino object for its "Domino effect" chip row.',
  radar: 'opportunity_unlocked reactions only.',
  lifeMap: 'barrier_cleared and opportunity_unlocked reactions (territory/state changes) only.',
  progressWorld: 'the moment level and affected-system map only — never individual event detail.',
  whatChanged: 'the full normalized reaction set, since it is the one surface whose job is to summarize everything.',
};

export const MOMENT_RANK = { micro: 1, meaningful: 2, major: 3, landmark: 4 };
export const MOMENT_LABEL = { micro: 'Micro', meaningful: 'Meaningful', major: 'Major', landmark: 'Landmark' };

// REACTION_CONTRACT — for each canonical event, which surfaces react and
// what that reaction is called. normalizeReaction() below is what turns
// this from documentation into an actual per-event routing decision.
export const REACTION_CONTRACT = {
  barrier_cleared: {
    surfaces: ['barrierDissolve', 'lifeMap', 'today', 'progressWorld', 'whatChanged'],
    reaction: 'dissolve_and_open',
  },
  opportunity_unlocked: {
    surfaces: ['radar', 'lifeMap', 'today', 'progressWorld', 'whatChanged'],
    reaction: 'emerge_and_illuminate',
  },
  recommendation_changed: {
    surfaces: ['chewMove', 'today', 'progressWorld', 'whatChanged'],
    reaction: 'focus_shift',
  },
};

function describeStableState(event) {
  switch (event.eventType) {
    case 'barrier_cleared':
      return `Barrier "${event.title}" resolved.`;
    case 'opportunity_unlocked':
      return `Opportunity "${event.title}" is now active.`;
    case 'recommendation_changed':
      return `Recommended move changed from "${event.previousActionText}" to "${event.title}".`;
    default:
      return null;
  }
}

function describeExplanation(event) {
  switch (event.eventType) {
    case 'barrier_cleared':
      return { whatHappened: event.whatHappened, doThisNow: event.doThisNow, resolutionNote: event.resolutionNote };
    case 'opportunity_unlocked':
      return { whatImproved: event.whatImproved, whyItMatters: event.whyItMatters, suggestedAction: event.suggestedAction };
    case 'recommendation_changed':
      return { reason: event.reason, previousActionText: event.previousActionText };
    default:
      return null;
  }
}

function levelForEventType(eventType) {
  if (eventType === 'barrier_cleared') return 'major';
  if (eventType === 'opportunity_unlocked' || eventType === 'recommendation_changed') return 'meaningful';
  return 'micro';
}

// One canonical event -> one normalized, surface-agnostic reaction. An
// eventType not yet in REACTION_CONTRACT still normalizes (falls back to
// 'whatChanged'-only, reaction 'noted') rather than throwing — a future
// event type appearing here before REACTION_CONTRACT is updated for it
// degrades honestly instead of breaking the page.
export function normalizeReaction(event, { domino } = {}) {
  const contract = REACTION_CONTRACT[event.eventType] ?? { surfaces: ['whatChanged'], reaction: 'noted' };
  const coOccurring = domino?.active ? domino.effects.map((e) => e.text) : [];
  return {
    id: event.id,
    eventType: event.eventType,
    entityType: event.entityType,
    entityId: event.entityId,
    occurredAt: event.occurredAt,
    surfaces: contract.surfaces,
    // Landmark only when this event's own clearing co-occurred with
    // another real transition this same pass — reuses domino.active
    // rather than re-deriving it, so this can never disagree with what
    // buildCrossSystemDomino/computeMomentLevel call a landmark moment.
    level: domino?.active ? 'landmark' : levelForEventType(event.eventType),
    oneShotEffect: contract.reaction,
    stableStateEffect: describeStableState(event),
    replay: 'never',
    certainty: 'direct',
    coOccurring,
    explanation: describeExplanation(event),
  };
}

// Filter a normalized reaction list down to what one surface is allowed
// to consume, per SURFACE_CONTRACT — the one place "does this event apply
// to me" is decided, instead of every surface writing its own filter.
export function reactionsFor(reactions, surface) {
  return (reactions ?? []).filter((r) => r.surfaces.includes(surface));
}

// Cross-System Focus Mode's node-level half — real co-occurring node
// identities, not just co-occurring sections. Every OTHER canonical
// event in the same `events` array (i.e. detected in this same
// reconciliation pass — see lib/transitions.js) becomes a
// `${entityType}:${entityId}` string, the exact scheme Life Map's
// subnodes carry as `nodeId` (lib/todayIntelligence.js's
// buildCreditSubNodes). Makes no causal claim of its own — same "true
// statement about what was detected together" boundary
// buildCrossSystemDomino already documents; callers gate this on
// `domino.active` before using it, so it only ever fires where section-
// level co-occurrence was already established, resolved down to the
// specific real rows instead of a synthetic label.
export function coOccurringNodeIds(events, selfEventId) {
  return (events ?? [])
    .filter((e) => e.id !== selfEventId)
    .map((e) => `${e.entityType}:${e.entityId}`);
}

// computeMomentLevel keeps its original (room) => level signature and
// behavior — the second argument is purely an optional optimization for
// callers (namely buildPortalReactions below) that already computed
// transitionEvents/domino and want to avoid a second pass over the same
// room. Calling it as computeMomentLevel(room) alone still derives both
// itself, unchanged from before this file gained normalizeReaction.
export function computeMomentLevel(room, { transitionEvents, domino } = {}) {
  if (!room) return null;
  const events = transitionEvents ?? buildTransitionEvents(room);
  const barrierCleared = events.some((e) => e.eventType === 'barrier_cleared');
  const opportunityUnlocked = events.some((e) => e.eventType === 'opportunity_unlocked');
  const recommendationChanged = events.some((e) => e.eventType === 'recommendation_changed');
  // buildCrossSystemDomino's `active` is exactly "a barrier cleared AND
  // it co-occurred with another real transition" — reused here rather
  // than re-derived, so landmark can never drift out of sync with what
  // Domino/BarrierDissolve already call a cross-system moment.
  const crossSystem = (domino ?? buildCrossSystemDomino(room, events)).active;

  if (crossSystem) return 'landmark';
  if (barrierCleared) return 'major';
  if (opportunityUnlocked || recommendationChanged) return 'meaningful';
  if ((room.whatChanged?.length ?? 0) > 0) return 'micro';
  return null;
}

// The single entry point. Computes transitionEvents and domino exactly
// once per room, derives the moment level from those same values (never
// a second buildTransitionEvents/buildCrossSystemDomino pass), and
// normalizes every event into one reaction list every surface can filter
// with reactionsFor(). null room -> the same "nothing to react to" shape
// every field would otherwise resolve to individually.
export function buildPortalReactions(room) {
  if (!room) {
    return { level: null, events: [], domino: { active: false, effects: [], affected: {} }, reactions: [] };
  }
  const events = buildTransitionEvents(room);
  const domino = buildCrossSystemDomino(room, events);
  const level = computeMomentLevel(room, { transitionEvents: events, domino });
  const reactions = events.map((event) => normalizeReaction(event, { domino }));
  return { level, events, domino, reactions };
}
