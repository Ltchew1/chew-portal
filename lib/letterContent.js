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

function formatItemLine(item, index) {
  const parts = [`${index + 1}. ${item.creditorName}`];
  if (item.accountNumber) parts.push(`(Account: ${item.accountNumber})`);
  const reasonText = pick(REASON_PHRASES[item.reason] ?? REASON_PHRASES.not_mine);
  return `${parts.join(' ')} — ${reasonText}`;
}

// Stage 1 (bureau), Stage 2 (furnisher), Stage 3 (secondary bureau) all
// share this shape — a standard dispute letter, just addressed differently
// and citing the FCRA provision that actually governs that recipient.
export function composeDisputeLetter({ member, items, recipientType, recipientName, recipientAddressLines, escalationNotes }) {
  const name = memberFullName(member);
  const citation = FCRA_CITATIONS[recipientType] ?? FCRA_CITATIONS.bureau;
  const opening = pick(OPENING_PHRASES[recipientType] ?? OPENING_PHRASES.bureau)(name);
  const closing = pick(CLOSING_PHRASES[recipientType] ?? CLOSING_PHRASES.bureau);
  const salutation = SALUTATIONS[recipientType] ?? SALUTATIONS.bureau;

  const itemLines = items.map(formatItemLine).join('\n');

  const legalParagraph = citation.text;
  const movParagraph = citation.mov ? `\n\n${citation.mov}` : '';
  const escalationParagraph = escalationNotes ? `\n\nFor your reference: ${escalationNotes}` : '';

  const lines = [
    name,
    ...memberAddressLines(member),
    '',
    todayFormatted(),
    '',
    recipientName,
    ...recipientAddressLines,
    '',
    `Re: Dispute of Credit Report Information — ${name}`,
    '',
    `Dear ${salutation},`,
    '',
    opening,
    '',
    'The item(s) I am disputing are:',
    '',
    itemLines,
    '',
    legalParagraph + movParagraph + escalationParagraph,
    '',
    closing,
    '',
    'Sincerely,',
    '',
    name,
  ];

  return lines.join('\n');
}

// Stage 4: a narrative for a CFPB or FTC complaint — not a letter to a
// bureau or furnisher. Cites the specific prior failure the client
// reports, per the constitution ("citing the specific prior failure").
export function composeEscalationNarrative({ member, items, recipientType, priorRecipientName, failureReason, failureDetail }) {
  const name = memberFullName(member);
  const failure = ESCALATION_FAILURE_CITATIONS[failureReason] ?? ESCALATION_FAILURE_CITATIONS.other;
  const failureText = failure.text ?? failureDetail ?? 'the issue described below';

  const itemLines = items.map(formatItemLine).join('\n');
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

  return lines.join('\n');
}
