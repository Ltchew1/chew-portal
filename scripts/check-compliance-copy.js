// scripts/check-compliance-copy.js
//
// Scans every file under app/dashboard/credit-lab, app/components/credit-lab,
// and app/api/credit-lab for FORBIDDEN_PHRASES (defined once, in
// lib/creditLabCompliance.js) — the automated form of the "client-decision
// enforcement" and "accuracy guard" guardrails: this catches prescriptive
// or promissory language before it ships, not just at review time.
//
// Reads the phrase list directly out of lib/creditLabCompliance.js (rather
// than duplicating it here) so there is exactly one list to maintain.
//
// Run via `npm run compliance:copy`. Exits non-zero and prints file:line
// for every match found.

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');

function loadForbiddenPhrases() {
  const compliancePath = path.join(REPO_ROOT, 'lib', 'creditLabCompliance.js');
  const source = fs.readFileSync(compliancePath, 'utf8');
  const match = source.match(/export const FORBIDDEN_PHRASES = \[([\s\S]*?)\];/);
  if (!match) {
    throw new Error('Could not find FORBIDDEN_PHRASES in lib/creditLabCompliance.js');
  }
  return match[1]
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith("'"))
    .map((line) => line.replace(/^'|',?$/g, ''));
}

const TARGET_DIRS = [
  path.join(REPO_ROOT, 'app', 'dashboard', 'credit-lab'),
  path.join(REPO_ROOT, 'app', 'components', 'credit-lab'),
  path.join(REPO_ROOT, 'app', 'api', 'credit-lab'),
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

function main() {
  const forbiddenPhrases = loadForbiddenPhrases();
  const files = TARGET_DIRS.flatMap((dir) => walk(dir));
  let violations = 0;

  for (const file of files) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      const lower = line.toLowerCase();
      for (const phrase of forbiddenPhrases) {
        if (lower.includes(phrase)) {
          console.error(`${path.relative(REPO_ROOT, file)}:${i + 1}: contains forbidden phrase "${phrase}"`);
          violations += 1;
        }
      }
    });
  }

  if (violations > 0) {
    console.error(`\n${violations} forbidden-phrase match(es) found. See lib/creditLabCompliance.js for the list and why.`);
    process.exit(1);
  }

  console.log(`Scanned ${files.length} file(s) under credit-lab — no forbidden phrases found.`);
}

main();
