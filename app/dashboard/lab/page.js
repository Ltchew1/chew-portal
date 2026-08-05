// app/dashboard/lab/page.js
//
// The Lab hub: the room picker. This checkpoint (rename/restructure) ships
// it as a straightforward grid — the cinematic tour and goal/progress
// dashboard land in later checkpoints. Every built, unlocked room links
// out to its own route; status-locked or not-yet-built rooms say so
// plainly (rendered as a non-interactive card, not a dead link).

import { currentUser } from '@clerk/nextjs/server';
import Link from 'next/link';
import PageHeader from '../../components/PageHeader';
import { IconChevronRight, IconLock } from '../../components/icons';
import { ROOMS } from '../../../lib/rooms';
import { statusFromClerkUser, hasRequiredStatus } from '../../../lib/clientStatus';

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

  return (
    <>
      <PageHeader
        eyebrow="CHEW"
        title="CHEW: The Lab"
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
