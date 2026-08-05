// app/components/credit-lab/StandingDisclosures.js
//
// The standing disclosure block required at Credit Lab entry
// (variant="entry", used on app/dashboard/credit-lab/page.js) and again
// immediately before attestation/letter generation (variant="pre-generation",
// rendered inside AttestationGate). Copy comes from
// STANDING_DISCLOSURE_POINTS in lib/creditLabCompliance.js — the single
// source of truth — never hardcoded here, and matches the plain, calm
// voice already established by app/components/DisclaimerBar.js.

import { IconShield } from '../icons';
import { STANDING_DISCLOSURE_POINTS } from '../../../lib/creditLabCompliance';

const HEADINGS = {
  entry: 'Before you start',
  'pre-generation': 'Before you attest',
};

export default function StandingDisclosures({ variant = 'entry' }) {
  return (
    <div className="alert" style={{ alignItems: 'flex-start' }}>
      <IconShield />
      <div>
        <strong>{HEADINGS[variant] ?? HEADINGS.entry}</strong>
        <ul style={{ margin: '8px 0 0', paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {STANDING_DISCLOSURE_POINTS.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
