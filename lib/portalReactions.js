// lib/portalReactions.js
//
// Progress World Reaction — the beginning of the Global Portal State
// Layer: one place that turns a verified state change into "how hard
// should the environment react," so the page doesn't independently
// guess. This file adds no new domain detection of its own — it only
// reads facts lib/transitions.js and lib/todayIntelligence.js's
// buildCrossSystemDomino already established (barrier_cleared,
// opportunity_unlocked, a genuinely changed recommendation) and ranks
// them.
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
// One-shot by construction, not by a timer: computeMomentLevel reads
// resolvedBarriers/newlyActiveOpportunities, which lib/intelligenceCore.js
// only populates on the exact reconciliation pass a transition happened.
// The next page load — same barrier, already resolved — sees empty
// arrays and naturally computes a lower (or null) level. Nothing here
// tracks "has this been shown before"; the underlying data already makes
// replay impossible.
//
// REACTION_CONTRACT documents, for each canonical event, which surfaces
// already react to it — Life Map, Radar, BarrierDissolve, Today, What
// Changed, and (this pass) the page-level environment. It is not
// exhaustively enforced here — each surface still owns its own rendering
// — but it is the single reference for "what should react to this,"
// so a future surface is added to a list here, not guessed independently
// at the call site.

import { buildTransitionEvents } from './transitions';
import { buildCrossSystemDomino } from './todayIntelligence';

export const MOMENT_RANK = { micro: 1, meaningful: 2, major: 3, landmark: 4 };
export const MOMENT_LABEL = { micro: 'Micro', meaningful: 'Meaningful', major: 'Major', landmark: 'Landmark' };

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

export function computeMomentLevel(room) {
  if (!room) return null;
  const dissolveEvents = buildTransitionEvents(room);
  const barrierCleared = dissolveEvents.some((e) => e.eventType === 'barrier_cleared');
  const opportunityUnlocked = dissolveEvents.some((e) => e.eventType === 'opportunity_unlocked');
  const recommendationChanged = !!room.recommendation?.previous;
  // buildCrossSystemDomino's `active` is exactly "a barrier cleared AND
  // it co-occurred with another real transition" — reused here rather
  // than re-derived, so landmark can never drift out of sync with what
  // Domino/BarrierDissolve already call a cross-system moment.
  const crossSystem = buildCrossSystemDomino(room).active;

  if (crossSystem) return 'landmark';
  if (barrierCleared) return 'major';
  if (opportunityUnlocked || recommendationChanged) return 'meaningful';
  if ((room.whatChanged?.length ?? 0) > 0) return 'micro';
  return null;
}
