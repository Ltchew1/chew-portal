// app/components/today/focusBus.js
//
// Cross-System Focus Mode's transport — a tiny window CustomEvent bus so
// independent client components (ChewMoveCard, BarrierDissolve, LifeMap,
// and any future surface) can agree on "what's focused right now"
// without a shared React tree (Today's page is a server component; these
// are siblings it renders, not children of one client root). No state
// lives here — FocusController.js is the single place that decides what
// to do with a focus change.
//
// Real systems only, in the SAME vocabulary lib/todayIntelligence.js's
// SYSTEM_LABEL already uses ('waiting', 'opportunity', 'life_map', ...)
// — a caller passes the exact affected-systems map it already computed
// (domino.affected / crossSystemDomino.affected), never a new one.
//
// "Last one wins, and only its own owner can clear it": setFocus(source,
// systems) always takes over; clearFocus(source) is a no-op unless
// `source` is still the currently active one — so closing a panel that
// already lost focus to something the member opened afterward doesn't
// wipe out that newer selection.

export const FOCUS_EVENT = 'chew:focus-change';

export function setFocus(source, systems) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(FOCUS_EVENT, { detail: { source, systems } }));
}

export function clearFocus(source) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(FOCUS_EVENT, { detail: { source, systems: null } }));
}

// cb receives { source, systems: object|null }. Returns an unsubscribe
// function.
export function subscribeFocus(cb) {
  if (typeof window === 'undefined') return () => {};
  const handler = (e) => cb(e.detail);
  window.addEventListener(FOCUS_EVENT, handler);
  return () => window.removeEventListener(FOCUS_EVENT, handler);
}
