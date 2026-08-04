// lib/db.js
//
// Thin query helper over node-postgres. No ORM, no query builder — plain
// SQL, parameterized. Uses the pooled DATABASE_URL for normal app queries
// (API routes, server components); DDL/migrations use DATABASE_URL_UNPOOLED
// directly (see scripts/run-schema.js), never this pooled client.

import { Pool } from 'pg';

let pool;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        'DATABASE_URL is not set. Add it in .env.local (dev) or Vercel → Settings → ' +
        'Environment Variables (prod). See README "Database setup".'
      );
    }
    pool = new Pool({ connectionString });
  }
  return pool;
}

// query('SELECT * FROM users WHERE clerk_user_id = $1', [clerkUserId])
export async function query(text, params) {
  return getPool().query(text, params);
}

// Run multiple statements against one client on one connection — use when
// a sequence of inserts must succeed or fail together (e.g. creating a
// dispute_items row and its attestations row).
export async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
