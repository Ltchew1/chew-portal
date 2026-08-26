// app/components/today/WhatChangedRipple.js
//
// What Changed as an intelligence summary, not a fifth copy of the same
// events Barrier Dissolve/Domino/Radar/Life Map already render. The real
// highest-importance event (lib/todayIntelligence.js's buildChangeStory)
// leads; every real co-occurring fact (the same buildCrossSystemDomino
// data Domino/BarrierDissolve use — reused, not recomputed) folds into
// the same sentence. Everything else collapses behind "See what
// changed," which still renders the full, unsummarized chain — nothing
// is hidden, only reordered by importance. Each item still names the
// real Today section it affects (buildChangeRipples), and the matching
// section headings glow via the same .ripple-glow mechanism (page.js) —
// nothing the glow conveys is invisible to screen readers or reduced
// motion, since the same text sits in this expandable list either way.

'use client';

import { useState } from 'react';

export default function WhatChangedRipple({ story, items }) {
  const [open, setOpen] = useState(false);
  if (!story.headline && items.length === 0) return null;

  return (
    <div className="card">
      <h3 style={{ marginBottom: '10px' }}>Since last time</h3>

      {story.headline ? (
        <div className="change-story">
          <span className={`badge badge-${story.headline.isMeaningful ? 'pending' : 'neutral'}`} style={{ marginBottom: '8px' }}>
            {story.headline.importanceLabel}
          </span>
          <p className="change-story-headline">{story.headline.text}</p>
          {(story.coOccurring.length > 0 || story.systemsTouchedCount > 1) && (
            <p className="text-faint change-story-coincided">
              That coincided with{story.coOccurring.length > 0 ? `: ${story.coOccurring.join(', ')}` : ''}
              {story.systemsTouchedCount > 1 ? `${story.coOccurring.length > 0 ? ', and' : ':'} movement in ${story.systemsTouchedCount} connected areas` : ''}.
            </p>
          )}
        </div>
      ) : null}

      {items.length > 0 && (
        <>
          <button type="button" className="dissolve-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open} style={{ marginTop: story.headline ? '10px' : 0 }}>
            See what changed ({items.length})
          </button>
          {open && (
            <ul className="ripple-list" style={{ marginTop: '10px' }}>
              {items.map((c, i) => (
                <li key={i} className="ripple-item" style={{ animationDelay: `${i * 0.08}s` }}>
                  <span className="ripple-text">{c.text}</span>
                  {c.systems.length > 0 && (
                    <span className="ripple-affects">
                      {c.systems.map((s) => <span key={s} className="ripple-affects-chip">{s}</span>)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
