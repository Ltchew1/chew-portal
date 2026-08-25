// app/components/today/ChewMoveCard.js
//
// THE CHEW MOVE — the flagship, signature component of the whole portal
// (see the portal directive's "this should become one of the signature
// components of the entire platform"). Same underlying shape as the Lab
// hub's next-move-card (action/why/effect/avoid/next), plus two things
// that card doesn't have:
//
// 1. The impact chain — "removes N constraints -> advances N goals ->
//    unlocks N pathways." Every number comes straight off
//    lib/homeIntelligence.js's `impact` field, computed in the same
//    branch that already decided this was the move — never a separate
//    estimate, and never rendered as a chip when the real number is 0.
// 2. A "Right now" tag when the room's planStatus says this is urgent,
//    not just next.
//
// The reasoning chain stays collapsed by default so the headline reads
// as one clear instruction, not a paragraph — expansion is a deliberate
// second action ("Why this move?"), never forced open.

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { IconSparkles, IconChevronRight } from '../icons';

const IMPACT_LABELS = {
  constraintsRemoved: (n) => `${n} constraint${n === 1 ? '' : 's'} removed`,
  goalsAdvanced: (n) => `${n} goal${n === 1 ? '' : 's'} advanced`,
  pathwaysUnlocked: (n) => `${n} pathway${n === 1 ? '' : 's'} unlocked`,
};
const IMPACT_ORDER = ['constraintsRemoved', 'goalsAdvanced', 'pathwaysUnlocked'];

function ImpactChain({ impact }) {
  const chips = IMPACT_ORDER
    .filter((key) => impact?.[key] > 0)
    .map((key) => ({ key, text: IMPACT_LABELS[key](impact[key]) }));
  if (chips.length === 0) return null;

  return (
    <div className="chew-move-impact" aria-label="What this move accomplishes">
      <span className="chew-move-impact-source">1 move</span>
      {chips.map((chip, i) => (
        <span key={chip.key} className="chew-move-impact-step" style={{ animationDelay: `${0.5 + i * 0.18}s` }}>
          <IconChevronRight className="chew-move-impact-arrow" />
          <span className="chew-move-impact-chip">{chip.text}</span>
        </span>
      ))}
    </div>
  );
}

export default function ChewMoveCard({ move, urgent }) {
  const [open, setOpen] = useState(false);
  if (!move) return null;

  return (
    <div className="chew-move-card">
      <div className={`chew-move-eyebrow${urgent ? ' chew-move-eyebrow--urgent' : ''}`}>
        <IconSparkles />
        <span>{urgent ? 'Right now' : 'Your CHEW Move'}</span>
      </div>
      <h2 className="chew-move-action">{move.action}</h2>

      <ImpactChain impact={move.impact} />

      <button
        type="button"
        className="chew-move-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        Why this move? <IconChevronRight style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s ease' }} />
      </button>

      {open && (
        <dl className="chew-move-reasoning">
          {move.why && <div><dt>Why</dt><dd>{move.why}</dd></div>}
          {move.effect && <div><dt>Effect</dt><dd>{move.effect}</dd></div>}
          {move.avoid && <div><dt>Don&apos;t</dt><dd>{move.avoid}</dd></div>}
          {move.next && <div><dt>Next</dt><dd>{move.next}</dd></div>}
        </dl>
      )}

      {move.href && (
        <Link href={move.href} className="btn btn-gold chew-move-cta">
          {move.linkLabel ?? 'Take this step'} <IconChevronRight />
        </Link>
      )}
    </div>
  );
}
