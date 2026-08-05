// lib/users.js
//
// The one place app code (as opposed to the standalone scripts, which are
// plain CommonJS and can't import this ESM module — see scripts/loadEnv.js)
// upserts a `users` row from a Clerk profile. Every Credit Lab table hangs
// off users.id, not the Clerk user id directly, so this runs before any
// dispute_items/attestations write.

import { query } from './db';

export async function ensureUserRow({ clerkUserId, email, firstName, lastName }) {
  const { rows } = await query(
    `INSERT INTO users (clerk_user_id, email, first_name, last_name)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (clerk_user_id)
     DO UPDATE SET email = EXCLUDED.email, first_name = EXCLUDED.first_name,
                   last_name = EXCLUDED.last_name, updated_at = now()
     RETURNING id`,
    [clerkUserId, email ?? null, firstName ?? null, lastName ?? null]
  );
  return rows[0].id;
}
