// app/api/admin/network/providers/[id]/lifecycle/route.js
//
// The ONLY route that changes a provider's lifecycle_status — see
// lib/providers.js's transitionProviderLifecycle(), which validates the
// move against LIFECYCLE_TRANSITIONS and writes an audited
// provider_lifecycle_events row every time. The generic PATCH on
// /providers/[id] deliberately cannot change status at all.

import { NextResponse } from 'next/server';
import { getAdminAccess } from '../../../../../../../lib/features';
import { transitionProviderLifecycle, listLifecycleEvents } from '../../../../../../../lib/providers';

export async function POST(req, { params }) {
  const { user, isAdmin } = await getAdminAccess();
  if (!isAdmin) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const providerId = Number(params.id);
  if (!Number.isInteger(providerId)) {
    return NextResponse.json({ error: 'Invalid provider id' }, { status: 400 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  try {
    const provider = await transitionProviderLifecycle(providerId, body.toStatus, {
      note: body.note?.trim() || null,
      changedBy: user.id,
    });
    return NextResponse.json({ provider });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function GET(req, { params }) {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const providerId = Number(params.id);
  if (!Number.isInteger(providerId)) {
    return NextResponse.json({ error: 'Invalid provider id' }, { status: 400 });
  }

  const events = await listLifecycleEvents(providerId);
  return NextResponse.json({ events });
}
