// app/components/TopBar.js
//
// The shell's top bar — real greeting, real Ask CHEW entry, real
// notification count, and Clerk's own account menu (never a second,
// custom-built account menu duplicating what Clerk already provides
// securely). No fabricated system-status line: this app has no health
// endpoint to honestly report "All Systems Operational" from, so it
// isn't shown at all rather than asserted without evidence.

import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import AskChewBar from './AskChewBar';
import NotificationBell from './NotificationBell';

function MessageIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="19" height="19" {...props}>
      <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function timeOfDayGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function TopBar({ firstName, notifications }) {
  return (
    <header className="portal-header">
      <div className="portal-brand">
        <img src="/chew-logo.png" alt="CHEW" style={{ height: '30px', width: 'auto' }} />
        <span>
          CHEW LLC
          <span className="portal-brand-sub">Command Center</span>
        </span>
      </div>

      <div className="topbar-greeting">
        <strong>{timeOfDayGreeting()}, {firstName}.</strong>
      </div>

      <AskChewBar />

      <div className="topbar-actions">
        <Link href="/dashboard/messages" className="topbar-icon-btn" aria-label="Messages">
          <MessageIcon />
        </Link>
        <NotificationBell initialNotifications={notifications} />
        <UserButton afterSignOutUrl="/" />
      </div>
    </header>
  );
}
