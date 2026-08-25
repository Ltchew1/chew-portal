// lib/recommendations.js
//
// Recommendation history — "Why CHEW told me that." Every Next Best Move
// CHEW has shown a client is kept, not overwritten: setRecommendation()
// only writes a new row when the action text actually changed from the
// active one, superseding the old with a reason rather than deleting it.
// `observed` and `whatWouldChangeThis` are what makes a recommendation
// inspectable instead of a black box — see RecommendationExplainer.js.

import { query } from './db';

export async function getActiveRecommendation(clerkUserId, room) {
  const { rows } = await query(
    `SELECT r.id, r.room, r.action_text AS "actionText", r.reason, r.observed,
            r.what_would_change_this AS "whatWouldChangeThis", r.href, r.created_at AS "createdAt"
     FROM recommendations r
     JOIN users u ON u.id = r.user_id
     WHERE u.clerk_user_id = $1 AND r.room = $2 AND r.status = 'active'`,
    [clerkUserId, room]
  );
  return rows[0] ?? null;
}

// Idempotent: if the active recommendation already has this exact action
// text, nothing changes (no churn from re-running the same computation on
// every page load). Only a genuinely different recommendation supersedes
// the old one and writes history.
export async function setRecommendation({
  userId, clerkUserId, room, relatedGoalId, actionText, reason, observed, whatWouldChangeThis, href,
}) {
  const current = await getActiveRecommendation(clerkUserId, room);
  if (current && current.actionText === actionText) {
    return current;
  }

  if (current) {
    await query(
      `UPDATE recommendations SET status = 'superseded', superseded_at = now(), superseded_reason = $2
       WHERE id = $1`,
      [current.id, `New recommendation: ${actionText}`]
    );
  }

  const { rows } = await query(
    `INSERT INTO recommendations (user_id, room, related_goal_id, action_text, reason, observed, what_would_change_this, href)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, room, action_text AS "actionText", reason, observed,
               what_would_change_this AS "whatWouldChangeThis", href, created_at AS "createdAt"`,
    [userId, room, relatedGoalId ?? null, actionText, reason, JSON.stringify(observed ?? []), JSON.stringify(whatWouldChangeThis ?? []), href ?? null]
  );
  return { ...rows[0], previous: current };
}

export async function listRecommendationHistory(clerkUserId, room, limit = 10) {
  const { rows } = await query(
    `SELECT r.id, r.action_text AS "actionText", r.reason, r.status, r.created_at AS "createdAt",
            r.superseded_at AS "supersededAt", r.superseded_reason AS "supersededReason"
     FROM recommendations r
     JOIN users u ON u.id = r.user_id
     WHERE u.clerk_user_id = $1 AND r.room = $2
     ORDER BY r.created_at DESC
     LIMIT $3`,
    [clerkUserId, room, limit]
  );
  return rows;
}
