// app/api/lab/credit/letters/[id]/route.js
//
// Fetches one previously generated letter (for re-download) and stamps
// downloaded_at the first time it's actually retrieved for that purpose.
// Read-only otherwise — there is no PUT/PATCH here; a letter's content
// never changes after it's generated, it's the record of what was
// actually produced.

import { NextResponse } from 'next/server';
import { getRoomAccess } from '../../../../../../lib/clientStatus';
import { getRoom } from '../../../../../../lib/rooms';
import { getOwnedLetter, markDownloaded } from '../../../../../../lib/letters';

const CREDIT_REQUIRED_STATUS = getRoom('credit').requiredStatus;

export async function GET(req, { params }) {
  const { user, hasAccess } = await getRoomAccess(CREDIT_REQUIRED_STATUS);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const letterId = Number(params.id);
  if (!Number.isInteger(letterId)) {
    return NextResponse.json({ error: 'Invalid letter id' }, { status: 400 });
  }

  const letter = await getOwnedLetter(user.id, letterId);
  if (!letter) {
    return NextResponse.json({ error: 'Letter not found for this account.' }, { status: 404 });
  }

  const url = new URL(req.url);
  if (url.searchParams.get('download') === '1') {
    await markDownloaded(user.id, letterId);
  }

  return NextResponse.json({ letter });
}
