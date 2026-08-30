// app/api/lab/credit/attestations/route.js
//
// The attestation gate's server side. Persists the legal record that the
// CLIENT attested to a specific item — see lib/attestations.js for the
// enforcement this backs (recordAttestation, assertItemsAttested). No
// route here, or anywhere in The Lab, ever sends anything to a bureau —
// this only ever writes to our own Postgres.
//
// Independently re-checks Credit room access — see the same note in
// app/api/lab/credit/dispute-items/route.js.

import { NextResponse } from 'next/server';
import { getRoomAccess } from '../../../../../lib/clientStatus';
import { getRoom } from '../../../../../lib/rooms';
import { recordAttestation, AttestationError } from '../../../../../lib/attestations';

const CREDIT_REQUIRED_STATUS = getRoom('credit').requiredStatus;
const STATUS_BY_CODE = { NOT_FOUND: 404, STATEMENT_MISMATCH: 400, ALREADY_ATTESTED: 409 };

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

  const { disputeItemId, statementText } = body;
  if (!disputeItemId || !statementText) {
    return NextResponse.json({ error: 'disputeItemId and statementText are required' }, { status: 400 });
  }

  try {
    const attestation = await recordAttestation({
      clerkUserId: user.id,
      disputeItemId,
      statementText,
    });
    return NextResponse.json({ attestation }, { status: 201 });
  } catch (err) {
    if (err instanceof AttestationError) {
      return NextResponse.json({ error: err.message }, { status: STATUS_BY_CODE[err.code] ?? 400 });
    }
    throw err;
  }
}
