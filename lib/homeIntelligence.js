// lib/homeIntelligence.js
//
// The shared rule engine behind CHEW: The Lab's home — Plan Status, Next
// Best Move, "CHEW Noticed", "What Changed", and Opportunities. Built as a
// reusable primitive on purpose (see the portal directive's "identify
// intelligence primitives that multiple rooms can reuse"): buildXIntelligence()
// is a pure function over already-fetched data, and getHomeIntelligence()
// is the thin per-room loader that calls it. Today only Credit has real
// client data to reason over, so this file only exports
// buildCreditIntelligence/getCreditIntelligence — a second room adds a
// sibling buildXIntelligence(), and the home page merges the results.
//
// Every signal here is derived from the client's own data already stored
// for other reasons (dispute items, letters, tracker entries) — nothing is
// fetched from a bureau, and nothing is fabricated when data is missing;
// see each branch below for the honest fallback when a room has no
// activity yet.

import { listDisputeItemsForUser } from './disputeItems';
import { listLettersForUser } from './letters';
import { listTrackerEntriesForUser, listUntrackedLetters } from './disputeTracker';
import { getMailingAddress, hasCompleteMailingAddress } from './users';
import {
  getScoreGoal, listScoreSnapshots, pickLatestScore, computeScorePath, SCORE_RECONFIRM_WINDOW_DAYS,
  detectScoreConflicts, describeScoreConflict,
} from './creditScore';
import { listRecentEvents } from './events';
import { describeFact, FRESHNESS_STATES, describeConflictState } from './factProvenance';

const RECENT_WINDOW_DAYS = 14;
const RESPONSE_WINDOW_DAYS = 30; // FCRA §611 — see lib/fcraCitations.js; only bureau/secondary_bureau letters carry this deadline

// `now` is an explicit, injectable parameter (defaulting to the real
// wall clock) rather than an implicit `new Date()` reach-in — the
// Recommendation Purity pass's point: buildCreditIntelligence's output
// must be a deterministic function of its arguments, including "what
// time is it," never a hidden global. A stalled-response deadline
// genuinely passing between two page loads IS a real state change (and
// correctly produces a different recommendation) — this doesn't change
// that; it just makes the dependency explicit and testable instead of
// buried inside a helper.
function daysAgo(n, now) {
  const d = new Date(now);
  d.setDate(d.getDate() - n);
  return d;
}

function isRecent(iso, now) {
  if (!iso) return false;
  return new Date(iso) >= daysAgo(RECENT_WINDOW_DAYS, now);
}

