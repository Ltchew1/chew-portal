// app/api/lab/credit/score/conflict/route.js
//
// Resolves a same-context score conflict (see lib/creditScore.js's
// resolveScoreConflict and lib/factProvenance.js's Fact Conflict
// foundation). The client only ever sends back the id of ONE of its own
// already-logged snapshots — "this one is the one that's right" — never
// a new value, a new source type, or any privileged provenance claim.
// resolveScoreConflict() itself re-verifies ownership and that a real,
// currently-unresolved conflict actually contains that snapshot before
// touching anything.

import { NextResponse } from 'next/server';
import { getRoomAccess } from '../../../../../../lib/clientStatus';
import { getRoom } from '../../../../../../lib/rooms';
import { resolveScoreConflict } from '../../../../../../lib/creditScore';

const CREDIT_REQUIRED_STATUS = getRoom('credit').requiredStatus;

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

  const keepSnapshotId = Number(body.keepSnapshotId);
  if (!Number.isInteger(keepSnapshotId)) {
    return NextResponse.json({ error: 'keepSnapshotId is required.' }, { status: 400 });
  }

  try {
    const result = await resolveScoreConflict({ clerkUserId: user.id, keepSnapshotId });
    return NextResponse.json({ result });
  } catch (err) {
    if (err.message?.includes('could not be found') || err.message?.includes('not part of an active conflict')) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
