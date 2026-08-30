// app/components/today/WhatsWaiting.js
//
// WHAT'S WAITING — real active barriers (lib/barriers.js), the things
// genuinely blocking or stalling progress right now. A barrier that just
// resolved no longer appears here — see BarrierDissolve.js, which is the
// one place a resolution is shown, exactly once, at the moment CHEW
// detects it.

const SEVERITY_BADGE = { risk: 'badge-danger', action_needed: 'badge-pending', watch: 'badge-neutral' };
const SEVERITY_LABEL = { risk: 'Risk', action_needed: 'Action needed', watch: 'Watch' };

export default function WhatsWaiting({ barriers }) {
  if (!barriers || barriers.length === 0) return null;

  return (
    <div className="card">
      <h3 style={{ marginBottom: '4px' }}>What&apos;s waiting</h3>
      <p className="text-faint" style={{ fontSize: '0.85rem', marginBottom: '16px' }}>
        What's genuinely blocking or stalling progress right now.
      </p>

      {barriers.map((b) => (
        <div key={b.id} className="waiting-item">
          <div className="flex-between" style={{ marginBottom: '4px' }}>
            <strong style={{ fontSize: '0.9rem' }}>{b.title}</strong>
            <span className={`badge ${SEVERITY_BADGE[b.severity] ?? 'badge-neutral'}`}>{SEVERITY_LABEL[b.severity] ?? b.severity}</span>
          </div>
          <p className="text-faint" style={{ fontSize: '0.83rem', margin: '0 0 4px' }}>{b.whatHappened}</p>
          <p style={{ fontSize: '0.83rem', margin: '0 0 4px' }}><strong>Do this now: </strong>{b.doThisNow}</p>
          <p className="text-faint" style={{ fontSize: '0.78rem', margin: 0 }}>CHEW rechecks: {b.recheckTrigger}</p>
        </div>
      ))}
    </div>
  );
}