function fmt(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// "What Changed" reads the universal event log (lib/events.js) instead of
// re-diffing timestamps across four different tables — one brain, one
// source for "did anything happen," not four ad-hoc reconstructions of it.
const EVENT_TEXT = {
  item_flagged: (e) => `You flagged ${e.subject}.`,
  item_attested: (e) => `You attested to ${e.subject}.`,
  letter_generated: (e) => `You generated a letter to ${e.subject}.`,
  escalation_generated: (e) => `You filed a complaint with ${e.subject}.`,
  tracking_started: (e) => `You started tracking your letter to ${e.subject}.`,
  letter_mailed: (e) => `You marked your letter to ${e.subject} as mailed.`,
  response_logged: (e) => `You logged a response from ${e.subject}${e.metadata?.responseType ? `: ${String(e.metadata.responseType).replace('_', ' ')}` : ''}.`,
  dispute_resolved: (e) => `You marked your dispute with ${e.subject} as resolved.`,
  goal_set: (e) => e.metadata?.goalType === 'credit_score' ? `You set a credit score target of ${e.subject}.` : `You set a target: ${e.subject}.`,
  score_logged: (e) => `You logged a score of ${e.subject}.`,
  score_conflict_resolved: (e) => `You clarified conflicting scores for your ${e.subject}.`,
  document_logged: (e) => `You added "${e.subject}" to your Evidence Vault.`,
  need_detected: (e) => `CHEW noticed a need: ${e.subject}.`,
  capability_matched: (e) => `CHEW matched a capability: ${e.subject}.`,
  handoff_initiated: (e) => `${e.subject}.`,
  handoff_consent_given: (e) => `${e.subject}.`,
  handoff_acknowledged: (e) => `${e.subject}.`,
  provider_outcome_received: (e) => `${e.subject}.`,
  followup_required: (e) => `${e.subject}.`,
};

export function eventToText(event) {
  return (EVENT_TEXT[event.eventType] ?? (() => `Update: ${event.subject}.`))(event);
}

// RECOMMENDATION PURITY — computeRecommendation is the whole "what should
// this client do next" decision, isolated on purpose: a pure function of
// already-derived signals (never fetches anything, never touches the
// DB), so it can be called, reasoned about, and tested completely apart
// from persistence. It NEVER writes a recommendation row — only
// lib/intelligenceCore.js's reconcileRoom does that, and only via
// lib/recommendations.js's setRecommendation, which itself only persists
// a new row when the computed actionText genuinely differs from what's
// already stored (see that file's "no-op if unchanged" check). Calling
// this function any number of times with the same inputs is free: no
// side effects, no history rows, no notifications — those only happen
// downstream, and only on a real change.
//
// planStatus and nextBestMove are returned together because they are
// one atomic decision, not two independent signals that happen to be
// computed side by side — every branch below is the single answer to
// "what's true about this plan right now, and what's the one dominant
// move that follows from it."
function computeRecommendation({
  stalled, unattested, attestedNoLetter, addressReady, untrackedLetters, hasAnyActivity, awaitingWithinWindow, goal,
  hasGoalWithoutScore, scoreNeedsUpdate, hasScoreConflict, scoreConflictDetail,
}) {
  // Every `impact` number below is read directly off data already in scope
  // for that branch — never a separate estimate. "Goals advanced" is
  // capped at 1 today because a client can only have one active
  // goal_type per room right now (lib/goals.js's partial unique index);
  // this stays honest rather than implying a multi-goal system that
  // doesn't exist yet. Today's home screen only renders this chain when
  // at least one number is nonzero — see app/components/today/ChewMoveCard.js.
  if (stalled.length > 0) {
    const entry = stalled[0];
    return {
      planStatus: 'plan_at_risk',
      nextBestMove: {
        action: `Consider escalating your letter to ${entry.recipientName}`,
        why: `It's been more than ${RESPONSE_WINDOW_DAYS} days since you mailed this (${fmt(entry.mailedDate)}) with no response logged — under FCRA §611, a bureau is generally expected to respond by now.`,
        effect: 'Moves this item from "waiting" to "escalated" — a CFPB or FTC complaint cites this specific delay.',
        supports: 'Your dispute for this item.',
        avoid: 'Nothing to avoid — this is a genuine option, not a requirement. No rush if you\'d rather wait a little longer.',
        next: 'Log a response in the Dispute Tracker if one arrives, any time — this suggestion updates automatically.',
        href: '/dashboard/lab/credit/letters',
        linkLabel: 'Go to Letters',
        impact: { constraintsRemoved: 1, goalsAdvanced: goal ? 1 : 0, pathwaysUnlocked: 0 },
      },
    };
  }
  if (unattested.length > 0) {
    return {
      planStatus: 'action_needed',
      nextBestMove: {
        action: `Attest to ${unattested.length} flagged item${unattested.length === 1 ? '' : 's'}`,
        why: 'A letter can\'t be generated for an item until you\'ve attested to it — that\'s the compliance gate, not a formality.',
        effect: 'Clears the one step between "flagged" and "ready to mail."',
        supports: 'Every item you\'ve already flagged.',
        avoid: 'Don\'t attest to anything you\'re not actually sure about — no rush.',
        next: 'CHEW reassesses the moment you attest.',
        href: '/dashboard/lab/credit/flag',
        linkLabel: 'Go to Flag Items',
        impact: { constraintsRemoved: unattested.length, goalsAdvanced: goal ? 1 : 0, pathwaysUnlocked: 1 },
      },
    };
  }
  if (attestedNoLetter.length > 0 && !addressReady) {
    return {
      planStatus: 'action_needed',
      nextBestMove: {
        action: 'Add your mailing address',
        why: `You have ${attestedNoLetter.length} attested item${attestedNoLetter.length === 1 ? '' : 's'} ready for a letter, but every letter needs a real return address first.`,
        effect: 'Unlocks letter generation for everything you\'ve already attested.',
        supports: 'Your next letter.',
        avoid: 'Nothing.',
        next: 'CHEW reassesses the moment your address is saved.',
        href: '/dashboard/lab/credit/letters',
        linkLabel: 'Go to Letters',
        impact: { constraintsRemoved: 1, goalsAdvanced: goal ? 1 : 0, pathwaysUnlocked: 1 },
      },
    };
  }
  if (attestedNoLetter.length > 0) {
    return {
      planStatus: 'action_needed',
      nextBestMove: {
        action: `Generate a letter for ${attestedNoLetter.length} attested item${attestedNoLetter.length === 1 ? '' : 's'}`,
        why: 'These items are attested and ready — the letter itself is the only thing standing between "decided" and "mailed."',
        effect: 'Produces a downloadable, ready-to-sign letter with the correct FCRA citation for its recipient.',
        supports: 'Your dispute timeline.',
        avoid: 'Nothing — take your time reviewing the letter before you mail it.',
        next: 'CHEW reassesses once a letter is generated.',
        href: '/dashboard/lab/credit/letters',
        linkLabel: 'Go to Letters',
        impact: { constraintsRemoved: 0, goalsAdvanced: goal ? 1 : 0, pathwaysUnlocked: 1 },
      },
    };
  }
  if (untrackedLetters.length > 0) {
    return {
      planStatus: 'watch',
      nextBestMove: {
        action: `Start tracking ${untrackedLetters.length} letter${untrackedLetters.length === 1 ? '' : 's'} you've generated`,
        why: 'Once a letter is mailed, logging the date is what lets CHEW keep an eye on the response window for you.',
        effect: 'Turns a generated letter into a timeline CHEW can actually watch.',
        supports: 'The Dispute Tracker.',
        avoid: 'Nothing.',
        next: 'CHEW reassesses once you log a mail date.',
        href: '/dashboard/lab/credit/tracker',
        linkLabel: 'Go to Dispute Tracker',
        impact: { constraintsRemoved: 0, goalsAdvanced: goal ? 1 : 0, pathwaysUnlocked: 1 },
      },
    };
  }
  // Unresolved contradiction outranks "missing" or "stale" — a conflict
  // means CHEW currently holds two claims that can't both be true, which
  // is a stronger, more urgent problem than simply not having (or having
  // an old) data point. See buildCreditIntelligence's own comment on why
  // this branch is NOT goal-gated the way the two below it are.
  if (hasScoreConflict) {
    const { bureauLabel: label, reportedDate, values } = scoreConflictDetail;
    return {
      planStatus: 'watch',
      nextBestMove: {
        action: 'Review conflicting credit information',
        why: `CHEW has ${values.length} different scores logged for ${label} on ${new Date(reportedDate).toLocaleDateString()}: ${values.join(' and ')}. These can't both be right.`,
        effect: 'Clarifying which one is accurate keeps CHEW from calculating anything off the wrong number.',
        supports: 'Any Credit reasoning that depends on this date\'s score.',
        avoid: 'Nothing — CHEW isn\'t assuming either number is correct until you clarify.',
        next: 'CHEW reassesses the moment you resolve this.',
        href: '/dashboard/lab/credit',
        linkLabel: 'Review in Credit room',
        impact: { constraintsRemoved: 0, goalsAdvanced: 0, pathwaysUnlocked: 0 },
      },
    };
  }
  // Materiality gate: these two branches only exist because
  // hasGoalWithoutScore/scoreNeedsUpdate are only ever true when an
  // active goal genuinely depends on the score (see buildCreditIntelligence
  // below) — with no goal, nothing in this app currently reasons from the
  // score value, so there is nothing to ask the client to reconfirm.
  if (hasGoalWithoutScore) {
    return {
      planStatus: 'watch',
      nextBestMove: {
        action: 'Log your current credit score',
        why: `You've set a target score of ${goal.targetValue}, but CHEW doesn't have a score on file yet to measure progress against it.`,
        effect: 'Lets CHEW calculate your actual gap to your target instead of showing none at all.',
        supports: 'Your score goal.',
        avoid: 'Nothing.',
        next: 'CHEW reassesses the moment you log a score.',
        href: '/dashboard/lab/credit',
        linkLabel: 'Log a score',
        impact: { constraintsRemoved: 0, goalsAdvanced: 1, pathwaysUnlocked: 0 },
      },
    };
  }
  if (scoreNeedsUpdate) {
    return {
      planStatus: 'watch',
      nextBestMove: {
        action: 'Reconfirm your credit score',
        why: `The score CHEW has on file is from more than ${SCORE_RECONFIRM_WINDOW_DAYS} days ago — your gap to your ${goal.targetValue} target is still being calculated from that older number.`,
        effect: 'Keeps your progress-to-target calculation based on a number you\'ve actually seen recently.',
        supports: 'Your score goal.',
        avoid: 'Nothing.',
        next: 'CHEW reassesses the moment you log a new score.',
        href: '/dashboard/lab/credit',
        linkLabel: 'Log a score',
        impact: { constraintsRemoved: 0, goalsAdvanced: 1, pathwaysUnlocked: 0 },
      },
    };
  }
  if (hasAnyActivity) {
    return {
      planStatus: 'on_track',
      nextBestMove: {
        action: 'Nothing needs your attention today',
        why: awaitingWithinWindow.length > 0
          ? `${awaitingWithinWindow.length} letter${awaitingWithinWindow.length === 1 ? ' is' : 's are'} out and still within the normal response window.`
          : 'Everything you\'ve flagged is either resolved or moving on its own timeline.',
        effect: 'No action improves your position right now — waiting is the correct move.',
        supports: 'Your existing plan.',
        avoid: 'Applying for new credit while items are still unresolved, if that\'s part of your goal.',
        next: awaitingWithinWindow.length > 0 ? `CHEW reassesses around ${RESPONSE_WINDOW_DAYS} days after each mail date.` : 'CHEW reassesses the next time something changes.',
        href: '/dashboard/lab/credit',
        linkLabel: 'View Credit room',
        impact: { constraintsRemoved: 0, goalsAdvanced: 0, pathwaysUnlocked: 0 },
      },
    };
  }
  return {
    planStatus: null,
    nextBestMove: {
      action: 'Pull your free reports and flag anything that isn\'t yours',
      why: 'Nothing\'s been flagged yet — this is always the real starting point.',
      effect: 'Gives CHEW something real to work with.',
      supports: 'Every goal that depends on your credit profile.',
      avoid: 'Nothing.',
      next: 'CHEW reassesses the moment you flag your first item.',
      href: '/dashboard/lab/credit/walkthrough',
      linkLabel: 'Go to Report Walkthrough',
      impact: { constraintsRemoved: 0, goalsAdvanced: goal ? 1 : 0, pathwaysUnlocked: 1 },
    },
  };
}

// Pure. Given everything already fetched for a user, derives the Credit
// room's slice of home intelligence. Kept side-effect-free and DB-free so
// it's directly testable, same pattern as lib/letterContent.js. `now`
// defaults to the real wall clock but is an explicit argument — see
// daysAgo/isRecent's comment — so this is a true function of its inputs,
// never a hidden-global read.
export function buildCreditIntelligence({ items, letters, trackerEntries, untrackedLetters, address, goal, scoreSnapshots, events = [], now = new Date() }) {
  const unattested = items.filter((i) => i.status === 'flagged');
  const attestedNoLetter = items.filter((i) => i.status === 'attested');
  const addressReady = hasCompleteMailingAddress(address);
  const stalled = trackerEntries.filter((e) => {
    if (!['mailed', 'awaiting_response'].includes(e.status)) return false;
    if (!['bureau', 'secondary_bureau'].includes(e.recipientType)) return false;
    if (!e.mailedDate) return false;
    return new Date(e.mailedDate) <= daysAgo(RESPONSE_WINDOW_DAYS, now);
  });
  const awaitingWithinWindow = trackerEntries.filter((e) =>
    ['mailed', 'awaiting_response'].includes(e.status) && !stalled.includes(e)
  );
  const resolvedFavorably = trackerEntries.filter((e) => e.status === 'resolved' && ['updated', 'deleted'].includes(e.responseType));

  // HIDDEN LEVERAGE — a real, already-created resource sitting unused:
  // a generated letter whose downloaded_at is still null (lib/letters.js's
  // markDownloaded is the only thing that ever sets it, and only a real
  // download click does that). Deliberately not a barrierCandidate
  // (nothing is interfering with the plan) and not an opportunityCandidate
  // (nothing about the member's situation changed for the better) — this
  // is a third, narrower category: an existing asset, not a barrier or a
  // win. It carries no confidence/suggestedAction framing on purpose,
  // since downloading a letter doesn't itself guarantee any outcome.
  const undownloadedLetters = letters.filter((l) => !l.downloadedAt);

  const hasAnyActivity = items.length > 0;

  // --- Fact provenance/freshness (lib/factProvenance.js) --------------------
  // The score is CHEW's first fact carrying real provenance/freshness —
  // see that file's header for why source and freshness are computed
  // independently. The staleness threshold is only ever passed when a
  // goal exists to make it material (see that file's materiality note);
  // with no goal, nothing in this app currently depends on how old the
  // score is, so scoreProvenance still exists (for display) but never
  // drives a Next Move.
  const latestScore = pickLatestScore(scoreSnapshots);
  const scoreProvenance = latestScore ? describeFact({
    sourceType: latestScore.sourceType,
    providedAt: latestScore.reportedDate,
    now,
    staleAfterDays: goal ? SCORE_RECONFIRM_WINDOW_DAYS : undefined,
  }) : null;
  const hasGoalWithoutScore = !!goal && !latestScore;
  const scoreNeedsUpdate = !!goal && !!latestScore && scoreProvenance?.freshness === FRESHNESS_STATES.NEEDS_UPDATE;

  // --- Fact conflict/uncertainty (lib/factProvenance.js) ---------------------
  // Unconditional on `goal` — unlike freshness, a same-context contradiction
  // (two different scores both claimed for the identical bureau+date) is
  // material on its own: it's wrong data sitting in the record regardless
  // of whether anything currently reads it. Never resolved by "the newer
  // entry wins" — see detectScoreConflicts()'s own comment.
  const scoreConflicts = detectScoreConflicts(scoreSnapshots);
  const scoreConflictState = describeConflictState(scoreConflicts);
  const hasScoreConflict = scoreConflicts.length > 0;
  const scoreConflictDetail = hasScoreConflict ? describeScoreConflict(scoreConflicts[0]) : null;

  // --- Plan status + the one dominant Next Best Move -----------------------
  // Isolated in computeRecommendation() above (Recommendation Purity
  // pass) — a pure function of these same already-derived signals, never
  // a DB call. See that function's own header comment for the invariant.
  const { planStatus, nextBestMove } = computeRecommendation({
    stalled, unattested, attestedNoLetter, addressReady, untrackedLetters, hasAnyActivity, awaitingWithinWindow, goal,
    hasGoalWithoutScore, scoreNeedsUpdate, hasScoreConflict, scoreConflictDetail,
  });

  // --- CHEW Noticed (secondary, non-obvious observations) ------------------
  const chewNoticed = [];
  if (stalled.length > 1) {
    chewNoticed.push(`${stalled.length} letters have passed their response window with nothing logged — not just the one above.`);
  }
  const byBureauUnattested = new Map();
  for (const item of unattested) {
    byBureauUnattested.set(item.bureau, (byBureauUnattested.get(item.bureau) ?? 0) + 1);
  }
  for (const [bureau, count] of byBureauUnattested) {
    if (count >= 2) chewNoticed.push(`${count} flagged items are all with the same bureau (${bureau}) — attesting to them together saves a trip back to this page.`);
  }
  if (resolvedFavorably.length > 0) {
    chewNoticed.push(
      `${resolvedFavorably.length} item${resolvedFavorably.length === 1 ? '' : 's'} came back updated or deleted. If a score check or an application was waiting on this, now is a reasonable time to look again.`
    );
  }
  const goalPath = goal ? computeScorePath({ goal, latestScore, openItemCount: unattested.length + attestedNoLetter.length + awaitingWithinWindow.length }) : null;
  if (goalPath && goalPath.gap <= 0) {
    chewNoticed.push(`Your last logged score (${goalPath.current}) already meets or beats your ${goalPath.target} target — worth logging an updated score, or setting a new one.`);
  }

  // --- What changed (recent activity, from the universal event log) -------
  const whatChanged = events
    .filter((e) => isRecent(e.occurredAt, now))
    .map((e) => ({ date: e.occurredAt, text: eventToText(e), eventType: e.eventType }));

  // --- Barrier / opportunity candidates ------------------------------------
  // Structured objects in the negative/positive communication grammar
  // (what happened -> what it hurts -> why -> how serious -> do this now ->
  // do not do -> what success looks like -> when CHEW checks again, and the
  // positive mirror). lib/intelligenceCore.js reconciles these against the
  // persisted `barriers`/`opportunities` tables by sourceKey — this
  // function only ever describes "what's true right now," never writes
  // anything itself.
  const goalIdForRecords = goal?.id ?? null;
  const barrierCandidates = stalled.map((entry) => ({
    sourceKey: `stalled_response:${entry.id}`,
    relatedGoalId: goalIdForRecords,
    title: `Response overdue: ${entry.recipientName}`,
    whatHappened: `You mailed a letter to ${entry.recipientName} on ${fmt(entry.mailedDate)}, and it's been more than ${RESPONSE_WINDOW_DAYS} days with no response logged.`,
    whatItHurts: goal ? `Progress toward your ${goal.targetValue} score target, and this dispute specifically.` : 'Progress on this dispute.',
    why: 'Under FCRA §611, a bureau is generally expected to respond to a dispute within 30 days (45 if you sent more information).',
    severity: 'risk',
    doThisNow: 'Log a response in the Dispute Tracker if one arrived, or consider a CFPB/FTC escalation citing "no response."',
    doNotDo: 'Nothing urgent — this is a genuine option, not a requirement. No rush if you\'d rather wait a little longer.',
    whatSuccessLooksLike: 'A response logged in the Dispute Tracker, or an escalation filed.',
    recheckTrigger: 'The next time you update this entry in the Dispute Tracker.',
  }));

  const opportunityCandidates = resolvedFavorably.map((entry) => ({
    sourceKey: `resolved_favorable:${entry.id}`,
    relatedGoalId: goalIdForRecords,
    title: `${entry.recipientName} resolved favorably`,
    whatImproved: `Your dispute with ${entry.recipientName} came back "${(entry.responseType ?? '').replace('_', ' ')}"${entry.responseDate ? ` on ${fmt(entry.responseDate)}` : ''}.`,
    whyItMatters: goal ? `This is one less obstacle toward your ${goal.targetValue} target.` : 'This removes a contested item from your file.',
    whatItUnlocked: 'A stronger position for any application or score check that depends on this item.',
    suggestedAction: 'Pull a fresh report to confirm the update landed.',
    confidence: 'medium',
  }));

  if (goalPath && goalPath.gap <= 0) {
    opportunityCandidates.push({
      sourceKey: `goal_met:${goalIdForRecords}`,
      relatedGoalId: goalIdForRecords,
      title: 'Target already met',
      whatImproved: `Your last logged score (${goalPath.current}) already meets or beats your ${goalPath.target} target.`,
      whyItMatters: 'Worth confirming with an updated score, or setting a new target now that this one is met.',
      whatItUnlocked: null,
      suggestedAction: 'Log an updated score, or set a new target.',
      confidence: 'high',
    });
  }

  return {
    room: 'credit',
    planStatus,
    nextBestMove,
    chewNoticed,
    whatChanged: whatChanged.slice(0, 8),
    scorePath: goalPath,
    scoreProvenance,
    scoreConflict: scoreConflictState,
    goal,
    barrierCandidates,
    opportunityCandidates,
    undownloadedLetters,
    counts: { unattested: unattested.length, attestedNoLetter: attestedNoLetter.length, stalled: stalled.length, untrackedLetters: untrackedLetters.length },
  };
}

// RECOMMENDATION PURITY — the canonical name for "the shared source of
// current recommendation/readiness state." Today it's a direct alias:
// buildCreditIntelligence already IS this (pure, DB-free, deterministic
// given its inputs — see that function's own comment). A second room
// adds its own buildXIntelligence() and this becomes the real per-room
// dispatch point; until then, this is simply the name every future
// caller (Economic Weather's historical layer included) should reach
// for, so "what does CHEW currently believe" only ever has one door.
export const buildBaselineSnapshot = buildCreditIntelligence;

export async function getCreditIntelligence(clerkUserId) {
  const [items, letters, trackerEntries, untrackedLetters, address, goal, scoreSnapshots, events] = await Promise.all([
    listDisputeItemsForUser(clerkUserId),
    listLettersForUser(clerkUserId),
    listTrackerEntriesForUser(clerkUserId),
    listUntrackedLetters(clerkUserId),
    getMailingAddress(clerkUserId),
    getScoreGoal(clerkUserId),
    listScoreSnapshots(clerkUserId),
    listRecentEvents(clerkUserId, { room: 'credit', limit: 30 }),
  ]);
  return buildCreditIntelligence({ items, letters, trackerEntries, untrackedLetters, address, goal, scoreSnapshots, events });
}

// The home page's multi-room merge point now lives in
// lib/intelligenceCore.js's reconcileHomeIntelligence() — it needs to call
// the reconciler (persisting barriers/opportunities/recommendations), which
// itself depends on getCreditIntelligence here, so putting the merge in
// this file would create a circular import. This file stays the pure
// per-room signal layer; intelligenceCore.js is the orchestration layer on
// top of it.
