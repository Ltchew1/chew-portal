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
import { listAllHandoffs } from '../../../../lib/providerHandoff';
import { listAllEvents } from '../../../../lib/events';
import { NETWORK_ROUTING_LIVE } from '../../../../lib/networkRouting';

export default async function AdminNetworkPage() {
  const [providers, capabilities, pairs, handoffs, events] = await Promise.all([
    listProviders(),
    listCapabilities(),
    listCapabilityProviderPairs(),
    listAllHandoffs(),
    listAllEvents({ room: 'network', limit: 100 }),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Network"
        description="Entities, capabilities, pairings, and handoffs behind the Capability Graph — internal only."
      />
      <div className="alert" style={{ marginBottom: '20px', borderColor: NETWORK_ROUTING_LIVE ? undefined : 'var(--danger)' }}>
        <span>
          <strong>NETWORK_ROUTING_LIVE = {String(NETWORK_ROUTING_LIVE)}.</strong>{' '}
          {NETWORK_ROUTING_LIVE
            ? 'Client-facing routing is enabled. Every match below is potentially reachable by a real client.'
            : 'Client-facing routing is disabled. Nothing below is reachable by any client regardless of readiness status — this screen is a preview, not a live control panel.'}
        </span>
      </div>
      <NetworkAdmin
        initialProviders={providers}
        initialCapabilities={capabilities}
        initialPairs={pairs}
        initialHandoffs={handoffs}
        initialEvents={events}
      />
    </>
  );
}
