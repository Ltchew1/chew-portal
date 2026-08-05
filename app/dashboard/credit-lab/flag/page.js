// app/dashboard/credit-lab/flag/page.js — Layer 4b: Self-Flagging Tool.
//
// The real feature FlagItemForm/AttestationGate were scaffolded for in
// Layer 3. Lists everything the client has flagged so far (with the
// attestation gate) and the form to flag something new. Gated by
// app/dashboard/credit-lab/layout.js like every other Credit Lab route.

import { currentUser } from '@clerk/nextjs/server';
import PageHeader from '../../../components/PageHeader';
import EmptyState from '../../../components/EmptyState';
import CreditLabSubNav from '../../../components/credit-lab/CreditLabSubNav';
import AttestationGate from '../../../components/credit-lab/AttestationGate';
import FlagItemForm from '../../../components/credit-lab/FlagItemForm';
import { IconScale } from '../../../components/icons';
import { listDisputeItemsForUser } from '../../../../lib/disputeItems';

export default async function CreditLabFlagPage() {
  const user = await currentUser();
  const items = await listDisputeItemsForUser(user.id);

  return (
    <>
      <PageHeader
        eyebrow="CHEW Credit Lab"
        title="Flag Items"
        description="Mark accounts you found on your report that you don't recognize or didn't authorize, then attest to each one below."
      />

      <CreditLabSubNav />

      {items.length === 0 && (
        <EmptyState
          icon={<IconScale />}
          title="Nothing flagged yet"
          description="Haven't pulled your reports yet? Start with the Report Walkthrough. Otherwise, use the form below to flag your first item."
        />
      )}

      {items.length > 0 && <AttestationGate items={items} />}

      <FlagItemForm />
    </>
  );
}
