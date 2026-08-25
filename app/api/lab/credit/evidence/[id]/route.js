// app/api/lab/credit/evidence/[id]/route.js
//
// Delete one evidence record — owner-scoped in the DB query itself (see
// lib/evidenceVault.js's deleteEvidenceRecord).

import { NextResponse } from 'next/server';
import { getRoomAccess } from '../../../../../../lib/clientStatus';
import { getRoom } from '../../../../../../lib/rooms';
import { getFeatureAccess } from '../../../../../../lib/features';
import { deleteEvidenceRecord } from '../../../../../../lib/evidenceVault';

const CREDIT_REQUIRED_STATUS = getRoom('credit').requiredStatus;

export async function DELETE(req, { params }) {
  const { user, hasAccess } = await getRoomAccess(CREDIT_REQUIRED_STATUS);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { hasAccess: featureLive } = await getFeatureAccess('credit_evidence_vault');
  if (!featureLive) return NextResponse.json({ error: 'Not available' }, { status: 404 });

  const evidenceId = Number(params.id);
  if (!Number.isInteger(evidenceId)) {
    return NextResponse.json({ error: 'Invalid evidence id' }, { status: 400 });
  }

  const deleted = await deleteEvidenceRecord(user.id, evidenceId);
  if (!deleted) return NextResponse.json({ error: 'Not found for this account.' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
