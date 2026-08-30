// lib/networkRouting.js
//
// The explicit gate between the Capability Graph existing (lib/capabilities.js,
// lib/providers.js, lib/capabilityGraph.js, lib/providerHandoff.js — all
// real, working code) and it actually being reachable from anything a
// client can see. NETWORK_ROUTING_LIVE is false; nothing in Ask CHEW,
// recommendations, notifications, or navigation checks the Capability
// Graph while it's false. Flip it only once at least one provider has been
// seeded, marked 'ready', and passes isReadyForRouting() — flipping this
// flag is a deliberate, separate decision from building the plumbing.
//
// This file is also the one sanctioned place for the directive's tasteful,
// non-specific expansion language — it never names a capability or
// provider, on purpose.

export const NETWORK_ROUTING_LIVE = false;

export function getExpansionNotice() {
  return 'CHEW is expanding the network of services available through the platform.';
}
