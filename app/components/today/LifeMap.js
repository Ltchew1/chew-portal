// app/components/today/LifeMap.js
//
// The relational Life Map — territories (one per real room, see
// lib/rooms.js) arranged around the member's own anchor node. Selecting a
// territory pulls it into focus and reveals its real chain: current state
// (goal) -> barrier -> move -> opportunity, each level read straight off
// lib/todayIntelligence.js's buildLifeMapGraph — which itself reads off
// persisted barrier/opportunity rows with a real relatedGoalId — never
// invented to fill out the graph. A territory with no connected structure
// yet is rendered as an honestly dormant, "not mapped" zone rather than a
// dead tile or a fabricated cluster.
//
// Hybrid SVG + DOM by design (kept from the first pass, reinforced after
// explicit confirmation not to reach for WebGL/Three.js here): an SVG
// layer draws only decorative connecting lines (aria-hidden), every node
// is a real HTML button/text so the map stays keyboard- and
// screen-reader-legible. Depth comes from CSS (scale, blur, glow,
// layered shadow), not a 3D engine.
//
// Mobile gets its own markup, not a shrunk copy of the desktop one: a
// horizontal snap-scroll strip of territories plus a stacked chain list
// for whichever one is selected, toggled by CSS media query (both trees
// exist; `display:none` removes the inactive one from the accessibility
// tree in both directions, so there's no duplicate-announcement risk).

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
// Distinct geometry per territory — the directive's "give each territory
// subtle visual identity" without leaning on color. Loosely matched to
// what the room actually is (business = angular/structural, referral =
// radiating/connective, etc.) via CSS clip-path, not a new icon set.
const TERRITORY_SHAPE = {
  credit: 'life-map-shape--stacked',
  'credit-builder': 'life-map-shape--ascend',
  business: 'life-map-shape--hex',
  funding: 'life-map-shape--flow',
  intelligence: 'life-map-shape--layered',
  'money-systems': 'life-map-shape--gear',
  referral: 'life-map-shape--radiant',
};

const KIND_LABEL = { goal: 'Current state', barrier: 'Barrier', move: 'CHEW Move', opportunity: 'Opportunity' };
const KIND_CLASS = {
  goal: 'life-map-subnode--goal', barrier: 'life-map-subnode--barrier',
  move: 'life-map-subnode--move', opportunity: 'life-map-subnode--opportunity',
};

function territoryPosition(index, count) {
  const spreadDeg = 150;
  const startDeg = -spreadDeg / 2;
  const angleDeg = count > 1 ? startDeg + index * (spreadDeg / (count - 1)) : 0;
  const rad = (angleDeg * Math.PI) / 180;
  const cx = 50, cy = 88, rx = 42, ry = 70;
  return { x: cx + rx * Math.sin(rad), y: cy - ry * Math.cos(rad) };
}

// The real chain, as levels: current state -> barrier -> move ->
// opportunity. Empty levels are dropped entirely (no goal set yet just
// means the chain starts at whatever's first real) so the visual never
// implies a step that doesn't exist. A barrier that just cleared
// (subNodes.dissolvingBarriers, from the same canonical transition
// events Today's Barrier Dissolve consumes — see
// lib/todayIntelligence.js's buildCreditSubNodes) renders in the same
// tier as any barrier still active, tagged `dissolving`, never in a
// tier of its own.
function buildChainLevels(subNodes) {
  if (!subNodes) return [];
  const barrierTier = [...(subNodes.barriers ?? []), ...(subNodes.dissolvingBarriers ?? [])];
  const tiers = [
    subNodes.goal ? [subNodes.goal] : [],
    barrierTier,
    subNodes.move ? [subNodes.move] : [],
    subNodes.opportunities ?? [],
  ];
  return tiers.filter((t) => t.length > 0);
}

// Whether the route beyond the barrier tier can carry the "clear" pulse
// downstream — real dependency check: only when a barrier actually just
// dissolved AND no other real barrier still occupies that tier. Never
// travels further than the remaining obstruction count allows.
function barrierTierIndex(subNodes) {
  return subNodes?.goal ? 1 : 0;
}
function isPulseUnlocked(subNodes) {
  return (subNodes?.dissolvingBarriers?.length ?? 0) > 0 && (subNodes?.remainingBarrierCount ?? 0) === 0;
}

function levelPosition(levelIndex, levelCount, nodeIndex, nodeCount) {
  const yStart = 34, yEnd = 76;
  const y = levelCount > 1 ? yStart + levelIndex * ((yEnd - yStart) / (levelCount - 1)) : yStart;
  const spread = Math.min(34, 12 + nodeCount * 8);
  const x = nodeCount > 1 ? 50 - spread / 2 + nodeIndex * (spread / (nodeCount - 1)) : 50;
  return { x, y };
}

