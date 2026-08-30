// lib/barriers.js
//
// Persistent barrier objects — "something is interfering with a goal" as a
// real row, not text a function recomputes and discards every page load.
// Reconciliation (lib/intelligenceCore.js) upserts by `sourceKey`, a stable
// fingerprint of the underlying condition, so re-detecting the same issue
// never forks a duplicate row, and the exact row that gets marked resolved
// when the condition clears is what powers "You fixed it."
//
// Every barrier is written in the same shape as the communication grammar
// the whole platform uses for negative signals: what happened, what it
// hurts, why, how serious, do this now, do not do, what success looks
// like, when CHEW checks again.

import { query } from './db';

const BARRIER_FIELDS = ['title', 'whatHappened', 'whatItHurts', 'why', 'severity', 'doThisNow', 'doNotDo', 'whatSuccessLooksLike', 'recheckTrigger'];

// `(xmax = 0)` is the standard Postgres idiom for "this row was just
// inserted, not updated by the ON CONFLICT branch" — lets the reconciler
// only fire a "new barrier" notification once, not on every refresh.
//
// RECOMMENDATION PURITY — a page VIEW (re-detecting the same active
// condition) must never itself be a WRITE. Before this pass, the
// INSERT ... ON CONFLICT DO UPDATE below ran unconditionally on every
// reconciliation pass, real UPDATE and all, even when every field was
// byte-identical to what was already stored (confirmed against a real
// Postgres instance: the row's xmin advanced on a repeat pass with no
// data change). Fixed the same way lib/recommendations.js's
// setRecommendation already handles this: read the current active row
// first, and skip the write entirely when nothing real changed.
export async function upsertBarrier({
  userId, room, relatedGoalId, sourceKey, title, whatHappened, whatItHurts, why,
  severity, doThisNow, doNotDo, whatSuccessLooksLike, recheckTrigger,
}) {
  const incoming = { title, whatHappened, whatItHurts, why, severity, doThisNow, doNotDo: doNotDo ?? null, whatSuccessLooksLike, recheckTrigger };
  const { rows: existingRows } = await query(
    `SELECT id, title, what_happened AS "whatHappened", what_it_hurts AS "whatItHurts", why, severity,
            do_this_now AS "doThisNow", do_not_do AS "doNotDo", what_success_looks_like AS "whatSuccessLooksLike",
            recheck_trigger AS "recheckTrigger", detected_at AS "detectedAt"
     FROM barriers WHERE user_id = $1 AND source_key = $2 AND status = 'active'`,
    [userId, sourceKey]
  );
  const existing = existingRows[0];
  if (existing && BARRIER_FIELDS.every((f) => existing[f] === incoming[f])) {
    return { ...existing, sourceKey, isNew: false };
  }

  const { rows } = await query(
    `INSERT INTO barriers
       (user_id, room, related_goal_id, source_key, title, what_happened, what_it_hurts, why,
        severity, do_this_now, do_not_do, what_success_looks_like, recheck_trigger)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     ON CONFLICT (user_id, source_key) WHERE status = 'active'
     DO UPDATE SET title = EXCLUDED.title, what_happened = EXCLUDED.what_happened,
                   what_it_hurts = EXCLUDED.what_it_hurts, why = EXCLUDED.why,
                   severity = EXCLUDED.severity, do_this_now = EXCLUDED.do_this_now,
                   do_not_do = EXCLUDED.do_not_do, what_success_looks_like = EXCLUDED.what_success_looks_like,
                   recheck_trigger = EXCLUDED.recheck_trigger
     RETURNING id, source_key AS "sourceKey", title, what_happened AS "whatHappened",
               what_it_hurts AS "whatItHurts", why, severity, do_this_now AS "doThisNow",
               do_not_do AS "doNotDo", what_success_looks_like AS "whatSuccessLooksLike",
               recheck_trigger AS "recheckTrigger", detected_at AS "detectedAt", (xmax = 0) AS "isNew"`,
    [userId, room, relatedGoalId ?? null, sourceKey, title, whatHappened, whatItHurts, why,
      severity, doThisNow, doNotDo ?? null, whatSuccessLooksLike, recheckTrigger]
  );
  return rows[0];
}

// Resolves every active barrier for (userId, room) whose sourceKey is NOT
// in `stillValidKeys` — i.e. CHEW no longer detects that condition.
// Returns the full prior-state row for each barrier actually resolved by
// this call — not just id/title — so a caller (the "You fixed it"
// notification, and the Barrier Dissolve sequence on Today) can show
// what was actually blocking, not just that something changed.
export async function resolveStaleBarriers(userId, room, stillValidKeys, resolutionNote) {
  const { rows } = await query(
    `UPDATE barriers
     SET status = 'resolved', resolved_at = now(), resolution_note = $4
     WHERE user_id = $1 AND room = $2 AND status = 'active' AND NOT (source_key = ANY($3::text[]))
     RETURNING id, related_goal_id AS "relatedGoalId", source_key AS "sourceKey", title,
               what_happened AS "whatHappened", what_it_hurts AS "whatItHurts", why, severity,
               do_this_now AS "doThisNow", resolution_note AS "resolutionNote", resolved_at AS "resolvedAt"`,
    [userId, room, stillValidKeys, resolutionNote]
  );
  return rows;
}

export async function listActiveBarriers(clerkUserId, room) {
  const params = [clerkUserId];
  let roomClause = '';
  if (room) {
    params.push(room);
    roomClause = 'AND b.room = $2';
  }
  const { rows } = await query(
    `SELECT b.id, b.room, b.title, b.what_happened AS "whatHappened", b.what_it_hurts AS "whatItHurts",
            b.why, b.severity, b.do_this_now AS "doThisNow", b.do_not_do AS "doNotDo",
            b.what_success_looks_like AS "whatSuccessLooksLike", b.recheck_trigger AS "recheckTrigger",
            b.detected_at AS "detectedAt"
     FROM barriers b
     JOIN users u ON u.id = b.user_id
     WHERE u.clerk_user_id = $1 AND b.status = 'active' ${roomClause}
     ORDER BY b.detected_at DESC`,
    params
  );
  return rows;
}
