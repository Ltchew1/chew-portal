// lib/creditAddresses.js
//
// Real mailing addresses for the letter generator's recipients, verified
// via web search at build time (each bureau's own site + independent
// consumer-law sources cross-checked) rather than assumed from memory —
// wrong addresses here mean a client's dispute never arrives, so this list
// is treated as load-bearing, not decorative copy.
//
// SageStream is deliberately absent: it was folded into LexisNexis Risk
// Solutions and no longer exists as a separate consumer report/company as
// of this writing — listing it would be presenting outdated information
// as current, which the portal constitution's "Proof Engine" section
// treats as the one unrecoverable kind of error.
//
// Addresses can change. Every letter that uses one of these also carries a
// short "confirm this address is still current" note in the UI — see
// AddressVerifyNote in the Letter Generator — rather than presenting this
// list as beyond doubt.

export const BUREAU_LABELS = {
  equifax: 'Equifax',
  experian: 'Experian',
  transunion: 'TransUnion',
  lexisnexis: 'LexisNexis Risk Solutions',
  innovis: 'Innovis',
};

export const PRIMARY_BUREAUS = ['equifax', 'experian', 'transunion'];
export const SECONDARY_BUREAUS = ['lexisnexis', 'innovis'];
export const ALL_BUREAUS = [...PRIMARY_BUREAUS, ...SECONDARY_BUREAUS];

// Multi-line mailing addresses, as they'd appear on an envelope.
export const BUREAU_ADDRESSES = {
  equifax: ['Equifax Information Services, LLC', 'P.O. Box 740256', 'Atlanta, GA 30374-0256'],
  experian: ['Experian', 'P.O. Box 4500', 'Allen, TX 75013'],
  transunion: ['TransUnion LLC Consumer Dispute Center', 'P.O. Box 2000', 'Chester, PA 19016'],
  lexisnexis: ['LexisNexis Risk Solutions Consumer Center', 'P.O. Box 105108', 'Atlanta, GA 30348-5108'],
  innovis: ['Innovis', 'P.O. Box 530088', 'Atlanta, GA 30353-0088'],
};

// CFPB accepts complaints by mail (source of truth for a downloadable
// letter) — the online form at consumerfinance.gov/complaint is faster and
// should always be offered alongside the mailed option, never instead of
// explaining it. The FTC's consumer-complaint intake is online-only
// (reportfraud.ftc.gov) with no public mailing address for individual
// complaints, so FTC output is a narrative to paste into that form, not a
// mailable letter — the UI must not claim otherwise.
export const CFPB_ADDRESS = ['Consumer Financial Protection Bureau', 'P.O. Box 27170', 'Washington, DC 20038'];
export const CFPB_ONLINE_URL = 'https://www.consumerfinance.gov/complaint/';
export const FTC_ONLINE_URL = 'https://reportfraud.ftc.gov/';

export function formatAddressBlock(lines) {
  return lines.join('\n');
}
