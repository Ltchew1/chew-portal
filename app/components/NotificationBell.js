// app/components/NotificationBell.js
//
// Real notifications only — lib/notifications.js's rows are created ONLY
// by lib/intelligenceCore.js's reconciler, at the moments something
// actually happened (a new barrier, a barrier resolved, a new
// opportunity, a recommendation change). The unread count here is a
// literal COUNT of rows with read_at IS NULL, computed server-side by
// the caller (app/dashboard/layout.js) and passed in — never a fabricated
// badge number.

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { IconSparkles } from './icons';

function BellIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="19" height="19" {...props}>
      <path d="M18 8a6 6 0 0 0-12 0c0 5-2 6-2 6h16s-2-1-2-6" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

export default function NotificationBell({ initialNotifications }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(initialNotifications);
  const unreadCount = notifications.filter((n) => !n.readAt).length;

  async function handleOpen() {
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen && unreadCount > 0) {
      const ids = notifications.filter((n) => !n.readAt).map((n) => n.id);
      setNotifications((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, readAt: new Date().toISOString() } : n)));
      await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds: ids }),
      }).catch(() => {});
      router.refresh();
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        className="topbar-icon-btn"
        onClick={handleOpen}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-expanded={open}
      >
        <BellIcon />
        {unreadCount > 0 && <span className="topbar-icon-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {open && (
        <div className="topbar-dropdown" role="menu">
          <div className="topbar-dropdown-header">
            <IconSparkles /> <span>What CHEW noticed</span>
          </div>
          {notifications.length === 0 ? (
            <p className="text-faint topbar-dropdown-empty">Nothing yet — CHEW notifies you when something real changes.</p>
          ) : (
            <ul className="topbar-dropdown-list">
              {notifications.slice(0, 8).map((n) => (
                <li key={n.id}>
                  <Link href={n.href || '/dashboard'} className="topbar-dropdown-item" onClick={() => setOpen(false)}>
                    <strong>{n.title}</strong>
                    <span className="text-faint">{n.body}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
