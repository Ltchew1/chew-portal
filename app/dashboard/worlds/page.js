// app/dashboard/worlds/page.js — "Worlds," the portal's honest map of
// every domain CHEW covers. The GRAND FINALE reference for this screen
// ("Home World") shows eight fabricated lifestyle categories — Home,
// Drive, Build, Go, Celebrate, Property, Level Up, Protect — none of
// which this app has a data model for. Rather than invent housing,
// vehicle, or travel data to fill that shape, this page shows the seven
// real rooms CHEW actually has (lib/rooms.js), gated by the exact same
// status/feature logic Today and The Lab hub already use
// (hasRequiredStatus + the feature registry's isRoomLive) — no new
// access rule, no second source of truth for what's "open."

import { currentUser } from '@clerk/nextjs/server';
import Link from 'next/link';
import { IconChevronRight, IconLock } from '../../components/icons';
import { ROOMS } from '../../../lib/rooms';
import { statusFromClerkUser, hasRequiredStatus } from '../../../lib/clientStatus';
import { listFeatures, evaluateFeatureAccess, roomFeatureKey } from '../../../lib/features';

const STATUS_LABELS = { applicant: 'Applicant', accepted: 'Accepted', paid: 'Paid' };

function WorldTile({ room, unlocked, live }) {
  const Icon = room.icon;
  const enterable = unlocked && live;
  const body = (
    <>
      <span className="world-tile-icon"><Icon /></span>
      <h3>{room.name}</h3>
      <p className="world-tile-tagline">{room.tagline}</p>
      <span className="enter-affordance">
        {!live ? 'Coming to your Lab' : unlocked ? 'Enter' : `Unlocks at ${STATUS_LABELS[room.requiredStatus]}`}
        {live && (enterable ? <IconChevronRight /> : <IconLock />)}
      </span>
    </>
  );

  const className = `world-tile${enterable ? ' world-tile--enterable' : ''}${!live ? ' world-tile--dormant' : ''}`;
  return enterable
    ? <Link href={room.href} className={className}>{body}</Link>
    : <div className={className}>{body}</div>;
}

export default async function WorldsPage() {
  const user = await currentUser();
  const status = statusFromClerkUser(user);

  const features = await listFeatures();
  const featuresByKey = new Map(features.map((f) => [f.featureKey, f]));
  const isRoomLive = (slug) => evaluateFeatureAccess(featuresByKey.get(roomFeatureKey(slug)), user);

  const readyCount = ROOMS.filter((room) => isRoomLive(room.slug) && hasRequiredStatus(status, room.requiredStatus)).length;

  return (
    <>
      <span className="page-eyebrow">Worlds</span>
      <h1 style={{ fontFamily: "'Fraunces', serif", marginBottom: '6px' }}>Your world, room by room</h1>
      <p className="text-faint" style={{ maxWidth: '60ch', marginBottom: '4px' }}>
        {readyCount} of {ROOMS.length} rooms open on your account — Credit today, the rest as CHEW builds them.
      </p>

      <div className="worlds-grid">
        {ROOMS.map((room) => (
          <WorldTile
            key={room.slug}
            room={room}
            unlocked={hasRequiredStatus(status, room.requiredStatus)}
            live={isRoomLive(room.slug)}
          />
        ))}
      </div>
    </>
  );
}
