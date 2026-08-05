// app/dashboard/lab/credit/flag/page.js — Self-Flagging Tool.
//
// Lists everything the client has flagged so far (with the attestation
// gate) and the form to flag something new. Gated by
// app/dashboard/lab/credit/layout.js like every other Credit room route.

import { currentUser } from '@clerk/nextjs/server';
import PageHeader from '../../../../components/PageHeader';
import EmptyState from '../../../../components/EmptyState';
import CreditRoomSubNav from '../../../../components/lab/credit/CreditRoomSubNav';
import AttestationGate from '../../../../components/lab/credit/AttestationGate';
import FlagItemForm from '../../../../components/lab/credit/FlagItemForm';
import { IconScale } from '../../../../components/icons';
import { listDisputeItemsForUser } from '../../../../../lib/disputeItems';

export default async function CreditFlagPage() {
  const user = await currentUser();
  const items = await listDisputeItemsForUser(user.id);

  return (
    <>
      <PageHeader
        eyebrow="The Lab · Credit"
        title="Flag Items"
        description="Mark accounts you found on your report that you don't recognize or didn't authorize, then attest to each one below."
      />

      <CreditRoomSubNav />

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
