// scripts/check-no-transmission.js
//
// The "no-transmission lock," automated: fails the check if the codebase
// ever grows a path that could send a dispute to a bureau. Two checks:
//   1. No outbound network calls (fetch/axios/http(s).request) inside
//      app/api/lab/** route files (any room, not just Credit) — those
//      routes may only ever talk to our own Postgres via lib/db.js.
//   2. No occurrence, anywhere in the app (excluding this script's own
//      identifier list below), of identifiers that would signal a
//      bureau-transmission code path. This should always find zero
//      matches; if it ever finds one, that's this guardrail doing its
//      job — remove the code rather than the check.
//
// Run via `npm run compliance:no-transmission`.

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'scripts']);

const BANNED_IDENTIFIERS = [
  'sendDispute', 'submitDispute', 'transmitDispute', 'sendToBureau',
  'mailDispute', 'emailBureau', 'fileDispute', 'submitToBureau',
  'sendLetterToBureau', 'bureauApi', 'bureauTransmit',
];

const NETWORK_CALL_PATTERN = /\b(fetch|axios|http\.request|https\.request)\s*\(/;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

function main() {
  const allFiles = walk(REPO_ROOT);
  const labApiFiles = allFiles.filter((f) =>
    f.includes(`${path.sep}app${path.sep}api${path.sep}lab${path.sep}`)
  );

  let violations = 0;

  for (const file of labApiFiles) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (NETWORK_CALL_PATTERN.test(line)) {
        console.error(
          `${path.relative(REPO_ROOT, file)}:${i + 1}: outbound network call in a Lab API route — ` +
          `routes here may only talk to our own database`
        );
        violations += 1;
      }
    });
  }

  for (const file of allFiles) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const id of BANNED_IDENTIFIERS) {
        if (line.includes(id)) {
          console.error(
            `${path.relative(REPO_ROOT, file)}:${i + 1}: contains banned identifier "${id}" — this name ` +
            `signals a bureau-transmission code path, which must never exist`
          );
          violations += 1;
        }
      }
    });
  }

  if (violations > 0) {
    console.error(`\n${violations} no-transmission violation(s) found.`);
    process.exit(1);
  }

  console.log(
    `Checked ${labApiFiles.length} Lab API route file(s) for outbound calls, and ` +
    `${allFiles.length} file(s) repo-wide for banned identifiers — no transmission path found.`
  );
}

main();
