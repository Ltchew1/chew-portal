// app/dashboard/domino/page.js — "Domino," a standalone, honest view of
// cause and effect in a member's Credit position. The GRAND FINALE
// reference for this screen shows a rich fabricated propagation graph
// (dollar figures, confidence percentages, cross-domain nodes CHEW has
// no data model for). This page shows only what CHEW actually computed:
// the current recommended move's real structural impact (the same
// buildDominoCascade steps THE CHEW MOVE card already renders, via the
// same exported DominoCascade component — no second visual language for
// "one move, N effects") and the real recent-change log (the same
// buildChangeRipples/buildChangeStory/WhatChangedRipple pipeline Today
// already uses). Nothing here is recomputed differently, and nothing is
// invented to fill the reference's richer shape.
//
// Deliberately does NOT reuse crossSystemDomino/BarrierDissolve's
// resolvedBarriers-driven "just happened" ceremony — that one-shot
// reveal is real DB state consumed on whichever page reads it first
// (see lib/intelligenceCore.js's reconcileRoom), and Today already owns
// that moment. Duplicating it here would risk silently starving Today's
// arrival ceremony of a transition a member never got to see there.

import { currentUser } from '@clerk/nextjs/server';
import { DominoCascade } from '../../components/today/ChewMoveCard';
import WhatChangedRipple from '../../components/today/WhatChangedRipple';
import { ROOMS } from '../../../lib/rooms';
import { statusFromClerkUser } from '../../../lib/clientStatus';
import { listFeatures, evaluateFeatureAccess, roomFeatureKey } from '../../../lib/features';
import { reconcileCreditIntelligence } from '../../../lib/intelligenceCore';
import {
  canSeeRoomIntelligence, buildAccountLevelMove, buildDominoCascade,
  buildChangeRipples, buildChangeStory,
} from '../../../lib/todayIntelligence';

export default async function DominoPage() {
  const user = await currentUser();
  const status = statusFromClerkUser(user);

  const features = await listFeatures();
  const featuresByKey = new Map(features.map((f) => [f.featureKey, f]));
  const isRoomLive = (slug) => evaluateFeatureAccess(featuresByKey.get(roomFeatureKey(slug)), user);

  const creditRoom = ROOMS.find((room) => room.slug === 'credit');
  const canSeeCredit = canSeeRoomIntelligence(status, creditRoom) && isRoomLive('credit');
  const creditRoomResult = canSeeCredit ? await reconcileCreditIntelligence(user.id) : null;

  const move = creditRoomResult?.nextBestMove ?? buildAccountLevelMove(status);
  const domino = buildDominoCascade(move);
  const ripple = buildChangeRipples(creditRoomResult?.whatChanged);
  const changeStory = buildChangeStory(creditRoomResult);

  return (
    <>
      <span className="page-eyebrow">Domino</span>
      <h1 style={{ fontFamily: "'Fraunces', serif", marginBottom: '6px' }}>Cause and effect</h1>
      <p className="text-faint" style={{ maxWidth: '60ch', marginBottom: '8px' }}>
        What your next move touches, and what CHEW has actually observed change since your last visit.
      </p>

      <div className="card" style={{ marginTop: '20px' }}>
        <h3 style={{ marginBottom: '4px' }}>{move ? move.action : 'No move recommended yet'}</h3>
        {domino.steps.length > 0 ? (
          <DominoCascade steps={domino.steps} baseDelay={0} />
        ) : (
          <p className="text-faint" style={{ fontSize: '0.85rem', margin: '8px 0 0' }}>
            {move
              ? "CHEW hasn't quantified a structural effect for this move yet."
              : "CHEW doesn't have enough verified information yet to recommend a move."}
          </p>
        )}
      </div>

      <div style={{ marginTop: '20px' }}>
        <WhatChangedRipple story={changeStory} items={ripple.items} />
      </div>

      {!changeStory.headline && ripple.items.length === 0 && (
        <p className="text-faint" style={{ fontSize: '0.85rem' }}>
          Nothing has changed since your last visit.
        </p>
      )}
    </>
  );
}