function ChainDiagram({ territory }) {
  const levels = buildChainLevels(territory.subNodes);
  if (levels.length === 0) {
    return (
      <div className="life-map-not-mapped">
        <span className="life-map-not-mapped-title">Not mapped yet</span>
        <p>CHEW doesn&apos;t have enough verified structure in this area yet.</p>
      </div>
    );
  }

  const positioned = levels.map((level, li) => level.map((n, ni) => ({ ...n, pos: levelPosition(li, levels.length, ni, level.length) })));
  const gatewayY = positioned[0][0].pos.y - 10;
  const barrierTierLi = barrierTierIndex(territory.subNodes);
  const pulseUnlocked = isPulseUnlocked(territory.subNodes);

  const edges = [];
  positioned[0].forEach((n) => edges.push({
    key: `trunk-${n.id}`, x1: 50, y1: gatewayY, x2: n.pos.x, y2: n.pos.y,
    cls: 'life-map-edge--trunk', dissolving: n.dissolving,
  }));
  for (let li = 1; li < positioned.length; li += 1) {
    positioned[li].forEach((n) => {
      positioned[li - 1].forEach((p) => {
        // An edge lands "in dissolve" when it's arriving at a barrier
        // that just cleared (the obstruction reconnecting); it carries
        // the pulse onward only leaving the barrier tier, and only when
        // no real barrier remains to block it.
        const dissolving = n.dissolving || p.dissolving;
        const pulsing = li - 1 === barrierTierLi && pulseUnlocked;
        edges.push({
          key: `${p.id}-${n.id}`, x1: p.pos.x, y1: p.pos.y, x2: n.pos.x, y2: n.pos.y,
          cls: `life-map-edge--chain life-map-edge--${n.kind}`, dissolving, pulsing,
        });
      });
    });
  }
  const subNodesFlat = positioned.flat();

  return (
    <div className="life-map-chain">
      <svg className="life-map-edges" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <line x1="50" y1={gatewayY - 8} x2="50" y2={gatewayY} className="life-map-edge life-map-edge--trunk" />
        {edges.map((e) => (
          e.dissolving ? (
            <g key={e.key}>
              <line x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} className="life-map-edge life-map-edge--dissolve-broken" />
              <line x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} className="life-map-edge life-map-edge--dissolve-open" />
            </g>
          ) : (
            <line
              key={e.key} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
              className={`life-map-edge ${e.cls}${e.pulsing ? ' life-map-edge--pulse' : ''}`}
            />
          )
        ))}
      </svg>
      {subNodesFlat.map((n) => (
        <div
          key={n.id}
          className={`life-map-subnode ${KIND_CLASS[n.kind] ?? ''}${n.dissolving ? ' life-map-subnode--dissolving' : ''}${n.isNew ? ' life-map-subnode--emerging' : ''}`}
          style={{ left: `${n.pos.x}%`, top: `${n.pos.y}%` }}
        >
          <span className="life-map-subnode-kind">{n.dissolving ? 'Cleared' : KIND_LABEL[n.kind]}</span>
          <span className="life-map-subnode-label">{n.label}</span>
        </div>
      ))}
    </div>
  );
}

// Mobile's own vertical version — not the desktop diagram shrunk. One
// connector between each real tier boundary (never between same-tier
// siblings, since they aren't connected to each other), carrying the
// same dissolving/pulse state the desktop connectors carry so the
// "barrier clears, then the route opens as far as reality allows"
// behavior reads the same way on touch.
function MobileChain({ territory }) {
  const levels = buildChainLevels(territory.subNodes);
  const barrierTierLi = barrierTierIndex(territory.subNodes);
  const pulseUnlocked = isPulseUnlocked(territory.subNodes);

  return (
    <ol className="life-map-mobile-chain">
      {levels.map((level, li) => (
        <li key={li} className="life-map-mobile-tier">
          {li > 0 && (
            <span
              className={`life-map-mobile-connector${levels[li - 1].some((n) => n.dissolving) ? ' life-map-mobile-connector--dissolve' : ''}${li - 1 === barrierTierLi && pulseUnlocked ? ' life-map-mobile-connector--pulse' : ''}`}
              aria-hidden="true"
            />
          )}
          <div className="life-map-mobile-tier-nodes">
            {level.map((n) => (
              <div
                key={n.id}
                className={`life-map-subnode life-map-subnode--mobile ${KIND_CLASS[n.kind] ?? ''}${n.dissolving ? ' life-map-subnode--dissolving' : ''}${n.isNew ? ' life-map-subnode--emerging' : ''}`}
              >
                <span className="life-map-subnode-kind">{n.dissolving ? 'Cleared' : KIND_LABEL[n.kind]}</span>
                <span className="life-map-subnode-label">{n.label}</span>
              </div>
            ))}
          </div>
        </li>
      ))}
    </ol>
  );
}

