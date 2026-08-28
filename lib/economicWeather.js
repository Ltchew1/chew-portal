// lib/economicWeather.js
//
// Economic Weather's opportunity-history layer — turns a room's canonical,
// persisted opportunity IDs (opportunities.id, the same identity Radar,
// Life Map, and opportunity_unlocked events already use) into an honest
// historical signal: did the member's active opportunity set expand,
// contract, stay the same, or change composition since CHEW last looked?
//
// CORE RULE — Economic Weather may only reason historically about
// opportunity access using stable persisted opportunity IDs. Never counts
// alone, titles, labels, array position, or display text: two different
// opportunities can share a count, and the same opportunity can be
// restated with different wording, so only comparing the ID sets is
// honest.
//
// SCOPE — a room's opportunity pipeline is opt-in. Only a room listed in
// ROOM_SCOPE below has a real, persisted opportunity pipeline behind it.
// There is deliberately no generic "Opportunity Access" aggregate: that
// would imply CHEW sees every possible opportunity across the whole
// platform, when today only Credit's pipeline is real. A second room
// earns its own ROOM_SCOPE entry once it has one; a cross-room rollup
// earns its own function once more than one room does.
import { query } from './db';
import { getUserIdByClerkId } from './users';

const ROOM_SCOPE = {
  credit: { scope: 'credit', label: 'Credit Opportunity Access' },
};

const UNAVAILABLE_REASON = 'CHEW does not yet have a real active opportunity population for this subject/domain.';

function canonicalizeIds(ids) {
  return Array.from(new Set((ids ?? []).map(Number))).sort((a, b) => a - b);
}

