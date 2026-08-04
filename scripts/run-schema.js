// scripts/run-schema.js
//
// Applies db/schema.sql to the database. Uses DATABASE_URL_UNPOOLED
// (Neon's direct connection) since DDL shouldn't go through the pooler.
// Idempotent — the schema file is all CREATE ... IF NOT EXISTS.
//
// Usage: npm run db:migrate

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { loadEnvLocal } = require('./loadEnv');

loadEnvLocal();

async function main() {
  const connectionString = process.env.DATABASE_URL_UNPOOLED;
  if (!connectionString) {
    console.error(
      'DATABASE_URL_UNPOOLED is not set. Add it to .env.local (see .env.example) — ' +
      'this must be Neon\'s unpooled/direct connection string, not the pooled one.'
    );
    process.exit(1);
  }

  const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query(schemaSql);
    console.log('Schema applied successfully.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Failed to apply schema:', err.message);
  process.exit(1);
});
