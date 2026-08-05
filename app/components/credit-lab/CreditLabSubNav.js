// app/components/credit-lab/CreditLabSubNav.js
//
// In-module navigation for the Credit Lab's five sub-features (Layer 4a-4e).
// Only links to routes that actually exist; the rest render as plain
// "coming soon" badges — same honest pattern as the rest of the portal
// (see NAV_ITEMS leading to stub pages) rather than linking to a 404.

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { label: 'Overview', href: '/dashboard/credit-lab' },
  { label: 'Report Walkthrough', href: '/dashboard/credit-lab/walkthrough' },
];

const COMING_SOON = ['Letter Generator', 'Dispute Tracker', 'Education Library'];

export default function CreditLabSubNav() {
  const pathname = usePathname();

  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '24px' }}>
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`btn btn-sm ${pathname === link.href ? 'btn-gold' : 'btn-outline'}`}
        >
          {link.label}
        </Link>
      ))}
      {COMING_SOON.map((label) => (
        <span key={label} className="badge badge-neutral" style={{ padding: '7px 12px' }}>
          {label} — coming soon
        </span>
      ))}
    </div>
  );
}