function idsFromField(field) {
  return field ? field.split(',').filter(Boolean).map(Number) : [];
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

// Deterministic set comparison — never count math. `previousIds`/
// `currentIds` need not be pre-canonicalized; this canonicalizes them
// itself so callers can pass raw arrays safely.
export function compareOpportunitySets(previousIds, currentIds) {
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

// Plain-English explanation of one comparison. Deliberately never says
// "improved" — an expanded set is not automatically a better one, only a
// larger one; whether it's beneficial is a judgment this function cannot
// make from ID sets alone.
function explainComparison({ label, comparison }) {
  const { status, added, removed, previousCount, currentCount } = comparison;
  const STATUS_HEADLINE = {
    unchanged: 'Unchanged', expanded: 'Expanded', contracted: 'Contracted',
    composition_changed: 'Mix Changed', mixed: 'Mixed',
  };
  let detail;
  switch (status) {
    case 'unchanged':
      detail = `The same ${plural(currentCount, 'opportunity')} remained active since the last observation. Nothing changed.`;
      break;
    case 'expanded':
      detail = `${plural(previousCount, 'persisted opportunity')} remained active and ${plural(added.length, 'new opportunity')} became active.`;
      break;
    case 'contracted':
      detail = `${plural(removed.length, 'previously active opportunity')} disappeared. ${plural(currentCount, 'opportunity')} remain active.`;
      break;
    case 'composition_changed':
      detail = `The number of active opportunities stayed the same (${currentCount}), but the actual opportunity set changed: ${plural(removed.length, 'opportunity')} left and ${plural(added.length, 'opportunity')} took their place.`;
      break;
    case 'mixed':
      detail = `Both additions and removals happened since the last observation — ${plural(added.length, 'new opportunity')} became active while ${plural(removed.length, 'opportunity')} disappeared, changing the active count from ${previousCount} to ${currentCount}.`;
      break;
    default:
      detail = '';
  }
  return { headline: `${label} — ${STATUS_HEADLINE[status]}`, detail };
}

function changeTextFor({ status, added, removed }) {
  if (status === 'unchanged') return 'No change';
  if (status === 'expanded') return `+${added.length} new ${added.length === 1 ? 'opportunity' : 'opportunities'}`;
  if (status === 'contracted') return `-${removed.length} ${removed.length === 1 ? 'opportunity' : 'opportunities'}`;
  return `${added.length} added, ${removed.length} removed`;
}

// Trend may only be stated when three or more observations genuinely
// agree on one direction — a single transition is never "momentum."
// `stepComparisons` must be consecutive, oldest-to-newest comparisons
// (snapshot[n] -> snapshot[n+1]).
function detectTrend(stepComparisons) {
  if (stepComparisons.length < 2) return null;
  if (stepComparisons.every((c) => c.status === 'expanded')) return 'consistently_expanding';
  if (stepComparisons.every((c) => c.status === 'contracted')) return 'consistently_contracting';
  return null;
}

export async function getLatestOpportunitySnapshot(userId, room) {
  const { rows } = await query(
    `SELECT id, active_ids AS "activeIds", newly_unlocked_ids AS "newlyUnlockedIds",
            active_count AS "activeCount", captured_at AS "capturedAt"
     FROM opportunity_history_snapshots WHERE user_id = $1 AND room = $2
     ORDER BY captured_at DESC, id DESC LIMIT 1`,
    [userId, room]
  );
  return rows[0] ?? null;
}

export async function listOpportunitySnapshots(userId, room, limit = 5) {
  const { rows } = await query(
    `SELECT id, active_ids AS "activeIds", newly_unlocked_ids AS "newlyUnlockedIds",
            active_count AS "activeCount", captured_at AS "capturedAt"
     FROM opportunity_history_snapshots WHERE user_id = $1 AND room = $2
     ORDER BY captured_at DESC, id DESC LIMIT $3`,
    [userId, room, limit]
  );
  return rows; // newest first
}

// RECOMMENDATION PURITY, applied to opportunity history — a page view
// re-observing the same canonical active-ID set must not itself create a
// new history row. Same read-then-compare-then-skip discipline as
// upsertBarrier/upsertOpportunity/setRecommendation: read the most recent
// snapshot, and only write when the canonical active_ids set genuinely
// differs. `newlyUnlockedIds` never gates the write by itself — it is a
// transition marker recorded alongside a real active-set change, not a
// reason to write on its own.
export async function recordOpportunitySnapshotIfChanged({ userId, room, activeOpportunityIds, newlyUnlockedIds = [] }) {
  const canonicalActive = canonicalizeIds(activeOpportunityIds);
  const canonicalUnlocked = canonicalizeIds(newlyUnlockedIds);
  const latest = await getLatestOpportunitySnapshot(userId, room);
  const latestActiveIds = latest ? idsFromField(latest.activeIds) : [];
  const comparison = compareOpportunitySets(latestActiveIds, canonicalActive);

  if (latest && comparison.status === 'unchanged') {
    return { snapshot: latest, isNew: false, comparison };
  }

  const { rows } = await query(
    `INSERT INTO opportunity_history_snapshots (user_id, room, active_ids, newly_unlocked_ids, active_count)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, active_ids AS "activeIds", newly_unlocked_ids AS "newlyUnlockedIds",
               active_count AS "activeCount", captured_at AS "capturedAt"`,
    [userId, room, canonicalActive.join(','), canonicalUnlocked.join(','), canonicalActive.length]
  );
  return { snapshot: rows[0], isNew: true, comparison: latest ? comparison : null };
}

// The read side — a plain-English, scope-honest historical signal for one
// room's opportunity access. Applies the history-depth discipline: one
// observation states current state only; two states the change since the
// last one; three or more may state a trend, and only when every step in
// the window genuinely agrees on one direction.
export async function getRoomOpportunityWeather(clerkUserId, room) {
  const scopeInfo = ROOM_SCOPE[room];
  if (!scopeInfo) {
    throw new Error(`lib/economicWeather.js: no opportunity-history scope registered for room "${room}"`);
  }
  const unavailable = () => ({
    scope: scopeInfo.scope, label: scopeInfo.label, status: 'unavailable', historyDepth: 'none',
    headline: `${scopeInfo.label} — Unavailable`, detail: UNAVAILABLE_REASON,
    currentCount: null, changeText: null, trend: null, addedCount: 0, removedCount: 0,
  });

  const userId = await getUserIdByClerkId(clerkUserId);
  if (!userId) return unavailable();

  const snapshots = await listOpportunitySnapshots(userId, room, 5); // newest first
  if (snapshots.length === 0) return unavailable();

  const [latest, previous] = snapshots;
  const currentCount = latest.activeCount;

  if (!previous) {
    return {
      scope: scopeInfo.scope, label: scopeInfo.label, status: 'current', historyDepth: 'current_only',
      headline: `${scopeInfo.label} — Current`,
      detail: `${plural(currentCount, 'opportunity')} currently active. This is CHEW's first observation for this domain — nothing to compare against yet.`,
      currentCount, changeText: null, trend: null, addedCount: 0, removedCount: 0,
    };
  }

  const comparison = compareOpportunitySets(idsFromField(previous.activeIds), idsFromField(latest.activeIds));
  const { headline, detail } = explainComparison({ label: scopeInfo.label, comparison });

  let trend = null;
  if (snapshots.length >= 3) {
    const stepComparisons = [];
    for (let i = snapshots.length - 1; i > 0; i -= 1) {
      stepComparisons.push(compareOpportunitySets(idsFromField(snapshots[i].activeIds), idsFromField(snapshots[i - 1].activeIds)));
    }
    trend = detectTrend(stepComparisons);
  }

  return {
    scope: scopeInfo.scope, label: scopeInfo.label, status: comparison.status,
    historyDepth: trend ? 'trend' : 'change_since_last',
    headline, detail, currentCount, changeText: changeTextFor(comparison), trend,
    // Exposed for the visual layer's field rendering (how many nodes to
    // show entering/receding) — the exact same numbers explainComparison
    // already narrated in `detail`, never a separate count derived a
    // second way.
    addedCount: comparison.added.length, removedCount: comparison.removed.length,
  };
}

export async function getCreditOpportunityWeather(clerkUserId) {
  return getRoomOpportunityWeather(clerkUserId, 'credit');
}
