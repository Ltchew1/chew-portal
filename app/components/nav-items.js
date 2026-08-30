// app/components/nav-items.js
import {
  IconHome, IconShield, IconBook, IconClipboard, IconScale, IconGears, IconBuilding,
  IconVault, IconMessage, IconSparkles, IconSettings, IconFlask,
} from './icons';

// Command Center nav. Every entry here is a route that actually renders
// something real — no destination is added because a locked reference
// image shows it. Three additions on top of the prior 8-item list, all
// real as of this pass: Whole Position (app/dashboard/whole-position,
// the same reconciled state Today's Orbit already uses), Credit
// Intelligence (a direct shortcut to the one room with a real
// intelligence pipeline — previously reachable only via The Lab),
// and Domino (app/dashboard/domino, the same real crossSystemDomino
// object BarrierDissolve already renders inline, given its own page).
// "Worlds" replaces what a locked reference calls "Home World" — there
// is no housing/vehicle/travel data model in this app, so it shows the
// member's real rooms (lib/rooms.js), never a fabricated destination.
export const NAV_ITEMS = [
  { label: 'Today', href: '/dashboard', icon: IconHome },
  { label: 'Whole Position', href: '/dashboard/whole-position', icon: IconSparkles },
  { label: 'Credit Intelligence', href: '/dashboard/lab/credit', icon: IconScale },
  { label: 'Domino', href: '/dashboard/domino', icon: IconGears },
  { label: 'Worlds', href: '/dashboard/worlds', icon: IconBuilding },
  { label: 'The Lab', href: '/dashboard/lab', icon: IconFlask },
  { label: 'Blueprint', href: '/dashboard/blueprint', icon: IconShield },
  { label: 'Education', href: '/dashboard/education', icon: IconBook },
  { label: 'Tasks', href: '/dashboard/tasks', icon: IconClipboard },
  { label: 'Documents', href: '/dashboard/documents', icon: IconVault },
  { label: 'Messages', href: '/dashboard/messages', icon: IconMessage },
  { label: 'Advisor', href: '/dashboard/guidance', icon: IconSparkles },
];

export const SETTINGS_ITEM = { label: 'Account Settings', href: '/dashboard/settings', icon: IconSettings };
