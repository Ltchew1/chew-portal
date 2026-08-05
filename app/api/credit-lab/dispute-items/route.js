// app/api/credit-lab/dispute-items/route.js
//
// Create/list the client's own flagged items. Every field on create is
// client-authored — there is no system classification anywhere in this
// route, and the DB schema has no column for one (see db/schema.sql).
//
// This route is intentionally minimal: it exists so the Layer 3 guardrails
// (the attestation gate, specifically) have real items to attest to and
// can be verified end-to-end. Layer 4b replaces the bare client-side form
// that calls this with the full self-flagging tool, built on this same
// endpoint — not a duplicate of it.
//
// Independently re-checks Credit Lab access — this route sits outside the
// app/dashboard/credit-lab page tree, so the page-level gate in
// app/dashboard/credit-lab/layout.js does not protect it.

import { NextResponse } from 'next/server';
import { getCreditLabAccess } from '../../../../lib/clientStatus';
import { createDisputeItem, listDisputeItemsForUser } from '../../../../lib/disputeItems';

const VALID_BUREAUS = ['equifax', 'experian', 'transunion'];
const VALID_REASONS = ['not_mine', 'not_authorized'];

export async function GET() {
  const { user, hasAccess } = await getCreditLabAccess();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const items = await listDisputeItemsForUser(user.id);
  return NextResponse.json({ items });
}

export async function POST(req) {
  const { user, hasAccess } = await getCreditLabAccess();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { bureau, creditorName, accountNumber, reason, clientNotes } = body;

  if (!VALID_BUREAUS.includes(bureau)) {
    return NextResponse.json({ error: `bureau must be one of: ${VALID_BUREAUS.join(', ')}` }, { status: 400 });
  }
  if (!creditorName || typeof creditorName !== 'string' || !creditorName.trim()) {
    return NextResponse.json({ error: 'creditorName is required' }, { status: 400 });
  }
  if (!VALID_REASONS.includes(reason)) {
    return NextResponse.json(
      { error: `reason must be one of: ${VALID_REASONS.join(', ')} — the client must actively choose one, there is no default` },
      { status: 400 }
    );
  }

  const item = await createDisputeItem({
    clerkUserId: user.id,
    email: user.primaryEmailAddress?.emailAddress,
    firstName: user.firstName,
    lastName: user.lastName,
    bureau,
    creditorName: creditorName.trim(),
    accountNumber: accountNumber?.trim() || null,
    reason,
    clientNotes: clientNotes?.trim() || null,
  });

  return NextResponse.json({ item }, { status: 201 });
}
