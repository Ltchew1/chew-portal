// lib/rooms.js
//
// The single source of truth for every room in CHEW: The Lab. The hub's
// room picker, each room's status gate (via RoomGate), and each room's
// sub-nav all read from this list rather than re-declaring a room's name,
// icon, or required status in more than one place.
//
// `requiredStatus` is enforced by app/components/lab/RoomGate.js, which
// every room layout.js uses — see lib/clientStatus.js's getRoomAccess().
// The Lab hub itself (app/dashboard/lab/layout.js) separately requires at
// least 'accepted' just to see the room picker at all; a room can require
// more on top of that (Credit requires 'paid'), never less.

import { IconScale, IconTrendUp, IconBuilding, IconCoins, IconChart, IconGears } from '../app/components/icons';

export const ROOMS = [
  {
    slug: 'credit',
    name: 'Credit',
    tagline: "Review your reports and dispute what isn't yours — filed by you, directly with the bureaus.",
    icon: IconScale,
    href: '/dashboard/lab/credit',
    requiredStatus: 'paid',
    built: true,
  },
  {
    slug: 'credit-builder',
    name: 'Credit Builder',
    tagline: 'Tools for building a stronger credit history from here forward.',
    icon: IconTrendUp,
    href: '/dashboard/lab/credit-builder',
    requiredStatus: 'accepted',
    built: false,
  },
  {
    slug: 'business',
    name: 'Business',
    tagline: 'Structure, credit, and readiness for the business you’re building.',
    icon: IconBuilding,
    href: '/dashboard/lab/business',
    requiredStatus: 'accepted',
    built: false,
  },
  {
    slug: 'funding',
    name: 'Funding',
    tagline: 'Understand your funding options and what it actually takes to qualify.',
    icon: IconCoins,
    href: '/dashboard/lab/funding',
    requiredStatus: 'accepted',
    built: false,
  },
  {
    slug: 'intelligence',
    name: 'Financial Intelligence',
    tagline: 'Real data, real odds — no guarantees, just what the numbers actually say.',
    icon: IconChart,
    href: '/dashboard/lab/intelligence',
    requiredStatus: 'accepted',
    built: false,
  },
  {
    slug: 'money-systems',
    name: 'Money Systems',
    tagline: 'The infrastructure — accounts, habits, and tracking — behind lasting financial capability.',
    icon: IconGears,
    href: '/dashboard/lab/money-systems',
    requiredStatus: 'accepted',
    built: false,
  },
];

export function getRoom(slug) {
  return ROOMS.find((room) => room.slug === slug) ?? null;
}
