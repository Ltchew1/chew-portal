// app/components/today/WhatChangedRipple.js
//
// What Changed as a real state-change experience: each recent event
// (lib/todayIntelligence.js's buildChangeRipples) names the real Today
// section it affects — never a decorative "something happened" line.
// The matching section headings elsewhere on the page (see page.js's
// ripple-glow classes) pulse once on load using the same `affected` map
// this component renders as text, so nothing the glow conveys is
// invisible to screen readers or reduced motion — the fallback IS the
// primary information, not a lesser copy of it.

export default function WhatChangedRipple({ items }) {
  if (items.length === 0) return null;
  return (
    <div className="card">
      <h3 style={{ marginBottom: '10px' }}>Since last time</h3>
      <ul className="ripple-list">
        {items.map((c, i) => (
          <li key={i} className="ripple-item" style={{ animationDelay: `${i * 0.08}s` }}>
            <span className="ripple-text">{c.text}</span>
            {c.systems.length > 0 && (
              <span className="ripple-affects">
                {c.systems.map((s) => <span key={s} className="ripple-affects-chip">{s}</span>)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
