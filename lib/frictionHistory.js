// lib/frictionHistory.js
//
// Friction History — the same honest historical-ID-set discipline
// lib/economicWeather.js established for opportunities (see
// lib/idSetHistory.js for the shared rule), applied to barriers: did the
// member's active friction set expand, contract, stay the same, or change
// composition since CHEW last looked — and, uniquely to friction, which
// specific barrier ID has now survived the most consecutive observations.
//
// CORE RULE — reason historically using stable persisted barrier IDs
// (barriers.id) only. Never counts, titles, or display text.
//
// PERSISTENCE STREAK — "the thing that keeps surviving" is a derived
// read, never a stored counter: walk this room's snapshot history
// backwards from the latest row and count how many consecutive snapshots
// (including the latest) already contain a given barrier ID, stopping at
// the first snapshot where it's absent or at the end of history. A
// second column tracking "current streak" would be redundant, persisted
// state that could drift from the real snapshot rows it's summarizing —
// recomputing it from the rows themselves can't drift.
//
// SCOPE — same opt-in discipline as Economic Weather: only a room with a
// real, persisted barrier pipeline gets a ROOM_SCOPE entry. No generic
// cross-room "Friction" aggregate until more than one room has one.
import { query } from './db';
import { getUserIdByClerkId } from './users';
import { canonicalizeIds, idsFromField, plural, compareIdSets, detectTrend } from './idSetHistory';

const ROOM_SCOPE = {
  credit: { scope: 'credit', label: 'Credit Friction' },
};

const UNAVAILABLE_REASON = 'CHEW does not yet have a real active barrier population for this subject/domain.';

// How many of the most recent snapshots to fetch for the persistence-
// streak walk. A barrier that has survived every observation in this
// window reports its streak as "at least N" (see getFrictionHistory),
// never a fabricated exact count beyond what was actually fetched.
const HISTORY_WINDOW = 12;

function explainComparison({ label, comparison }) {
  const { status, added, removed, previousCount, currentCount } = comparison;
  const STATUS_HEADLINE = {
    unchanged: 'Unchanged', expanded: 'Expanded', contracted: 'Contracted',
    composition_changed: 'Mix Changed', mixed: 'Mixed',
  };
  let detail;
  switch (status) {
    case 'unchanged':
      detail = `The same ${plural(currentCount, 'barrier')} remained active since the last observation. Nothing changed.`;
      break;
    case 'expanded':
      detail = `${plural(previousCount, 'persisted barrier')} remained active and ${plural(added.length, 'new barrier')} appeared.`;
      break;
    case 'contracted':
      detail = `${plural(removed.length, 'previously active barrier')} cleared. ${plural(currentCount, 'barrier')} remain active.`;
      break;
    case 'composition_changed':
      detail = `The number of active barriers stayed the same (${currentCount}), but the actual set changed: ${plural(removed.length, 'barrier')} cleared and ${plural(added.length, 'barrier')} took their place.`;
      break;
    case 'mixed':
      detail = `Both new barriers and clearances happened since the last observation — ${plural(added.length, 'new barrier')} appeared while ${plural(removed.length, 'barrier')} cleared, changing the active count from ${previousCount} to ${currentCount}.`;
      break;
    default:
      detail = '';
  }
  return { headline: `${label} — ${STATUS_HEADLINE[status]}`, detail };
}

function changeTextFor({ status, added, removed }) {
  if (status === 'unchanged') return 'No change';
  if (status === 'expanded') return `+${added.length} new ${added.length === 1 ? 'barrier' : 'barriers'}`;
  if (status === 'contracted') return `-${removed.length} ${removed.length === 1 ? 'barrier' : 'barriers'} cleared`;
  return `${added.length} new, ${removed.length} cleared`;
}

