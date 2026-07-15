// app/components/nav-items.js
import {
  IconHome, IconClipboard, IconCalendar, IconVault, IconTrendUp,
  IconBook, IconBuilding, IconShield, IconSparkles, IconMessage, IconSettings,
} from './icons';

export const NAV_ITEMS = [
  { label: 'Overview', href: '/dashboard', icon: IconHome },
  { label: 'My Action Plan', href: '/dashboard/action-plan', icon: IconClipboard },
  { label: 'Appointments', href: '/dashboard/appointments', icon: IconCalendar },
  { label: 'Secure Documents', href: '/dashboard/documents', icon: IconVault },
  { label: 'Progress', href: '/dashboard/progress', icon: IconTrendUp },
  { label: 'Education Center', href: '/dashboard/education', icon: IconBook },
  { label: 'Business Builder', href: '/dashboard/business-builder', icon: IconBuilding },
  { label: 'Funding Readiness', href: '/dashboard/funding-readiness', icon: IconShield },
  { label: 'CHEW Guidance', href: '/dashboard/guidance', icon: IconSparkles },
  { label: 'Messages', href: '/dashboard/messages', icon: IconMessage },
];

export const SETTINGS_ITEM = { label: 'Account Settings', href: '/dashboard/settings', icon: IconSettings };
