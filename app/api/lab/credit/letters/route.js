// app/api/lab/credit/letters/route.js
//
// List the client's generated letters, and generate a new one. This route
// only ever writes to our own Postgres — see lib/letters.js for the two
// composition paths (dispute letter for stages 1-3, escalation narrative
// for stage 4) and the attestation gate both call before anything is
// persisted. Independently re-checks Credit room access, same as every
// other route in this room.

import { NextResponse } from 'next/server';
import { getRoomAccess } from '../../../../../lib/clientStatus';
import { getRoom } from '../../../../../lib/rooms';
import { getMailingAddress, hasCompleteMailingAddress } from '../../../../../lib/users';
import { AttestationError } from '../../../../../lib/attestations';
import {
  generateDisputeLetter, generateEscalationLetter, listLettersForUser,
} from '../../../../../lib/letters';
import { ESCALATION_FAILURE_CITATIONS } from '../../../../../lib/fcraCitations';

const CREDIT_REQUIRED_STATUS = getRoom('credit').requiredStatus;
const DISPUTE_RECIPIENT_TYPES = ['bureau', 'secondary_bureau', 'furnisher'];
const ESCALATION_RECIPIENT_TYPES = ['cfpb', 'ftc'];
const STAGE_BY_RECIPIENT_TYPE = { bureau: 1, furnisher: 2, secondary_bureau: 3 };

export async function GET() {
  const { user, hasAccess } = await getRoomAccess(CREDIT_REQUIRED_STATUS);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const letters = await listLettersForUser(user.id);
  return NextResponse.json({ letters });
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

  const address = await getMailingAddress(user.id);
  if (!hasCompleteMailingAddress(address)) {
    return NextResponse.json(
      { error: 'Add your mailing address before generating a letter — it goes in the return-address block.' },
      { status: 400 }
    );
  }
  const member = {
    firstName: user.firstName,
    lastName: user.lastName,
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2,
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
  };
  const identity = {
    clerkUserId: user.id,
    email: user.primaryEmailAddress?.emailAddress,
    firstName: user.firstName,
    lastName: user.lastName,
    member,
  };

  try {
    if (body.kind === 'escalation') {
      const { priorLetterId, recipientType, failureReason, failureDetail } = body;
      if (!priorLetterId || !ESCALATION_RECIPIENT_TYPES.includes(recipientType)) {
        return NextResponse.json(
          { error: `priorLetterId and a recipientType of ${ESCALATION_RECIPIENT_TYPES.join(' or ')} are required.` },
          { status: 400 }
        );
      }
      if (!ESCALATION_FAILURE_CITATIONS[failureReason]) {
        return NextResponse.json({ error: 'A valid failureReason is required.' }, { status: 400 });
      }
      if (failureReason === 'other' && !failureDetail?.trim()) {
        return NextResponse.json({ error: 'Describe what happened when selecting "Something else."' }, { status: 400 });
      }

      const letter = await generateEscalationLetter({
        ...identity,
        priorLetterId,
        recipientType,
        failureReason,
        failureDetail: failureDetail?.trim() || null,
      });
      return NextResponse.json({ letter }, { status: 201 });
    }

    // Default kind: a Stage 1/2/3 dispute letter.
    const { disputeItemIds, recipientType, recipientAddress } = body;

    if (!Array.isArray(disputeItemIds) || disputeItemIds.length === 0) {
      return NextResponse.json({ error: 'disputeItemIds must be a non-empty array.' }, { status: 400 });
    }
    if (!DISPUTE_RECIPIENT_TYPES.includes(recipientType)) {
      return NextResponse.json(
        { error: `recipientType must be one of: ${DISPUTE_RECIPIENT_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    let recipientAddressOverride;
    if (recipientType === 'furnisher') {
      const { line1, city, state, postalCode } = recipientAddress ?? {};
      if (!line1?.trim() || !city?.trim() || !state?.trim() || !postalCode?.trim()) {
        return NextResponse.json(
          { error: 'A furnisher letter needs the creditor\'s mailing address (line 1, city, state, postal code) — from your report or their statements.' },
          { status: 400 }
        );
      }
      recipientAddressOverride = [
        recipientAddress.line1.trim(),
        recipientAddress.line2?.trim(),
        `${recipientAddress.city.trim()}, ${recipientAddress.state.trim()} ${recipientAddress.postalCode.trim()}`,
      ].filter(Boolean);
    }

    const letter = await generateDisputeLetter({
      ...identity,
      disputeItemIds,
      recipientType,
      recipientAddressOverride,
      stage: STAGE_BY_RECIPIENT_TYPE[recipientType],
    });
    return NextResponse.json({ letter }, { status: 201 });
  } catch (err) {
    if (err instanceof AttestationError) {
      const status = err.code === 'NOT_FOUND' ? 404 : 409;
      return NextResponse.json({ error: err.message }, { status });
    }
    const KNOWN_VALIDATION_PREFIXES = [
      'All items', 'A mailing address', 'Some items', 'This letter could not be generated',
      'A letter has already been generated', 'The prior letter for this escalation',
      'Log this letter as mailed', 'It\'s only been', 'Log the bureau\'s response',
    ];
    if (KNOWN_VALIDATION_PREFIXES.some((prefix) => err.message?.startsWith(prefix))) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
