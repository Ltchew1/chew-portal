// scripts/verify-db.js
//
// Connects with DATABASE_URL (pooled — the same connection string the app
// uses at runtime) and confirms every table from db/schema.sql exists.
//
// Usage: npm run db:verify

const { Client } = require('pg');
const { loadEnvLocal } = require('./loadEnv');

loadEnvLocal();

const EXPECTED_TABLES = [
  'users',
  'client_status',
  'dispute_items',
  'attestations',
  'generated_letters',
  'generated_letter_items',
  'dispute_tracker_entries',
];

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set. Add it to .env.local (see .env.example).');
    process.exit(1);
  }

  const client = new Client({ connectionString });
  await client.connect();
  try {
    const { rows: nowRows } = await client.query('SELECT NOW() AS now');
    console.log(`Connected. Database time: ${nowRows[0].now}`);

    const { rows: tableRows } = await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
    );
    const existing = new Set(tableRows.map((r) => r.table_name));

    const missing = EXPECTED_TABLES.filter((t) => !existing.has(t));
    if (missing.length > 0) {
      console.error(`Missing tables: ${missing.join(', ')}`);
      console.error('Run `npm run db:migrate` to apply db/schema.sql.');
      process.exit(1);
    }

    console.log(`All ${EXPECTED_TABLES.length} expected tables present:`);
    for (const t of EXPECTED_TABLES) console.log(`  - ${t}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Connection failed:', err.message);
  process.exit(1);
});
