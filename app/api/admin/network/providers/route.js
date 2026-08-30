// app/api/admin/network/providers/route.js
//
// Admin -> Network: list/create providers (entities/professionals/external
// providers — see lib/providers.js's classification taxonomy). Gated to
// internal staff only, independently of any UI — a non-admin request gets
// a 404, same posture as the page (see app/dashboard/admin/layout.js's
// comment on why 404 rather than 403).

import { NextResponse } from 'next/server';
import { getAdminAccess } from '../../../../../lib/features';
import { createProvider, listProviders, CLASSIFICATIONS } from '../../../../../lib/providers';

export async function GET() {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const providers = await listProviders();
  return NextResponse.json({ providers, classifications: CLASSIFICATIONS });
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

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  try {
    const provider = await createProvider(body);
    return NextResponse.json({ provider }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
