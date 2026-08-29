// app/components/today/CommandCenterOrbit.js
//
// CHEW ORBIT — Today's new centerpiece: the member's whole real position,
// rendered as one radial system instead of a greeting + a progress ring.
// Every value here is a prop already computed by app/dashboard/page.js
// from real data (lib/homeIntelligence.js, lib/todayIntelligence.js) —
// this component adds no data fetching and no new intelligence of its
// own. It is a second, denser view of facts Today already states in
// plain text elsewhere on the page, not a second source of truth.
//
// Two concentric rings around the member, matching the same hybrid
// SVG-edges + real-DOM-nodes technique LifeMap.js and OpportunityRadar.js
// already established (aria-hidden lines for the connective geometry,
// every node a real button/link so the map stays keyboard- and
// screen-reader-legible):
//
//   INNER RING — system signals: Next Move, Barriers, Opportunities,
//   What Changed. These summarize sections that already exist further
//   down this same page; every node is an anchor link to that section,
//   never a duplicate implementation of it.
//
//   OUTER RING — the member's real rooms (lib/rooms.js), in the exact
//   live/locked/unknown/on-track/etc. state Life Map already computes
//   (`rooms` prop is lifeMapGraph, passed straight through) — Credit is
//   the only room with a real intelligence signal today, so it renders
//   richer (score + barrier/opportunity counts); every other room is
//   honestly locked or "not yet built," never invented activity.
//
// HONEST GAPS FROM ANY "whole economic life" REFERENCE IMAGE: chew-portal
// has no income, cash-flow, savings, business-revenue, career, housing,
// or vehicle data model at all today — only Credit has a real
// intelligence pipeline. This component does not show those domains,
// because showing them would mean fabricating numbers CHEW does not
// have. When one of those data models exists for real, it becomes a new
// outer-ring room the same way Credit already is one — this component
// doesn't need to change shape to add it.
//
// Reduced motion: every animation here is a CSS `animation`/`transition`,
// so the site-wide `prefers-reduced-motion` rule in globals.css (which
// zeroes all durations to 0.001ms) already applies with no extra branching
// needed here — same as every other Today module.

'use client';

const PLAN_STATUS_META = {
  plan_at_risk: { word: 'At risk', cls: 'chew-orbit-status--risk' },
  action_needed: { word: 'Action needed', cls: 'chew-orbit-status--action' },
  watch: { word: 'Monitoring', cls: 'chew-orbit-status--watch' },
  on_track: { word: 'On track', cls: 'chew-orbit-status--stable' },
};

const STATE_BADGE = {
  stable: 'badge-success', improving: 'badge-pending', needs_attention: 'badge-pending',
  blocked: 'badge-danger', unknown: 'badge-neutral', locked: 'badge-locked', unbuilt: 'badge-neutral',
};

function ringPosition(index, count, rx, ry, startDeg) {
  const angleDeg = count > 0 ? startDeg + (index / count) * 360 : startDeg;
  const rad = (angleDeg * Math.PI) / 180;
  return { x: 50 + rx * Math.sin(rad), y: 50 - ry * Math.cos(rad) };
}

// `score.freshnessLabel` (see lib/factProvenance.js) is only ever passed
// down when the freshness state is actually 'needs_update' — page.js
// deliberately omits it for 'current', since restating "current" next to
// every settled score would be metadata noise, not intelligence.
function scoreReadout(score) {
  if (!score) return 'No score logged yet';
  const base = `Score ${score.current} → ${score.target}`;
  return score.freshnessLabel ? `${base} · ${score.freshnessLabel}` : base;
}

// `tone` is the one real-urgency color signal shared by a signal's node
// AND its connecting edge (see the `chew-orbit-tone--*` CSS classes) —
// kept element-agnostic on purpose so it never reads as if edges were
// borrowing a node-only class.
function buildSignalNodes({ moveActionText, barrierCount, opportunityCount, changedCount, attentionCount }) {
  const nodes = [
    {
      key: 'move',
      label: 'Next move',
      value: moveActionText ?? 'Nothing pending',
      href: '#chew-move',
      tone: moveActionText ? 'move' : 'quiet',
    },
    {
      key: 'barriers',
      label: 'Barriers',
      value: barrierCount > 0 ? `${barrierCount} active` : 'None active',
      href: '#whats-waiting',
      tone: barrierCount > 0 ? 'barrier' : 'quiet',
    },
    {
      key: 'opportunities',
      label: 'Opportunities',
      value: opportunityCount > 0 ? `${opportunityCount} open` : 'None yet',
      href: '#opportunity-radar',
      tone: opportunityCount > 0 ? 'opportunity' : 'quiet',
    },
    {
      key: 'changed',
      label: 'What changed',
      value: changedCount > 0 ? `${changedCount} thing${changedCount === 1 ? '' : 's'}` : 'Nothing new',
      sub: attentionCount > 0 ? `${attentionCount} need${attentionCount === 1 ? 's' : ''} attention` : null,
      href: changedCount > 0 ? '#what-changed' : null,
      tone: attentionCount > 0 ? 'barrier' : (changedCount > 0 ? 'opportunity' : 'quiet'),
    },
  ];
  return nodes;
}