export async function getLatestBarrierSnapshot(userId, room) {
  const { rows } = await query(
    `SELECT id, active_ids AS "activeIds", newly_detected_ids AS "newlyDetectedIds",
            active_count AS "activeCount", captured_at AS "capturedAt"
     FROM barrier_history_snapshots WHERE user_id = $1 AND room = $2
     ORDER BY captured_at DESC, id DESC LIMIT 1`,
    [userId, room]
  );
  return rows[0] ?? null;
}

export async function listBarrierSnapshots(userId, room, limit = HISTORY_WINDOW) {
  const { rows } = await query(
    `SELECT id, active_ids AS "activeIds", newly_detected_ids AS "newlyDetectedIds",
            active_count AS "activeCount", captured_at AS "capturedAt"
     FROM barrier_history_snapshots WHERE user_id = $1 AND room = $2
     ORDER BY captured_at DESC, id DESC LIMIT $3`,
    [userId, room, limit]
  );
  return rows; // newest first
}

// RECOMMENDATION PURITY, applied to barrier history — identical shape to
// lib/economicWeather.js's recordOpportunitySnapshotIfChanged: a page
// view re-observing the same canonical active-ID set must not itself
// create a new history row.
export async function recordBarrierSnapshotIfChanged({ userId, room, activeBarrierIds, newlyDetectedIds = [] }) {
  const canonicalActive = canonicalizeIds(activeBarrierIds);
  const canonicalDetected = canonicalizeIds(newlyDetectedIds);
  const latest = await getLatestBarrierSnapshot(userId, room);
  const latestActiveIds = latest ? idsFromField(latest.activeIds) : [];
  const comparison = compareIdSets(latestActiveIds, canonicalActive);

  if (latest && comparison.status === 'unchanged') {
    return { snapshot: latest, isNew: false, comparison };
  }

  const { rows } = await query(
    `INSERT INTO barrier_history_snapshots (user_id, room, active_ids, newly_detected_ids, active_count)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, active_ids AS "activeIds", newly_detected_ids AS "newlyDetectedIds",
               active_count AS "activeCount", captured_at AS "capturedAt"`,
    [userId, room, canonicalActive.join(','), canonicalDetected.join(','), canonicalActive.length]
  );
  return { snapshot: rows[0], isNew: true, comparison: latest ? comparison : null };
}

// For each currently-active barrier ID, how many consecutive snapshots
// (walking back from the latest, inclusive) has it appeared in — derived
// purely from the fetched `snapshots` (newest first), never a stored
// counter. `hitWindowEdge` is true when the streak ran to the oldest
// fetched snapshot without breaking — the real streak could be longer
// than HISTORY_WINDOW, so the caller reports "at least N," never a false
// exact number.
export function computePersistenceStreaks(snapshots) {
  const streaks = new Map(); // barrierId -> { streak, hitWindowEdge }
  if (snapshots.length === 0) return streaks;
  const currentIds = idsFromField(snapshots[0].activeIds);
  for (const id of currentIds) {
    let streak = 0;
    let hitWindowEdge = true;
    for (let i = 0; i < snapshots.length; i += 1) {
      if (idsFromField(snapshots[i].activeIds).includes(id)) {
        streak += 1;
      } else {
        hitWindowEdge = false;
        break;
      }
    }
    streaks.set(id, { streak, hitWindowEdge });
  }
  return streaks;
}

