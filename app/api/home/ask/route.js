// app/api/home/ask/route.js
//
// "Ask CHEW" — routes free text to the right place in the portal. Gated at
// the Lab-wide access level (not a specific room), since it can point
// anywhere in The Lab. See lib/askChew.js for why this is a deterministic
// router rather than a model call.

import { NextResponse } from 'next/server';
import { getRoomAccess, LAB_REQUIRED_STATUS } from '../../../../lib/clientStatus';
import { routeAskChew } from '../../../../lib/askChew';

export async function POST(req) {
  const { user, hasAccess } = await getRoomAccess(LAB_REQUIRED_STATUS);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (typeof body.text !== 'string' || !body.text.trim()) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 });
  }

  const result = routeAskChew(body.text);
  return NextResponse.json({ result });
}
