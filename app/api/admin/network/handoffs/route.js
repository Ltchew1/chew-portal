// app/api/admin/network/handoffs/route.js — Admin -> Network: every handoff, any user.

import { NextResponse } from 'next/server';
import { getAdminAccess } from '../../../../../lib/features';
import { listAllHandoffs } from '../../../../../lib/providerHandoff';

export async function GET() {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const handoffs = await listAllHandoffs();
  return NextResponse.json({ handoffs });
}