// The read side — a plain-English, scope-honest historical signal for one
// room's friction, plus (uniquely to friction) which currently-active
// barrier has survived the longest. Same history-depth discipline as
// Economic Weather: one observation states current state only; two
// states the change since the last one; three or more may state a trend.
export async function getRoomFrictionHistory(clerkUserId, room) {
  const scopeInfo = ROOM_SCOPE[room];
  if (!scopeInfo) {
    throw new Error(`lib/frictionHistory.js: no friction-history scope registered for room "${room}"`);
  }
  const unavailable = () => ({
    scope: scopeInfo.scope, label: scopeInfo.label, status: 'unavailable', historyDepth: 'none',
    headline: `${scopeInfo.label} — Unavailable`, detail: UNAVAILABLE_REASON,
    currentCount: null, changeText: null, trend: null, addedCount: 0, removedCount: 0,
    timeline: [], survivor: null,
  });

  const userId = await getUserIdByClerkId(clerkUserId);
  if (!userId) return unavailable();

  const snapshots = await listBarrierSnapshots(userId, room, HISTORY_WINDOW); // newest first
  if (snapshots.length === 0) return unavailable();

  const [latest, previous] = snapshots;
  const currentCount = latest.activeCount;
  const streaks = computePersistenceStreaks(snapshots);
  const survivor = currentCount > 0
    ? [...streaks.entries()].sort((a, b) => b[1].streak - a[1].streak)[0]
    : null;
  const survivorInfo = survivor
    ? { barrierId: survivor[0], observedFor: survivor[1].streak, atLeast: survivor[1].hitWindowEdge }
    : null;
  // Real timeline points for the visual layer — one per fetched snapshot,
  // oldest first, each a plain fact (when, how many active, which ids) —
  // never a fabricated in-between frame.
  const timeline = [...snapshots].reverse().map((s) => ({
    capturedAt: s.capturedAt, activeCount: s.activeCount, activeIds: idsFromField(s.activeIds),
  }));

  if (!previous) {
    return {
      scope: scopeInfo.scope, label: scopeInfo.label, status: 'current', historyDepth: 'current_only',
      headline: `${scopeInfo.label} — Current`,
      detail: `${plural(currentCount, 'barrier')} currently active. This is CHEW's first observation for this domain — nothing to compare against yet.`,
      currentCount, changeText: null, trend: null, addedCount: 0, removedCount: 0,
      timeline, survivor: survivorInfo,
    };
  }

  const comparison = compareIdSets(idsFromField(previous.activeIds), idsFromField(latest.activeIds));
  const { headline, detail } = explainComparison({ label: scopeInfo.label, comparison });

  let trend = null;
  if (snapshots.length >= 3) {
    const stepComparisons = [];
    for (let i = snapshots.length - 1; i > 0; i -= 1) {
      stepComparisons.push(compareIdSets(idsFromField(snapshots[i].activeIds), idsFromField(snapshots[i - 1].activeIds)));
    }
    trend = detectTrend(stepComparisons);
  }

  return {
    scope: scopeInfo.scope, label: scopeInfo.label, status: comparison.status,
    historyDepth: trend ? 'trend' : 'change_since_last',
    headline, detail, currentCount, changeText: changeTextFor(comparison), trend,
    addedCount: comparison.added.length, removedCount: comparison.removed.length,
    timeline, survivor: survivorInfo,
  };
}

export async function getCreditFrictionHistory(clerkUserId) {
  return getRoomFrictionHistory(clerkUserId, 'credit');
}

// Derived tracks for the timeline visual — one row per distinct barrier
// ID seen anywhere in the fetched window, each a presence bitmap aligned
// to the same ordered `timeline` points getRoomFrictionHistory already
// returns (oldest first). Sorted so the longest current streak (ending at
// the latest point) renders first — the "anchored" track the eye lands
// on while shorter-lived tracks start and stop around it. Pure and
// DB-free so it's trivially unit-testable against fixture timelines.
export function buildFrictionTracks(timeline) {
  const ids = new Set();
  for (const point of timeline) for (const id of point.activeIds) ids.add(id);
  const currentStreak = (presence) => {
    let s = 0;
    for (let i = presence.length - 1; i >= 0 && presence[i]; i -= 1) s += 1;
    return s;
  };
  const tracks = [...ids].map((barrierId) => ({
    barrierId,
    presence: timeline.map((point) => point.activeIds.includes(barrierId)),
  }));
  tracks.sort((a, b) => currentStreak(b.presence) - currentStreak(a.presence));
  return tracks;
}
