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
import GoldProgressRing from '../../components/lab/GoldProgressRing';
import RevealOnScroll from '../../components/lab/RevealOnScroll';
import TourExperience from '../../components/lab/tour/TourExperience';
import { IconChevronRight, IconLock } from '../../components/icons';
import { ROOMS } from '../../../lib/rooms';
import { statusFromClerkUser, hasRequiredStatus } from '../../../lib/clientStatus';
import { hasCompletedTour } from '../../../lib/tour';

const STATUS_LABELS = { applicant: 'Applicant', accepted: 'Accepted', paid: 'Paid' };

function RoomTileBody({ room, unlocked, enterable }) {
  const Icon = room.icon;
  return (
    <>
      {room.slug === 'credit' && (
        <>
          <span className="room-badge">Available now</span>
          <span className="room-shimmer" aria-hidden="true" />
        </>
      )}
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
        {!room.built
          ? 'Coming to your Lab'
          : unlocked
            ? 'Enter'
            : `Unlocks at ${STATUS_LABELS[room.requiredStatus]}`}
        {/* Only show an affordance icon when a room is actually built —
            an unbuilt-but-status-unlocked room isn't "locked," it just
            isn't ready, so a lock icon there would be misleading. */}
        {room.built && (enterable ? <IconChevronRight /> : <IconLock />)}
      </span>
    </>
  );
}

function RoomTile({ room, unlocked, index }) {
  const enterable = unlocked && room.built;
  const tileClass = [
    'room-tile',
    room.slug === 'credit' ? 'room-tile--featured' : '',
    !room.built ? 'room-tile--dormant' : '',
    !enterable ? 'room-tile--locked' : '',
  ].filter(Boolean).join(' ');

  return (
    <RevealOnScroll
      as={enterable ? 'link' : 'div'}
      href={enterable ? room.href : undefined}
      className={tileClass}
      delay={index * 90}
    >
      <RoomTileBody room={room} unlocked={unlocked} enterable={enterable} />
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
  // "Ready to enter" — built AND status-unlocked. Deliberately not just
  // status-unlocked: a Paid client clears every room's status threshold,
  // but only Credit actually has content, so counting status alone would
  // have this ring and its copy claim "6 of 6 rooms open" when 5 are
  // still stubs. The number shown here must always be one a client could
  // verify by clicking through every tile.
  const readyCount = ROOMS.filter((room) => room.built && hasRequiredStatus(status, room.requiredStatus)).length;
  const creditRoom = ROOMS.find((room) => room.slug === 'credit');

  return (
    <div className="lab-hub-bg">
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

      <div className="room-gallery">
        {ROOMS.map((room, index) => (
          <RoomTile
            key={room.slug}
            room={room}
            unlocked={hasRequiredStatus(status, room.requiredStatus)}
            index={index}
          />
        ))}
      </div>
    </div>
  );
}
