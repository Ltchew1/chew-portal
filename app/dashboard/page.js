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
import ProgressWorldReaction from '../components/today/ProgressWorldReaction';
import SessionChoreography from '../components/today/SessionChoreography';
import FocusController from '../components/today/FocusController';
import { IconSparkles } from '../components/icons';
import { ROOMS } from '../../lib/rooms';
import { statusFromClerkUser, hasRequiredStatus } from '../../lib/clientStatus';
import { listFeatures, evaluateFeatureAccess, roomFeatureKey } from '../../lib/features';
import { reconcileCreditIntelligence } from '../../lib/intelligenceCore';
import { buildPortalReactions, reactionsFor, coOccurringNodeIds } from '../../lib/portalReactions';
import {
  timeOfDayGreeting, canSeeRoomIntelligence, buildChangeSummary,
  buildAccountLevelMove, buildLifeMapGraph, buildOpportunityRadar, buildMoveSignals,
  buildChangeRipples, buildDominoCascade, buildChangeStory, pickTopChangeText, SYSTEM_LABEL,
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
  // The single Cross-System State Propagation entry point (see
  // lib/portalReactions.js) — computes transitionEvents/domino/level
  // exactly once for this page load; every surface below consumes these
  // same values instead of independently re-deriving "did something just
  // happen" from creditRoomResult.
  const { level: momentLevel, events: dissolveEvents, domino: crossSystemDomino, reactions } = buildPortalReactions(creditRoomResult);

  const { changedCount, attentionCount } = creditRoomResult
    ? buildChangeSummary([creditRoomResult])
    : { changedCount: 0, attentionCount: 0 };

  const move = creditRoomResult?.nextBestMove ?? buildAccountLevelMove(status);
  // Real, honest reason for the one case `move` is null: a paid client
  // whose Credit room isn't live yet (a feature-flag state, not a guess).
  const noMoveReason = move ? null : (!isRoomLive('credit')
    ? "Credit isn't turned on for your account yet — check back soon."
    : "CHEW doesn't have enough verified information yet.");
  const urgentMove = creditRoomResult?.planStatus === 'plan_at_risk';
  const moveSignals = buildMoveSignals(creditRoomResult);
  const domino = buildDominoCascade(move);
  const goal = creditRoomResult?.goal ?? null;

  // THE CHEW MOVE's own slice of the shared reaction contract — the
  // single recommendation_changed reaction (SURFACE_CONTRACT.chewMove),
  // never independently re-detected. `moveChanged` gates the card's
  // one-shot signature reveal; `previousActionText` is the real prior
  // action text (only ever present on a genuine change, never on an
  // ordinary revisit — see lib/transitions.js).
  const moveReaction = reactionsFor(reactions, 'chewMove')[0] ?? null;
  const moveChanged = !!moveReaction;
  const previousActionText = moveReaction?.explanation?.previousActionText ?? null;
  const moveLevel = moveReaction?.level ?? null;
  const moveId = creditRoomResult?.recommendation?.id ?? null;
  // Node-level focus's exact co-occurring rows (Cross-System Focus
  // Mode) — the same real ids the "Connects to"/"Domino effect" text
  // already names, resolved to their `${entityType}:${entityId}` nodeId
  // form instead of a summary count. Gated by crossSystemDomino.active,
  // the same established boundary those text chips already use.
  const moveCoOccurringNodeIds = moveChanged && crossSystemDomino.active
    ? coOccurringNodeIds(dissolveEvents, moveReaction.id)
    : [];
  // BarrierDissolve's cards get the same treatment per-event, computed
  // once here rather than importing lib/portalReactions.js into a
  // client component (which would drag in lib/todayIntelligence.js's
  // server-only @clerk/nextjs/server chain).
  const dissolveEventsWithNodeIds = dissolveEvents.map((e) => ({
    ...e,
    coOccurringNodeIds: crossSystemDomino.active ? coOccurringNodeIds(dissolveEvents, e.id) : [],
  }));

  const readyCount = ROOMS.filter((room) => isRoomLive(room.slug) && hasRequiredStatus(status, room.requiredStatus)).length;
  // Only Credit has a real opportunity-detection pipeline today (see
  // lib/homeIntelligence.js) — every other room, live or not, is a real,
  // named dormant zone on the Radar until it has one too.
  const dormantRooms = ROOMS.filter((room) => room.slug !== 'credit');

  // Icons are rendered here (server side, same as every other room icon in
  // the app) and passed down as elements — LifeMap (a client component)
  // never needs its own icon imports or a room->icon lookup of its own.
  const lifeMapGraph = buildLifeMapGraph({ rooms: ROOMS, status, isRoomLive, creditIntel: creditRoomResult, transitionEvents: dissolveEvents })
    .map((territory) => {
      const Icon = ROOMS.find((r) => r.slug === territory.slug)?.icon;
      return { ...territory, icon: Icon ? <Icon /> : null };
    });
  const opportunityRadar = buildOpportunityRadar({ creditIntel: creditRoomResult, dormantRooms, transitionEvents: dissolveEvents });
  const ripple = buildChangeRipples(creditRoomResult?.whatChanged);
  const changeStory = buildChangeStory(creditRoomResult, crossSystemDomino);
  const affected = { ...ripple.affected, ...domino.affected, ...crossSystemDomino.affected };
  const rippleClass = (system) => (affected[system] ? ' ripple-glow' : '');

  // Signature Session Choreography's inputs — the same real headline and
  // counts Today already renders in plain text below, plus a key built
  // from real event ids (or, lacking those, real whatChanged timestamps)
  // so the one-shot guard is tied to an actual detected change, never a
  // generic per-day flag. See SessionChoreography.js.
  const topItemText = pickTopChangeText(changeStory, dissolveEvents);
  const choreographyKey = dissolveEvents.length > 0
    ? dissolveEvents.map((e) => e.id).join(',')
    : (creditRoomResult?.whatChanged ?? []).map((c) => `${c.eventType}:${c.date}`).join(',');
  // Session Choreography handoff: a server-side approximation of "will the
  // overlay actually play" (it also depends on client-only reduced-motion
  // and sessionStorage checks — see SessionChoreography.js — so this can't
  // be exact). When it's likely and the move is what changed, THE CHEW
  // MOVE's own reveal waits a beat longer so it settles into view around
  // when the overlay closes, instead of finishing off-screen behind it.
  const choreographyLikely = momentLevel !== null && !!topItemText;

  return (
    <div className="today-bg">
      <SessionChoreography
        level={momentLevel}
        changedCount={changedCount}
        attentionCount={attentionCount}
        topItemText={topItemText}
        eventKey={choreographyKey}
      />
      <ProgressWorldReaction level={momentLevel} />
      <FocusController systemLabels={SYSTEM_LABEL} />
      <span className="today-eyebrow">Today</span>
      <h1 className="today-greeting">{timeOfDayGreeting()} {firstName}.</h1>
      {creditRoomResult ? (
        <p className="today-summary">
          {changedCount === 0
            ? 'Nothing new since last time.'
            : `${changedCount} thing${changedCount === 1 ? '' : 's'} changed.`}
          {attentionCount > 0 && ` ${attentionCount} deserve${attentionCount === 1 ? 's' : ''} your attention today.`}
          {/* Real text equivalent of ProgressWorldReaction's ambient
              pass — present regardless of motion preference, so the
              level's meaning never depends on the animation rendering. */}
          {momentLevel === 'major' && ' Major shift today.'}
          {momentLevel === 'landmark' && ' Landmark day.'}
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

      <ChewMoveCard
        move={move}
        noMoveReason={noMoveReason}
        urgent={urgentMove}
        signals={moveSignals}
        domino={domino}
        goal={goal}
        changed={moveChanged}
        previousActionText={previousActionText}
        level={moveLevel}
        connects={crossSystemDomino}
        handoffDelay={moveChanged && choreographyLikely}
        moveId={moveId}
        moveCoOccurringNodeIds={moveCoOccurringNodeIds}
      />

      {dissolveEvents.length > 0 && (
        <RevealOnScroll className="today-reveal">
          <BarrierDissolve events={dissolveEventsWithNodeIds} crossSystemDomino={crossSystemDomino} />
        </RevealOnScroll>
      )}

      {creditRoomResult && (creditRoomResult.whatChanged.length > 0 || creditRoomResult.chewNoticed.length > 0) && (
        <RevealOnScroll className="today-reveal">
          <span className="today-section-eyebrow">What changed</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px' }}>
            <WhatChangedRipple story={changeStory} items={ripple.items} />
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
        <RevealOnScroll className="today-reveal" data-chew-focus-target data-chew-system="waiting">
          <span className={`today-section-eyebrow${rippleClass('waiting')}`}>What&apos;s waiting</span>
          <WhatsWaiting barriers={creditRoomResult.activeBarriers} />
        </RevealOnScroll>
      )}

      <RevealOnScroll className="today-reveal" data-chew-focus-target data-chew-system="opportunity">
        <span className={`today-section-eyebrow${rippleClass('opportunity')}`}>What&apos;s opening</span>
        <OpportunityRadar radar={opportunityRadar} />
      </RevealOnScroll>

      <RevealOnScroll className="today-reveal" data-chew-focus-target data-chew-system="life_map">
        <span className={`today-section-eyebrow${rippleClass('life_map')}`}>Your world</span>
        <LifeMap territories={lifeMapGraph} />
      </RevealOnScroll>

      <RevealOnScroll className="today-reveal">
        <ComingToCommandCenter />
      </RevealOnScroll>
    </div>
  );
}
