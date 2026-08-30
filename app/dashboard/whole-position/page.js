// app/dashboard/whole-position/page.js — "Whole Position," the flagship
// CHEW Orbit view: where everything stands, all at once, at rest. Today
// answers "what deserves my attention right now" and owns the signature
// arrival choreography (SessionChoreography, ProgressWorldReaction); this
// page deliberately does not replay that theater — it's the calm,
// explorable instrument a member returns to, not a second arrival
// moment. Every value here comes from the exact same reconciled state
// Today reads (lib/intelligenceCore.reconcileCreditIntelligence);
// nothing is recomputed differently and nothing is invented for this
// page specifically.

import { currentUser } from '@clerk/nextjs/server';
import CommandCenterOrbit from '../../components/today/CommandCenterOrbit';
import ChewMoveCard from '../../components/today/ChewMoveCard';
import WhatsWaiting from '../../components/today/WhatsWaiting';
import OpportunityRadar from '../../components/today/OpportunityRadar';
import { ROOMS } from '../../../lib/rooms';
import { statusFromClerkUser, hasRequiredStatus } from '../../../lib/clientStatus';
import { listFeatures, evaluateFeatureAccess, roomFeatureKey } from '../../../lib/features';
import { reconcileCreditIntelligence } from '../../../lib/intelligenceCore';
import {
  canSeeRoomIntelligence, buildAccountLevelMove, buildLifeMapGraph,
  buildOpportunityRadar, buildDominoCascade,
} from '../../../lib/todayIntelligence';

const STATUS_LABELS = { applicant: 'Applicant', accepted: 'Accepted', paid: 'Paid' };
const NO_CONNECTS = { active: false, effects: [], affected: {} };

