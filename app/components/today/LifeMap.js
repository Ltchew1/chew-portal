// app/components/today/LifeMap.js
//
// The relational Life Map — territories (one per real room, see
// lib/rooms.js) arranged around the member's own anchor node, connected by
// real edges. Selecting a territory illuminates its actual substructure:
// for Credit today, that's its real move/barriers/opportunities
// (lib/todayIntelligence.js's buildLifeMapGraph, all read off persisted
// rows with a real relatedGoalId — never invented to fill out the graph).
// Every other territory has no sub-structure yet, and honestly shows none
// rather than a fabricated one.
//
// Hybrid SVG + DOM by design: an SVG layer draws only the decorative
// connecting lines (aria-hidden), while every node is a real HTML
// button/link with real text — so the whole map stays keyboard-navigable
// and screen-reader legible even though it "looks" like a spatial diagram.
// No WebGL: this is a DOM/SVG-depth build, see CAPABILITY_NETWORK-era
// discipline of matching technology to the surface rather than reaching
// for 3D by default.

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { IconChevronRight } from '../icons';

const STATE_BADGE = {
  stable: 'badge-success', improving: 'badge-pending', needs_attention: 'badge-pending',
  blocked: 'badge-danger', unknown: 'badge-neutral', locked: 'badge-locked', unbuilt: 'badge-neutral',
};
const STATE_GLOW = {
  stable: 'life-map-glow--stable', improving: 'life-map-glow--improving',
  needs_attention: 'life-map-glow--attention', blocked: 'life-map-glow--blocked',
};

// Territories fan out above the member's own anchor node, angle measured
// from straight up. Deliberately not a perfect circle (Rx != Ry) — reads
// as a dome of connected zones rather than a mechanical wheel.
function territoryPosition(index, count) {
  const spreadDeg = 150;
  const startDeg = -spreadDeg / 2;
  const angleDeg = count > 1 ? startDeg + index * (spreadDeg / (count - 1)) : 0;
  const rad = (angleDeg * Math.PI) / 180;
  const cx = 50, cy = 88, rx = 42, ry = 70;
  return { x: cx + rx * Math.sin(rad), y: cy - ry * Math.cos(rad) };
}

function subNodePosition(index, count) {
  const spread = Math.min(30, count * 9);
  const startX = 50 - spread / 2;
  const x = count > 1 ? startX + index * (spread / (count - 1)) : 50;
  return { x, y: 46 };
}

const SUBNODE_KIND_LABEL = { move: 'CHEW Move', barrier: 'Barrier', opportunity: 'Opportunity' };
const SUBNODE_KIND_CLASS = {
  move: 'life-map-subnode--move',
  barrier: 'life-map-subnode--barrier',
  opportunity: 'life-map-subnode--opportunity',
};

export default function LifeMap({ territories }) {
  const defaultSelected = territories.find((t) => t.subNodes && (t.subNodes.move || t.subNodes.barriers.length || t.subNodes.opportunities.length))?.slug
    ?? territories[0]?.slug;
  const [selected, setSelected] = useState(defaultSelected);

  const positions = territories.map((t, i) => ({ ...t, pos: territoryPosition(i, territories.length) }));
  const selectedTerritory = positions.find((t) => t.slug === selected);
  const subNodes = selectedTerritory?.subNodes
    ? [
        ...(selectedTerritory.subNodes.move ? [selectedTerritory.subNodes.move] : []),
        ...selectedTerritory.subNodes.barriers,
        ...selectedTerritory.subNodes.opportunities,
      ]
    : [];
  const subPositions = subNodes.map((n, i) => ({ ...n, pos: subNodePosition(i, subNodes.length) }));
  const anchor = { x: 50, y: 88 };

  return (
    <div className="card">
      <h3 style={{ marginBottom: '4px' }}>Your Life Map</h3>
      <p className="text-faint" style={{ fontSize: '0.85rem', marginBottom: '18px' }}>
        Your world, as far as CHEW actually knows it. Select a territory to see what&apos;s connected to it.
      </p>

      <div className="life-map-stage">
        <svg className="life-map-edges" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {positions.map((t) => (
            <line
              key={`anchor-${t.slug}`}
              x1={anchor.x} y1={anchor.y} x2={t.pos.x} y2={t.pos.y}
              className={`life-map-edge${t.slug === selected ? ' life-map-edge--active' : ''}`}
            />
          ))}
          {selectedTerritory && subPositions.map((n) => (
            <line
              key={`sub-${n.id}`}
              x1={selectedTerritory.pos.x} y1={selectedTerritory.pos.y} x2={n.pos.x} y2={n.pos.y}
              className="life-map-edge life-map-edge--sub"
            />
          ))}
        </svg>

        <button
          type="button"
          className="life-map-anchor"
          style={{ left: `${anchor.x}%`, top: `${anchor.y}%` }}
          disabled
          aria-label="You"
        >
          You
        </button>

        {positions.map((t) => (
          <button
            key={t.slug}
            type="button"
            className={`life-map-territory ${t.slug === selected ? 'life-map-territory--selected' : ''} ${STATE_GLOW[t.state] ?? ''}`}
            style={{ left: `${t.pos.x}%`, top: `${t.pos.y}%` }}
            onClick={() => setSelected(t.slug)}
            aria-pressed={t.slug === selected}
          >
            <span className="life-map-territory-name">{t.name}</span>
            <span className={`badge ${STATE_BADGE[t.state] ?? 'badge-neutral'}`}>{t.stateLabel}</span>
          </button>
        ))}

        {subPositions.map((n) => (
          <div
            key={n.id}
            className={`life-map-subnode ${SUBNODE_KIND_CLASS[n.kind] ?? ''}`}
            style={{ left: `${n.pos.x}%`, top: `${n.pos.y}%` }}
          >
            <span className="life-map-subnode-kind">{SUBNODE_KIND_LABEL[n.kind]}</span>
            <span className="life-map-subnode-label">{n.label}</span>
          </div>
        ))}
      </div>

      {selectedTerritory && (
        <div className="life-map-detail">
          <div className="flex-between" style={{ marginBottom: '4px' }}>
            <strong>{selectedTerritory.name}</strong>
            <span className={`badge ${STATE_BADGE[selectedTerritory.state] ?? 'badge-neutral'}`}>{selectedTerritory.stateLabel}</span>
          </div>
          <p className="text-faint" style={{ fontSize: '0.85rem', margin: 0 }}>{selectedTerritory.detail}</p>
          {subNodes.length === 0 && (
            <p className="text-faint" style={{ fontSize: '0.8rem', margin: '6px 0 0' }}>
              CHEW doesn&apos;t have a connected structure here yet — this territory doesn&apos;t have its own data model built yet.
            </p>
          )}
          {selectedTerritory.enterable && (
            <Link href={selectedTerritory.href} className="btn btn-outline btn-sm" style={{ marginTop: '10px' }}>
              Enter {selectedTerritory.name} <IconChevronRight />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
