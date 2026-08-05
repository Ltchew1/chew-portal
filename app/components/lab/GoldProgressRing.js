// app/components/lab/GoldProgressRing.js
//
// Animated gold ring that fills from 0 to `value/max` on mount — the
// "goal/progress made beautiful" treatment. Reusable anywhere real
// progress exists; the Lab hub currently uses it for rooms unlocked
// (a real, computed number), not a fabricated "goal" — there's no actual
// goal-setting feature yet, so this never claims one.

'use client';

import { useEffect, useState } from 'react';

export default function GoldProgressRing({ value, max, caption, size = 108 }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setFilled(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const offset = circumference * (1 - (filled ? pct : 0));

  return (
    <div className="gold-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="gold-ring-track" cx={size / 2} cy={size / 2} r={radius} />
        <circle
          className="gold-ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          style={{ strokeDasharray: circumference, strokeDashoffset: offset }}
        />
      </svg>
      <div className="gold-ring-label">
        <strong>
          {value}
          <span className="gold-ring-max">/{max}</span>
        </strong>
        {caption && <span className="gold-ring-caption">{caption}</span>}
      </div>
    </div>
  );
}