function TerritoryDetail({ territory }) {
  return (
    <div className="life-map-detail">
      <div className="flex-between" style={{ marginBottom: '4px' }}>
        <strong>{territory.name}</strong>
        <span className={`badge ${STATE_BADGE[territory.state] ?? 'badge-neutral'}`}>{territory.stateLabel}</span>
      </div>
      <p className="text-faint" style={{ fontSize: '0.85rem', margin: 0 }}>{territory.detail}</p>
      {territory.enterable && (
        <Link href={territory.href} className="btn btn-outline btn-sm" style={{ marginTop: '10px' }}>
          Enter {territory.name} <IconChevronRight />
        </Link>
      )}
    </div>
  );
}

export default function LifeMap({ territories }) {
  const hasChain = (t) => t.subNodes && buildChainLevels(t.subNodes).length > 0;
  const defaultSelected = territories.find(hasChain)?.slug ?? territories[0]?.slug;
  const [selected, setSelected] = useState(defaultSelected);

  const positions = territories.map((t, i) => ({ ...t, pos: territoryPosition(i, territories.length) }));
  const selectedTerritory = positions.find((t) => t.slug === selected);
  const anchor = { x: 50, y: 88 };

  return (
    <div className="card">
      <h3 style={{ marginBottom: '4px' }}>Your Life Map</h3>
      <p className="text-faint" style={{ fontSize: '0.85rem', marginBottom: '18px' }}>
        Your world, as far as CHEW actually knows it. Select a territory to enter its layer.
      </p>

      {/* Desktop/spatial layout */}
      <div className="life-map-stage--desktop">
        <svg className="life-map-edges" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {positions.map((t) => (
            <line
              key={`anchor-${t.slug}`}
              x1={anchor.x} y1={anchor.y} x2={t.pos.x} y2={t.pos.y}
              className={`life-map-edge${t.slug === selected ? ' life-map-edge--active' : ''}`}
            />
          ))}
        </svg>

        <div className="life-map-anchor-halo" style={{ left: `${anchor.x}%`, top: `${anchor.y}%` }} aria-hidden="true" />
        <button type="button" className="life-map-anchor" style={{ left: `${anchor.x}%`, top: `${anchor.y}%` }} disabled aria-label="You — the center of your world">
          You
        </button>

        {positions.map((t) => (
          <button
            key={t.slug}
            type="button"
            className={[
              'life-map-territory',
              TERRITORY_SHAPE[t.slug] ?? '',
              t.slug === selected ? 'life-map-territory--selected' : 'life-map-territory--receded',
              STATE_GLOW[t.state] ?? '',
              !hasChain(t) ? 'life-map-territory--dormant' : '',
            ].filter(Boolean).join(' ')}
            style={{ left: `${t.pos.x}%`, top: `${t.pos.y}%` }}
            onClick={() => setSelected(t.slug)}
            aria-pressed={t.slug === selected}
          >
            {t.icon && <span className="life-map-territory-icon">{t.icon}</span>}
            <span className="life-map-territory-name">{t.name}</span>
            <span className={`badge ${STATE_BADGE[t.state] ?? 'badge-neutral'}`}>{t.stateLabel}</span>
          </button>
        ))}

        {selectedTerritory && (
          <div className="life-map-focus-plane">
            <ChainDiagram territory={selectedTerritory} />
          </div>
        )}
      </div>

      {/* Mobile/touch layout — its own interaction model, not a shrunk copy */}
      <div className="life-map-stage--mobile">
        <div className="life-map-mobile-rail" role="tablist" aria-label="Life Map territories">
          {positions.map((t) => (
            <button
              key={t.slug}
              type="button"
              role="tab"
              aria-selected={t.slug === selected}
              className={[
                'life-map-mobile-chip',
                t.slug === selected ? 'life-map-mobile-chip--selected' : '',
                STATE_GLOW[t.state] ?? '',
              ].filter(Boolean).join(' ')}
              onClick={() => setSelected(t.slug)}
            >
              {t.icon && <span className="life-map-territory-icon">{t.icon}</span>}
              <span className="life-map-territory-name">{t.name}</span>
              <span className={`badge ${STATE_BADGE[t.state] ?? 'badge-neutral'}`}>{t.stateLabel}</span>
            </button>
          ))}
        </div>

        {selectedTerritory && (
          <div className="life-map-mobile-sheet">
            {hasChain(selectedTerritory) ? (
              <MobileChain territory={selectedTerritory} />
            ) : (
              <div className="life-map-not-mapped life-map-not-mapped--mobile">
                <span className="life-map-not-mapped-title">Not mapped yet</span>
                <p>CHEW doesn&apos;t have enough verified structure in this area yet.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedTerritory && <TerritoryDetail territory={selectedTerritory} />}
    </div>
  );
}
