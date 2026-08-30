// app/dashboard/lab/credit/tracker/page.js — Dispute Tracker.
//
// Gated by app/dashboard/lab/credit/layout.js like every other Credit room
// route. The client's own record of what they did with each letter they
// generated and what happened — not a bureau-status lookup (see
// lib/disputeTracker.js and its API routes; nothing here reads from a
// bureau, ever).

import { currentUser } from '@clerk/nextjs/server';
import PageHeader from '../../../../components/PageHeader';
import CreditRoomSubNav from '../../../../components/lab/credit/CreditRoomSubNav';
import DisputeTracker from '../../../../components/lab/credit/DisputeTracker';
import { listTrackerEntriesForUser, listUntrackedLetters } from '../../../../../lib/disputeTracker';

export default async function CreditTrackerPage() {
  const user = await currentUser();
  const [entries, untrackedLetters] = await Promise.all([
    listTrackerEntriesForUser(user.id),
    listUntrackedLetters(user.id),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="The Lab · Credit"
        title="Dispute Tracker"
        description="Your own record of what you sent and what happened — log it whenever you're ready, at your own pace."
      />

      <CreditRoomSubNav />

      <DisputeTracker initialEntries={entries} initialUntrackedLetters={untrackedLetters} />
    </>
  );
}
