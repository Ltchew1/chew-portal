// app/components/today/FocusController.js
//
// CROSS-SYSTEM FOCUS MODE — the payoff of the shared portal-reaction
// contract (lib/portalReactions.js) and the affected-systems maps
// already computed for the static .ripple-glow treatment
// (app/dashboard/page.js's `affected`). Turns that passive, always-on
// signal into an active one: selecting a real insight (THE CHEW MOVE's
// "Why this move?", a Barrier Dissolve card's "Why this opened?", a Life
// Map territory) temporarily highlights the real sections it's
// connected to and softens the rest, instead of the whole page
// competing for attention at once.
//
// No new detection: every systems map a caller passes into setFocus()
// (see focusBus.js) is one already computed elsewhere this same page
// load (buildDominoCascade's `affected`, buildCrossSystemDomino's
// `affected`) — this component only routes it to the DOM. Mounted once,
// imperative by necessity: Today's sections are independent client
// components rendered as siblings by a server component page, not
// children of one shared client tree, so a window event (focusBus.js)
// is the connective tissue, and toggling data-attributes already present
// on each section (page.js) is how it reaches them.
//
// One focus source at a time; the last one selected wins (see
// focusBus.js's clearFocus semantics), and a closed panel only clears
// focus mode if it was the one that turned it on.
//
// Accessibility: dimming is opacity-only, so every section stays fully
// present and readable to screen readers regardless of visual state —
// nothing here is glow-only. A visually-hidden aria-live region restates
// in plain text what's highlighted, using the same real SYSTEM_LABEL
// strings the page already renders elsewhere, for anyone who can't see
// the highlight/dim contrast.

'use client';

import { useEffect, useRef } from 'react';
import { subscribeFocus } from './focusBus';

export default function FocusController({ systemLabels }) {
  const announceRef = useRef(null);

  useEffect(() => {
    const bg = document.querySelector('.today-bg');
    if (!bg) return undefined;

    // The currently active source — a clear() from anyone else is a
    // stale request (its panel already lost focus to something newer)
    // and must be ignored, or closing an old panel would wipe out a
    // selection made after it. This is the actual enforcement of the
    // "last one wins, only its owner can clear it" rule focusBus.js
    // documents; it lives here (the one place with memory) rather than
    // in each caller.
    let currentSource = null;

    const clearHighlights = () => {
      currentSource = null;
      bg.classList.remove('chew-focus-active');
      bg.querySelectorAll('[data-chew-focus-target]').forEach((el) => el.classList.remove('chew-focus-highlight'));
      if (announceRef.current) announceRef.current.textContent = '';
    };

    const unsubscribe = subscribeFocus(({ source, systems }) => {
      if (!systems || Object.keys(systems).length === 0) {
        if (source === currentSource) clearHighlights();
        return;
      }
      currentSource = source;
      bg.classList.add('chew-focus-active');
      bg.querySelectorAll('[data-chew-focus-target]').forEach((el) => {
        const key = el.getAttribute('data-chew-system');
        el.classList.toggle('chew-focus-highlight', !!systems[key]);
      });
      if (announceRef.current) {
        const labels = Object.keys(systems).filter((k) => systems[k]).map((k) => systemLabels[k]).filter(Boolean);
        announceRef.current.textContent = labels.length > 0 ? `Focused on: ${labels.join(', ')}` : '';
      }
    });

    return () => {
      unsubscribe();
      clearHighlights();
    };
  }, [systemLabels]);

  return <div ref={announceRef} className="sr-only" role="status" aria-live="polite" />;
}
