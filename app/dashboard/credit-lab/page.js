// app/dashboard/credit-lab/page.js
//
// Credit Lab module entry point. The guardrail components
// (StandingDisclosures, AttestationGate) are real and wired to the real
// database via lib/disputeItems.js, gated by
// app/dashboard/credit-lab/layout.js. BareFlagForm is a deliberate
// placeholder (see its file comment) that Layer 4b replaces with the full
// self-flagging tool. Layer 4a (Report Walkthrough) lives at
// ./walkthrough — linked via CreditLabSubNav below. The letter generator,
// tracker, and education library (Layers 4c–4e) aren't here yet.

import { currentUser } from '@clerk/nextjs/server';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import StandingDisclosures from '../../components/credit-lab/StandingDisclosures';
import AttestationGate from '../../components/credit-lab/AttestationGate';
import BareFlagForm from '../../components/credit-lab/BareFlagForm';
import CreditLabSubNav from '../../components/credit-lab/CreditLabSubNav';
import { IconScale } from '../../components/icons';
import { listDisputeItemsForUser } from '../../../lib/disputeItems';

export default async function CreditLabPage() {
  const user = await currentUser();
  const items = await listDisputeItemsForUser(user.id);

  return (
    <>
      <PageHeader
        eyebrow="CHEW Credit Lab"
        title="CHEW Credit Lab"
        description="We show you how to review your report and dispute items you don't recognize — filed by you, directly with the bureaus. This is education and tools, not credit repair."
      />

      <CreditLabSubNav />

      <StandingDisclosures variant="entry" />

      {items.length === 0 ? (
        <EmptyState
          icon={<IconScale />}
          title="You haven't flagged anything yet"
          description="Start with the Report Walkthrough above if you haven't pulled your reports yet. The full self-flagging tool is coming in the next build layer — use the form below to flag a test item and try the attestation gate."
        />
      ) : (
        <AttestationGate items={items} />
      )}

      <BareFlagForm />
    </>
  );
}
