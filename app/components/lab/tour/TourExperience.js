// app/components/lab/tour/TourExperience.js
//
// The first-visit cinematic welcome, shown in place of the room picker at
// /dashboard/lab until the client finishes it. Purely text/visual for
// now — see tourSteps.js's voiceoverId note for the (currently unused)
// AI-voiceover hook; the tour must never block waiting on audio.
//
// On the last step, "Enter The Lab" POSTs to /api/lab/tour/complete, then
// calls router.refresh() — that re-runs the Server Component at
// /dashboard/lab, which will now read has_completed_tour = true and
// render the hub instead. No separate tour route to bookmark into.

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import GoldDivider from './GoldDivider';
import { TOUR_STEPS } from './tourSteps';

export default function TourExperience({ firstName }) {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const step = TOUR_STEPS[stepIndex];
  const isLast = stepIndex === TOUR_STEPS.length - 1;

  async function finish() {
    setFinishing(true);
    try {
      await fetch('/api/lab/tour/complete', { method: 'POST' });
    } catch {
      // If this fails, the tour just shows again next visit — harmless,
      // so the client still gets into their Lab today either way.
    }
    // The query param tells the hub this is the moment right after
    // finishing, not a true return visit — see page.js's "Welcome back"
    // seam note. It's read once and never persisted.
    router.push('/dashboard/lab?justFinishedTour=1');
  }

  function handlePrimary() {
    if (isLast) {
      finish();
    } else {
      setStepIndex((i) => i + 1);
    }
  }

  return (
    <div className="tour-stage">
      <div key={step.id} className="tour-step">
        <span className="tour-eyebrow">{step.eyebrow}</span>
        <h1 className="tour-title">{step.title(firstName)}</h1>
        <GoldDivider />
        <p className="tour-body">{step.body}</p>
      </div>

      <div className="tour-dots" aria-hidden="true">
        {TOUR_STEPS.map((s, i) => (
          <span
            key={s.id}
            className={`tour-dot${i === stepIndex ? ' active' : ''}${i < stepIndex ? ' done' : ''}`}
          />
        ))}
      </div>

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-gold btn-glow"
          onClick={handlePrimary}
          disabled={finishing}
        >
          {finishing ? 'Opening…' : (step.cta || 'Continue')}
        </button>
        {!isLast && (
          <button type="button" className="btn btn-outline" onClick={finish} disabled={finishing}>
            Skip tour
          </button>
        )}
      </div>
    </div>
  );
}
