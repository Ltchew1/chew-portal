// app/components/today/ComingToCommandCenter.js
//
// Truthful previews of the portal experiences the network directive and
// the portal master directive both call for next — Path, Network, Vault —
// none of them built yet. Reuses the same LockedFeatureCard treatment as
// the Lab hub's dormant rooms: a premium, non-interactive "coming" card,
// never a dead link, never implied to be operational.
//
// Network in particular must stay generic on purpose — see
// lib/networkRouting.js and CAPABILITY_NETWORK.md: the Capability Network
// is real, working backend code, but NETWORK_ROUTING_LIVE is false and no
// provider is client-facing yet. This card names no capability and no
// provider, exactly like lib/networkRouting.js's own getExpansionNotice().

import LockedFeatureCard from '../lab/LockedFeatureCard';
import { IconTrendUp, IconReferral, IconVault } from '../icons';
import { STATUS_LABELS } from '../../../lib/featureCopy';
import { getExpansionNotice } from '../../../lib/networkRouting';

export default function ComingToCommandCenter() {
  return (
    <div>
      <h3 style={{ marginBottom: '4px' }}>Coming to your command center</h3>
      <p className="text-faint" style={{ fontSize: '0.85rem', marginBottom: '18px' }}>
        Built next, in this order — each one a connected view of the same CHEW intelligence, not a separate app.
      </p>
      <div className="card-grid">
        <LockedFeatureCard
          icon={<IconTrendUp />}
          name="Path"
          description="How you get from where you are to where you're going — milestones, requirements, and the next action, laid out as one route instead of a task list."
          statusLabel={STATUS_LABELS.locked}
        />
        <LockedFeatureCard
          icon={<IconReferral />}
          name="Network"
          description={getExpansionNotice()}
          statusLabel={STATUS_LABELS.internal}
        />
        <LockedFeatureCard
          icon={<IconVault />}
          name="Vault"
          description="An intelligent document environment — every document connected to the goal, requirement, or deadline it actually supports."
          statusLabel={STATUS_LABELS.locked}
        />
      </div>
    </div>
  );
}
