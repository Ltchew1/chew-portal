// app/components/lab/RecommendationExplainer.js
//
// "Why CHEW told me that" — makes a recommendation inspectable instead of
// a black box. Reads straight from the persisted `recommendations` row
// (lib/recommendations.js): what CHEW observed, the reasoning, and what
// would actually change the recommendation. No fetch needed — the
// recommendation is already on the page from the server-side reconciler.

'use client';

import { useState } from 'react';

export default function RecommendationExplainer({ recommendation }) {
  const [open, setOpen] = useState(false);
  if (!recommendation) return null;

  return (
    <div style={{ marginTop: '10px' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{ background: 'none', border: 'none', color: 'var(--gold-light)', fontSize: '0.8rem', cursor: 'pointer', padding: 0 }}
      >
        {open ? 'Hide why CHEW told you that' : 'Why did CHEW tell me that?'}
      </button>
      {open && (
        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--divider)', fontSize: '0.82rem', display: 'grid', gap: '10px' }}>
          <div>
            <span className="text-faint">Recommendation created</span>
            <div>{new Date(recommendation.createdAt).toLocaleString()}</div>
          </div>
          {recommendation.observed?.length > 0 && (
            <div>
              <span className="text-faint">CHEW observed</span>
              <ul style={{ paddingLeft: '18px', marginTop: '4px' }}>
                {recommendation.observed.map((o, i) => <li key={i}>{o}</li>)}
              </ul>
            </div>
          )}
          <div>
            <span className="text-faint">Reason</span>
            <div>{recommendation.reason}</div>
          </div>
          {recommendation.whatWouldChangeThis?.length > 0 && (
            <div>
              <span className="text-faint">What would change this</span>
              <ul style={{ paddingLeft: '18px', marginTop: '4px' }}>
                {recommendation.whatWouldChangeThis.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
