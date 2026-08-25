// app/components/today/WhatsWaiting.js
//
// WHAT'S WAITING — real active barriers (lib/barriers.js), the things
// genuinely blocking or stalling progress right now, plus "visual
// consequence" for the ones that recently stopped: a barrier that
// resolved shows here too, once, dissolving rather than just vanishing
// from the list — see lib/todayIntelligence.js's buildRecentlyResolved,
// which reads the real 'back_on_track' notification lib/intelligenceCore.js
// already logs at the moment a barrier clears.

const SEVERITY_BADGE = { risk: 'badge-danger', action_needed: 'badge-pending', watch: 'badge-neutral' };
const SEVERITY_LABEL = { risk: 'Risk', action_needed: 'Action needed', watch: 'Watch' };

export default function WhatsWaiting({ barriers, recentlyResolved }) {
  if ((!barriers || barriers.length === 0) && (!recentlyResolved || recentlyResolved.length === 0)) return null;

  return (
    <div className="card">
      <h3 style={{ marginBottom: '4px' }}>What&apos;s waiting</h3>
      <p className="text-faint" style={{ fontSize: '0.85rem', marginBottom: '16px' }}>
        What's genuinely blocking or stalling progress right now.
      </p>

      {barriers?.map((b) => (
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

      {recentlyResolved?.map((n) => (
        <div key={n.id} className="waiting-item waiting-item--dissolved">
          <div className="flex-between">
            <strong style={{ fontSize: '0.9rem' }}>{n.title}</strong>
            <span className="badge badge-success">Resolved</span>
          </div>
          <p className="text-faint" style={{ fontSize: '0.83rem', margin: '4px 0 0' }}>{n.body}</p>
        </div>
      ))}
    </div>
  );
}
