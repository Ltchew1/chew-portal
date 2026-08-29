// app/api/notifications/read/route.js
//
// Marks the caller's own notifications as read. lib/notifications.js's
// markNotificationsRead() scopes its UPDATE by the authenticated
// clerkUserId itself (via a JOIN on users), so a client cannot mark
// another member's notification read no matter what id it sends.

import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { markNotificationsRead } from '../../../../lib/notifications';

export async function POST(req) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const ids = Array.isArray(body.notificationIds) ? body.notificationIds.map(Number).filter(Number.isInteger) : [];
  if (ids.length === 0) {
    return NextResponse.json({ ok: true });
  }

  await markNotificationsRead(user.id, ids);
  return NextResponse.json({ ok: true });
}
