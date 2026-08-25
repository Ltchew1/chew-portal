// app/components/lab/LockedFeatureCard.js
//
// The premium "coming to CHEW" presentation for a locked feature — never
// an ugly disabled button, never a dead link. This component renders no
// interactive affordance at all: no <button>, no <Link>, no onClick — a
// locked feature is not "clickable but blocked," it simply isn't a click
// target, which is the actual enforcement showing through in the UI
// rather than a CSS-only illusion of one.
//
// `statusLabel` picks the badge copy ("Coming Soon" / "In Development" /
// "Being Built") per the directive's suggested vocabulary — pass whichever
// fits the visual context; callers should never invent a release date.

import { STATUS_LABELS } from '../../../lib/featureCopy';

export default function LockedFeatureCard({ icon, name, description, statusLabel = STATUS_LABELS.locked }) {
  return (
    <div className="locked-feature-card">
      <div className="locked-feature-visual" aria-hidden="true">
        <svg viewBox="0 0 200 120" preserveAspectRatio="xMidYMid slice">
          <line x1="0" y1="30" x2="200" y2="30" />
          <line x1="0" y1="90" x2="200" y2="90" />
          <line x1="60" y1="0" x2="60" y2="120" />
          <line x1="140" y1="0" x2="140" y2="120" />
          <circle cx="100" cy="60" r="34" />
          <circle cx="100" cy="60" r="18" />
        </svg>
      </div>
      <div className="locked-feature-body">
        {icon && <div className="card-icon">{icon}</div>}
        <h3>{name}</h3>
        <p>{description}</p>
        <span className="badge badge-locked">{statusLabel}</span>
      </div>
    </div>
  );
}
