// app/api/lab/credit/mailing-address/route.js
//
// The client's own return address for letters — read/write. Independently
// re-checks Credit room access, same as every other route in this room.

import { NextResponse } from 'next/server';
import { getRoomAccess } from '../../../../../lib/clientStatus';
import { getRoom } from '../../../../../lib/rooms';
import { getMailingAddress, updateMailingAddress } from '../../../../../lib/users';

const CREDIT_REQUIRED_STATUS = getRoom('credit').requiredStatus;

export async function GET() {
  const { user, hasAccess } = await getRoomAccess(CREDIT_REQUIRED_STATUS);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const address = await getMailingAddress(user.id);
  return NextResponse.json({ address });
}

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

  const { addressLine1, addressLine2, city, state, postalCode } = body;
  if (!addressLine1?.trim() || !city?.trim() || !state?.trim() || !postalCode?.trim()) {
    return NextResponse.json(
      { error: 'Address line 1, city, state, and postal code are all required.' },
      { status: 400 }
    );
  }

  await updateMailingAddress({
    clerkUserId: user.id,
    addressLine1: addressLine1.trim(),
    addressLine2: addressLine2?.trim() || null,
    city: city.trim(),
    state: state.trim(),
    postalCode: postalCode.trim(),
  });

  return NextResponse.json({ ok: true });
}
