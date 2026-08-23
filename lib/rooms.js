// lib/rooms.js
//
// The single source of truth for every room in CHEW: The Lab. The hub's
// room picker, each room's status gate (via RoomGate), and each room's
// sub-nav all read from this list rather than re-declaring a room's name,
// icon, tagline, or feature list in more than one place. Adding a new
// room later (Real Estate, Land, etc.) is just a new entry here plus a
// matching route folder — the hub's grid (`.room-gallery`, auto-fit +
// dense packing) and RoomComingSoon/RoomGate both scale to any count
// without layout changes.
//
// `features` is the room-card teaser list — what's actually coming, named
// specifically so a member can see "everything I need is in here" at a
// glance. These are real planned features, not vague marketing copy; keep
// them specific, and keep `built: false` honest until they exist.
//
// `requiredStatus` is enforced by app/components/lab/RoomGate.js, which
// every room layout.js uses — see lib/clientStatus.js's getRoomAccess().
// The Lab hub itself (app/dashboard/lab/layout.js) separately requires at
// least 'accepted' just to see the room picker at all; a room can require
// more on top of that (Credit requires 'paid'), never less.

import {
  IconScale, IconTrendUp, IconBuilding, IconCoins, IconChart, IconGears, IconReferral,
} from '../app/components/icons';

export const ROOMS = [
  {
    slug: 'credit',
    name: 'Credit',
    tagline: "Review your reports and dispute what isn't yours — filed by you, directly with the bureaus.",
    features: [
      'Disputes — all 3 bureaus + secondaries',
      'Furnisher disputes',
      'Method of Verification (MOV) requests',
      'CFPB & FTC escalation paths',
    ],
    icon: IconScale,
    href: '/dashboard/lab/credit',
    requiredStatus: 'paid',
    built: true,
  },
  {
    slug: 'credit-builder',
    name: 'Credit Builder',
    tagline: 'Build credit history the right way, one deliberate step at a time.',
    features: [
      'Tradeline strategy',
      'Secured cards',
      'Rent reporting',
      'Authorized-user (AU) strategy',
      'The full build sequence',
    ],
    icon: IconTrendUp,
    href: '/dashboard/lab/credit-builder',
    requiredStatus: 'accepted',
    built: false,
  },
  {
    slug: 'business',
    name: 'Business',
    tagline: 'Everything it takes to structure and credit a business, in one place.',
    features: [
      'Entity formation',
      'EIN & Sunbiz filings',
      'Operating agreements',
      'Business banking setup',
      'Licensing',
      'Business credit stack',
    ],
    icon: IconBuilding,
    href: '/dashboard/lab/business',
    requiredStatus: 'accepted',
    built: false,
  },
  {
    slug: 'funding',
    name: 'Funding',
    tagline: 'Understand what lenders actually look for — and close the gaps yourself.',
    features: [
      'Funding readiness',
      'Lender criteria',
      'Lines of credit (LOCs)',
      'Grants',
      'Gap-closing strategy',
    ],
    icon: IconCoins,
    href: '/dashboard/lab/funding',
    requiredStatus: 'accepted',
    built: false,
  },
  {
    slug: 'intelligence',
    name: 'Financial Intelligence',
    tagline: 'Real data, real odds — no guarantees, just what the numbers actually say.',
    features: [
      'Business survival data',
      'Licensing guides + links',
      'Full financial literacy library',
    ],
    icon: IconChart,
    href: '/dashboard/lab/intelligence',
    requiredStatus: 'accepted',
    built: false,
  },
  {
    slug: 'money-systems',
    name: 'Money Systems',
    tagline: 'The infrastructure behind lasting financial capability.',
    features: [
      'Cash flow management',
      'Budgeting',
      'Banking access & ChexSystems',
      'Habit building',
      'Tracking tools',
    ],
    icon: IconGears,
    href: '/dashboard/lab/money-systems',
    requiredStatus: 'accepted',
    built: false,
  },
  {
    slug: 'referral',
    name: 'Referral Hub',
    tagline: 'Feed the next — bring the people you trust into The Lab with you.',
    features: [
      'Invite your circle',
      'Track referral status',
      'See what’s available to you as a member',
    ],
    icon: IconReferral,
    href: '/dashboard/lab/referral',
    requiredStatus: 'accepted',
    built: false,
  },
];

export function getRoom(slug) {
  return ROOMS.find((room) => room.slug === slug) ?? null;
}
