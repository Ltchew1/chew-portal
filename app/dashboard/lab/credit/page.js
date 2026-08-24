// app/dashboard/lab/credit/page.js
//
// Credit room entry point / summary, inside CHEW: The Lab. Gated by
// app/dashboard/lab/credit/layout.js (Paid status) on top of the hub's own
// Accepted-status gate. Links out to the three built sub-features (Report
// Walkthrough, Flag Items, Letters); the tracker and education library
// aren't built yet, shown as "coming soon" in CreditRoomSubNav.

import { currentUser } from '@clerk/nextjs/server';
import Link from 'next/link';
import PageHeader from '../../../components/PageHeader';
import StandingDisclosures from '../../../components/lab/credit/StandingDisclosures';
import CreditRoomSubNav from '../../../components/lab/credit/CreditRoomSubNav';
import { IconBook, IconScale, IconMail, IconChevronRight } from '../../../components/icons';
import { listDisputeItemsForUser } from '../../../../lib/disputeItems';
import { listLettersForUser } from '../../../../lib/letters';

export default async function CreditRoomPage() {
  const user = await currentUser();
  const [items, letters] = await Promise.all([
    listDisputeItemsForUser(user.id),
    listLettersForUser(user.id),
  ]);
  const attestedCount = items.filter((i) => i.attested_at).length;

  return (
    <>
      <PageHeader
        eyebrow="The Lab · Credit"
        title="Credit"
        description="We show you how to review your report and dispute items you don't recognize — filed by you, directly with the bureaus. This is education and tools, not credit repair."
      />

      <CreditRoomSubNav />

      <StandingDisclosures variant="entry" />

      <div className="card-grid">
        <Link href="/dashboard/lab/credit/walkthrough" className="card" style={{ color: 'inherit' }}>
          <div className="card-icon"><IconBook /></div>
          <h3>Report Walkthrough</h3>
          <p style={{ fontSize: '0.88rem' }}>
            Pull your free reports from all three bureaus and learn what each section means.
          </p>
          <span className="flex-between" style={{ marginTop: '8px' }}>
            <span className="text-faint" style={{ fontSize: '0.82rem' }}>Start here</span>
            <IconChevronRight />
          </span>
        </Link>

        <Link href="/dashboard/lab/credit/flag" className="card" style={{ color: 'inherit' }}>
          <div className="card-icon"><IconScale /></div>
          <h3>Flag Items</h3>
          <p style={{ fontSize: '0.88rem' }}>
            Mark accounts you don&apos;t recognize or didn&apos;t authorize, and attest to each one.
          </p>
          <span className="flex-between" style={{ marginTop: '8px' }}>
            <span className="text-faint" style={{ fontSize: '0.82rem' }}>
              {items.length === 0 ? 'Not started' : `${attestedCount} of ${items.length} attested`}
            </span>
            <IconChevronRight />
          </span>
        </Link>

        <Link href="/dashboard/lab/credit/letters" className="card" style={{ color: 'inherit' }}>
          <div className="card-icon"><IconMail /></div>
          <h3>Letters</h3>
          <p style={{ fontSize: '0.88rem' }}>
            Generate a dispute letter for anything you&apos;ve attested — download, sign, and mail it yourself.
          </p>
          <span className="flex-between" style={{ marginTop: '8px' }}>
            <span className="text-faint" style={{ fontSize: '0.82rem' }}>
              {letters.length === 0 ? 'None generated yet' : `${letters.length} generated`}
            </span>
            <IconChevronRight />
          </span>
        </Link>
      </div>
    </>
  );
}
