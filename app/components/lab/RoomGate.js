// app/components/lab/RoomGate.js
//
// Server-side status gate shared by every room layout in The Lab
// (app/dashboard/lab/layout.js for the hub itself, and each
// app/dashboard/lab/<room>/layout.js for its own, possibly higher,
// requirement — see lib/rooms.js's requiredStatus per room). Renders a
// locked explanation instead of `children` when status falls short, the
// same pattern app/dashboard/layout.js already uses for its signed-out
// redirect — this runs on the server before anything is sent to the
// browser, so an insufficient status never receives the room's markup or
// data, not just a hidden UI.

import { redirect } from 'next/navigation';
import PageHeader from '../PageHeader';
import EmptyState from '../EmptyState';
import { IconLock } from '../icons';
import { getRoomAccess } from '../../../lib/clientStatus';

const STATUS_LABELS = { applicant: 'Applicant', accepted: 'Accepted', paid: 'Paid' };

export default async function RoomGate({ name, requiredStatus, children }) {
  const { user, status, hasAccess } = await getRoomAccess(requiredStatus);
  if (!user) {
    redirect('/sign-in');
  }

  if (!hasAccess) {
    return (
      <>
        <PageHeader
          eyebrow="CHEW: The Lab"
          title={`${name} isn't unlocked yet`}
          description={`This room opens once your account reaches ${STATUS_LABELS[requiredStatus]} status.`}
        />
        <EmptyState
          icon={<IconLock />}
          title="This room isn't available on your account yet"
          description={`Your account is currently ${STATUS_LABELS[status]}. Message your CHEW strategist if you believe this should be unlocked.`}
        />
      </>
    );
  }

  return children;
}
