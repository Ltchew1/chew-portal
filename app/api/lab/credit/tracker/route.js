// app/api/lab/credit/tracker/route.js
//
// List the client's tracker entries (plus letters not yet tracked), and
// start tracking a letter. Independently re-checks Credit room access,
// same as every other route in this room. Everything this route writes is
// the client saying "I mailed this" / "here's what happened" — there is no
// path here or anywhere else in the Credit room that reads a bureau's
// response for them.

import { NextResponse } from 'next/server';
import { getRoomAccess } from '../../../../../lib/clientStatus';
import { getRoom } from '../../../../../lib/rooms';
import {
  createTrackerEntryForLetter, listTrackerEntriesForUser, listUntrackedLetters,
} from '../../../../../lib/disputeTracker';

const CREDIT_REQUIRED_STATUS = getRoom('credit').requiredStatus;

export async function GET() {
  const { user, hasAccess } = await getRoomAccess(CREDIT_REQUIRED_STATUS);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const [entries, untrackedLetters] = await Promise.all([
    listTrackerEntriesForUser(user.id),
    listUntrackedLetters(user.id),
  ]);
  return NextResponse.json({ entries, untrackedLetters });
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

  const letterId = Number(body.letterId);
  if (!Number.isInteger(letterId)) {
    return NextResponse.json({ error: 'letterId is required' }, { status: 400 });
  }

  try {
    const entry = await createTrackerEntryForLetter(user.id, letterId);
    return NextResponse.json({ entry }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
