// app/api/lab/credit/score/goal/route.js
//
// Sets (or replaces) the client's active credit-score target. See
// lib/goals.js — this is an upsert by design, one active target at a time.

import { NextResponse } from 'next/server';
import { getRoomAccess } from '../../../../../../lib/clientStatus';
import { getRoom } from '../../../../../../lib/rooms';
import { setScoreGoal } from '../../../../../../lib/creditScore';

const CREDIT_REQUIRED_STATUS = getRoom('credit').requiredStatus;

export async function PUT(req) {
  const { user, hasAccess } = await getRoomAccess(CREDIT_REQUIRED_STATUS);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const targetScore = Number(body.targetScore);
  if (!Number.isInteger(targetScore) || targetScore < 300 || targetScore > 900) {
    return NextResponse.json({ error: 'targetScore must be a whole number between 300 and 900' }, { status: 400 });
  }

  const goal = await setScoreGoal({
    clerkUserId: user.id,
    email: user.primaryEmailAddress?.emailAddress,
    firstName: user.firstName,
    lastName: user.lastName,
    targetScore,
    targetDate: body.targetDate || null,
    notes: body.notes?.trim() || null,
  });
  return NextResponse.json({ goal });
}
