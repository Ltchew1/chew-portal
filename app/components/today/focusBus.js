// app/components/today/focusBus.js
//
// Cross-System Focus Mode's transport — a tiny window CustomEvent bus so
// independent client components (ChewMoveCard, BarrierDissolve, LifeMap,
// OpportunityRadar, and any future surface) can agree on "what's focused
// right now" without a shared React tree (Today's page is a server
// component; these are siblings it renders, not children of one client
// root). No state lives here — FocusController.js is the single place
// that decides what to do with a focus change.
//
// Two depths in the same payload, never a second focus system:
//   systems — section-level (Level 1). Real affected-systems maps a
//             caller already computed (domino.affected /
//             crossSystemDomino.affected), in the same vocabulary
//             lib/todayIntelligence.js's SYSTEM_LABEL uses.
//   nodeIds — object-level (Level 2/3), OPTIONAL. Real
//             `${entityType}:${entityId}` strings (the same scheme
//             lib/todayIntelligence.js's buildCreditSubNodes attaches as
//             `nodeId` and lib/portalReactions.js's coOccurringNodeIds
//             produces) naming the exact rows involved — never a
//             fabricated id. Omit entirely when only the section
//             relationship is known; FocusController falls back to
//             section-only dimming, the same behavior this had before
//             node-level focus existed.
//   label —   OPTIONAL real display label (the node's own title/action
//             text) for the aria-live announcement to lead with instead
//             of a generic section name.
//
// "Last one wins, and only its own owner can clear it": setFocus(source,
// systems, opts) always takes over; clearFocus(source) is a no-op unless
// `source` is still the currently active one — so closing a panel that
// already lost focus to something the member opened afterward doesn't
// wipe out that newer selection.

export const FOCUS_EVENT = 'chew:focus-change';

export function setFocus(source, systems, { nodeIds = [], label = null } = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(FOCUS_EVENT, { detail: { source, systems, nodeIds, label } }));
}

export function clearFocus(source) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(FOCUS_EVENT, { detail: { source, systems: null, nodeIds: [], label: null } }));
}

// cb receives { source, systems: object|null, nodeIds: string[], label:
// string|null }. Returns an unsubscribe function.
export function subscribeFocus(cb) {
  if (typeof window === 'undefined') return () => {};
  const handler = (e) => cb(e.detail);
  window.addEventListener(FOCUS_EVENT, handler);
  return () => window.removeEventListener(FOCUS_EVENT, handler);
}