export default async function WholePositionPage() {
  const user = await currentUser();
  const firstName = user?.firstName || 'there';
  const status = statusFromClerkUser(user);

  const features = await listFeatures();
  const featuresByKey = new Map(features.map((f) => [f.featureKey, f]));
  const isRoomLive = (slug) => evaluateFeatureAccess(featuresByKey.get(roomFeatureKey(slug)), user);

  const creditRoom = ROOMS.find((room) => room.slug === 'credit');
  const canSeeCredit = canSeeRoomIntelligence(status, creditRoom) && isRoomLive('credit');
  const creditRoomResult = canSeeCredit ? await reconcileCreditIntelligence(user.id) : null;

  const move = creditRoomResult?.nextBestMove ?? buildAccountLevelMove(status);
  const noMoveReason = move ? null : (!isRoomLive('credit')
    ? "Credit isn't turned on for your account yet — check back soon."
    : "CHEW doesn't have enough verified information yet.");
  const domino = buildDominoCascade(move);
  const goal = creditRoomResult?.goal ?? null;

  const readyCount = ROOMS.filter((room) => isRoomLive(room.slug) && hasRequiredStatus(status, room.requiredStatus)).length;
  const dormantRooms = ROOMS.filter((room) => room.slug !== 'credit');
  const lifeMapGraph = buildLifeMapGraph({ rooms: ROOMS, status, isRoomLive, creditIntel: creditRoomResult, transitionEvents: [] })
    .map((territory) => {
      const Icon = ROOMS.find((r) => r.slug === territory.slug)?.icon;
      return { ...territory, icon: Icon ? <Icon /> : null };
    });
  const opportunityRadar = buildOpportunityRadar({ creditIntel: creditRoomResult, dormantRooms, transitionEvents: [] });
  const opportunityCount = opportunityRadar.availableNow.length + opportunityRadar.newlyUnlocked.length;
  const barrierCount = creditRoomResult?.activeBarriers?.length ?? 0;

  // "What CHEW knows" — the real provenance/freshness/conflict status of
  // the one fact this app actually tracks with that foundation (see
  // lib/factProvenance.js). This is Whole Position's honest substitute
  // for a "Position Health" panel — chew-portal has no liquidity,
  // leverage, or protection data model to report on, so this shows what
  // is actually known instead of inventing qualitative scores for
  // dimensions nothing measures.
  const scoreProvenance = creditRoomResult?.scoreProvenance ?? null;
  const scoreConflict = creditRoomResult?.scoreConflict ?? null;

  return (
    <>
      <span className="page-eyebrow">Whole Position</span>
      <h1 style={{ fontFamily: "'Fraunces', serif", marginBottom: '6px' }}>CHEW Orbit</h1>
      <p className="text-faint" style={{ maxWidth: '60ch', marginBottom: '8px' }}>
        See how every part of your Credit position connects — and where CHEW genuinely does, and doesn&apos;t,
        have enough information yet.
      </p>

      <div style={{ margin: '24px 0 8px' }}>
        <CommandCenterOrbit
          firstName={firstName}
          statusLabel={STATUS_LABELS[status]}
          readyCount={readyCount}
          totalRooms={ROOMS.length}
          planStatus={creditRoomResult?.planStatus ?? null}
          score={scoreProvenance ? {
            current: creditRoomResult.scorePath?.current ?? null,
            target: creditRoomResult.scorePath?.target ?? null,
            freshnessLabel: scoreProvenance.freshness === 'needs_update' ? scoreProvenance.freshnessLabel : null,
            conflictLabel: scoreConflict?.state === 'conflict_detected' ? scoreConflict.label : null,
          } : null}
          barrierCount={barrierCount}
          opportunityCount={opportunityCount}
          changedCount={0}
          attentionCount={0}
          momentLevel={null}
          moveActionText={move?.action ?? null}
          rooms={lifeMapGraph}
        />
      </div>

      <div className="wp-grid">
        <div className="wp-main">
          <ChewMoveCard
            move={move}
            noMoveReason={noMoveReason}
            urgent={creditRoomResult?.planStatus === 'plan_at_risk'}
            signals={[]}
            domino={domino}
            goal={goal}
            changed={false}
            previousActionText={null}
            level={null}
            connects={NO_CONNECTS}
            handoffDelay={false}
            moveId={creditRoomResult?.recommendation?.id ?? null}
            moveCoOccurringNodeIds={[]}
          />

          {creditRoomResult && barrierCount > 0 && (
            <div style={{ marginTop: '20px' }}>
              <span className="today-section-eyebrow">What&apos;s waiting</span>
              <WhatsWaiting barriers={creditRoomResult.activeBarriers} />
            </div>
          )}

          <div style={{ marginTop: '20px' }}>
            <span className="today-section-eyebrow">What&apos;s opening</span>
            <OpportunityRadar radar={opportunityRadar} />
          </div>
        </div>

        <div className="wp-side">
          <div className="card">
            <h3 style={{ marginBottom: '12px' }}>What CHEW knows</h3>
            {scoreProvenance ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div className="flex-between">
                  <span className="text-faint" style={{ fontSize: '0.85rem' }}>Credit score</span>
                  <span className="badge badge-neutral">{scoreProvenance.sourceLabel}</span>
                </div>
                {scoreConflict?.state === 'conflict_detected' ? (
                  <span className="badge badge-pending" style={{ alignSelf: 'flex-start' }}>{scoreConflict.label}</span>
                ) : scoreProvenance.freshness === 'needs_update' ? (
                  <span className="badge badge-pending" style={{ alignSelf: 'flex-start' }}>{scoreProvenance.freshnessLabel}</span>
                ) : (
                  <span className="badge badge-success" style={{ alignSelf: 'flex-start' }}>Current</span>
                )}
              </div>
            ) : (
              <p className="text-faint" style={{ fontSize: '0.85rem', margin: 0 }}>
                No score logged yet — CHEW only knows what you tell it.
              </p>
            )}
          </div>

          <div className="card">
            <h3 style={{ marginBottom: '12px' }}>Orbit summary</h3>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
              <li className="flex-between"><span className="text-faint">Rooms open</span><strong>{readyCount} of {ROOMS.length}</strong></li>
              <li className="flex-between"><span className="text-faint">Score goal</span><strong>{goal ? goal.targetValue : 'Not set'}</strong></li>
              <li className="flex-between"><span className="text-faint">Active barriers</span><strong>{barrierCount}</strong></li>
              <li className="flex-between"><span className="text-faint">Open opportunities</span><strong>{opportunityCount}</strong></li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
