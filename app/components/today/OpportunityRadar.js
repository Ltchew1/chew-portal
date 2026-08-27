// app/components/today/OpportunityRadar.js
//
// Opportunities arranged spatially around "Now," not stacked as a list —
// discovery, not a directory. Reuses the exact anchor/arc geometry
// Life Map established (same CHEW spatial grammar, not a second
// invention) but with only the two provable states:
//
// Active and Newly Unlocked are two VIEWS of the same canonical
// identity — every node here (including "active" ones, since the
// Opportunity Identity Gap Review pass) is a real, persisted
// lib/opportunities.js row, carrying the same real `id` Life Map's
// opportunity subnodes and the opportunity_unlocked transition event's
// `entityId` already reference (lib/todayIntelligence.js's
// buildOpportunityRadar excludes whatever unlocked THIS pass from the
// active list, so one real opportunity is exactly one node, never
// both). Selecting either kind reaches Cross-System Focus Mode Level 2:
// the same `opportunity:<id>` nodeId lights up wherever else that exact
// row appears. Never title-matched, never a fabricated id — see that
// function's header comment for the full identity invariant.
//
// The outer ring is real, named dormant rooms (never a fabricated
// "blocked opportunity" count) — "Visible" and "Blocked" opportunity
// states are not built because no candidate-generation pass exists that
// would produce that data; see lib/todayIntelligence.js's
// buildOpportunityRadar. Dormant nodes stay non-interactive: there is no
// real opportunity-system relevance to a room CHEW hasn't mapped yet.

'use client';

import { useState } from 'react';
import { setFocus, clearFocus } from './focusBus';

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
  const [selectedKey, setSelectedKey] = useState(null);
  const anchor = { x: RADAR_CX, y: RADAR_CY };
  // Real id either way: availableNow's `id` (the persisted row) and
  // newlyUnlocked's `entityId` (the transition event's reference to that
  // same row) are the same canonical identity — normalized here to one
  // `realId` field so the rest of this component never has to branch on
  // which kind of node it's looking at.
  const activeNodes = availableNow.map((o, i) => ({ ...o, kind: 'active', key: `active-${o.id}`, realId: o.id, pos: innerPosition(i, availableNow.length) }));
  const unlockedNodes = newlyUnlocked.map((e, i) => ({
    ...e, kind: 'unlocked', key: `unlocked-${e.id}`, realId: e.entityId,
    pos: innerPosition(activeNodes.length + i, activeNodes.length + newlyUnlocked.length),
  }));
  const dormantNodes = dormant.map((d, i) => ({ ...d, pos: outerPosition(i, dormant.length) }));
  const isEmpty = activeNodes.length === 0 && unlockedNodes.length === 0;

  // Cross-System Focus Mode — both kinds carry the same real
  // `opportunity:<id>` nodeId scheme now, so both reach Level 2.
  function selectNode(node) {
    setSelectedKey((was) => {
      const willSelect = was !== node.key;
      if (willSelect) {
        setFocus(`radar:${node.key}`, { opportunity: true, life_map: true }, { nodeIds: [`opportunity:${node.realId}`], label: node.title });
        return node.key;
      }
      clearFocus(`radar:${node.key}`);
      return null;
    });
  }

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
            <line key={`edge-${n.key}`} x1={anchor.x} y1={anchor.y} x2={n.pos.x} y2={n.pos.y} className={`radar-edge${n.kind === 'unlocked' ? ' radar-edge--unlocked' : ''}`} />
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

        {activeNodes.map((o) => (
          <div
            key={o.key}
            className={`radar-node radar-node--active${selectedKey === o.key ? ' radar-node--selected' : ''}`}
            style={{ left: `${o.pos.x}%`, top: `${o.pos.y}%` }}
            data-chew-node={`opportunity:${o.realId}`}
          >
            <button type="button" className="radar-node-label radar-node-label--button" onClick={() => selectNode(o)} aria-pressed={selectedKey === o.key}>
              {o.title}
            </button>
          </div>
        ))}

        {unlockedNodes.map((e) => (
          <div
            key={e.key}
            className={`radar-node radar-node--unlocked${selectedKey === e.key ? ' radar-node--selected' : ''}`}
            style={{ left: `${e.pos.x}%`, top: `${e.pos.y}%` }}
            data-chew-node={`opportunity:${e.realId}`}
          >
            <span className="radar-node-badge">OPPORTUNITY UNLOCKED</span>
            <button type="button" className="radar-node-label radar-node-label--button" onClick={() => selectNode(e)} aria-pressed={selectedKey === e.key}>
              {e.title}
            </button>
          </div>
        ))}

        {isEmpty && (
          <div className="radar-empty">
            CHEW doesn&apos;t have enough verified information yet to identify an opportunity here.
          </div>
        )}
      </div>

      {/* Mobile — a plain stacked field, not the spatial diagram shrunk.
          Selection still works (same selectNode call), just without the
          spatial edge/anchor geometry desktop gets. */}
      <div className="radar-stage--mobile">
        {isEmpty && dormantNodes.length === 0 && (
          <p className="text-faint" style={{ fontSize: '0.85rem' }}>
            CHEW doesn&apos;t have enough verified information yet to identify an opportunity here.
          </p>
        )}
        {unlockedNodes.map((e) => (
          <div key={`m-${e.key}`} className="radar-mobile-card radar-mobile-card--unlocked" data-chew-node={`opportunity:${e.realId}`}>
            <span className="radar-node-badge">OPPORTUNITY UNLOCKED</span>
            <button type="button" className="radar-mobile-card-button" onClick={() => selectNode(e)} aria-pressed={selectedKey === e.key}>
              <strong>{e.title}</strong>
            </button>
          </div>
        ))}
        {activeNodes.map((o) => (
          <div key={`m-${o.key}`} className="radar-mobile-card radar-mobile-card--active" data-chew-node={`opportunity:${o.realId}`}>
            <button type="button" className="radar-mobile-card-button" onClick={() => selectNode(o)} aria-pressed={selectedKey === o.key}>
              <strong>{o.title}</strong>
            </button>
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

      {/* One shared detail-rendering shape now that both kinds carry the
          same real fields (title/whatImproved/suggestedAction) off the
          same persisted row. */}
      {activeNodes.map((o) => (
        <p key={`detail-${o.key}`} className="text-faint" style={{ fontSize: '0.83rem', margin: '2px 0' }}>
          <strong style={{ color: 'var(--text)' }}>{o.title}: </strong>{o.whatImproved}
          {o.suggestedAction && <> — <strong>Next: </strong>{o.suggestedAction}</>}
        </p>
      ))}
      {unlockedNodes.map((e) => (
        <p key={`detail-${e.key}`} className="text-faint" style={{ fontSize: '0.83rem', margin: '2px 0' }}>
          <strong style={{ color: 'var(--success)' }}>{e.title}: </strong>{e.whatImproved}
          {e.suggestedAction && <> — <strong>Next: </strong>{e.suggestedAction}</>}
        </p>
      ))}
    </div>
  );
}
