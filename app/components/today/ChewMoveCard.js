// app/components/today/ChewMoveCard.js
//
// THE CHEW MOVE — the portal's flagship signature component.
//
// Isolation sequence: before the move resolves, CHEW's real tracked
// signals (active barriers, active opportunities, chewNoticed strings —
// all already-computed, already-persisted data, never invented for the
// animation) appear as chips, then recede as the move brightens. This is
// not "N candidate actions competing" — the underlying priority logic
// (lib/homeIntelligence.js) is a deterministic branch, not a scored
// contest — so the copy says "Evaluating N signals," a true count of
// what actually fed that decision, not a false multi-candidate narrative.
// Skipped entirely when there are zero real signals: nothing to isolate
// from, so no sequence plays.
//
// Domino Cascade ("ONE MOVE. N EFFECTS."): every step is a real number
// from lib/homeIntelligence.js's `impact` field (see
// lib/todayIntelligence.js's buildDominoCascade), paired with the real
// Today section it lands on — the same section vocabulary What Changed
// Ripple uses, so "affects X" means one thing everywhere on this page.
// Never rendered when there are no real effects.

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { IconSparkles, IconChevronRight } from '../icons';

const IMPACT_LABELS = {
  constraintsRemoved: (n) => `${n} constraint${n === 1 ? '' : 's'} removed`,
  goalsAdvanced: (n) => `${n} goal${n === 1 ? '' : 's'} advanced`,
  pathwaysUnlocked: (n) => `${n} pathway${n === 1 ? '' : 's'} unlocked`,
};

function DominoCascade({ steps, baseDelay }) {
  if (steps.length === 0) return null;
  return (
    <div className="chew-move-impact" aria-label="What this move accomplishes">
      <span className="chew-move-impact-kicker">ONE MOVE. {steps.length} EFFECT{steps.length === 1 ? '' : 'S'}.</span>
      <div className="chew-move-impact-row">
        <span className="chew-move-impact-source">1 move</span>
        {steps.map((step, i) => (
          <span key={step.key} className="chew-move-impact-step" style={{ animationDelay: `${baseDelay + i * 0.22}s` }}>
            <IconChevronRight className="chew-move-impact-arrow" />
            <span className="chew-move-impact-chip">
              {IMPACT_LABELS[step.key](step.value)}
              <span className="chew-move-impact-target">→ {step.systemLabel}</span>
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function IsolationField({ signals }) {
  if (signals.length === 0) return null;
  const n = signals.length;
  return (
    <div className="chew-isolation" aria-hidden="true">
      <span className="chew-isolation-kicker">Evaluating {n} signal{n === 1 ? '' : 's'}</span>
      <div className="chew-isolation-field">
        {signals.map((s, i) => {
          const offset = i - (n - 1) / 2;
          return (
            <span
              key={s.id}
              className={`chew-isolation-chip chew-isolation-chip--${s.kind}`}
              style={{
                left: `${50 + offset * 15}%`,
                top: `${i % 2 === 0 ? 0 : 14}px`,
                animationDelay: `${i * 0.09}s`,
              }}
            >
              {s.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default function ChewMoveCard({ move, urgent, signals = [], domino = { steps: [] } }) {
  const [open, setOpen] = useState(false);
  if (!move) return null;
  const isolated = signals.length > 0;

  return (
    <div className={`chew-move-card${isolated ? ' chew-move-card--isolated' : ''}`}>
      <IsolationField signals={signals} />

      <div className={`chew-move-eyebrow${urgent ? ' chew-move-eyebrow--urgent' : ''}`}>
        <IconSparkles />
        <span>{urgent ? 'Right now' : 'Your CHEW Move'}</span>
      </div>
      <h2 className="chew-move-action">{move.action}</h2>

      <DominoCascade steps={domino.steps} baseDelay={isolated ? 1.6 : 0.5} />

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
