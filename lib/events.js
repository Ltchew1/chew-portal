// lib/events.js
//
// The universal event log — "something happened in this person's economic
// life." Every other intelligence primitive (What Changed, barrier/
// opportunity detection, notifications) reads from this instead of each
// re-deriving its own notion of "anything interesting?" from raw tables.
//
// logEvent() is called at the source of truth — inside the same write path
// (and, where one already exists, the same DB transaction) as the action
// itself — never reconstructed later from timestamps. Pass an existing pg
// client via `client` to log atomically with the action that caused it;
// omit it to use the pool directly for call sites with no transaction of
// their own.

import { query } from './db';

export async function logEvent({
  client, userId, room, eventType, subject, source = 'client',
  previousState, newState, severity = 'info', requiresAction = false,
  relatedGoalId, metadata,
}) {
  const runner = client ?? { query: (text, params) => query(text, params) };
  const { rows } = await runner.query(
    `INSERT INTO chew_events
       (user_id, room, event_type, subject, source, previous_state, new_state,
        severity, requires_action, related_goal_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id, occurred_at`,
    [
      userId, room, eventType, subject, source,
      previousState ? JSON.stringify(previousState) : null,
      newState ? JSON.stringify(newState) : null,
      severity, requiresAction, relatedGoalId ?? null,
      metadata ? JSON.stringify(metadata) : null,
    ]
  );
  return rows[0];
}

export async function countEvents(clerkUserId, room) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS count
     FROM chew_events ce
     JOIN users u ON u.id = ce.user_id
     WHERE u.clerk_user_id = $1 AND ce.room = $2`,
    [clerkUserId, room]
  );
  return rows[0].count;
}

export async function listRecentEvents(clerkUserId, { room, limit = 20 } = {}) {
  const params = [clerkUserId];
  let roomClause = '';
  if (room) {
    params.push(room);
    roomClause = `AND ce.room = $${params.length}`;
  }
  params.push(limit);
  const { rows } = await query(
    `SELECT ce.id, ce.room, ce.event_type AS "eventType", ce.subject, ce.occurred_at AS "occurredAt",
            ce.source, ce.severity, ce.requires_action AS "requiresAction", ce.metadata
     FROM chew_events ce
     JOIN users u ON u.id = ce.user_id
     WHERE u.clerk_user_id = $1 ${roomClause}
     ORDER BY ce.occurred_at DESC
     LIMIT $${params.length}`,
    params
  );
  return rows;
}
