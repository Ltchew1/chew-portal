// app/components/today/SessionChoreography.js
//
// SIGNATURE SESSION CHOREOGRAPHY — a short, one-shot return sequence:
// "CHEW online" -> "N things changed while you were away" -> "1 thing
// that matters" -> reveal into the real Today page underneath. Every
// word here is data Today already renders in plain text elsewhere on the
// same page (the summary line, WhatChangedRipple's headline) — this is a
// curated preview of real information, not a second source of truth, so
// skipping it (no JS, reduced motion, or the Skip control) never loses
// anything a member could only get by watching it play.
//
// DISABLED WHEN NOTHING MEANINGFUL CHANGED: `level`/`topItemText` come
// from lib/portalReactions.js's buildPortalReactions and
// lib/todayIntelligence.js's pickTopChangeText — both real. No level, no
// top item, no key: no sequence. This renders nothing rather than
// staging an empty ceremony.
//
// ONE-SHOT, NEVER REPLAYED: `eventKey` (built in app/dashboard/page.js)
// comes from the real transition-event ids behind this exact level (or,
// lacking those, real whatChanged timestamps) — never a timer or a
// generic "seen today" flag. sessionStorage remembers that key so a
// re-render of the same real change (a duplicate tab, a back/forward
// navigation before the next reconciliation pass) does not replay the
// same moment; a genuinely new change produces a new key and plays
// again — the same guarantee the rest of the propagation layer relies
// on (lib/transitions.js's header comment).
//
// REDUCED MOTION: checked directly rather than left to the global CSS
// duration override — since every word here is redundant with
// always-present text elsewhere on Today, the honest choice is to skip
// the whole dramatization rather than show a motionless husk of it. SSR
// and no-JS renders nothing; the mount effect below only ever turns it
// on after a deliberate client-side check, so there is no server/client
// mismatch and no flash for anyone who never gets JS.
//
// NOT aria-hidden: unlike ProgressWorldReaction (purely atmospheric),
// this overlay's text is the whole point while visible, so it carries
// role="status"/aria-live so screen reader users hear the same three
// lines instead of silence, and its Skip control is a real, focusable
// button (autoFocus) rather than something only a sighted mouse user
// could reach. Not a modal: nothing traps focus, and it unmounts itself
// the moment the sequence (or a skip) finishes closing.

'use client';

import { useEffect, useState } from 'react';

const STAGES = ['online', 'summary', 'headline'];
const STAGE_MS = { online: 1000, summary: 1600, headline: 2400 };
const CLOSE_MS = 500;

export default function SessionChoreography({ level, changedCount, attentionCount, topItemText, eventKey }) {
  const [stage, setStage] = useState(null);
  const [closing, setClosing] = useState(false);

  // Mount-only: decide once whether this exact real change has already
  // played in this browser tab.
  useEffect(() => {
    if (!level || !topItemText || !eventKey) return;
    if (typeof window === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const key = `chew-session-choreography:${eventKey}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, '1');
    } catch {
      // Private-browsing/storage-blocked: fail toward "don't replay,"
      // not toward a crash — skipping the dramatization is the safe
      // default when we can't remember we've shown it.
      return;
    }
    setStage('online');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!stage || closing) return;
    const idx = STAGES.indexOf(stage);
    const next = STAGES[idx + 1];
    const timer = setTimeout(() => {
      if (next) setStage(next);
      else beginClose();
    }, STAGE_MS[stage]);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, closing]);

  function beginClose() {
    setClosing(true);
    setTimeout(() => setStage(null), CLOSE_MS);
  }

  if (!stage) return null;

  return (
    <div
      className={`choreography-overlay${closing ? ' choreography-overlay--closing' : ''}`}
      role="status"
      aria-live="polite"
      aria-label="What changed since your last visit"
    >
      <div className="choreography-stage-wrap">
        {stage === 'online' && (
          <p key="online" className="choreography-line">CHEW online.</p>
        )}
        {stage === 'summary' && (
          <p key="summary" className="choreography-line">
            {changedCount} thing{changedCount === 1 ? '' : 's'} changed while you were away.
            {attentionCount > 0 && ` ${attentionCount} deserve${attentionCount === 1 ? 's' : ''} your attention.`}
          </p>
        )}
        {stage === 'headline' && (
          <p key="headline" className="choreography-line choreography-line--headline">
            What matters most: {topItemText}
          </p>
        )}
      </div>
      <button type="button" className="choreography-skip" onClick={beginClose} autoFocus>
        Skip to Today
      </button>
    </div>
  );
}
