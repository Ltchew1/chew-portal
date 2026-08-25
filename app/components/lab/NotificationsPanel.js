// app/components/lab/NotificationsPanel.js
//
// The in-app notification channel's first surface (see lib/notifications.js
// and the schema comment on `notifications` — email/push/SMS are later,
// separately-authorized integrations that would read from the same table).
// Display-only for v1: read/unread interaction is a real next increment,
// not built here — every notification shown is real, generated only by
// lib/intelligenceCore.js's reconciler at the moments a client would
// actually want to be told something.

const TYPE_LABELS = {
  critical_action: 'Action Needed',
  plan_at_risk: 'Plan at Risk',
  opportunity_found: 'Opportunity',
  back_on_track: 'Back on Track',
  milestone: 'Milestone',
  chew_noticed: 'CHEW Noticed',
  reassessment_complete: 'Reassessed',
};
const TYPE_BADGE = {
  critical_action: 'badge-pending',
  plan_at_risk: 'badge-danger',
  opportunity_found: 'badge-success',
  back_on_track: 'badge-success',
  milestone: 'badge-success',
  chew_noticed: 'badge-neutral',
  reassessment_complete: 'badge-neutral',
};

export default function NotificationsPanel({ notifications }) {
  if (!notifications || notifications.length === 0) return null;

  return (
    <div className="card" style={{ marginBottom: '20px' }}>
      <h3 style={{ marginBottom: '10px' }}>Recent CHEW notifications</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {notifications.map((n) => (
          <div key={n.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <span className={`badge ${TYPE_BADGE[n.type] ?? 'badge-neutral'}`} style={{ flexShrink: 0, marginTop: '2px' }}>
              {TYPE_LABELS[n.type] ?? n.type}
            </span>
            <div>
              <strong style={{ fontSize: '0.88rem' }}>{n.title}</strong>
              <p className="text-faint" style={{ fontSize: '0.82rem', margin: '2px 0 0' }}>{n.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
