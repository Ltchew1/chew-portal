// app/api/admin/network/events/route.js — Admin -> Network: the raw 'network' room event trail.

import { NextResponse } from 'next/server';
import { getAdminAccess } from '../../../../../lib/features';
import { listAllEvents } from '../../../../../lib/events';

export async function GET() {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const events = await listAllEvents({ room: 'network', limit: 100 });
  return NextResponse.json({ events });
}
