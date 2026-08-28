// app/dashboard/lab/page.js
//
// The Lab hub — the room picker, composed as a gallery: Credit (the one
// built, priority room) featured and forward; the other five shown as
// honest, dormant "coming to your Lab" tiles. First-time visitors see the
// cinematic tour instead (see TourExperience); everyone else lands here.
//
// The "Welcome back" seam: TourExperience finishes by navigating to
// /dashboard/lab?justFinishedTour=1 rather than a bare refresh, so this
// page can tell "just arrived, seconds ago" apart from "a true return
// visit" and greet each one differently — the query param is read once
// and never persisted, it's not app state.
//
// The gold ring shows rooms unlocked — a real, computed number (ROOMS
// filtered by the client's actual status). There's no goal-setting
// feature yet, so this never claims to show progress toward "a goal."
//
// This page intentionally doesn't use the shared PageHeader — it's "the
// hero moment of the whole portal," not one of the ~15 standard pages
// PageHeader's generic eyebrow/h1/p layout is meant for.

import { currentUser } from '@clerk/nextjs/server';
import Link from 'next/link';
import GoldProgressRing from '../../components/lab/GoldProgressRing';
import RevealOnScroll from '../../components/lab/RevealOnScroll';
import TourExperience from '../../components/lab/tour/TourExperience';
import AskChew from '../../components/lab/AskChew';
import HomeIntelligence from '../../components/lab/HomeIntelligence';
import { IconChevronRight, IconLock } from '../../components/icons';
import { ROOMS } from '../../../lib/rooms';
import { statusFromClerkUser, hasRequiredStatus } from '../../../lib/clientStatus';
import { hasCompletedTour } from '../../../lib/tour';
import { reconcileHomeIntelligence } from '../../../lib/intelligenceCore';
import { listRecentNotifications } from '../../../lib/notifications';
import NotificationsPanel from '../../components/lab/NotificationsPanel';
import { listFeatures, evaluateFeatureAccess, roomFeatureKey } from '../../../lib/features';
import { getCreditOpportunityWeather } from '../../../lib/economicWeather';
import EconomicWeatherCard from '../../components/lab/EconomicWeatherCard';
import { getCreditFrictionHistory } from '../../../lib/frictionHistory';
import FrictionTimelineCard from '../../components/lab/FrictionTimelineCard';

const STATUS_LABELS = { applicant: 'Applicant', accepted: 'Accepted', paid: 'Paid' };

