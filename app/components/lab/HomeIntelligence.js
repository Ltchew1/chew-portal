// app/components/lab/HomeIntelligence.js
//
// Renders one room's slice of lib/homeIntelligence.js's output — Plan
// Status, the one dominant Next Best Move, What Changed, and CHEW Noticed.
// Pure presentation, no client interactivity needed, so this stays a
// server component and renders straight from what the home page already
// fetched.

import Link from 'next/link';
import { IconTrendUp, IconSparkles, IconChevronRight } from '../icons';

const PLAN_STATUS_LABELS = {
  on_track: 'On Track',
  watch: 'Watch',
  action_needed: 'Action Needed',
  plan_at_risk: 'Plan at Risk',
};
const PLAN_STATUS_BADGE = {
  on_track: 'badge-success',
  watch: 'badge-pending',
  action_needed: 'badge-pending',
  plan_at_risk: 'badge-danger',
};

function NextBestMoveCard({ move }) {
  if (!move) return null;
  return (
    <div className="card next-move-card" style={{ marginBottom: '20px' }}>
      <div className="flex-between" style={{ marginBottom: '10px', alignItems: 'flex-start' }}>
        <div>
          <span className="text-faint" style={{ fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Your next best move
          </span>
          <h3 style={{ margin: '4px 0 0' }}>{move.action}</h3>
        </div>
        <IconTrendUp />
      </div>
      <p style={{ fontSize: '0.9rem', marginBottom: '10px' }}>{move.why}</p>
      <dl style={{ display: 'grid', gap: '6px', fontSize: '0.82rem', marginBottom: '14px' }}>
        <div className="text-faint"><strong style={{ color: 'var(--text)' }}>Expected effect: </strong>{move.effect}</div>
        <div className="text-faint"><strong style={{ color: 'var(--text)' }}>Don&apos;t: </strong>{move.avoid}</div>
        <div className="text-faint"><strong style={{ color: 'var(--text)' }}>Next: </strong>{move.next}</div>
      </dl>
      <Link href={move.href} className="btn btn-gold btn-sm">
        {move.linkLabel} <IconChevronRight />
      </Link>
    </div>
  );
}

export default function HomeIntelligence({ intelligence }) {
  const { planStatus, nextBestMove, chewNoticed, whatChanged, opportunities } = intelligence;

  return (
    <>
      {planStatus && (
        <div className="flex-between" style={{ marginBottom: '16px' }}>
          <span className="text-faint" style={{ fontSize: '0.85rem' }}>Plan status</span>
          <span className={`badge ${PLAN_STATUS_BADGE[planStatus]}`}>{PLAN_STATUS_LABELS[planStatus]}</span>
        </div>
      )}

      <NextBestMoveCard move={nextBestMove} />

      {(whatChanged.length > 0 || chewNoticed.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px', marginBottom: '20px' }}>
          {whatChanged.length > 0 && (
            <div className="card">
              <h3 style={{ marginBottom: '10px' }}>What changed</h3>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '18px', fontSize: '0.85rem' }}>
                {whatChanged.map((c, i) => (
                  <li key={i}>{c.text}</li>
                ))}
              </ul>
            </div>
          )}
          {chewNoticed.length > 0 && (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <IconSparkles />
                <h3 style={{ margin: 0 }}>CHEW noticed</h3>
              </div>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '18px', fontSize: '0.85rem' }}>
                {chewNoticed.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {opportunities.length > 0 && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <h3 style={{ marginBottom: '10px' }}>Opportunities</h3>
          {opportunities.map((o, i) => (
            <div key={i} style={{ marginBottom: i < opportunities.length - 1 ? '12px' : 0 }}>
              <strong style={{ fontSize: '0.9rem' }}>{o.title}</strong>
              <p className="text-faint" style={{ fontSize: '0.85rem', margin: '4px 0 0' }}>
                {o.body} {o.href && <Link href={o.href}>Take a look</Link>}
              </p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
