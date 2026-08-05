// scripts/set-client-status.js
//
// The documented manual way to change a client's status until an admin UI
// exists. Writes the audit-trail row to client_status, then mirrors it to
// Clerk publicMetadata (the fast read every room gate in The Lab checks — see
// lib/clientStatus.js). If the Clerk update fails after the DB write
// succeeds, the script exits non-zero and says so — the DB row is already
// correct, so re-run is safe (it inserts a fresh status row either way).
//
// This is a plain CommonJS script run outside Next.js (see scripts/loadEnv.js
// for why), so it talks to Postgres and Clerk directly rather than
// importing lib/clientStatus.js — that file uses ESM import/export and is
// bundled by Next, not runnable via plain `node`.
//
// Usage:
//   npm run status:set -- --email=client@example.com --status=paid --set-by=you@chew.com
//   npm run status:set -- --clerk-user-id=user_abc123 --status=accepted --set-by=you@chew.com --note="signed program agreement"

const { Client } = require('pg');
const { createClerkClient } = require('@clerk/backend');
const { loadEnvLocal } = require('./loadEnv');

loadEnvLocal();

const VALID_STATUSES = ['applicant', 'accepted', 'paid'];

function parseArgs() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) args[match[1]] = match[2];
  }
  return args;
}

async function main() {
  const args = parseArgs();
  const email = args.email;
  const clerkUserIdArg = args['clerk-user-id'];
  const status = args.status;
  const setBy = args['set-by'];
  const note = args.note;

  if (!status || !VALID_STATUSES.includes(status)) {
    console.error(`--status is required and must be one of: ${VALID_STATUSES.join(', ')}`);
    process.exit(1);
  }
  if (!setBy) {
    console.error('--set-by is required (who is making this change — goes in the audit trail).');
    process.exit(1);
  }
  if (!email && !clerkUserIdArg) {
    console.error('Provide --email or --clerk-user-id to identify the client.');
    process.exit(1);
  }

  const secretKey = process.env.CLERK_SECRET_KEY;
  const databaseUrl = process.env.DATABASE_URL;
  if (!secretKey) {
    console.error('CLERK_SECRET_KEY is not set. Add it to .env.local.');
    process.exit(1);
  }
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set. Add it to .env.local.');
    process.exit(1);
  }

  const clerk = createClerkClient({ secretKey });

  let clerkUser;
  if (clerkUserIdArg) {
    clerkUser = await clerk.users.getUser(clerkUserIdArg);
  } else {
    const { data } = await clerk.users.getUserList({ emailAddress: [email] });
    if (data.length === 0) {
      console.error(`No Clerk user found with email ${email}`);
      process.exit(1);
    }
    clerkUser = data[0];
  }

  const primaryEmail =
    clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ??
    email ??
    null;

  const dbClient = new Client({ connectionString: databaseUrl });
  await dbClient.connect();
  let userId;
  try {
    const { rows } = await dbClient.query(
      `INSERT INTO users (clerk_user_id, email, first_name, last_name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (clerk_user_id)
       DO UPDATE SET email = EXCLUDED.email, first_name = EXCLUDED.first_name,
                     last_name = EXCLUDED.last_name, updated_at = now()
       RETURNING id`,
      [clerkUser.id, primaryEmail, clerkUser.firstName, clerkUser.lastName]
    );
    userId = rows[0].id;

    await dbClient.query(
      `INSERT INTO client_status (user_id, status, set_by, note) VALUES ($1, $2, $3, $4)`,
      [userId, status, setBy, note ?? null]
    );
  } finally {
    await dbClient.end();
  }

  try {
    await clerk.users.updateUserMetadata(clerkUser.id, {
      publicMetadata: { clientStatus: status },
    });
  } catch (err) {
    console.error(
      `DB status row was written, but mirroring to Clerk publicMetadata failed: ${err.message}\n` +
      `Every room gate in The Lab reads Clerk metadata, so this user will NOT see the new status until ` +
      `this succeeds. Re-run this same command to retry — it's safe, it just adds another audit row.`
    );
    process.exit(1);
  }

  console.log(`Set status for ${primaryEmail ?? clerkUser.id} (${clerkUser.id}) -> ${status}`);
}

main().catch((err) => {
  console.error('Failed to set status:', err.message);
  process.exit(1);
});
