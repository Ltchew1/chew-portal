// app/components/today/OpportunityRadar.js
//
// Opportunities arranged spatially around "Now," not stacked as a list —
// discovery, not a directory. Reuses the exact anchor/arc geometry
// Life Map established (same CHEW spatial grammar, not a second
// invention) but with only the two provable states:
//
// Active — real, grounded opportunities (lib/homeIntelligence.js).
// Newly unlocked — the same canonical opportunity_unlocked transitions
// Life Map's dissolve integration reads (lib/transitions.js), rendered
// with their own real title/whatImproved. These are NOT cross-referenced
// against the active list by title-matching (that would be a guess, not
// a fact) — both are independently real and both get their own node,
// even if in a given moment they describe the same underlying change.
//
// The outer ring is real, named dormant rooms (never a fabricated
// "blocked opportunity" count) — "Visible" and "Blocked" opportunity
// states are not built because no candidate-generation pass exists that
// would produce that data; see lib/todayIntelligence.js's
// buildOpportunityRadar.

import Link from 'next/link';

// A full sweep around the center, not a dome above it like Life Map —
// "radar" reads more literally as opportunities surrounding the member
// on every side, and a full circle uses the stage's vertical space
// evenly instead of leaving empty air a half-arc doesn't reach.
const RADAR_CX = 50, RADAR_CY = 52;
function ringPosition(index, count, rx, ry, startDeg = 0) {
  const angleDeg = count > 0 ? startDeg + (index / count) * 360 : startDeg;
  const rad = (angleDeg * Math.PI) / 180;
  return { x: RADAR_CX + rx * Math.sin(rad), y: RADAR_CY - ry * Math.cos(rad) };
}
function innerPosition(index, count) {
  return ringPosition(index, count, 30, 32, -15);
}
function outerPosition(index, count) {
  return ringPosition(index, count, 45, 44, 20);
}

export default function OpportunityRadar({ radar }) {
  const { availableNow, newlyUnlocked, dormant } = radar;
  const anchor = { x: RADAR_CX, y: RADAR_CY };
  const activeNodes = availableNow.map((o, i) => ({ ...o, kind: 'active', pos: innerPosition(i, availableNow.length) }));
  // Newly-unlocked nodes share the inner ring's radius band but are
  // interleaved after the active ones, not overlapping them.
  const unlockedNodes = newlyUnlocked.map((e, i) => ({
    ...e, kind: 'unlocked',
    pos: innerPosition(activeNodes.length + i, activeNodes.length + newlyUnlocked.length),
  }));
  const dormantNodes = dormant.map((d, i) => ({ ...d, pos: outerPosition(i, dormant.length) }));
  const isEmpty = activeNodes.length === 0 && unlockedNodes.length === 0;

  return (
    <div className="card">
      <h3 style={{ marginBottom: '4px' }}>Opportunity Radar</h3>
      <p className="text-faint" style={{ fontSize: '0.85rem', marginBottom: '18px' }}>
        What's within reach right now, and where CHEW hasn't mapped enough to say yet.
      </p>

      {/* Desktop/spatial layout */}
      <div className="radar-stage--desktop">
        <svg className="radar-edges" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {[...activeNodes, ...unlockedNodes].map((n) => (
            <line key={`edge-${n.id ?? n.title}`} x1={anchor.x} y1={anchor.y} x2={n.pos.x} y2={n.pos.y} className={`radar-edge${n.kind === 'unlocked' ? ' radar-edge--unlocked' : ''}`} />
          ))}
        </svg>

        <div className="life-map-anchor-halo" style={{ left: `${anchor.x}%`, top: `${anchor.y}%` }} aria-hidden="true" />
        <div className="life-map-anchor" style={{ left: `${anchor.x}%`, top: `${anchor.y}%` }} aria-label="Now">Now</div>

        {dormantNodes.map((d) => (
          <div key={d.slug} className="radar-node radar-node--dormant" style={{ left: `${d.pos.x}%`, top: `${d.pos.y}%` }}>
            <span className="radar-node-label">{d.name}</span>
            <span className="radar-node-sub">Not yet mapped</span>
          </div>
        ))}

        {activeNodes.map((o, i) => (
          <div key={`active-${i}`} className="radar-node radar-node--active" style={{ left: `${o.pos.x}%`, top: `${o.pos.y}%` }}>
            <span className="radar-node-label">{o.title}</span>
            {o.href && <Link href={o.href} className="radar-node-link">Take a look</Link>}
          </div>
        ))}

        {unlockedNodes.map((e) => (
          <div key={e.id} className="radar-node radar-node--unlocked" style={{ left: `${e.pos.x}%`, top: `${e.pos.y}%` }}>
            <span className="radar-node-badge">OPPORTUNITY UNLOCKED</span>
            <span className="radar-node-label">{e.title}</span>
          </div>
        ))}

        {isEmpty && (
          <div className="radar-empty">
            CHEW doesn&apos;t have enough verified information yet to identify an opportunity here.
          </div>
        )}
      </div>

      {/* Mobile — a plain stacked field, not the spatial diagram shrunk.
          No interactivity in this component either way, so both trees
          are simple server-rendered markup toggled by media query. */}
      <div className="radar-stage--mobile">
        {isEmpty && dormantNodes.length === 0 && (
          <p className="text-faint" style={{ fontSize: '0.85rem' }}>
            CHEW doesn&apos;t have enough verified information yet to identify an opportunity here.
          </p>
        )}
        {unlockedNodes.map((e) => (
          <div key={`m-unlocked-${e.id}`} className="radar-mobile-card radar-mobile-card--unlocked">
            <span className="radar-node-badge">OPPORTUNITY UNLOCKED</span>
            <strong>{e.title}</strong>
          </div>
        ))}
        {activeNodes.map((o, i) => (
          <div key={`m-active-${i}`} className="radar-mobile-card radar-mobile-card--active">
            <strong>{o.title}</strong>
          </div>
        ))}
        {dormantNodes.length > 0 && (
          <div className="radar-mobile-dormant-row">
            {dormantNodes.map((d) => (
              <span key={d.slug} className="radar-mobile-dormant-chip">{d.name}</span>
            ))}
          </div>
        )}
      </div>

      {activeNodes.map((o, i) => (
        <p key={`detail-${i}`} className="text-faint" style={{ fontSize: '0.83rem', margin: i === 0 ? '4px 0 2px' : '2px 0' }}>
          <strong style={{ color: 'var(--text)' }}>{o.title}: </strong>{o.body}
        </p>
      ))}
      {unlockedNodes.map((e) => (
        <p key={`unlocked-detail-${e.id}`} className="text-faint" style={{ fontSize: '0.83rem', margin: '2px 0' }}>
          <strong style={{ color: 'var(--success)' }}>{e.title}: </strong>{e.whatImproved}
          {e.suggestedAction && <> — <strong>Next: </strong>{e.suggestedAction}</>}
        </p>
      ))}
    </div>
  );
}
