// app/components/today/FocusController.js
//
// CROSS-SYSTEM FOCUS MODE — the payoff of the shared portal-reaction
// contract (lib/portalReactions.js) and the affected-systems maps
// already computed for the static .ripple-glow treatment
// (app/dashboard/page.js's `affected`). Turns that passive, always-on
// signal into an active one: selecting a real insight (THE CHEW MOVE's
// "Why this move?", a Barrier Dissolve card's "Why this opened?", a Life
// Map territory, an Opportunity Radar node) temporarily highlights the
// real sections and objects it's connected to and softens the rest,
// instead of the whole page competing for attention at once.
//
// THREE DEPTHS, ONE MECHANISM — never a second focus system, and never
// deeper than the real data proves:
//   Level 1 (section)  — `systems` only. A section either dims or
//                         doesn't; every node inside it looks the same.
//                         This is the whole mechanism before this pass.
//   Level 2 (node)      — `nodeIds` also present. Only the exact
//                         `data-chew-node` elements named highlight at
//                         full strength; sibling nodes in the same
//                         section soften (a shade dimmer than a fully
//                         out-of-focus section, but still present).
//   Level 3 (chain)     — same `nodeIds`, but a `data-chew-edge`
//                         element (an SVG line, "from|to" using the
//                         same nodeId strings) lights up only when BOTH
//                         its endpoints are in the set — an emergent
//                         property of Level 2, not a separate payload.
//
// No new detection: every nodeId a caller passes is one already carried
// by real data this page load — lib/todayIntelligence.js's
// buildCreditSubNodes attaches `nodeId` to every real Life Map subnode,
// and lib/portalReactions.js's coOccurringNodeIds resolves a real
// co-occurrence down to the specific rows involved. A caller with only
// section-level knowledge simply omits nodeIds — Level 2/3 never fires
// on a guess.
//
// Mounted once, imperative by necessity: Today's sections are
// independent client components rendered as siblings by a server
// component page, not children of one shared client tree, so a window
// event (focusBus.js) is the connective tissue, and toggling
// data-attributes already present on each section/node (page.js,
// LifeMap.js, OpportunityRadar.js) is how it reaches them.
//
// One focus source at a time; the last one selected wins, and a closed
// panel only clears focus mode if it was the one that turned it on (see
// `currentSource` below — the actual enforcement of the rule
// focusBus.js documents).
//
// Accessibility: dimming/softening is opacity-only, so every section
// and node stays fully present and readable to screen readers
// regardless of visual state — nothing here is glow-only. A
// visually-hidden aria-live region restates in plain text what's
// highlighted, leading with the real object label when one was given
// (e.g. "Focused on: Real Asset Execution — connects to What's Waiting")
// instead of a generic section name.

'use client';

import { useEffect, useRef } from 'react';
import { subscribeFocus } from './focusBus';

export default function FocusController({ systemLabels }) {
  const announceRef = useRef(null);

  useEffect(() => {
    const bg = document.querySelector('.today-bg');
    if (!bg) return undefined;

    let currentSource = null;

    const clearHighlights = () => {
      currentSource = null;
      bg.classList.remove('chew-focus-active');
      bg.querySelectorAll('[data-chew-focus-target]').forEach((el) => el.classList.remove('chew-focus-highlight'));
      bg.querySelectorAll('[data-chew-node]').forEach((el) => el.classList.remove('chew-focus-node-highlight', 'chew-focus-node-soften'));
      bg.querySelectorAll('[data-chew-edge]').forEach((el) => el.classList.remove('chew-focus-edge-highlight'));
      if (announceRef.current) announceRef.current.textContent = '';
    };

    const unsubscribe = subscribeFocus(({ source, systems, nodeIds, label }) => {
      // Ownership is decided synchronously (same tick as the click), so
      // rapid selections still resolve "last one wins" correctly even
      // before a frame renders.
      if (!systems || Object.keys(systems).length === 0) {
        if (source === currentSource) {
          currentSource = null;
          // The DOM writes below still need the same deferral as the
          // "set" path (see the comment there) — clearing right away
          // would race a re-render the same click may have triggered.
          requestAnimationFrame(clearHighlights);
        }
        return;
      }
      currentSource = source;

      // Deferred one frame: setFocus is very often called from inside
      // the SAME click handler that also updates the caller's own local
      // React state (e.g. OpportunityRadar.js's `selectedKey`). If this
      // ran synchronously, it could write chew-focus-node-highlight to
      // an element a moment before React's own re-render for that click
      // commits and overwrites that same element's className wholesale
      // (React owns className; it has no idea a listener touched it
      // directly) — silently erasing the highlight the instant it was
      // applied. One rAF reliably lands after that commit. Caught by
      // this file's own Playwright verification, not by reading the
      // code — a real element was losing its highlight class the
      // instant it was added.
      requestAnimationFrame(() => {
        bg.classList.add('chew-focus-active');

        bg.querySelectorAll('[data-chew-focus-target]').forEach((el) => {
          const key = el.getAttribute('data-chew-system');
          el.classList.toggle('chew-focus-highlight', !!systems[key]);
        });

        const ids = nodeIds ?? [];
        bg.querySelectorAll('[data-chew-node]').forEach((el) => {
          const id = el.getAttribute('data-chew-node');
          const isTarget = ids.length > 0 && ids.includes(id);
          el.classList.toggle('chew-focus-node-highlight', isTarget);
          el.classList.toggle('chew-focus-node-soften', ids.length > 0 && !isTarget);
        });
        bg.querySelectorAll('[data-chew-edge]').forEach((el) => {
          const [from, to] = (el.getAttribute('data-chew-edge') ?? '').split('|');
          el.classList.toggle('chew-focus-edge-highlight', ids.length > 0 && ids.includes(from) && ids.includes(to));
        });

        if (announceRef.current) {
          const sectionLabels = Object.keys(systems).filter((k) => systems[k]).map((k) => systemLabels[k]).filter(Boolean);
          if (label && sectionLabels.length > 0) {
            announceRef.current.textContent = `Focused on: ${label} — connects to ${sectionLabels.join(', ')}`;
          } else if (label) {
            announceRef.current.textContent = `Focused on: ${label}`;
          } else if (sectionLabels.length > 0) {
            announceRef.current.textContent = `Focused on: ${sectionLabels.join(', ')}`;
          } else {
            announceRef.current.textContent = '';
          }
        }
      });
    });

    return () => {
      unsubscribe();
      clearHighlights();
    };
  }, [systemLabels]);

  return <div ref={announceRef} className="sr-only" role="status" aria-live="polite" />;
}
