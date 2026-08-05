// app/api/lab/tour/complete/route.js
//
// Marks the signed-in user's first-visit guided tour as done, so
// /dashboard/lab renders the hub instead of the tour on every visit after
// this. Lab-wide, not room-specific — just being signed in is enough,
// since the tour is what a client sees on their way toward whatever
// status-gated content they do or don't have access to yet.

import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { markTourCompleted } from '../../../../../lib/tour';

export async function POST() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await markTourCompleted({
    clerkUserId: user.id,
    email: user.primaryEmailAddress?.emailAddress,
    firstName: user.firstName,
    lastName: user.lastName,
  });

  return NextResponse.json({ ok: true });
}
