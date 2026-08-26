// app/dashboard/page.js — "Today," the portal's home screen.
//
// Answers the portal directive's five questions in order: Where am I?
// What changed? What matters now? What move should I make next? What
// becomes possible afterward? Everything below is real data or an honest
// "not yet" — see lib/todayIntelligence.js's header comment. No fabricated
// scores, no invented opportunities, no dead links: a room-level move or
// Life Map link only ever renders as clickable when the client's real
// clientStatus actually clears that room's gate.

import { currentUser } from '@clerk/nextjs/server';
import GoldProgressRing from '../components/lab/GoldProgressRing';
import RevealOnScroll from '../components/lab/RevealOnScroll';
import ChewMoveCard from '../components/today/ChewMoveCard';
import BarrierDissolve from '../components/today/BarrierDissolve';
import WhatChangedRipple from '../components/today/WhatChangedRipple';
import WhatsWaiting from '../components/today/WhatsWaiting';
import LifeMap from '../components/today/LifeMap';
import OpportunityRadar from '../components/today/OpportunityRadar';
import ComingToCommandCenter from '../components/today/ComingToCommandCenter';
import { IconSparkles } from '../components/icons';
import { ROOMS } from '../../lib/rooms';
import { statusFromClerkUser, hasRequiredStatus } from '../../lib/clientStatus';
import { listFeatures, evaluateFeatureAccess, roomFeatureKey } from '../../lib/features';
import { reconcileCreditIntelligence } from '../../lib/intelligenceCore';
import { buildTransitionEvents } from '../../lib/transitions';
import {
  timeOfDayGreeting, canSeeRoomIntelligence, buildChangeSummary,
  buildAccountLevelMove, buildLifeMapGraph, buildOpportunityRadar, buildMoveSignals,
  buildChangeRipples, buildDominoCascade, buildCrossSystemDomino,
} from '../../lib/todayIntelligence';

const STATUS_LABELS = { applicant: 'Applicant', accepted: 'Accepted', paid: 'Paid' };

