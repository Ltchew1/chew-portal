// lib/notifications.js
//
// In-app notification channel — architected now so email/push/SMS delivery
// (each its own later, separately-authorized integration — never wired up
// without the founder's own credentials) can read from this same table
// rather than needing a second event model bolted on afterward. Rows are
// created only by lib/intelligenceCore.js's reconciler, at the moments a
// human would actually want to be told something: a new barrier, a barrier
// resolved, a new opportunity, or a recommendation that changed.

import { query } from './db';

const VALID_TYPES = [
  'critical_action', 'plan_at_risk', 'opportunity_found', 'back_on_track',
  'milestone', 'chew_noticed', 'reassessment_complete',
];

export async function createNotification({ userId, room, type, title, body, href, relatedEventId }) {
  if (!VALID_TYPES.includes(type)) {
    throw new Error(`Invalid notification type: ${type}`);
  }
  const { rows } = await query(
    `INSERT INTO notifications (user_id, room, type, title, body, href, related_event_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, room, type, title, body, href, created_at AS "createdAt"`,
    [userId, room, type, title, body, href ?? null, relatedEventId ?? null]
  );
  return rows[0];
}

export async function listRecentNotifications(clerkUserId, limit = 10) {
  const { rows } = await query(
    `SELECT n.id, n.room, n.type, n.title, n.body, n.href, n.created_at AS "createdAt", n.read_at AS "readAt"
     FROM notifications n
     JOIN users u ON u.id = n.user_id
     WHERE u.clerk_user_id = $1
     ORDER BY n.created_at DESC
     LIMIT $2`,
    [clerkUserId, limit]
  );
  return rows;
}

export async function markNotificationsRead(clerkUserId, notificationIds) {
  await query(
    `UPDATE notifications n
     SET read_at = COALESCE(read_at, now())
     FROM users u
     WHERE n.user_id = u.id AND u.clerk_user_id = $1 AND n.id = ANY($2::bigint[])`,
    [clerkUserId, notificationIds]
  );
}