function RoomTileBody({ room, unlocked, live, enterable }) {
  const Icon = room.icon;
  return (
    <>
      {room.slug === 'credit' && <span className="room-badge">Available now</span>}
      <div className="room-icon-badge"><Icon /></div>
      <h3>{room.name}</h3>
      <p className="room-tile-tagline">{room.tagline}</p>

      {room.features?.length > 0 && (
        <ul className="room-feature-list">
          {room.features.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
      )}

      <span className="enter-affordance">
        {!live
          ? 'Coming to your Lab'
          : unlocked
            ? 'Enter'
            : `Unlocks at ${STATUS_LABELS[room.requiredStatus]}`}
        {/* Only show an affordance icon when a room is actually live —
            a not-yet-released room isn't "locked," it just isn't ready,
            so a lock icon there would be misleading. */}
        {live && (enterable ? <IconChevronRight /> : <IconLock />)}
      </span>
    </>
  );
}

function RoomTile({ room, unlocked, live, index }) {
  const enterable = unlocked && live;
  const tileClass = [
    'room-tile',
    room.slug === 'credit' ? 'room-tile--featured' : '',
    !live ? 'room-tile--dormant' : '',
    !enterable ? 'room-tile--locked' : '',
  ].filter(Boolean).join(' ');

  return (
    <RevealOnScroll
      as={enterable ? 'link' : 'div'}
      href={enterable ? room.href : undefined}
      className={tileClass}
      delay={index * 90}
    >
      <RoomTileBody room={room} unlocked={unlocked} live={live} enterable={enterable} />
    </RevealOnScroll>
  );
}

export default async function LabHubPage({ searchParams }) {
  const user = await currentUser();
  const status = statusFromClerkUser(user);
  const toured = await hasCompletedTour(user.id);
  const justArrived = searchParams?.justFinishedTour === '1';

  if (!toured) {
    return <TourExperience firstName={user.firstName || 'there'} />;
  }

  const firstName = user.firstName || 'there';
  const [homeIntelligence, notifications, features, creditOpportunityWeather, creditFrictionHistory] = await Promise.all([
    reconcileHomeIntelligence(user.id),
    listRecentNotifications(user.id, 6),
    listFeatures(),
    getCreditOpportunityWeather(user.id),
    getCreditFrictionHistory(user.id),
  ]);
  const creditRoomIntel = homeIntelligence.rooms.find((r) => r.room === 'credit');
  // Only ever true on the exact reconciliation pass that just wrote a new
  // opportunity/barrier-history snapshot for a real prior-vs-current
  // comparison — gates each card's entrance/recede/pulse motion so it
  // never replays the transition ceremony on an ordinary revisit (see
  // lib/intelligenceCore.js's opportunityHistoryChanged/
  // barrierHistoryChanged comments).
  const creditWeatherJustChanged = !!creditRoomIntel?.opportunityHistoryChanged;
  const creditFrictionJustChanged = !!creditRoomIntel?.barrierHistoryChanged;
  const creditActiveBarriers = creditRoomIntel?.activeBarriers ?? [];

  // The feature registry (lib/features.js) is the one source of truth for
  // "is this room actually released," not a static built:true/false flag —
  // same access decision Ask CHEW and each room's own placeholder now make
  // server-side. hasRequiredStatus (clientStatus) is a separate axis: a
  // room can be released but still gated to Paid accounts.
  const featuresByKey = new Map(features.map((f) => [f.featureKey, f]));
  const isRoomLive = (slug) => evaluateFeatureAccess(featuresByKey.get(roomFeatureKey(slug)), user);

  // "Ready to enter" — live AND status-unlocked. Deliberately not just
  // status-unlocked: a Paid client clears every room's status threshold,
  // but only Credit is actually released, so counting status alone would
  // have this ring and its copy claim "7 of 7 rooms open" when 6 are
  // still stubs. The number shown here must always be one a client could
  // verify by clicking through every tile.
  const readyCount = ROOMS.filter((room) => isRoomLive(room.slug) && hasRequiredStatus(status, room.requiredStatus)).length;
  const creditRoom = ROOMS.find((room) => room.slug === 'credit');

  return (
    <div className="lab-hub-bg">
      {/* The mark, featured elegantly — see .lab-mark for the treatment.
          A real hero image (once supplied) slots in as a background-image
          layer on .lab-hub-bg itself, behind the existing gold gradients —
          see that rule's comment. Nothing here needs to change shape when
          one arrives, only that one extra background layer gets added. */}
      <div className="lab-mark"><img src="/chew-logo.png" alt="CHEW" /></div>

      <span className="lab-hero-eyebrow">CHEW: The Lab</span>
      <h1 className="lab-hero-title">{justArrived ? `You're in, ${firstName}.` : 'Welcome back.'}</h1>
      <p className="lab-hero-desc">
        {justArrived
          ? 'Your Lab is open. Every room below is yours to step into, at your pace.'
          : 'Your rooms — each one a focused space for a different part of your financial infrastructure.'}
      </p>

      <div className="lab-access-row">
        <GoldProgressRing value={readyCount} max={ROOMS.length} caption="Ready" />
        <div className="lab-access-copy">
          <strong>Your access: {STATUS_LABELS[status]}</strong>
          <span>
            {readyCount === 0
              ? `No rooms open yet — Credit opens once your account reaches ${STATUS_LABELS[creditRoom.requiredStatus]}.`
              : `${readyCount} of ${ROOMS.length} rooms open on your account. The rest open as we build them.`}
          </span>
        </div>
      </div>

      {!justArrived && (
        <div className="lab-intelligence-block">
          <AskChew />
          <NotificationsPanel notifications={notifications} />
          {homeIntelligence.rooms.map((roomIntel) => (
            <HomeIntelligence key={roomIntel.room} intelligence={roomIntel} />
          ))}
          <EconomicWeatherCard weather={creditOpportunityWeather} justChanged={creditWeatherJustChanged} />
          <FrictionTimelineCard friction={creditFrictionHistory} activeBarriers={creditActiveBarriers} justChanged={creditFrictionJustChanged} />
          <Link href="/dashboard/lab/war-room" className="btn btn-outline btn-sm" style={{ marginBottom: '8px' }}>
            Open My War Room <IconChevronRight />
          </Link>
        </div>
      )}

      <div className="room-gallery">
        {ROOMS.map((room, index) => (
          <RoomTile
            key={room.slug}
            room={room}
            unlocked={hasRequiredStatus(status, room.requiredStatus)}
            live={isRoomLive(room.slug)}
            index={index}
          />
        ))}
      </div>

      {/* The creed — set small, quiet, Light Gold. Placed with reverence,
          never shouted: this is the one spot on the whole platform where
          it's said outright. */}
      <p className="lab-creed">We all Chew. You eat. Then you feed the next.</p>
    </div>
  );
}
