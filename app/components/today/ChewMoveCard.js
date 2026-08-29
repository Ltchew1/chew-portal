// app/components/today/ChewMoveCard.js
//
// THE CHEW MOVE — the portal's flagship signature component, the visual
// and strategic center of Today. Answers, in order: what should I do
// next, why, what does it affect, and (via Before/Now) what changed to
// get here. Sourced entirely from the same real recommendation/move
// state every other surface reads (lib/homeIntelligence.js's
// nextBestMove, lib/todayIntelligence.js's buildMoveSignals/
// buildDominoCascade, and — for the change itself — the single
// recommendation_changed reaction app/dashboard/page.js already filtered
// via lib/portalReactions.js's reactionsFor). No second recommendation
// engine, no invented action when one doesn't exist (see the `!move`
// branch below).
//
// SIGNATURE REVEAL, GATED TO A REAL CHANGE: earlier versions of this card
// played the isolation-then-resolve ceremony on every mount, changed or
// not — "No repeated animation on every render" (this pass's directive)
// means that's wrong. `changed` (real: a canonical recommendation_changed
// event existed this reconciliation pass) is the only thing that turns
// the animation on at all; an ordinary revisit renders the settled
// resting state immediately, no ceremony. `handoffDelay` (also real: does
// Signature Session Choreography's overlay plausibly precede this
// reveal — see page.js) pushes the reveal to land after that overlay
// would close, instead of finishing invisibly behind it; skipping the
// isolation micro-sequence in that case keeps the two timings from
// fighting each other. Fixed CSS animation-delay values, same category
// of decision this card already shipped (the original 1.35s
// isolation-then-resolve gap) — no client-side reduced-motion branching
// needed for a delay this size.

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { IconSparkles, IconChevronRight } from '../icons';
import { setFocus, clearFocus } from './focusBus';

const IMPACT_LABELS = {
  constraintsRemoved: (n) => `${n} constraint${n === 1 ? '' : 's'} removed`,
  goalsAdvanced: (n) => `${n} goal${n === 1 ? '' : 's'} advanced`,
  pathwaysUnlocked: (n) => `${n} pathway${n === 1 ? '' : 's'} unlocked`,
};

export function DominoCascade({ steps, baseDelay }) {
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

// The leverage map's cross-system half: real co-occurring transitions
// (lib/todayIntelligence.js's buildCrossSystemDomino, the exact same
// object BarrierDissolve's "Domino effect" row reads — never
// independently re-detected here). The move's own entry is filtered out
// — a card cannot meaningfully tell you it "connects to" its own change.
function ConnectsTo({ connects }) {
  const effects = (connects?.effects ?? []).filter((e) => e.system !== 'move');
  if (!connects?.active || effects.length === 0) return null;
  return (
    <div className="chew-move-connects" aria-label="What else is true right now">
      <span className="chew-move-connects-kicker">Connects to</span>
      <div className="chew-move-connects-row">
        {effects.map((eff) => (
          <span key={eff.system} className="chew-move-connects-chip">
            <IconChevronRight className="chew-move-connects-arrow" />
            {eff.text}
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

export default function ChewMoveCard({
  move, noMoveReason, urgent, signals = [], domino = { steps: [] }, goal = null,
  changed = false, previousActionText = null, level = null, connects = null, handoffDelay = false,
  moveId = null, moveCoOccurringNodeIds = [],
}) {
  const [open, setOpen] = useState(false);

  // Honest empty state — real reason, never an invented action just to
  // fill the space (the one case is a paid client whose Credit room
  // isn't live yet; see page.js's noMoveReason).
  if (!move) {
    return (
      <div className="chew-move-card chew-move-card--empty">
        <div className="chew-move-eyebrow">
          <IconSparkles />
          <span>Your CHEW Move</span>
        </div>
        <h2 className="chew-move-action chew-move-action--empty">No priority move yet</h2>
        {noMoveReason && <p className="chew-move-empty-reason">{noMoveReason}</p>}
      </div>
    );
  }

  // No animation at all when nothing changed (a plain revisit) — the
  // isolation micro-sequence is skipped, too, whenever a choreography
  // handoff is expected, so the two timings never compete (see the file
  // header comment).
  const isolated = changed && !handoffDelay && signals.length > 0;
  const resolveDelay = handoffDelay ? 1.6 : (isolated ? 1.35 : 0.5);
  const levelClass = changed && level ? ` chew-move-card--level-${level}` : '';

  // Cross-System Focus Mode — real leverage only: the move's own proven
  // impact (domino.affected) plus, when this pass's change co-occurred
  // with something else, the same crossSystemDomino.affected map
  // ConnectsTo already renders as text. Never independently re-detected.
  const focusSystems = { ...domino.affected, ...(changed && connects?.active ? connects.affected : {}) };
  const hasFocusTargets = Object.keys(focusSystems).length > 0;

  // Node-level (Level 2): the move's own real id, its real goal, and —
  // only on a genuine change that really co-occurred with something else
  // — the exact other rows involved (page.js precomputed this via
  // lib/portalReactions.js's coOccurringNodeIds; never independently
  // re-derived here). Anything without a real backing id is simply
  // omitted, never invented.
  const focusNodeIds = [
    moveId ? `move:${moveId}` : null,
    goal?.id ? `goal:${goal.id}` : null,
    ...(changed && connects?.active ? moveCoOccurringNodeIds : []),
  ].filter(Boolean);

  function toggleReasoning() {
    setOpen((wasOpen) => {
      const willOpen = !wasOpen;
      if (willOpen && hasFocusTargets) setFocus('chewMove', focusSystems, { nodeIds: focusNodeIds, label: move.action });
      else clearFocus('chewMove');
      return willOpen;
    });
  }

  return (
    <div
      className={`chew-move-card${isolated ? ' chew-move-card--isolated' : ''}${changed ? ' chew-move-card--changed' : ''}${levelClass}`}
      style={changed ? { '--chew-move-delay': `${resolveDelay}s` } : undefined}
      data-chew-node={moveId ? `move:${moveId}` : undefined}
    >
      {isolated && <IsolationField signals={signals} />}

      <div className={`chew-move-eyebrow${urgent ? ' chew-move-eyebrow--urgent' : ''}`}>
        <IconSparkles />
        <span>{urgent ? 'Right now' : 'Your CHEW Move'}</span>
      </div>

      {/* Before/Now — only when a real prior action exists (a genuine
          change this pass, never fabricated). The "Now" is the headline
          below; this is only ever the "Before" half. */}
      {changed && previousActionText && (
        <p className="chew-move-previous">
          Previous priority: <span className="chew-move-previous-text">{previousActionText}</span>
        </p>
      )}

      <h2 className="chew-move-action">{move.action}</h2>

      <DominoCascade steps={domino.steps} baseDelay={isolated ? 1.6 : 0.5} />
      {changed && <ConnectsTo connects={connects} />}

      <button
        type="button"
        className="chew-move-toggle"
        onClick={toggleReasoning}
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
          {goal && <div><dt>Goal</dt><dd>Score target: {goal.targetValue}</dd></div>}
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
