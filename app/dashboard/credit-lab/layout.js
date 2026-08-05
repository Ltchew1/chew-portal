// app/dashboard/credit-lab/layout.js
//
// Server-side gate for the Credit Lab. Unless the signed-in user's status
// (Clerk publicMetadata.clientStatus, kept in sync with the client_status
// table by scripts/set-client-status.js) meets CREDIT_LAB_REQUIRED_STATUS,
// this renders a locked explanation instead of the child route — the same
// pattern app/dashboard/layout.js already uses for the signed-out redirect.
// Because this runs on the server before anything is sent to the browser,
// an insufficient status never receives the Credit Lab's markup or data;
// it isn't UI hidden behind a client-side check.

import { redirect } from 'next/navigation';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import { IconLock } from '../../components/icons';
import { getCreditLabAccess } from '../../../lib/clientStatus';

const STATUS_LABELS = { applicant: 'Applicant', accepted: 'Accepted', paid: 'Paid' };

export default async function CreditLabLayout({ children }) {
  const { user, status, hasAccess } = await getCreditLabAccess();
  if (!user) {
    redirect('/sign-in');
  }

  if (!hasAccess) {
    return (
      <>
        <PageHeader
          eyebrow="CHEW Credit Lab"
          title="Not unlocked yet"
          description="The Credit Lab opens once your account reaches Paid status."
        />
        <EmptyState
          icon={<IconLock />}
          title="This section isn't available on your account yet"
          description={`Your account is currently ${STATUS_LABELS[status]}. Message your CHEW strategist if you believe this should be unlocked.`}
        />
      </>
    );
  }

  return children;
}
