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
// Reduced motion: the CSS keyframes' end-state IS the resolved state
// (barrier gone, outcome visible), so the global prefers-reduced-motion
// rule (zeroes all animation durations) renders the correct final state
// instantly rather than skipping information.

'use client';

import { useState } from 'react';

const OUTCOME_LABEL = { barrier_cleared: 'BARRIER CLEARED', opportunity_unlocked: 'OPPORTUNITY UNLOCKED' };

function DissolveCard({ event }) {
  const [open, setOpen] = useState(false);
  const isBarrier = event.kind === 'barrier_cleared';

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
        <span className="dissolve-outcome">{OUTCOME_LABEL[event.kind]}</span>
      </div>
      <p className="dissolve-result">{isBarrier ? event.resolutionNote : event.title}</p>

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

export default function BarrierDissolve({ events }) {
  if (events.length === 0) return null;
  return (
    <div className="card">
      <h3 style={{ marginBottom: '4px' }}>Something just cleared</h3>
      <p className="text-faint" style={{ fontSize: '0.85rem', marginBottom: '16px' }}>
        A real condition changed since your last visit.
      </p>
      {events.map((e) => <DissolveCard key={e.id} event={e} />)}
    </div>
  );
}
