// app/components/nav-items.js
import {
  IconHome, IconShield, IconBook, IconClipboard,
  IconVault, IconMessage, IconSparkles, IconSettings,
} from './icons';

// Command Center nav — Phase 1 (CHEW Rebuild Kit, Section 4). Deliberately
// simplified from the prior 10-item nav: Business Builder and Funding
// Readiness are Phase 2 (Financial Health / Business Readiness / Funding
// Readiness scores); Appointments and Progress fold into Tasks for now.
export const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: IconHome },
  { label: 'Blueprint', href: '/dashboard/blueprint', icon: IconShield },
  { label: 'Education', href: '/dashboard/education', icon: IconBook },
  { label: 'Tasks', href: '/dashboard/tasks', icon: IconClipboard },
  { label: 'Documents', href: '/dashboard/documents', icon: IconVault },
  { label: 'Messages', href: '/dashboard/messages', icon: IconMessage },
  { label: 'Advisor', href: '/dashboard/guidance', icon: IconSparkles },
];

export const SETTINGS_ITEM = { label: 'Account Settings', href: '/dashboard/settings', icon: IconSettings };
