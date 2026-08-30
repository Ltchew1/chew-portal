// app/api/lab/credit/dispute-items/[id]/route.js
//
// Deletes a flagged-but-not-yet-attested item — lets the client fix a
// mistake before flagging becomes a permanent attested record. Once an
// item has an attestation this always returns 409; deleteUnattestedItem()
// enforces that at the query level (WHERE status = 'flagged'), not here.
//
// Independently re-checks Credit room access — see the same note in the
// sibling dispute-items/route.js.

import { NextResponse } from 'next/server';
import { getRoomAccess } from '../../../../../../lib/clientStatus';
import { getRoom } from '../../../../../../lib/rooms';
import { deleteUnattestedItem } from '../../../../../../lib/disputeItems';

const CREDIT_REQUIRED_STATUS = getRoom('credit').requiredStatus;

export async function DELETE(req, { params }) {
  const { user, hasAccess } = await getRoomAccess(CREDIT_REQUIRED_STATUS);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const disputeItemId = Number(params.id);
  if (!Number.isInteger(disputeItemId)) {
    return NextResponse.json({ error: 'Invalid item id' }, { status: 400 });
  }

  const deleted = await deleteUnattestedItem(user.id, disputeItemId);
  if (!deleted) {
    return NextResponse.json(
      { error: 'Item not found, not yours, or already attested — attested items cannot be removed.' },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true });
}
