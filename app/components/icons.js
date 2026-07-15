// app/components/icons.js
//
// A small, hand-rolled icon set (24x24, stroke = currentColor). Keeping this
// as plain inline SVG avoids adding an icon library as a new dependency.

function base(props) {
  return {
    xmlns: 'http://www.w3.org/2000/svg',
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    ...props,
  };
}

export const IconHome = (p) => (
  <svg {...base(p)}><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" /></svg>
);

export const IconClipboard = (p) => (
  <svg {...base(p)}><rect x="6" y="4" width="12" height="17" rx="2" /><path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" /><path d="M9 11h6M9 15h6M9 7h6" /></svg>
);

export const IconCalendar = (p) => (
  <svg {...base(p)}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9.5h18M8 3v4M16 3v4" /></svg>
);

export const IconVault = (p) => (
  <svg {...base(p)}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="12" cy="12" r="3.2" /><path d="M12 9.8V12l1.4 1.4" /></svg>
);

export const IconTrendUp = (p) => (
  <svg {...base(p)}><path d="M3 17 10 10l4 4 7-7" /><path d="M15 6h6v6" /></svg>
);

export const IconBook = (p) => (
  <svg {...base(p)}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v18H6.5A2.5 2.5 0 0 1 4 18.5v-13Z" /><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H12v18h5.5a2.5 2.5 0 0 0 2.5-2.5v-13Z" /></svg>
);

export const IconBuilding = (p) => (
  <svg {...base(p)}><rect x="4" y="3" width="10" height="18" rx="1" /><path d="M14 8h6v13h-6" /><path d="M7 7h1M7 11h1M7 15h1M17 12h1M17 16h1" /></svg>
);

export const IconShield = (p) => (
  <svg {...base(p)}><path d="M12 3 5 6v6c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6l-7-3Z" /><path d="M9 12l2 2 4-4" /></svg>
);

export const IconSparkles = (p) => (
  <svg {...base(p)}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M17.5 15.5 20 18M18 6l-2.5 2.5M8.5 15.5 6 18" /><circle cx="12" cy="12" r="2.5" /></svg>
);

export const IconMessage = (p) => (
  <svg {...base(p)}><path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4V6a1 1 0 0 1 1-1Z" /></svg>
);

export const IconSettings = (p) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="3" /><path d="M19.4 13.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V19.9a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.11-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.04H2.1a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.55-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H8.24A1.7 1.7 0 0 0 9.28 2.1V2a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1.04 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V7.76c.16.62.62 1.13 1.24 1.34H21.9a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.55 1.11 1.7 1.7 0 0 0 .34 1.87Z" opacity="0" /><path d="M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4M2 12h2M20 12h2M12 2v2M12 20v2" /></svg>
);

export const IconLifeBuoy = (p) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3.5" /><path d="m6.3 6.3 3 3M18 6l-3.3 3.3M17.7 17.7l-3-3M6.3 17.7l3.3-3.3" /></svg>
);

export const IconLock = (p) => (
  <svg {...base(p)}><rect x="4.5" y="10.5" width="15" height="10" rx="2" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /></svg>
);

export const IconUpload = (p) => (
  <svg {...base(p)}><path d="M12 16V4M8 8l4-4 4 4" /><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></svg>
);

export const IconChevronRight = (p) => (
  <svg {...base(p)}><path d="m9 6 6 6-6 6" /></svg>
);

export const IconCheck = (p) => (
  <svg {...base(p)}><path d="m5 12 5 5 9-9" /></svg>
);
