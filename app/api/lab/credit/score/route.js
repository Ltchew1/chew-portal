// app/api/lab/credit/score/route.js
//
// The Score Path Engine's data entry point: list what the client has told
// CHEW about their score so far, and record a new reading. Every score
// here is self-reported — see lib/creditScore.js and its schema comment;
// CHEW has no bureau connection and never queries one.

import { NextResponse } from 'next/server';
import { getRoomAccess } from '../../../../../lib/clientStatus';
import { getRoom } from '../../../../../lib/rooms';
import { recordScoreSnapshot, listScoreSnapshots, getScoreGoal, pickLatestScore, SCORE_RECONFIRM_WINDOW_DAYS } from '../../../../../lib/creditScore';
import { describeFact } from '../../../../../lib/factProvenance';

const CREDIT_REQUIRED_STATUS = getRoom('credit').requiredStatus;
const VALID_BUREAUS = ['equifax', 'experian', 'transunion', 'overall'];

export async function GET() {
  const { user, hasAccess } = await getRoomAccess(CREDIT_REQUIRED_STATUS);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const [snapshots, goal] = await Promise.all([
    listScoreSnapshots(user.id),
    getScoreGoal(user.id),
  ]);
  // Provenance/freshness is computed server-side, same as every other
  // authoritative Credit signal — a client re-deriving "is this stale"
  // from a raw date would be a second, driftable copy of this logic.
  const latestScore = pickLatestScore(snapshots);
  const scoreProvenance = latestScore ? describeFact({
    sourceType: latestScore.sourceType,
    providedAt: latestScore.reportedDate,
    staleAfterDays: goal ? SCORE_RECONFIRM_WINDOW_DAYS : undefined,
  }) : null;
  return NextResponse.json({ snapshots, goal, scoreProvenance });
}

export async function POST(req) {
  const { user, hasAccess } = await getRoomAccess(CREDIT_REQUIRED_STATUS);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { bureau, score, reportedDate, sourceNote } = body;
  const scoreNum = Number(score);
  if (bureau && !VALID_BUREAUS.includes(bureau)) {
    return NextResponse.json({ error: `bureau must be one of: ${VALID_BUREAUS.join(', ')}` }, { status: 400 });
  }
  if (!Number.isInteger(scoreNum) || scoreNum < 300 || scoreNum > 900) {
    return NextResponse.json({ error: 'score must be a whole number between 300 and 900' }, { status: 400 });
  }

  const snapshot = await recordScoreSnapshot({
    clerkUserId: user.id,
    email: user.primaryEmailAddress?.emailAddress,
    firstName: user.firstName,
    lastName: user.lastName,
    bureau: bureau || 'overall',
    score: scoreNum,
    reportedDate: reportedDate || null,
    sourceNote: sourceNote?.trim() || null,
  });
  return NextResponse.json({ snapshot }, { status: 201 });
}
