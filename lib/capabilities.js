// lib/capabilities.js
//
// The capability registry — "what need can CHEW recognize." Deliberately
// separate from providers: a capability can (and today, every one does)
// exist with zero ready providers behind it. Admin-managed for now (no UI
// writes this table yet — createCapability exists for seeding/future admin
// tooling, not a client-facing path).

import { query } from './db';

export async function createCapability({ key, name, description, category }) {
  const { rows } = await query(
    `INSERT INTO capabilities (key, name, description, category)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, category = EXCLUDED.category
     RETURNING id, key, name, description, category, created_at AS "createdAt"`,
    [key, name, description, category ?? null]
  );
  return rows[0];
}

export async function getCapabilityByKey(key) {
  const { rows } = await query(
    `SELECT id, key, name, description, category, created_at AS "createdAt" FROM capabilities WHERE key = $1`,
    [key]
  );
  return rows[0] ?? null;
}

export async function listCapabilities() {
  const { rows } = await query(
    `SELECT id, key, name, description, category, created_at AS "createdAt" FROM capabilities ORDER BY name ASC`
  );
  return rows;
}
