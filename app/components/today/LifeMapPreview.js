// app/components/today/LifeMapPreview.js
//
// The first, honest slice of the Life Map — one node per real room (see
// lib/todayIntelligence.js's buildLifeMapDomains). Not the full relational
// map the portal directive describes (connected-impact illumination on
// select is a real future increment); this is a truthful state grid: every
// node's state is computed from real data or clearly reads "not yet
// built"/"locked," never a fabricated position on a spectrum.

import Link from 'next/link';
import { IconChevronRight } from '../icons';
import RevealOnScroll from '../lab/RevealOnScroll';

const STATE_BADGE = {
  stable: 'badge-success',
  improving: 'badge-pending',
  needs_attention: 'badge-pending',
  blocked: 'badge-danger',
  unknown: 'badge-neutral',
  locked: 'badge-locked',
  unbuilt: 'badge-neutral',
};

function Node({ domain, delay }) {
  const body = (
    <>
      <div className="flex-between" style={{ marginBottom: '6px' }}>
        <strong style={{ fontSize: '0.92rem' }}>{domain.name}</strong>
        <span className={`badge ${STATE_BADGE[domain.state] ?? 'badge-neutral'}`}>{domain.stateLabel}</span>
      </div>
      <p className="text-faint" style={{ fontSize: '0.82rem', margin: 0 }}>{domain.detail}</p>
      {domain.enterable && (
        <span className="life-map-node-enter">Enter <IconChevronRight /></span>
      )}
    </>
  );

  const className = `life-map-node${domain.enterable ? ' life-map-node--enterable' : ''}`;

  return (
    <RevealOnScroll as={domain.enterable ? 'link' : 'div'} href={domain.enterable ? domain.href : undefined} className={className} delay={delay}>
      {body}
    </RevealOnScroll>
  );
}

export default function LifeMapPreview({ domains }) {
  return (
    <div className="card">
      <h3 style={{ marginBottom: '4px' }}>Your Life Map</h3>
      <p className="text-faint" style={{ fontSize: '0.85rem', marginBottom: '18px' }}>
        Where each part of your economic world stands right now, as far as CHEW actually knows it.
      </p>
      <div className="life-map-grid">
        {domains.map((d, i) => <Node key={d.slug} domain={d} delay={i * 70} />)}
      </div>
    </div>
  );
}
