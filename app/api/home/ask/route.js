// app/api/home/ask/route.js
//
// "Ask CHEW" — routes free text to the right place in the portal. Gated at
// the Lab-wide access level (not a specific room), since it can point
// anywhere in The Lab. See lib/askChew.js for why this is a deterministic
// router rather than a model call.

import { NextResponse } from 'next/server';
import { getRoomAccess, LAB_REQUIRED_STATUS } from '../../../../lib/clientStatus';
import { getRoom } from '../../../../lib/rooms';
import { routeAskChew, parseScoreTarget } from '../../../../lib/askChew';
import { setScoreGoal } from '../../../../lib/creditScore';
import { getFeatureAccess, roomFeatureKey } from '../../../../lib/features';
import { EXPANSION_LINES } from '../../../../lib/featureCopy';

const CREDIT_REQUIRED_STATUS = getRoom('credit').requiredStatus;

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
  if (!result.matched) {
    return NextResponse.json({ result });
  }

  // Ask CHEW never trusts its own keyword match as proof a room is
  // reachable — the feature registry (lib/features.js) is re-checked here,
  // server-side, on every call, same discipline as the score-goal dispatch
  // below. A locked room never gets its name echoed back with specifics;
  // it gets one of the directive's sanctioned generic expansion lines.
  const room = getRoom(result.roomSlug);
  const { hasAccess: roomLive } = await getFeatureAccess(roomFeatureKey(result.roomSlug));
  if (!roomLive) {
    return NextResponse.json({
      result: {
        matched: true, roomLive: false,
        roomName: room?.name ?? result.label,
        message: EXPANSION_LINES[0],
      },
    });
  }

  // The one intent currently wired to actually activate a CHEW system
  // rather than just link to it — see lib/askChew.js's file comment.
  if (result.dispatch === 'score_goal') {
    const targetScore = parseScoreTarget(body.text);
    if (targetScore) {
      const { hasAccess: hasCreditAccess } = await getRoomAccess(CREDIT_REQUIRED_STATUS);
      if (hasCreditAccess) {
        const goal = await setScoreGoal({
          clerkUserId: user.id,
          email: user.primaryEmailAddress?.emailAddress,
          firstName: user.firstName,
          lastName: user.lastName,
          targetScore,
        });
        return NextResponse.json({
          result: { ...result, roomLive: true, dispatched: true, dispatchType: 'goal_set', targetScore, goal },
        });
      }
    }
  }

  return NextResponse.json({ result: { ...result, roomLive: true } });
}
