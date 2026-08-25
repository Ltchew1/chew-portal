// lib/secretWeapon.js
//
// "YOUR CREDIT SECRET WEAPON" — built now, using only what CHEW already
// verified via the Credit room's own reconciled intelligence
// (lib/intelligenceCore.js), not a new data source. Pure function, same
// pattern as computeScorePath()/buildCreditIntelligence(): given the
// already-computed intel for this room, derive the nine-section synthesis.
// Gets more sophisticated automatically as CHEW knows more — every field
// below already degrades honestly to "not enough logged yet" rather than
// inventing something.

const STAGES = [
  { key: 'flag', label: 'Flag anything you don\'t recognize' },
  { key: 'attest', label: 'Attest to what you\'ve flagged' },
  { key: 'letter', label: 'Generate your letter(s)' },
  { key: 'track', label: 'Track what you mail and log responses' },
];

export function buildCreditSecretWeapon(intel) {
  const { scorePath, goal, nextBestMove, activeBarriers, chewNoticed, counts, planStatus } = intel;
  const hasActivity = planStatus !== null && planStatus !== undefined;

  const target = scorePath
    ? `${scorePath.target}+ (currently ${scorePath.current}, gap ${scorePath.gap <= 0 ? 'met' : scorePath.gap})`
    : goal
      ? `${goal.targetValue} credit score`
      : 'Not set yet — set a target on the Credit room overview.';

  const whatMattersMost = nextBestMove
    ? nextBestMove.action
    : 'Pull your reports and flag your first item — everything else follows from that.';

  const whatDoesntMatter = activeBarriers.length > 0
    ? 'Anything not tied to the active barrier above — resolving that first is worth more than starting something new.'
    : nextBestMove?.avoid && nextBestMove.avoid !== 'Nothing.'
      ? nextBestMove.avoid
      : 'Multitasking your plan — one dominant move at a time is the strongest approach here.';

  let strongestAdvantage;
  const resolvedCount = (chewNoticed.find((n) => /came back updated or deleted/.test(n)) ? 1 : 0);
  if (!hasActivity) {
    strongestAdvantage = 'Nothing logged yet — this fills in the moment you flag your first item.';
  } else if (activeBarriers.length === 0 && counts.unattested === 0 && counts.attestedNoLetter === 0 && counts.untrackedLetters === 0 && counts.stalled === 0) {
    strongestAdvantage = 'No active barriers right now — your plan is moving cleanly, with nothing stuck.';
  } else if (resolvedCount > 0) {
    strongestAdvantage = 'You already have at least one item resolved in your favor — real, confirmed progress.';
  } else {
    strongestAdvantage = 'You\'ve actually started the process — most people who mean to never get past this point.';
  }

  const biggestConstraint = activeBarriers.length > 0
    ? activeBarriers[0].title
    : nextBestMove
      ? nextBestMove.why
      : 'No report has been pulled yet — that\'s the starting constraint for everyone.';

  const doneStages = new Set();
  if (counts.unattested === 0 && (counts.attestedNoLetter > 0 || counts.untrackedLetters > 0 || counts.stalled > 0)) doneStages.add('flag');
  if (counts.attestedNoLetter === 0 && (counts.untrackedLetters > 0 || counts.stalled > 0)) doneStages.add('attest');
  if (counts.untrackedLetters === 0 && counts.stalled >= 0 && (counts.stalled > 0)) doneStages.add('letter');
  const sequence = STAGES.filter((s) => !doneStages.has(s.key)).slice(0, 3).map((s) => s.label);
  if (sequence.length === 0) sequence.push('Keep the Dispute Tracker current as responses come in.');

  const whatCouldKnockYouOffTrack = [
    'A letter passing 30 days with no logged response (FCRA §611\'s window).',
    'Applying for new credit before an active dispute resolves.',
  ];

  const whatChewWillWatch = activeBarriers.length > 0
    ? activeBarriers.map((b) => b.recheckTrigger)
    : ['Your next flagged item, generated letter, or logged score update.'];

  const whatUnlocksNext = nextBestMove?.next ?? 'CHEW reassesses the moment you take your next action.';

  return {
    target,
    whatMattersMost,
    whatDoesntMatter,
    strongestAdvantage,
    biggestConstraint,
    sequence,
    whatCouldKnockYouOffTrack,
    whatChewWillWatch,
    whatUnlocksNext,
  };
}
