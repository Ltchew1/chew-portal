// app/api/lab/credit/evidence/route.js
//
// Evidence Vault v1 — list/create. Independently re-checks Credit room
// access AND the feature registry (belt-and-suspenders: the room gate
// alone isn't the "is this capability released" answer anymore — see
// lib/features.js). Every field here is client-authored; see
// lib/evidenceVault.js for why this is metadata/recordkeeping, not file
// storage.

import { NextResponse } from 'next/server';
import { getRoomAccess } from '../../../../../lib/clientStatus';
import { getRoom } from '../../../../../lib/rooms';
import { getFeatureAccess } from '../../../../../lib/features';
import { createEvidenceRecord, listEvidenceForUser, CATEGORIES } from '../../../../../lib/evidenceVault';

const CREDIT_REQUIRED_STATUS = getRoom('credit').requiredStatus;

export async function GET() {
  const { user, hasAccess } = await getRoomAccess(CREDIT_REQUIRED_STATUS);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { hasAccess: featureLive } = await getFeatureAccess('credit_evidence_vault');
  if (!featureLive) return NextResponse.json({ error: 'Not available' }, { status: 404 });

  const records = await listEvidenceForUser(user.id);
  return NextResponse.json({ records });
}

export async function POST(req) {
  const { user, hasAccess } = await getRoomAccess(CREDIT_REQUIRED_STATUS);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { hasAccess: featureLive } = await getFeatureAccess('credit_evidence_vault');
  if (!featureLive) return NextResponse.json({ error: 'Not available' }, { status: 404 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { category, title, description, occurredDate, relatedTrackerEntryId } = body;
  if (!CATEGORIES.includes(category)) {
    return NextResponse.json({ error: `category must be one of: ${CATEGORIES.join(', ')}` }, { status: 400 });
  }
  if (!title || typeof title !== 'string' || !title.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }

  try {
    const record = await createEvidenceRecord({
      clerkUserId: user.id,
      category, title: title.trim(),
      description: description?.trim() || null,
      occurredDate: occurredDate || null,
      relatedTrackerEntryId: relatedTrackerEntryId ? Number(relatedTrackerEntryId) : null,
    });
    return NextResponse.json({ record }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
