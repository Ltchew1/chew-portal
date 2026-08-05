// lib/creditLabCompliance.js
//
// The single source of truth for every piece of compliance-load-bearing
// copy in the Credit Lab: the exact attestation statements a client signs
// off on, the standing disclosures, and a forbidden-phrase list that
// scripts/check-compliance-copy.js scans the whole module for. Nothing
// that displays this copy should hardcode its own version of it — import
// from here so there is exactly one wording to ever review or change.
//
// Why this matters architecturally: the Credit Lab must operate as
// client-executed education, never a service performed on the client's
// behalf, to stay outside Florida's Credit Service Organization statute
// (817.7001 et seq.). That line is drawn in this file as much as in any
// access-control code — see FORBIDDEN_PHRASES.

// Exact wording a client attests to per item, keyed by the `reason` they
// picked when flagging it (see db/schema.sql's dispute_items.reason CHECK
// constraint — these two keys are the only two reasons that can exist).
// recordAttestation() in lib/attestations.js rejects any statementText
// that doesn't match this exactly — a client can't attest to different
// wording than what they were actually shown.
export const ATTESTATION_STATEMENTS = {
  not_mine: 'I do not recognize this account. I did not open it and it is not mine.',
  not_authorized: 'I did not authorize this item. Any charge, account, or inquiry here was not something I approved.',
};

// Shown at Credit Lab entry (StandingDisclosures variant="entry") and again
// immediately before attestation/letter generation (variant="pre-generation",
// rendered inside AttestationGate).
export const STANDING_DISCLOSURE_POINTS = [
  'You file this dispute yourself, directly with the credit bureau — CHEW never submits, mails, or transmits anything on your behalf.',
  'CHEW provides education and tools here, not credit repair services.',
  "Accurate information can't be permanently removed from a credit report — this is only for items you don't recognize or didn't authorize.",
  'You always have the right to dispute directly with the bureaus yourself, for free, with or without CHEW.',
];

// Phrases that would cross from "explain how disputing works" into
// "tell the client which items to dispute," "CHEW performs the dispute,"
// or "promise an outcome." Checked by scripts/check-compliance-copy.js
// against every file under app/dashboard/credit-lab and
// app/components/credit-lab. Keep this list growing, not shrinking.
export const FORBIDDEN_PHRASES = [
  'we will dispute',
  'we will file',
  'we will submit',
  'we will send',
  'we dispute this for you',
  'we file this for you',
  'let us handle',
  'we handle the dispute',
  'remove negative',
  'remove this account',
  'delete this account',
  'boost your score',
  'increase your score by',
  'improve your score by',
  'raise your score by',
  'guaranteed to remove',
  'guaranteed removal',
  'this item is inaccurate',
  'this account is inaccurate',
  'you should dispute',
  'we recommend disputing',
  'this item looks disputable',
];

export function findForbiddenLanguage(text) {
  const lower = text.toLowerCase();
  return FORBIDDEN_PHRASES.filter((phrase) => lower.includes(phrase));
}
