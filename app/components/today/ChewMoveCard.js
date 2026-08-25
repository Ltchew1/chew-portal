// app/components/today/ChewMoveCard.js
//
// THE CHEW MOVE — Today's one central action. Same underlying shape as the
// Lab hub's next-move-card (action/why/effect/avoid/next), presented as
// the portal home's hero rather than one card among several, with the
// reasoning chain collapsed by default ("Why this move?") so the headline
// stays a single clear instruction, not a paragraph.

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { IconSparkles, IconChevronRight } from '../icons';

export default function ChewMoveCard({ move }) {
  const [open, setOpen] = useState(false);
  if (!move) return null;

  return (
    <div className="chew-move-card">
      <div className="chew-move-eyebrow">
        <IconSparkles />
        <span>Your CHEW Move</span>
      </div>
      <h2 className="chew-move-action">{move.action}</h2>

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
