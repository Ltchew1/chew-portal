// app/dashboard/admin/network/page.js — Admin -> Network.
//
// Gated by app/dashboard/admin/layout.js (internal staff only). The real
// tool behind "adding a new company should not require editing multiple
// code files" — see app/components/admin/NetworkAdmin.js.

import PageHeader from '../../../components/PageHeader';
import NetworkAdmin from '../../../components/admin/NetworkAdmin';
import { listProviders } from '../../../../lib/providers';
import { listCapabilities } from '../../../../lib/capabilities';
import { listCapabilityProviderPairs } from '../../../../lib/capabilityGraph';

export default async function AdminNetworkPage() {
  const [providers, capabilities, pairs] = await Promise.all([
    listProviders(),
    listCapabilities(),
    listCapabilityProviderPairs(),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Network"
        description="Entities, capabilities, and pairings behind the Capability Graph — internal only."
      />
      <NetworkAdmin initialProviders={providers} initialCapabilities={capabilities} initialPairs={pairs} />
    </>
  );
}