export default async function TodayPage() {
  const user = await currentUser();
  const firstName = user?.firstName || 'there';
  const status = statusFromClerkUser(user);

  const features = await listFeatures();
  const featuresByKey = new Map(features.map((f) => [f.featureKey, f]));
  const isRoomLive = (slug) => evaluateFeatureAccess(featuresByKey.get(roomFeatureKey(slug)), user);

  const creditRoom = ROOMS.find((room) => room.slug === 'credit');
  const canSeeCredit = canSeeRoomIntelligence(status, creditRoom) && isRoomLive('credit');
  const creditRoomResult = canSeeCredit ? await reconcileCreditIntelligence(user.id) : null;
  const dissolveEvents = buildTransitionEvents(creditRoomResult);
  const crossSystemDomino = buildCrossSystemDomino(creditRoomResult);

  const { changedCount, attentionCount } = creditRoomResult
    ? buildChangeSummary([creditRoomResult])
    : { changedCount: 0, attentionCount: 0 };

  const move = creditRoomResult?.nextBestMove ?? buildAccountLevelMove(status);
  const urgentMove = creditRoomResult?.planStatus === 'plan_at_risk';
  const moveSignals = buildMoveSignals(creditRoomResult);
  const domino = buildDominoCascade(move);

  const readyCount = ROOMS.filter((room) => isRoomLive(room.slug) && hasRequiredStatus(status, room.requiredStatus)).length;
  // Only Credit has a real opportunity-detection pipeline today (see
  // lib/homeIntelligence.js) — every other room, live or not, is a real,
  // named dormant zone on the Radar until it has one too.
  const dormantRooms = ROOMS.filter((room) => room.slug !== 'credit');

  // Icons are rendered here (server side, same as every other room icon in
  // the app) and passed down as elements — LifeMap (a client component)
  // never needs its own icon imports or a room->icon lookup of its own.
  const lifeMapGraph = buildLifeMapGraph({ rooms: ROOMS, status, isRoomLive, creditIntel: creditRoomResult })
    .map((territory) => {
      const Icon = ROOMS.find((r) => r.slug === territory.slug)?.icon;
      return { ...territory, icon: Icon ? <Icon /> : null };
    });
  const opportunityRadar = buildOpportunityRadar({ creditIntel: creditRoomResult, dormantRooms });
  const ripple = buildChangeRipples(creditRoomResult?.whatChanged);
  const affected = { ...ripple.affected, ...domino.affected, ...crossSystemDomino.affected };
  const rippleClass = (system) => (affected[system] ? ' ripple-glow' : '');

  return (
    <div className="today-bg">
      <span className="today-eyebrow">Today</span>
      <h1 className="today-greeting">{timeOfDayGreeting()} {firstName}.</h1>
      {creditRoomResult ? (
        <p className="today-summary">
          {changedCount === 0
            ? 'Nothing new since last time.'
            : `${changedCount} thing${changedCount === 1 ? '' : 's'} changed.`}
          {attentionCount > 0 && ` ${attentionCount} deserve${attentionCount === 1 ? 's' : ''} your attention today.`}
        </p>
      ) : (
        <p className="today-summary text-faint">
          CHEW doesn&apos;t have enough verified information about your situation yet — here&apos;s where to start.
        </p>
      )}

      <div className="lab-access-row" style={{ margin: '20px 0 32px' }}>
        <GoldProgressRing value={readyCount} max={ROOMS.length} caption="Rooms open" />
        <div className="lab-access-copy">
          <strong>Your access: {STATUS_LABELS[status]}</strong>
          <span>
            {readyCount === 0
              ? `No rooms open yet — Credit opens once your account reaches ${STATUS_LABELS[creditRoom.requiredStatus]}.`
              : `${readyCount} of ${ROOMS.length} rooms open on your account.`}
          </span>
        </div>
      </div>

      <ChewMoveCard move={move} urgent={urgentMove} signals={moveSignals} domino={domino} />

      {dissolveEvents.length > 0 && (
        <RevealOnScroll className="today-reveal">
          <BarrierDissolve events={dissolveEvents} crossSystemDomino={crossSystemDomino} />
        </RevealOnScroll>
      )}

      {creditRoomResult && (creditRoomResult.whatChanged.length > 0 || creditRoomResult.chewNoticed.length > 0) && (
        <RevealOnScroll className="today-reveal">
          <span className="today-section-eyebrow">What changed</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px' }}>
            <WhatChangedRipple items={ripple.items} />
            {creditRoomResult.chewNoticed.length > 0 && (
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <IconSparkles />
                  <h3 style={{ margin: 0 }}>CHEW noticed</h3>
                </div>
                <ul style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '18px', fontSize: '0.85rem' }}>
                  {creditRoomResult.chewNoticed.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              </div>
            )}
          </div>
        </RevealOnScroll>
      )}

      {creditRoomResult && creditRoomResult.activeBarriers?.length > 0 && (
        <RevealOnScroll className="today-reveal">
          <span className={`today-section-eyebrow${rippleClass('waiting')}`}>What&apos;s waiting</span>
          <WhatsWaiting barriers={creditRoomResult.activeBarriers} />
        </RevealOnScroll>
      )}

      <RevealOnScroll className="today-reveal">
        <span className={`today-section-eyebrow${rippleClass('opportunity')}`}>What&apos;s opening</span>
        <OpportunityRadar radar={opportunityRadar} />
      </RevealOnScroll>

      <RevealOnScroll className="today-reveal">
        <span className={`today-section-eyebrow${rippleClass('life_map')}`}>Your world</span>
        <LifeMap territories={lifeMapGraph} />
      </RevealOnScroll>

      <RevealOnScroll className="today-reveal">
        <ComingToCommandCenter />
      </RevealOnScroll>
    </div>
  );
}
