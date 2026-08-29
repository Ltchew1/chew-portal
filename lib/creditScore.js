// lib/creditScore.js
//
// Score Path Engine — but grounded in the same discipline as the rest of
// the Credit room: CHEW has no bureau connection, so "current position" is
// whatever score the client has already told CHEW they saw, and "gap" is
// exact subtraction, never a fabricated day-count or probability. See
// computeScorePath()'s comment for exactly what is and isn't claimed.

import { query } from './db';
import { ensureUserRow } from './users';
import { getActiveGoal, setActiveGoal } from './goals';
import { logEvent } from './events';
import { SOURCE_TYPES } from './factProvenance';

const GOAL_ROOM = 'credit';
const GOAL_TYPE = 'credit_score';
// A product-chosen check-in window, NOT a legal or scoring-model
// deadline — long enough that a score isn't flagged after every
// ordinary re-login, short enough that a client actively working a
// goal gets asked to look again periodically. Exported so
// lib/homeIntelligence.js's Next Move copy and any page displaying the
// score's freshness use the exact same number, never two thresholds
// drifting apart.
export const SCORE_RECONFIRM_WINDOW_DAYS = 45;

// The only way a score reaches this table today is the client typing it
// in (see ScoreGoal.js) — there is no bureau connection and no document
// extraction yet — so source_type is always 'member_provided' here, set
// unconditionally rather than accepted as a caller-supplied argument. A
// future source (a parsed credit report, a connected account) gets its
// own write path with its own honest source_type, never this one
// silently reused for a different kind of input.
export async function recordScoreSnapshot({ clerkUserId, email, firstName, lastName, bureau, score, reportedDate, sourceNote }) {
  const userId = await ensureUserRow({ clerkUserId, email, firstName, lastName });
  const { rows } = await query(
    `INSERT INTO credit_score_snapshots (user_id, bureau, score, reported_date, source_note, source_type)
     VALUES ($1, $2, $3, COALESCE($4, CURRENT_DATE), $5, $6)
     RETURNING id, bureau, score, reported_date AS "reportedDate", source_note AS "sourceNote",
               source_type AS "sourceType", created_at AS "createdAt"`,
    [userId, bureau ?? null, score, reportedDate ?? null, sourceNote ?? null, SOURCE_TYPES.MEMBER_PROVIDED]
  );
  const snapshot = rows[0];
  await logEvent({
    userId, room: 'credit', eventType: 'score_logged',
    subject: `${score} (${bureau ?? 'overall'})`,
    newState: { score, bureau: bureau ?? 'overall' },
    severity: 'info',
  });
  return snapshot;
}

export async function listScoreSnapshots(clerkUserId) {
  const { rows } = await query(
    `SELECT css.id, css.bureau, css.score, css.reported_date AS "reportedDate", css.source_note AS "sourceNote",
            css.source_type AS "sourceType", css.created_at AS "createdAt"
     FROM credit_score_snapshots css
     JOIN users u ON u.id = css.user_id
     WHERE u.clerk_user_id = $1
     ORDER BY css.reported_date DESC, css.created_at DESC`,
    [clerkUserId]
  );
  return rows;
}

// Prefers the most recently reported 'overall' snapshot; falls back to the
// most recent snapshot of any bureau if the client has only ever logged a
// per-bureau number.
export function pickLatestScore(snapshots) {
  if (snapshots.length === 0) return null;
  return snapshots.find((s) => s.bureau === 'overall') ?? snapshots[0];
}

export async function setScoreGoal({ clerkUserId, email, firstName, lastName, targetScore, targetDate, notes }) {
  return setActiveGoal({
    clerkUserId, email, firstName, lastName,
    room: GOAL_ROOM, goalType: GOAL_TYPE,
    targetValue: String(targetScore), targetDate, notes,
  });
}

export async function getScoreGoal(clerkUserId) {
  return getActiveGoal(clerkUserId, GOAL_ROOM, GOAL_TYPE);
}

// Pure — no DB access, so this is directly testable and reusable wherever
// the caller already has a goal + snapshots in hand (see
// lib/homeIntelligence.js). Every field here is either an exact number
// (target, current, gap) or an explicitly-labeled category (controllable /
// time-dependent / unknown) — never a fabricated "N days" projection, since
// CHEW has no way to know when a bureau will actually update anyone's file.
export function computeScorePath({ goal, latestScore, openItemCount }) {
  if (!goal || !latestScore) return null;

  const target = Number(goal.targetValue);
  const current = latestScore.score;
  const gap = target - current;

  const controllableFactors = [];
  if (openItemCount > 0) {
    controllableFactors.push(
      `${openItemCount} flagged item${openItemCount === 1 ? '' : 's'} still working through the dispute process in your Credit room.`
    );
  }
  controllableFactors.push(
    'Reported utilization on revolving accounts — general education only, since CHEW doesn\'t track your balances or limits.',
    'On-time payments going forward — the single heaviest-weighted factor in most scoring models.',
    'Avoiding new hard inquiries until this target is reached.'
  );

  const timeDependentFactors = [
    'How long ago your oldest and newest accounts were opened — this only moves with time, not action.',
    'How long negative items have been reporting — most age off on a fixed federal timeline, not an accelerated one.',
  ];

  const unknownFactors = [
    'Anything on your file CHEW hasn\'t been told about — CHEW never pulls your report directly (see the Credit room\'s standing disclosures).',
    'The exact scoring model and version a specific lender uses, which can differ from the score you last saw.',
  ];

  return {
    target,
    current,
    gap,
    asOfDate: latestScore.reportedDate,
    controllableFactors,
    timeDependentFactors,
    unknownFactors,
    reassessmentTrigger: 'The next time you log an updated score.',
  };
}
