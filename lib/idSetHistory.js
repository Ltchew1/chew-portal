// lib/idSetHistory.js
//
// The one real rule shared by every "did CHEW's persisted-ID view of a
// room change since last time" signal — first built for Economic Weather
// (lib/economicWeather.js, opportunity IDs), reused as-is for Friction
// History (lib/frictionHistory.js, barrier IDs) rather than re-implemented
// a second time. Two domains, same honest rule:
//
// CORE RULE — reason historically using stable persisted IDs only. Never
// counts alone, titles, labels, array position, or display text: two
// different rows can share a count, and the same row can be restated with
// different wording, so only comparing the ID sets is honest.
//
// This file is pure and DB-free on purpose — every caller owns its own
// table, its own scope/label vocabulary, and its own explanation copy;
// this only ever answers "given these two ID sets, what genuinely
// changed."

export function canonicalizeIds(ids) {
  return Array.from(new Set((ids ?? []).map(Number))).sort((a, b) => a - b);
}

export function idsFromField(field) {
  return field ? field.split(',').filter(Boolean).map(Number) : [];
}

export function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

// Deterministic set comparison — never count math. `previousIds`/
// `currentIds` need not be pre-canonicalized; this canonicalizes them
// itself so callers can pass raw arrays safely.
export function compareIdSets(previousIds, currentIds) {
  const prev = canonicalizeIds(previousIds);
  const curr = canonicalizeIds(currentIds);
  const prevSet = new Set(prev);
  const currSet = new Set(curr);
  const added = curr.filter((id) => !prevSet.has(id));
  const removed = prev.filter((id) => !currSet.has(id));

  let status;
  if (added.length === 0 && removed.length === 0) status = 'unchanged';
  else if (added.length > 0 && removed.length === 0) status = 'expanded';
  else if (added.length === 0 && removed.length > 0) status = 'contracted';
  else if (curr.length === prev.length) status = 'composition_changed';
  else status = 'mixed';

  return { status, added, removed, previousCount: prev.length, currentCount: curr.length };
}

// Trend may only be stated when three or more observations genuinely
// agree on one direction — a single transition is never "momentum."
// `stepComparisons` must be consecutive, oldest-to-newest comparisons
// (snapshot[n] -> snapshot[n+1]).
export function detectTrend(stepComparisons) {
  if (stepComparisons.length < 2) return null;
  if (stepComparisons.every((c) => c.status === 'expanded')) return 'consistently_expanding';
  if (stepComparisons.every((c) => c.status === 'contracted')) return 'consistently_contracting';
  return null;
}
