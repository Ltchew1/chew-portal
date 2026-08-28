// app/components/lab/EconomicWeatherCard.js
//
// Economic Weather's opportunity-history signal — renders exactly what
// lib/economicWeather.js's getCreditOpportunityWeather() returns, and
// nothing it doesn't have real data for. Coverage is always stated
// explicitly ("Credit only") so this never reads as "CHEW's view of every
// opportunity in your world" when today it's one room's pipeline.
//
// Pure presentation, server component — no client interactivity needed.

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

export default function EconomicWeatherCard({ weather }) {
  if (!weather) return null;
  const { scope, label, status, detail, currentCount, changeText, trend } = weather;
  const coverageText = `${scope.charAt(0).toUpperCase()}${scope.slice(1)} only`;

  if (status === 'unavailable') {
    return (
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="flex-between" style={{ marginBottom: '10px', alignItems: 'flex-start' }}>
          <span className="text-faint" style={{ fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {label.toUpperCase()}
          </span>
          <span className={`badge ${STATUS_BADGE.unavailable}`}>Unavailable</span>
        </div>
        <p className="text-faint" style={{ fontSize: '0.85rem', margin: 0 }}>
          <strong style={{ color: 'var(--text)' }}>Why: </strong>{detail}
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ marginBottom: '20px' }}>
      <div className="flex-between" style={{ marginBottom: '10px', alignItems: 'flex-start' }}>
        <span className="text-faint" style={{ fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {label.toUpperCase()}
        </span>
        <span className={`badge ${STATUS_BADGE[status]}`}>{STATUS_LABEL[status]}</span>
      </div>
      <p style={{ fontSize: '0.88rem', marginBottom: '12px' }}>{detail}</p>
      <dl style={{ display: 'grid', gap: '6px', fontSize: '0.82rem', marginBottom: 0 }}>
        <div className="text-faint">
          <strong style={{ color: 'var(--text)' }}>Current active set: </strong>
          {currentCount === 1 ? '1 opportunity' : `${currentCount} opportunities`}
        </div>
        {changeText && (
          <div className="text-faint"><strong style={{ color: 'var(--text)' }}>Change: </strong>{changeText}</div>
        )}
        {trend && (
          <div className="text-faint"><strong style={{ color: 'var(--text)' }}>Trend: </strong>{TREND_LABEL[trend]}</div>
        )}
        <div className="text-faint"><strong style={{ color: 'var(--text)' }}>Coverage: </strong>{coverageText}</div>
      </dl>
    </div>
  );
}
