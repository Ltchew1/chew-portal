// app/components/today/ProgressWorldReaction.js
//
// The environment itself reacting to a real state change — see
// lib/portalReactions.js's computeMomentLevel for how "how hard should
// this land" is decided (reused facts, no new detection). Purely
// decorative and aria-hidden: the real textual signal for the same
// level lives in the page's summary line (Today's "N things changed"
// sentence gets "Major shift today." / "Landmark day." appended for
// major/landmark — see app/dashboard/page.js), so nothing here is the
// only place the meaning exists. One-shot by CSS animation only; no
// timer, no cleanup needed — it settles to fully transparent and stays
// inert.
//
// Micro/meaningful levels render nothing here on purpose — "not every
// event deserves spectacle." Only major and landmark get an
// environmental pass.

export default function ProgressWorldReaction({ level }) {
  if (level !== 'major' && level !== 'landmark') return null;
  return <div className={`world-reaction world-reaction--${level}`} aria-hidden="true" />;
}
