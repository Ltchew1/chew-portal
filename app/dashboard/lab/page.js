// app/dashboard/lab/page.js
//
// The Lab hub. First-time visitors (has_completed_tour = false) see the
// cinematic entrance (TourExperience) instead of the room picker; everyone
// else lands straight on it — "The Lab remembers you." Same URL both
// times; TourExperience marks the tour complete and refreshes this Server
// Component, which then renders the hub. The goal/progress dashboard the
// tour promises between itself and the room picker isn't built yet — next
// checkpoint.

import { currentUser } from '@clerk/nextjs/server';
import Link from 'next/link';
import PageHeader from '../../components/PageHeader';
import TourExperience from '../../components/lab/tour/TourExperience';
import { IconChevronRight, IconLock } from '../../components/icons';
import { ROOMS } from '../../../lib/rooms';
import { statusFromClerkUser, hasRequiredStatus } from '../../../lib/clientStatus';
import { hasCompletedTour } from '../../../lib/tour';

const STATUS_LABELS = { applicant: 'Applicant', accepted: 'Accepted', paid: 'Paid' };

function RoomCardBody({ room, unlocked, enterable }) {
  const Icon = room.icon;
  return (
    <>
      <div className="card-icon"><Icon /></div>
      <h3>{room.name}</h3>
      <p style={{ fontSize: '0.88rem' }}>{room.tagline}</p>
      <span className="flex-between" style={{ marginTop: '8px' }}>
        <span className="text-faint" style={{ fontSize: '0.82rem' }}>
          {!room.built
            ? 'Coming to your Lab'
            : unlocked
              ? 'Enter'
              : `Unlocks at ${STATUS_LABELS[room.requiredStatus]}`}
        </span>
        {enterable ? <IconChevronRight /> : <IconLock />}
      </span>
    </>
  );
}

export default async function LabHubPage() {
  const user = await currentUser();
  const status = statusFromClerkUser(user);
  const toured = await hasCompletedTour(user.id);

  if (!toured) {
    return <TourExperience firstName={user.firstName || 'there'} />;
  }

  return (
    <>
      <PageHeader
        eyebrow="CHEW"
        title="Welcome back."
        description="Your rooms — each one a focused space for a different part of your financial infrastructure."
      />

      <div className="card-grid">
        {ROOMS.map((room) => {
          const unlocked = hasRequiredStatus(status, room.requiredStatus);
          const enterable = unlocked && room.built;

          return enterable ? (
            <Link key={room.slug} href={room.href} className="card" style={{ color: 'inherit' }}>
              <RoomCardBody room={room} unlocked={unlocked} enterable={enterable} />
            </Link>
          ) : (
            <div key={room.slug} className="card" style={{ opacity: 0.7 }}>
              <RoomCardBody room={room} unlocked={unlocked} enterable={enterable} />
            </div>
          );
        })}
      </div>
    </>
  );
}
