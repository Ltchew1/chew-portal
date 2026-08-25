// lib/opportunities.js
//
// Persistent opportunity objects — the same architecture as
// lib/barriers.js, opposite direction: upside CHEW noticed, tracked
// symmetrically instead of as disposable text. See that file's comment for
// the sourceKey/upsert/reconcile reasoning, which is identical here.

import { query } from './db';

export async function upsertOpportunity({
  userId, room, relatedGoalId, sourceKey, title, whatImproved, whyItMatters,
  whatItUnlocked, suggestedAction, confidence,
}) {
  const { rows } = await query(
    `INSERT INTO opportunities
       (user_id, room, related_goal_id, source_key, title, what_improved, why_it_matters,
        what_it_unlocked, suggested_action, confidence)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (user_id, source_key) WHERE status = 'active'
     DO UPDATE SET title = EXCLUDED.title, what_improved = EXCLUDED.what_improved,
                   why_it_matters = EXCLUDED.why_it_matters, what_it_unlocked = EXCLUDED.what_it_unlocked,
                   suggested_action = EXCLUDED.suggested_action, confidence = EXCLUDED.confidence
     RETURNING id, source_key AS "sourceKey", title, what_improved AS "whatImproved",
               why_it_matters AS "whyItMatters", what_it_unlocked AS "whatItUnlocked",
               suggested_action AS "suggestedAction", confidence, created_at AS "createdAt", (xmax = 0) AS "isNew"`,
    [userId, room, relatedGoalId ?? null, sourceKey, title, whatImproved, whyItMatters,
      whatItUnlocked ?? null, suggestedAction, confidence]
  );
  return rows[0];
}

export async function resolveStaleOpportunities(userId, room, stillValidKeys) {
  const { rows } = await query(
    `UPDATE opportunities
     SET status = 'resolved', resolved_at = now()
     WHERE user_id = $1 AND room = $2 AND status = 'active' AND NOT (source_key = ANY($3::text[]))
     RETURNING id, source_key AS "sourceKey", title`,
    [userId, room, stillValidKeys]
  );
  return rows;
}

export async function listActiveOpportunities(clerkUserId, room) {
  const params = [clerkUserId];
  let roomClause = '';
  if (room) {
    params.push(room);
    roomClause = 'AND o.room = $2';
  }
  const { rows } = await query(
    `SELECT o.id, o.room, o.title, o.what_improved AS "whatImproved", o.why_it_matters AS "whyItMatters",
            o.what_it_unlocked AS "whatItUnlocked", o.suggested_action AS "suggestedAction",
            o.confidence, o.created_at AS "createdAt"
     FROM opportunities o
     JOIN users u ON u.id = o.user_id
     WHERE u.clerk_user_id = $1 AND o.status = 'active' ${roomClause}
     ORDER BY o.created_at DESC`,
    params
  );
  return rows;
}
