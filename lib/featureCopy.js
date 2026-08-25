// lib/featureCopy.js
//
// The vocabulary for anything not yet live — kept in one place so no page
// invents its own tone, and so it stays easy to audit against the
// directive's rule: elegant, never a fake release date, never "feature
// unavailable" / "under construction" / "sorry, this isn't ready."

export const STATUS_LABELS = {
  internal: 'In Development',
  preview: 'In Development',
  locked: 'Coming Soon',
  beta: 'Beta',
};

export const EXPANSION_LINES = [
  'More intelligence is coming to CHEW.',
  'The system is expanding.',
  'New capabilities are being built behind the scenes.',
  'More ways to learn, build, own, and move are on the way.',
];

export function roomComingSoonCopy(roomName, tagline) {
  return {
    title: roomName,
    description: tagline,
    statusLabel: STATUS_LABELS.locked,
  };
}
