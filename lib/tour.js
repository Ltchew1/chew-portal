// lib/tour.js
//
// Tracks whether a client has completed the first-visit guided tour at
// /dashboard/lab. Backed by users.has_completed_tour (see db/schema.sql).
// Kept separate from lib/users.js since that file is specifically the
// Clerk-profile upsert; this is tour-specific read/write logic used by
// the Lab hub page and the tour-completion API route.

import { query } from './db';
import { ensureUserRow } from './users';

export async function hasCompletedTour(clerkUserId) {
  const { rows } = await query(
    'SELECT has_completed_tour FROM users WHERE clerk_user_id = $1',
    [clerkUserId]
  );
  return rows[0]?.has_completed_tour ?? false;
}

// A brand-new user may not have a users row yet (nothing else creates one
// until they touch a gated room) — ensure it exists before marking done.
export async function markTourCompleted({ clerkUserId, email, firstName, lastName }) {
  await ensureUserRow({ clerkUserId, email, firstName, lastName });
  await query(
    'UPDATE users SET has_completed_tour = true, updated_at = now() WHERE clerk_user_id = $1',
    [clerkUserId]
  );
}
