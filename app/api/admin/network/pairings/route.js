// app/api/admin/network/pairings/route.js — Admin -> Network: link a provider to a capability.

import { NextResponse } from 'next/server';
import { getAdminAccess } from '../../../../../lib/features';
import { listCapabilityProviderPairs, upsertCapabilityProviderPair } from '../../../../../lib/capabilityGraph';

export async function GET() {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const pairs = await listCapabilityProviderPairs();
  return NextResponse.json({ pairs });
}

export async function POST(req) {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const capabilityId = Number(body.capabilityId);
  const providerId = Number(body.providerId);
  if (!Number.isInteger(capabilityId) || !Number.isInteger(providerId)) {
    return NextResponse.json({ error: 'capabilityId and providerId are required' }, { status: 400 });
  }

  const pair = await upsertCapabilityProviderPair({
    capabilityId, providerId,
    isActive: Boolean(body.isActive),
    eligibilityNotes: body.eligibilityNotes?.trim() || null,
    clientProfileFit: body.clientProfileFit?.trim() || null,
    prerequisiteSteps: body.prerequisiteSteps ?? [],
    documentsNeeded: body.documentsNeeded ?? [],
  });
  return NextResponse.json({ pair }, { status: 201 });
}
