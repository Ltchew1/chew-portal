// lib/factProvenance.js
//
// CHEW's first universal fact/provenance/freshness vocabulary — pure,
// DB-free, and deliberately small: a shared source-type/freshness
// vocabulary plus one classification function, not a generic "Facts"
// table and not a second reasoning engine. Any future domain (a HOME
// estimate, a DRIVE budget, a document, a resource allocation, the
// eventual Member Economic Twin...) stores its own value next to its
// own `source_type` column and whatever "as-of" date it already keeps,
// then calls describeFact() below to turn those two raw fields into the
// one consistent {sourceType, freshness, ...} shape every surface can
// render — this is the smallest coherent abstraction that scales,
// never an EAV mega-table and never a per-domain reinvention.
//
// Source and freshness are two independent questions and must never be
// collapsed into one: "member provided" says nothing about how current
// a value still is, and "needs update" says nothing about whether CHEW
// trusts who gave it. See the two enums below — a value can honestly be
// MEMBER_PROVIDED + NEEDS_UPDATE, or CHEW_DERIVED + CURRENT, etc.

export const SOURCE_TYPES = {
  MEMBER_PROVIDED: 'member_provided',
  DOCUMENT_PROVIDED: 'document_provided',
  REVIEWED_WITH_CHEW: 'reviewed_with_chew',
  CONNECTED_SOURCE: 'connected_source',
  CHEW_DERIVED: 'chew_derived',
  EXTERNAL_RESPONSE: 'external_response',
  UNKNOWN: 'unknown',
};

export const SOURCE_LABELS = {
  [SOURCE_TYPES.MEMBER_PROVIDED]: 'Member provided',
  [SOURCE_TYPES.DOCUMENT_PROVIDED]: 'Document provided',
  [SOURCE_TYPES.REVIEWED_WITH_CHEW]: 'Reviewed with CHEW',
  [SOURCE_TYPES.CONNECTED_SOURCE]: 'Connected source',
  [SOURCE_TYPES.CHEW_DERIVED]: 'CHEW derived',
  [SOURCE_TYPES.EXTERNAL_RESPONSE]: 'External response',
  [SOURCE_TYPES.UNKNOWN]: 'Unknown',
};

// Deliberately three states for this first implementation, not the
// full illustrative list a future pass might want (e.g. a distinct
// "aging" early-warning state) — see this slice's own report for why:
// adding a state with no real consumer yet is exactly the
// over-engineering this foundation is supposed to avoid. The threshold
// math below already supports adding one later without a rewrite.
export const FRESHNESS_STATES = {
  CURRENT: 'current',
  NEEDS_UPDATE: 'needs_update',
  UNKNOWN: 'unknown',
};

export const FRESHNESS_LABELS = {
  [FRESHNESS_STATES.CURRENT]: 'Current',
  [FRESHNESS_STATES.NEEDS_UPDATE]: 'Needs update',
  [FRESHNESS_STATES.UNKNOWN]: 'Unknown freshness',
};

function normalizeSourceType(sourceType) {
  return Object.values(SOURCE_TYPES).includes(sourceType) ? sourceType : SOURCE_TYPES.UNKNOWN;
}

// Pure. `staleAfterDays` is supplied by the CALLER, per fact type, and —
// per the materiality doctrine — only when an actual active decision
// depends on this fact (e.g. a score is only "aging" relative to a goal
// that reads it; with no goal, nothing currently depends on it, so no
// threshold should be passed at all). There is no universal expiration
// window in this file. A missing `providedAt` or an omitted
// `staleAfterDays` is not an error — "not enough information to judge
// freshness" or "nothing currently depends on this" are their own
// honest outcomes, never a guess.
export function classifyFreshness({ providedAt, now = new Date(), staleAfterDays } = {}) {
  if (!providedAt) return FRESHNESS_STATES.UNKNOWN;
  if (!Number.isFinite(staleAfterDays)) return FRESHNESS_STATES.CURRENT;
  const ageMs = new Date(now).getTime() - new Date(providedAt).getTime();
  if (!Number.isFinite(ageMs) || ageMs < 0) return FRESHNESS_STATES.UNKNOWN;
  const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
  return ageDays >= staleAfterDays ? FRESHNESS_STATES.NEEDS_UPDATE : FRESHNESS_STATES.CURRENT;
}

