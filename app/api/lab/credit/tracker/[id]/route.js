// app/api/lab/credit/tracker/[id]/route.js
//
// Update one tracker entry — mailed date, status, and (once the client
// says they heard back) response type/date and notes. Every field here is
// the client reporting what happened; there is no field, route, or code
// path anywhere that fetches or infers a bureau's actual response.

import { NextResponse } from 'next/server';
import { getRoomAccess } from '../../../../../../lib/clientStatus';
import { getRoom } from '../../../../../../lib/rooms';
import { updateTrackerEntry } from '../../../../../../lib/disputeTracker';

const CREDIT_REQUIRED_STATUS = getRoom('credit').requiredStatus;

export async function PATCH(req, { params }) {
  const { user, hasAccess } = await getRoomAccess(CREDIT_REQUIRED_STATUS);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const entryId = Number(params.id);
  if (!Number.isInteger(entryId)) {
    return NextResponse.json({ error: 'Invalid tracker entry id' }, { status: 400 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { status, mailedDate, responseType, responseDate, clientNotes } = body;

  try {
    const entry = await updateTrackerEntry(user.id, entryId, {
      status,
      mailedDate: mailedDate || null,
      responseType: responseType || null,
      responseDate: responseDate || null,
      clientNotes: typeof clientNotes === 'string' ? clientNotes.trim() : undefined,
    });
    return NextResponse.json({ entry });
  } catch (err) {
    const httpStatus = err.message?.includes('could not be found') ? 404 : 400;
    return NextResponse.json({ error: err.message }, { status: httpStatus });
  }
}
