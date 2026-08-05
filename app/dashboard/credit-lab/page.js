// app/dashboard/credit-lab/page.js
//
// Credit Lab module entry point / summary. Gated by
// app/dashboard/credit-lab/layout.js. Links out to the two built
// sub-features (Report Walkthrough — Layer 4a, Flag Items — Layer 4b);
// the letter generator, tracker, and education library (4c–4e) aren't
// built yet, shown as "coming soon" in CreditLabSubNav.

import { currentUser } from '@clerk/nextjs/server';
import Link from 'next/link';
import PageHeader from '../../components/PageHeader';
import StandingDisclosures from '../../components/credit-lab/StandingDisclosures';
import CreditLabSubNav from '../../components/credit-lab/CreditLabSubNav';
import { IconBook, IconScale, IconChevronRight } from '../../components/icons';
import { listDisputeItemsForUser } from '../../../lib/disputeItems';

export default async function CreditLabPage() {
  const user = await currentUser();
  const items = await listDisputeItemsForUser(user.id);
  const attestedCount = items.filter((i) => i.attested_at).length;

  return (
    <>
      <PageHeader
        eyebrow="CHEW Credit Lab"
        title="CHEW Credit Lab"
        description="We show you how to review your report and dispute items you don't recognize — filed by you, directly with the bureaus. This is education and tools, not credit repair."
      />

      <CreditLabSubNav />

      <StandingDisclosures variant="entry" />

      <div className="card-grid">
        <Link href="/dashboard/credit-lab/walkthrough" className="card" style={{ color: 'inherit' }}>
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

        <Link href="/dashboard/credit-lab/flag" className="card" style={{ color: 'inherit' }}>
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
      </div>
    </>
  );
}