function OrbitNode({ node, pos, kind }) {
  const content = (
    <>
      <span className="chew-orbit-node-label">{node.label ?? node.name}</span>
      {node.value && <span className="chew-orbit-node-value">{node.value}</span>}
      {node.sub && <span className="chew-orbit-node-sub">{node.sub}</span>}
      {node.stateLabel && <span className={`badge ${STATE_BADGE[node.state] ?? 'badge-neutral'}`}>{node.stateLabel}</span>}
    </>
  );
  const className = [
    'chew-orbit-node',
    `chew-orbit-node--${kind}`,
    node.tone ? `chew-orbit-tone--${node.tone}` : '',
    node.enterable === false ? 'chew-orbit-node--dormant' : '',
  ].filter(Boolean).join(' ');
  const style = { left: `${pos.x}%`, top: `${pos.y}%` };

  if (node.href) {
    return (
      <a href={node.href} className={className} style={style}>
        {node.icon && <span className="chew-orbit-node-icon">{node.icon}</span>}
        {content}
      </a>
    );
  }
  return (
    <div className={className} style={style}>
      {node.icon && <span className="chew-orbit-node-icon">{node.icon}</span>}
      {content}
    </div>
  );
}

export default function CommandCenterOrbit({
  firstName, statusLabel, readyCount, totalRooms, planStatus, score,
  barrierCount, opportunityCount, changedCount, attentionCount, momentLevel, moveActionText, rooms,
}) {
  const signals = buildSignalNodes({ moveActionText, barrierCount, opportunityCount, changedCount, attentionCount });
  const signalPositions = signals.map((s, i) => ({ ...s, pos: ringPosition(i, signals.length, 26, 30, -20) }));
  const roomPositions = rooms.map((r, i) => ({ ...r, pos: ringPosition(i, rooms.length, 46, 45, 8) }));
  const statusMeta = planStatus ? PLAN_STATUS_META[planStatus] : null;
  const center = { x: 50, y: 50 };

  return (
    <div className="chew-orbit">
      <div className="chew-orbit-status-strip">
        <span className="chew-orbit-status-strip-item">
          <strong>{readyCount}</strong> of {totalRooms} rooms open
        </span>
        <span className="chew-orbit-status-strip-sep" aria-hidden="true">·</span>
        <span className="chew-orbit-status-strip-item">Access: {statusLabel}</span>
        {momentLevel && (
          <>
            <span className="chew-orbit-status-strip-sep" aria-hidden="true">·</span>
            <span className="chew-orbit-status-strip-item chew-orbit-status-strip-item--pulse">
              {momentLevel === 'landmark' ? 'Landmark day' : 'Major shift today'}
            </span>
          </>
        )}
      </div>

      {/* Desktop/spatial layout */}
      <div className="chew-orbit-stage--desktop">
        <svg className="chew-orbit-edges" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {signalPositions.map((s) => (
            <line key={`sig-${s.key}`} x1={center.x} y1={center.y} x2={s.pos.x} y2={s.pos.y} className={`chew-orbit-edge chew-orbit-edge--signal chew-orbit-tone--${s.tone}`} />
          ))}
          {roomPositions.map((r) => (
            <line key={`room-${r.slug}`} x1={center.x} y1={center.y} x2={r.pos.x} y2={r.pos.y} className={`chew-orbit-edge chew-orbit-edge--room${r.enterable ? ' chew-orbit-edge--live' : ''}`} />
          ))}
        </svg>

        <div className="chew-orbit-center-halo" aria-hidden="true" />
        <div className={`chew-orbit-center${statusMeta ? ` ${statusMeta.cls}` : ''}`}>
          <span className="chew-orbit-center-eyebrow">You</span>
          <strong className="chew-orbit-center-name">{firstName}</strong>
          <span className="chew-orbit-center-status">{statusMeta?.word ?? 'Getting started'}</span>
          <span className="chew-orbit-center-score">
            {scoreReadout(score)}
          </span>
        </div>

        {signalPositions.map((s) => <OrbitNode key={s.key} node={s} pos={s.pos} kind="signal" />)}
        {roomPositions.map((r) => <OrbitNode key={r.slug} node={r} pos={r.pos} kind="room" />)}
      </div>

      {/* Mobile — its own composition, not the desktop map shrunk: a
          status card, then two rails (signals, rooms) that scroll
          horizontally, matching the snap-scroll pattern already used
          elsewhere on Today. */}
      <div className="chew-orbit-stage--mobile">
        <div className={`chew-orbit-mobile-center${statusMeta ? ` ${statusMeta.cls}` : ''}`}>
          <div>
            <span className="chew-orbit-center-eyebrow">You</span>
            <strong className="chew-orbit-center-name">{firstName}</strong>
          </div>
          <div className="chew-orbit-mobile-center-right">
            <span className="chew-orbit-center-status">{statusMeta?.word ?? 'Getting started'}</span>
            <span className="chew-orbit-center-score">
              {scoreReadout(score)}
            </span>
          </div>
        </div>
        <div className="chew-orbit-mobile-rail">
          {signals.map((s) => (
            <a key={s.key} href={s.href ?? '#'} className={`chew-orbit-mobile-chip chew-orbit-tone--${s.tone}`}>
              <span className="chew-orbit-node-label">{s.label}</span>
              <span className="chew-orbit-node-value">{s.value}</span>
            </a>
          ))}
        </div>
        <div className="chew-orbit-mobile-rail chew-orbit-mobile-rail--rooms">
          {rooms.map((r) => (
            r.enterable ? (
              <a key={r.slug} href={r.href} className="chew-orbit-mobile-chip chew-orbit-mobile-chip--room">
                <span className="chew-orbit-node-label">{r.name}</span>
                <span className={`badge ${STATE_BADGE[r.state] ?? 'badge-neutral'}`}>{r.stateLabel}</span>
              </a>
            ) : (
              <div key={r.slug} className="chew-orbit-mobile-chip chew-orbit-mobile-chip--room chew-orbit-mobile-chip--dormant">
                <span className="chew-orbit-node-label">{r.name}</span>
                <span className={`badge ${STATE_BADGE[r.state] ?? 'badge-neutral'}`}>{r.stateLabel}</span>
              </div>
            )
          ))}
        </div>
      </div>
    </div>
  );
}
