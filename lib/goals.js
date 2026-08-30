// lib/goals.js
//
// The Goal Graph's foundation table — deliberately room-agnostic (see
// db/schema.sql's comment on `goals`) so a future room can reuse this same
// shape instead of growing its own. Only Credit populates it today, with
// goal_type='credit_score'. Setting a new goal for the same (room,
// goal_type) replaces the old one — the partial unique index on
// (user_id, room, goal_type) WHERE status='active' means "set a goal" is
// always an upsert, never a second parallel target to reconcile.

import { query } from './db';
import { ensureUserRow } from './users';
import { logEvent } from './events';

export async function setActiveGoal({ clerkUserId, email, firstName, lastName, room, goalType, targetValue, targetDate, notes }) {
  const userId = await ensureUserRow({ clerkUserId, email, firstName, lastName });
  const previous = await getActiveGoal(clerkUserId, room, goalType);
  const { rows } = await query(
    `INSERT INTO goals (user_id, room, goal_type, target_value, target_date, notes)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id, room, goal_type) WHERE status = 'active'
     DO UPDATE SET target_value = EXCLUDED.target_value, target_date = EXCLUDED.target_date,
                   notes = EXCLUDED.notes, updated_at = now()
     RETURNING id, room, goal_type AS "goalType", target_value AS "targetValue",
               target_date AS "targetDate", status, notes, created_at AS "createdAt", updated_at AS "updatedAt"`,
    [userId, room, goalType, targetValue, targetDate ?? null, notes ?? null]
  );
  const goal = rows[0];
  await logEvent({
    userId, room, eventType: 'goal_set', subject: targetValue,
    previousState: previous ? { targetValue: previous.targetValue } : null,
    newState: { targetValue }, metadata: { goalType },
    relatedGoalId: goal.id, severity: 'info',
  });
  return goal;
}

export async function getActiveGoal(clerkUserId, room, goalType) {
  const { rows } = await query(
    `SELECT g.id, g.room, g.goal_type AS "goalType", g.target_value AS "targetValue",
            g.target_date AS "targetDate", g.status, g.notes, g.created_at AS "createdAt", g.updated_at AS "updatedAt"
     FROM goals g
     JOIN users u ON u.id = g.user_id
     WHERE u.clerk_user_id = $1 AND g.room = $2 AND g.goal_type = $3 AND g.status = 'active'`,
    [clerkUserId, room, goalType]
  );
  return rows[0] ?? null;
}

export async function listActiveGoalsForUser(clerkUserId) {
  const { rows } = await query(
    `SELECT g.id, g.room, g.goal_type AS "goalType", g.target_value AS "targetValue",
            g.target_date AS "targetDate", g.status, g.notes, g.created_at AS "createdAt"
     FROM goals g
     JOIN users u ON u.id = g.user_id
     WHERE u.clerk_user_id = $1 AND g.status = 'active'
     ORDER BY g.created_at DESC`,
    [clerkUserId]
  );
  return rows;
}
