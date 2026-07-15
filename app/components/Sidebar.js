// app/components/Sidebar.js
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS, SETTINGS_ITEM } from './nav-items';
import { IconLifeBuoy } from './icons';

function NavLink({ item, active }) {
  const Icon = item.icon;
  return (
    <Link href={item.href} className={`sidebar-link${active ? ' active' : ''}`}>
      <Icon />
      {item.label}
    </Link>
  );
}

export default function Sidebar() {
  const pathname = usePathname();

  const isActive = (href) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);

  return (
    <nav className="portal-sidebar" aria-label="Dashboard navigation">
      <div className="portal-sidebar-group">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item.href)} />
        ))}
        <NavLink item={SETTINGS_ITEM} active={isActive(SETTINGS_ITEM.href)} />
      </div>

      <div className="portal-sidebar-footer">
        <div className="sidebar-help">
          <strong>Need help?</strong>
          <p>Contact your strategist for guidance on your account.</p>
          <Link href="/dashboard/messages" className="btn btn-gold btn-sm" style={{ width: '100%' }}>
            <IconLifeBuoy /> Message Us
          </Link>
        </div>
      </div>
    </nav>
  );
}