// The one shared shape every surface (a Credit fact today, an Orbit
// node, a future room, a future consultant view) renders from. Source
// and freshness are computed independently and returned side by side —
// never collapsed into a single "quality" value.
export function describeFact({ sourceType, providedAt, now, staleAfterDays } = {}) {
  const resolvedSourceType = normalizeSourceType(sourceType);
  const freshness = classifyFreshness({ providedAt, now, staleAfterDays });
  return {
    sourceType: resolvedSourceType,
    sourceLabel: SOURCE_LABELS[resolvedSourceType],
    providedAt: providedAt ?? null,
    freshness,
    freshnessLabel: FRESHNESS_LABELS[freshness],
  };
}

// ============================================================================
// CONFLICT / UNCERTAINTY — the third, independent dimension. A fact can be
// MEMBER_PROVIDED + CURRENT + CONFLICT_DETECTED all at once; none of these
// three questions ("where did it come from," "how current is it," "do two
// observations of the SAME state disagree") ever collapses into another.
//
// Deliberately three states, same restraint as FRESHNESS_STATES above:
// NO_CONFLICT and CONFLICT_DETECTED are the two live states; RESOLVED
// exists so a domain can mark a past conflict handled without deleting
// the observations that caused it (see each domain's own resolution
// function — this file has no opinion on HOW a domain resolves one,
// only on how to describe the resulting state).
export const CONFLICT_STATES = {
  NO_CONFLICT: 'no_conflict',
  CONFLICT_DETECTED: 'conflict_detected',
  RESOLVED: 'resolved',
};

// No label for NO_CONFLICT on purpose — same reasoning as FRESHNESS's
// omitted "Current" badge (see CommandCenterOrbit.js's scoreReadout):
// restating "no conflict" next to every uncontested fact is metadata
// noise, not intelligence.
export const CONFLICT_LABELS = {
  [CONFLICT_STATES.NO_CONFLICT]: null,
  [CONFLICT_STATES.CONFLICT_DETECTED]: 'Conflict needs review',
  [CONFLICT_STATES.RESOLVED]: 'Resolved',
};

// Pure. `observations` is `[{ contextKey, value, ...anything else the
// caller wants carried through }]`. Two observations are ever compared
// ONLY when their contextKey is identical — the caller decides what
// "the same claimed state" means for its fact type (for the Credit
// score: same bureau AND same reported/as-of date; a different bureau
// or a different date is a different context and is never compared,
// exactly the "unlike measurements" guard this foundation's directive
// requires). A context group is a conflict when it contains more than
// one DISTINCT value — no numeric tolerance, no recency tiebreaker, no
// source-prestige tiebreaker: two claims about the literal same state
// that disagree at all are a contradiction, full stop. A context with
// only one observation, or where every observation in it agrees, is
// NO_CONFLICT — never flagged merely for existing.
export function detectConflicts(observations) {
  const byContext = new Map();
  for (const obs of observations ?? []) {
    if (!byContext.has(obs.contextKey)) byContext.set(obs.contextKey, []);
    byContext.get(obs.contextKey).push(obs);
  }
  const conflicts = [];
  for (const [contextKey, group] of byContext) {
    const distinctValues = new Set(group.map((o) => o.value));
    if (distinctValues.size > 1) conflicts.push({ contextKey, observations: group });
  }
  return conflicts;
}

// The shared shape every surface renders conflict state from — mirrors
// describeFact()'s role for source/freshness. Takes detectConflicts()'s
// output directly so a caller never has to re-derive "is this a
// conflict" from the raw list itself.
export function describeConflictState(conflicts) {
  const list = conflicts ?? [];
  const state = list.length > 0 ? CONFLICT_STATES.CONFLICT_DETECTED : CONFLICT_STATES.NO_CONFLICT;
  return {
    state,
    label: CONFLICT_LABELS[state],
    conflicts: list,
  };
}
