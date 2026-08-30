// app/dashboard/lab/credit/evidence/page.js — Evidence Vault.
//
// Gated by app/dashboard/lab/credit/layout.js (Paid) AND independently by
// the feature registry (getFeatureAccess) — see lib/features.js. Real,
// live, working: client-owned recordkeeping, not file storage (see
// lib/evidenceVault.js and EvidenceVault.js for why).

import PageHeader from '../../../../components/PageHeader';
import CreditRoomSubNav from '../../../../components/lab/credit/CreditRoomSubNav';
import LockedFeatureCard from '../../../../components/lab/LockedFeatureCard';
import EvidenceVault from '../../../../components/lab/credit/EvidenceVault';
import { IconVault } from '../../../../components/icons';
import { getFeatureAccess } from '../../../../../lib/features';
import { STATUS_LABELS } from '../../../../../lib/featureCopy';
import { listEvidenceForUser } from '../../../../../lib/evidenceVault';

export default async function CreditEvidencePage() {
  const { user, hasAccess, feature } = await getFeatureAccess('credit_evidence_vault');
  const records = hasAccess ? await listEvidenceForUser(user.id) : [];

  return (
    <>
      <PageHeader
        eyebrow="The Lab · Credit"
        title="Evidence Vault"
        description="A structured record of what you have and where it pertains to."
      />
      <CreditRoomSubNav />

      {!hasAccess ? (
        <LockedFeatureCard
          icon={<IconVault />}
          name={feature?.name ?? 'Evidence Vault'}
          description={feature?.description ?? 'A structured record of your evidence is coming to CHEW.'}
          statusLabel={STATUS_LABELS[feature?.status] ?? STATUS_LABELS.locked}
        />
      ) : (
        <EvidenceVault initialRecords={records} />
      )}
    </>
  );
}
