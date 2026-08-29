// lib/letterContent.js
//
// Composes actual letter text from curated phrase banks — never from a
// live model call. A dispute letter is a legal document; the set of
// possible phrasings needs to be fully known and auditable (the compliance
// scanners read literal source text), which an LLM call at generation time
// can't guarantee. "Individualized, never templated-looking" comes from
// randomly selecting among several hand-written variants for each section
// plus the client's own item details — not from generative unpredictability.
//
// Every function here is pure: given the same inputs and the same random
// picks, it produces the same text. The randomness only matters once, at
// generation time — the result is persisted (lib/letters.js) and never
// regenerated, so re-reading a letter later always shows exactly what was
// actually sent, not a fresh roll.
//
// LETTER QUALITY PASS — each compose function now returns both `content`
// (the flat string, unchanged shape, still the plain-text record and
// on-screen preview) and `sections` (the same facts as a structured
// object — sender/recipient blocks, subject, salutation, itemized
// entries, legal paragraph, signature) built from ONE set of resolved
// item entries so the two representations can never disagree with each
// other about which random phrase was picked. `sections` is what
// lib/letterPdf.js lays out with real typographic hierarchy instead of
// dumping one monospace blob. Also the first place `clientNotes` (the
// client's own free-text account of an item, captured at flagging time)
// actually reaches a letter — it was already in the database and simply
// never selected by the callers that feed this file.

import { FCRA_CITATIONS, ESCALATION_FAILURE_CITATIONS } from './fcraCitations';

function pick(variants) {
  return variants[Math.floor(Math.random() * variants.length)];
}

