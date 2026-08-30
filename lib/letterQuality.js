// lib/letterQuality.js
//
// Deterministic pre-persist quality gate for composed letters — checked
// once, at generation time, before a letter is ever written to
// generated_letters or exposed as downloadable. This is a backstop, not
// the primary gate (the API route already requires a complete mailing
// address and a non-empty item list before calling into lib/letters.js);
// it exists because a legal document deserves a second, independent
// check against the actually-composed text, not just the inputs that fed
// it. Every check here is a real defect detector — missing fields,
// literal placeholder artifacts, duplicated paragraphs — never a
// judgment call about writing quality (that's what the phrase banks in
// lib/letterContent.js are for). Where a fact is genuinely missing, this
// throws a clear, actionable message rather than letting the letter
// generate with a silent gap — never invents the missing fact.

const PLACEHOLDER_PATTERN = /\bundefined\b|\bnull\b|\[object Object\]|\{\{.*?\}\}/i;

// Shared by both compose paths — a literal "undefined"/"null"/unresolved
// template token in the final text is always a composition bug, never
// intentional content, regardless of letter type.
export function scanForPlaceholderArtifacts(content) {
  const problems = [];
  if (PLACEHOLDER_PATTERN.test(content)) {
    problems.push('The generated text contains an unresolved placeholder or literal null/undefined value — this is a system error, not something fixable by re-entering information.');
  }
  const nonEmptyLines = content.split('\n').map((l) => l.trim()).filter(Boolean);
  for (let i = 1; i < nonEmptyLines.length; i += 1) {
    if (nonEmptyLines[i].length > 20 && nonEmptyLines[i] === nonEmptyLines[i - 1]) {
      problems.push('The generated text contains a duplicated paragraph — this is a system error.');
      break;
    }
  }
  if (nonEmptyLines.length === 0) {
    problems.push('The generated text is blank.');
  }
  return problems;
}

// Structural facts specific to a mailed dispute letter (stage 1-3) — an
// escalation narrative (stage 4) has its own, already-enforced input
// requirements (prior letter, failure reason) at the API route, so this
// is not reused there.
export function validateDisputeLetterFacts({ member, sections, recipientAddressLines, items }) {
  const problems = [];
  if (!member?.firstName && !member?.lastName) {
    problems.push('Your account is missing a name — add your name before generating a letter.');
  }
  if (!sections.senderAddressLines || sections.senderAddressLines.length === 0) {
    problems.push('Your mailing address is incomplete.');
  }
  if (!recipientAddressLines || recipientAddressLines.length === 0) {
    problems.push('The recipient address is missing.');
  }
  if (!items || items.length === 0) {
    problems.push('No items were included in this letter.');
  }
  return problems;
}

// Called by lib/letters.js right after composing, before the INSERT.
// Throws rather than returning a boolean — there is no reasonable
// "generate anyway" path once a real defect is detected in a document
// about to be treated as a legal record.
export function assertLetterQuality(problems) {
  if (problems.length > 0) {
    throw new Error(`This letter could not be generated: ${problems.join(' ')}`);
  }
}
