// app/components/today/OpportunityLadder.js
//
// Opportunities as layers, per the portal directive — but only ever as
// honest as the data behind them. "Available now" holds real, already-
// grounded opportunities (lib/homeIntelligence.js). The locked bucket
// never lists invented items; it states the real reason (not enough
// verified data yet) and a real count, never a mysterious lock.
//
// "Just opened" is a separate, real signal: the same canonical
// opportunity_unlocked transitions Life Map and Today's Barrier Dissolve
// consume (lib/transitions.js), rendered here as a one-shot rise —
// never a replay, since it's only populated the reconciliation pass the
// opportunity actually became active. Only Active/Newly Active states
// are built; "Visible" and "Blocked" opportunities aren't provable with
// the current data model (see lib/todayIntelligence.js's
// buildOpportunityLadder) and aren't faked here.

import Link from 'next/link';

export default function OpportunityLadder({ ladder }) {
  const { availableNow, newlyUnlocked, locked } = ladder;
  if (availableNow.length === 0 && newlyUnlocked.length === 0 && !locked.note) return null;

  return (
    <div className="card">
      <h3 style={{ marginBottom: '4px' }}>Opportunity Ladder</h3>
      <p className="text-faint" style={{ fontSize: '0.85rem', marginBottom: '16px' }}>
        What's within reach, and why.
      </p>

      {newlyUnlocked.length > 0 && (
        <div className="opportunity-tier">
          <span className="opportunity-tier-label">Just opened</span>
          {newlyUnlocked.map((e, i) => (
            <div key={e.id} className="opportunity-item opportunity-item--rising" style={{ animationDelay: `${i * 0.12}s` }}>
              <div className="flex-between">
                <strong style={{ fontSize: '0.88rem' }}>{e.title}</strong>
                <span className="badge badge-success">OPPORTUNITY UNLOCKED</span>
              </div>
              <p className="text-faint" style={{ fontSize: '0.83rem', margin: '3px 0 0' }}>{e.whatImproved}</p>
              {e.suggestedAction && (
                <p style={{ fontSize: '0.83rem', margin: '2px 0 0' }}><strong>Next: </strong>{e.suggestedAction}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="opportunity-tier">
        <span className="opportunity-tier-label">Available now</span>
        {availableNow.length === 0 ? (
          <p className="text-faint" style={{ fontSize: '0.85rem' }}>
            CHEW doesn't have enough verified information yet to identify an opportunity here.
          </p>
        ) : (
          availableNow.map((o, i) => (
            <div key={i} className="opportunity-item">
              <strong style={{ fontSize: '0.88rem' }}>{o.title}</strong>
              <p className="text-faint" style={{ fontSize: '0.83rem', margin: '3px 0 0' }}>
                {o.body} {o.href && <Link href={o.href}>Take a look</Link>}
              </p>
            </div>
          ))
        )}
      </div>

      {locked.note && (
        <div className="opportunity-tier opportunity-tier--locked">
          <span className="opportunity-tier-label">Locked ({locked.count})</span>
          <p className="text-faint" style={{ fontSize: '0.83rem' }}>{locked.note}</p>
        </div>
      )}
    </div>
  );
}
