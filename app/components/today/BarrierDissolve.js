// app/components/today/BarrierDissolve.js
//
// BARRIER / UNLOCK DISSOLVE — a real structural obstruction visibly
// clearing, not a green checkmark. Every event here is a real state
// transition (lib/todayIntelligence.js's buildDissolveEvents), and it
// only ever renders on the exact page load where CHEW detected it —
// resolvedBarriers/newlyActiveOpportunities are empty on every later
// visit, so this never replays an old transition as new.
//
// Two distinct outcomes, never collapsed into one generic "unlocked":
// BARRIER CLEARED (a real blocker ended) and OPPORTUNITY UNLOCKED (a
// real opportunity became available). The "why" panel is collapsed by
// default, same pattern as THE CHEW MOVE's reasoning chain — expansion
// is deliberate, not forced.
//
// A barrier clearing can set off a real DOMINO EFFECT: on the exact
// same reconciliation pass, did an opportunity also go active, or did
// the recommended move change (lib/todayIntelligence.js's
// buildCrossSystemDomino)? Not a claim that this barrier specifically
// caused those things — a true statement about what CHEW detected
// together in this pass. Each effect names the real system it landed
// on, and that system's section glows elsewhere on the page (same
// .ripple-glow mechanism What Changed Ripple and Domino Cascade use —
// one visual language, not three).
//
// Reduced motion: the CSS keyframes' end-state IS the resolved state
// (barrier gone, outcome visible, domino chips visible), so the global
// prefers-reduced-motion rule (zeroes all animation durations) renders
// the correct final state instantly rather than skipping information.

'use client';

import { useState } from 'react';
import { IconChevronRight } from '../icons';

const OUTCOME_LABEL = { barrier_cleared: 'BARRIER CLEARED', opportunity_unlocked: 'OPPORTUNITY UNLOCKED' };

function DissolveCard({ event, crossSystemDomino }) {
  const [open, setOpen] = useState(false);
  const isBarrier = event.eventType === 'barrier_cleared';
  const showDomino = isBarrier && crossSystemDomino?.active;

  return (
    <div className="dissolve-card">
      <div className="dissolve-stage">
        <span className={`dissolve-node ${isBarrier ? 'dissolve-node--barrier' : 'dissolve-node--locked'}`}>
          {isBarrier ? event.title : 'Locked'}
        </span>
        <span className="dissolve-connector" aria-hidden="true">
          <span className="dissolve-connector-broken" />
          <span className="dissolve-connector-open" />
        </span>
        <span className="dissolve-outcome">{OUTCOME_LABEL[event.eventType]}</span>
      </div>
      <p className="dissolve-result">{isBarrier ? event.resolutionNote : event.title}</p>

      {showDomino && (
        <div className="dissolve-domino" aria-label="What this also changed">
          <span className="dissolve-domino-label">Domino effect</span>
          <div className="dissolve-domino-row">
            {crossSystemDomino.effects.map((eff, i) => (
              <span key={eff.system} className="dissolve-domino-chip" style={{ animationDelay: `${1.9 + i * 0.2}s` }}>
                <IconChevronRight className="dissolve-domino-arrow" />
                {eff.text}
              </span>
            ))}
          </div>
        </div>
      )}

      <button type="button" className="dissolve-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        Why this opened
      </button>
      {open && (
        <dl className="dissolve-detail">
          {isBarrier ? (
            <>
              <div><dt>Prior blocker</dt><dd>{event.whatHappened}</dd></div>
              {event.doThisNow && <div><dt>What was being asked</dt><dd>{event.doThisNow}</dd></div>}
              <div><dt>Resulting change</dt><dd>{event.resolutionNote}</dd></div>
            </>
          ) : (
            <>
              <div><dt>What improved</dt><dd>{event.whatImproved}</dd></div>
              {event.whyItMatters && <div><dt>Why it matters</dt><dd>{event.whyItMatters}</dd></div>}
              {event.suggestedAction && <div><dt>Suggested next step</dt><dd>{event.suggestedAction}</dd></div>}
            </>
          )}
        </dl>
      )}
    </div>
  );
}

export default function BarrierDissolve({ events, crossSystemDomino }) {
  if (events.length === 0) return null;
  return (
    <div className="card">
      <h3 style={{ marginBottom: '4px' }}>Something just cleared</h3>
      <p className="text-faint" style={{ fontSize: '0.85rem', marginBottom: '16px' }}>
        A real condition changed since your last visit.
      </p>
      {events.map((e) => <DissolveCard key={e.id} event={e} crossSystemDomino={crossSystemDomino} />)}
    </div>
  );
}
