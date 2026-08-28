// app/components/lab/FrictionTimelineCard.js
//
// Friction History's visual — the timeline moves (one tick per real
// captured observation, lib/frictionHistory.js's getRoomFrictionHistory
// output) while a barrier that keeps recurring holds its track anchored
// across it. Every tick, track, and the isolate callout below the
// timeline are real: a track's presence bitmap is the exact same
// barrierId-in-activeIds fact the DB stores (buildFrictionTracks), and
// the isolated barrier's title/severity come from the real currently-
// active barriers list — never a synthesized "for dramatic effect" name.
//
// Same one-shot discipline as EconomicWeatherCard: `justChanged` (from
// lib/intelligenceCore.js's barrierHistoryChanged — true only on the
// exact pass a real transition was detected) gates the latest tick's
// pulse. An ordinary revisit renders every tick in its settled state.
//
// Pure presentation, server component — the timeline is `aria-hidden`;
// every fact it shows also exists as real text (detail sentence, stat
// list, isolate callout) for anyone not seeing the motion.

import { buildFrictionTracks } from '../../../lib/frictionHistory';

const STATUS_BADGE = {
  expanded: 'badge-danger',
  contracted: 'badge-success',
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

const MAX_TRACKS = 4;

function Timeline({ timeline, justChanged }) {
  if (timeline.length === 0) return null;
  const tracks = buildFrictionTracks(timeline).slice(0, MAX_TRACKS);
  const overflow = Math.max(0, buildFrictionTracks(timeline).length - MAX_TRACKS);
  const lastIndex = timeline.length - 1;

  return (
    <div className="friction-timeline" aria-hidden="true">
      {tracks.map((track, ti) => (
        <div key={track.barrierId} className={`friction-track${ti === 0 ? ' friction-track--anchor' : ''}`}>
          {track.presence.map((present, i) => (
            <span
              key={i}
              className={[
                'friction-tick',
                present ? 'friction-tick--present' : 'friction-tick--absent',
                ti === 0 ? 'friction-tick--anchor' : '',
                justChanged && i === lastIndex && present ? 'friction-tick--pulse' : '',
              ].filter(Boolean).join(' ')}
            />
          ))}
        </div>
      ))}
      {overflow > 0 && <span className="friction-track-overflow">+{overflow} more barrier{overflow === 1 ? '' : 's'} in this window</span>}
    </div>
  );
}

export default function FrictionTimelineCard({ friction, activeBarriers = [], justChanged = false }) {
  if (!friction) return null;
  const { scope, label, status, detail, currentCount, changeText, trend, timeline, survivor } = friction;
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

  // Only named when it has genuinely survived more than one observation —
  // a streak of 1 just means "first time seen," not "keeps recurring,"
  // so there is nothing honest to isolate yet.
  const survivorBarrier = survivor && survivor.observedFor >= 2
    ? activeBarriers.find((b) => b.id === survivor.barrierId)
    : null;

  return (
    <div className="card weather-card" style={{ marginBottom: '20px' }}>
      <div className="flex-between weather-card-head">
        <span className="weather-card-eyebrow">{label.toUpperCase()}</span>
        <span className={`badge ${STATUS_BADGE[status]}`}>{STATUS_LABEL[status]}</span>
      </div>

      <Timeline timeline={timeline} justChanged={justChanged} />

      {trend && (
        <div className={[
          'weather-trend',
          trend === 'consistently_expanding' ? 'weather-trend--rising' : 'weather-trend--falling',
          // More barriers accumulating over time is the bad direction here
          // — the opposite valence from Economic Weather's opportunity
          // count, where "rising" is the good one.
          trend === 'consistently_expanding' ? 'weather-trend--bad' : 'weather-trend--good',
        ].join(' ')}>
          <span className="weather-trend-arrow" />
          {TREND_LABEL[trend]}
        </div>
      )}

      <p className="weather-detail">{detail}</p>

      {survivorBarrier && (
        <div className="friction-isolate">
          <span className="friction-isolate-kicker">Keeps surviving</span>
          <strong className="friction-isolate-title">{survivorBarrier.title}</strong>
          <span className="friction-isolate-count">
            Active across {survivor.observedFor}{survivor.atLeast ? '+' : ''} observation{survivor.observedFor === 1 ? '' : 's'}
          </span>
        </div>
      )}

      <dl className="weather-stats">
        <div className="text-faint">
          <strong style={{ color: 'var(--text)' }}>Current active set: </strong>
          <span className="weather-count">{currentCount}</span> {currentCount === 1 ? 'barrier' : 'barriers'}
        </div>
        {changeText && (
          <div className="text-faint"><strong style={{ color: 'var(--text)' }}>Change: </strong>{changeText}</div>
        )}
        <div className="text-faint"><strong style={{ color: 'var(--text)' }}>Coverage: </strong>{coverageText}</div>
      </dl>
    </div>
  );
}