function todayFormatted() {
  return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function memberFullName(member) {
  return [member.firstName, member.lastName].filter(Boolean).join(' ').trim() || 'the undersigned';
}

function memberAddressLines(member) {
  const lines = [member.addressLine1, member.addressLine2].filter(Boolean);
  const cityLine = [member.city, member.state].filter(Boolean).join(', ') + (member.postalCode ? ` ${member.postalCode}` : '');
  if (cityLine.trim()) lines.push(cityLine.trim());
  return lines;
}

const REASON_PHRASES = {
  not_mine: [
    'I do not recognize this account and have no record of ever opening it.',
    'This account is not mine — I have no history with this creditor and never opened it.',
    'I have no knowledge of this account. It was not opened by me.',
  ],
  not_authorized: [
    'I did not authorize this item and never approved this charge, account, or inquiry.',
    'This item was not authorized by me at any time.',
    'I have no record of approving this account or transaction, and I am disputing it as unauthorized.',
  ],
};

const SALUTATIONS = {
  bureau: 'To Whom It May Concern',
  secondary_bureau: 'To Whom It May Concern',
  furnisher: 'To Whom It May Concern',
};

const OPENING_PHRASES = {
  bureau: [
    (name) => `I am writing to dispute the following item(s) currently appearing on my credit report with your agency. My name is ${name}, and I am the consumer to whom this file belongs.`,
    (name) => `This letter is a formal dispute of inaccurate information in my credit file, submitted under the Fair Credit Reporting Act. I am ${name}, the consumer identified below.`,
    (name) => `I am disputing the item(s) listed below, which appear on the credit report your agency maintains for me, ${name}.`,
  ],
  secondary_bureau: [
    (name) => `I am writing to dispute the following item(s) currently appearing in the consumer file your agency maintains for me. My name is ${name}.`,
    (name) => `This letter formally disputes information in the report your agency keeps on file for me, ${name}, under the Fair Credit Reporting Act.`,
    (name) => `I am disputing the item(s) listed below, which appear in the file your agency maintains for me, ${name}.`,
  ],
  furnisher: [
    (name) => `I am writing to dispute information your company has furnished to one or more consumer reporting agencies regarding an account associated with my name, ${name}.`,
    (name) => `This letter disputes an item your company has reported to the credit bureaus concerning me, ${name}. I am disputing it directly with you under the Fair Credit Reporting Act.`,
    (name) => `I am ${name}, and I am disputing the account described below, which your company has furnished to one or more consumer reporting agencies.`,
  ],
};

const CLOSING_PHRASES = {
  bureau: [
    'I request that you conduct a reasonable reinvestigation of the item(s) above and correct or delete any information that cannot be verified as accurate. Please send me written confirmation of the results.',
    'Please investigate this matter and provide me with written notice of the outcome, including deletion or correction of any item that cannot be verified.',
    'I ask that you reinvestigate the item(s) listed above and notify me in writing of the results, along with an updated copy of my report if any changes are made.',
  ],
  secondary_bureau: [
    'I request that you conduct a reasonable reinvestigation of the item(s) above and correct or delete any information that cannot be verified as accurate. Please send me written confirmation of the results.',
    'Please investigate this matter and provide me with written notice of the outcome.',
    'I ask that you reinvestigate the item(s) listed above and notify me in writing of the results.',
  ],
  furnisher: [
    'I request that you investigate this matter directly and correct or withdraw any inaccurate information you have furnished to the consumer reporting agencies. Please notify me in writing of the outcome.',
    'Please conduct a reasonable investigation of this dispute and instruct any consumer reporting agency you have furnished this information to, to correct or delete it if it cannot be verified. I would appreciate written confirmation.',
    'I ask that you review this account and correct your reporting if the information cannot be verified as accurate, and confirm the outcome to me in writing.',
  ],
};

// Resolves each item's random reason phrase exactly once, and carries the
// client's own words forward under an explicit, honest label — this is
// the consumer's own account, not a fact CHEW is itself asserting, so it
// is never blended into the reason sentence itself.
function buildItemEntries(items) {
  return items.map((item, i) => ({
    index: i + 1,
    creditorName: item.creditorName,
    accountNumber: item.accountNumber || null,
    reasonText: pick(REASON_PHRASES[item.reason] ?? REASON_PHRASES.not_mine),
    clientNotes: item.clientNotes || null,
  }));
}

function formatItemLineText(entry) {
  const parts = [`${entry.index}. ${entry.creditorName}`];
  if (entry.accountNumber) parts.push(`(Account: ${entry.accountNumber})`);
  let line = `${parts.join(' ')} — ${entry.reasonText}`;
  if (entry.clientNotes) line += `\n   Additional context I provided: ${entry.clientNotes}`;
  return line;
}

// Stage 1 (bureau), Stage 2 (furnisher), Stage 3 (secondary bureau) all
// share this shape — a standard dispute letter, just addressed differently
// and citing the FCRA provision that actually governs that recipient.
export function composeDisputeLetter({ member, items, recipientType, recipientName, recipientAddressLines }) {
  const name = memberFullName(member);
  const citation = FCRA_CITATIONS[recipientType] ?? FCRA_CITATIONS.bureau;
  const opening = pick(OPENING_PHRASES[recipientType] ?? OPENING_PHRASES.bureau)(name);
  const closing = pick(CLOSING_PHRASES[recipientType] ?? CLOSING_PHRASES.bureau);
  const salutation = SALUTATIONS[recipientType] ?? SALUTATIONS.bureau;
  const senderAddressLines = memberAddressLines(member);
  const subject = `Re: Dispute of Credit Report Information — ${name}`;
  // Some bureau address blocks (lib/creditAddresses.js's BUREAU_ADDRESSES)
  // already lead with the entity's own name (Experian, Innovis), while
  // others start straight from a legally distinct entity name (Equifax
  // Information Services, LLC) — the recipient block only ever needs the
  // name once, so drop the address block's own first line when it's
  // literally identical to recipientName rather than printing it twice.
  const recipientBlockLines = recipientAddressLines[0] === recipientName ? recipientAddressLines.slice(1) : recipientAddressLines;

  const itemEntries = buildItemEntries(items);
  const itemLines = itemEntries.map(formatItemLineText).join('\n');

  const legalParagraph = citation.text;
  const movParagraph = citation.mov ?? null;

  const lines = [
    name,
    ...senderAddressLines,
    '',
    todayFormatted(),
    '',
    recipientName,
    ...recipientBlockLines,
    '',
    subject,
    '',
    `Dear ${salutation},`,
    '',
    opening,
    '',
    'The item(s) I am disputing are:',
    '',
    itemLines,
    '',
    [legalParagraph, movParagraph].filter(Boolean).join('\n\n'),
    '',
    closing,
    '',
    'Sincerely,',
    '',
    name,
  ];

  const sections = {
    senderName: name,
    senderAddressLines,
    date: todayFormatted(),
    recipientName,
    recipientAddressLines: recipientBlockLines,
    subject,
    salutation: `Dear ${salutation},`,
    opening,
    itemsIntro: 'The item(s) I am disputing are:',
    items: itemEntries,
    legalParagraph,
    movParagraph,
    closing,
    signOff: 'Sincerely,',
    signatureName: name,
  };

  return { content: lines.join('\n'), sections };
}

// Stage 4: a narrative for a CFPB or FTC complaint — not a letter to a
// bureau or furnisher. Cites the specific prior failure the client
// reports, per the constitution ("citing the specific prior failure").
// No `sections`/PDF here on purpose: this narrative is meant to be
// copied into CFPB/FTC's own web complaint form (see LetterGenerator.js's
// UI copy), so a plain, easily-copyable string is the actually useful
// format — a PDF would work against the one real thing the client needs
// to do with this text.
export function composeEscalationNarrative({ member, items, recipientType, priorRecipientName, failureReason, failureDetail }) {
  const name = memberFullName(member);
  const failure = ESCALATION_FAILURE_CITATIONS[failureReason] ?? ESCALATION_FAILURE_CITATIONS.other;
  const failureText = failure.text ?? failureDetail ?? 'the issue described below';

  const itemEntries = buildItemEntries(items);
  const itemLines = itemEntries.map(formatItemLineText).join('\n');
  const agency = recipientType === 'ftc' ? 'Federal Trade Commission' : 'Consumer Financial Protection Bureau';

  const lines = [
    `Complaint narrative — ${agency}`,
    `Prepared by: ${name}`,
    `Date: ${todayFormatted()}`,
    '',
    `I previously disputed the following item(s) with ${priorRecipientName}:`,
    '',
    itemLines,
    '',
    `${priorRecipientName} did not resolve this dispute properly. Specifically: ${failureText}`,
  ];
  if (failureDetail && failure.text) {
    lines.push('', `Additional detail I provided: ${failureDetail}`);
  }
  lines.push('', 'I am requesting that this matter be investigated and that the item(s) above be corrected or removed if they cannot be verified as accurate.');

  return { content: lines.join('\n'), sections: null };
}
