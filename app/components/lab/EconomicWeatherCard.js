// app/components/lab/EconomicWeatherCard.js
//
// Economic Weather's opportunity-history signal — renders exactly what
// lib/economicWeather.js's getCreditOpportunityWeather() returns, and
// nothing it doesn't have real data for. Coverage is always stated
// explicitly ("Credit only") so this never reads as "CHEW's view of every
// opportunity in your world" when today it's one room's pipeline.
//
// The field of nodes below the headline is a real-state instrument, not
// decoration: one node per currently active opportunity (currentCount —
// the exact same number the "Current active set" line states in text).
// It never renders anything the data doesn't support — no nodes beyond
// currentCount, no ghost/entrance treatment unless `justChanged` (passed
// from a page that read lib/intelligenceCore.js's opportunityHistoryChanged
// — true only on the exact reconciliation pass a real transition was
// detected) says this is the one render where that transition is fresh.
// An ordinary revisit — even while `status` is still "Expanded" from last
// week — renders every node in its plain, settled state: no ceremony.
//
// Pure presentation, server component — no client interactivity needed;
// the field is `aria-hidden`, so every fact it shows also exists as real
// text (detail sentence + the stat list) for anyone not seeing the motion.

const STATUS_BADGE = {
  expanded: 'badge-success',
  contracted: 'badge-danger',
  composition_changed: 'badge-pending',
  mixed: 'badge-pending',
  unchanged: 'badge-pending',
  current: 'badge-pending',
  unavailable: 'badge-pending',
};

const STATUS_LABEL = {
  expanded: 'Expanded', contracted: 'Contracted', composition_changed: 'Mix Changed',
  mixed: 'Mixed', unchanged: 'Unchanged', current: 'Current', unavailable: 'Unavailable',
};

const TREND_LABEL = {
  consistently_expanding: 'Consistently expanding',
  consistently_contracting: 'Consistently contracting',
};

const MAX_FIELD_NODES = 6;

function WeatherField({ currentCount, addedCount, removedCount, justChanged }) {
  const emergingCount = justChanged ? Math.min(addedCount, currentCount) : 0;
  const steadyCount = currentCount - emergingCount;
  const recedingCount = justChanged ? removedCount : 0;
  const overflow = Math.max(0, steadyCount - MAX_FIELD_NODES);
  const steadyShown = Math.min(steadyCount, MAX_FIELD_NODES);
  const emergingShown = Math.min(emergingCount, Math.max(0, MAX_FIELD_NODES - steadyShown));
  const recedingShown = Math.min(recedingCount, 3); // a count, not a roster — three ghosts communicates "some left" without pretending to enumerate them

  const nodes = [
    ...Array.from({ length: steadyShown }, (_, i) => ({ key: `steady-${i}`, kind: 'steady' })),
    ...Array.from({ length: emergingShown }, (_, i) => ({ key: `emerging-${i}`, kind: 'emerging' })),
  ];

  return (
    <div className="weather-field" aria-hidden="true">
      <span className="weather-field-line" />
      {nodes.map((n, i) => (
        <span
          key={n.key}
          className={`weather-node weather-node--${n.kind}`}
          style={n.kind === 'emerging' ? { animationDelay: `${i * 0.12}s` } : undefined}
        />
      ))}
      {recedingShown > 0 && Array.from({ length: recedingShown }, (_, i) => (
        <span key={`receding-${i}`} className="weather-node weather-node--receding" style={{ animationDelay: `${i * 0.1}s` }} />
      ))}
      {overflow > 0 && <span className="weather-node-overflow">+{overflow}</span>}
    </div>
  );
}

export default function EconomicWeatherCard({ weather, justChanged = false }) {
  if (!weather) return null;
  const { scope, label, status, detail, currentCount, changeText, trend, addedCount, removedCount } = weather;
  const coverageText = `${scope.charAt(0).toUpperCase()}${scope.slice(1)} only`;

  if (status === 'unavailable') {
    return (
      <div className="card weather-card weather-card--dormant" style={{ marginBottom: '20px' }}>
        <div className="flex-between weather-card-head">
          <span className="weather-card-eyebrow">{label.toUpperCase()}</span>
          <span className={`badge ${STATUS_BADGE.unavailable}`}>Unavailable</span>
        </div>
        <div className="weather-field weather-field--dormant" aria-hidden="true">
          <span className="weather-node weather-node--dormant" />
        </div>
        <p className="text-faint weather-detail">
          <strong style={{ color: 'var(--text)' }}>Why: </strong>{detail}
        </p>
      </div>
    );
  }

  return (
    <div className="card weather-card" style={{ marginBottom: '20px' }}>
      <div className="flex-between weather-card-head">
        <span className="weather-card-eyebrow">{label.toUpperCase()}</span>
        <span className={`badge ${STATUS_BADGE[status]}`}>{STATUS_LABEL[status]}</span>
      </div>

      <WeatherField currentCount={currentCount} addedCount={addedCount} removedCount={removedCount} justChanged={justChanged} />

      {trend && (
        <div className={`weather-trend weather-trend--${trend === 'consistently_expanding' ? 'up' : 'down'}`}>
          <span className="weather-trend-arrow" />
          {TREND_LABEL[trend]}
        </div>
      )}

      <p className="weather-detail">{detail}</p>

      <dl className="weather-stats">
        <div className="text-faint">
          <strong style={{ color: 'var(--text)' }}>Current active set: </strong>
          <span className="weather-count">{currentCount}</span> {currentCount === 1 ? 'opportunity' : 'opportunities'}
        </div>
        {changeText && (
          <div className="text-faint"><strong style={{ color: 'var(--text)' }}>Change: </strong>{changeText}</div>
        )}
        <div className="text-faint"><strong style={{ color: 'var(--text)' }}>Coverage: </strong>{coverageText}</div>
      </dl>
    </div>
  );
}
