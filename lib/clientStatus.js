// lib/clientStatus.js
//
// The APPLICANT -> ACCEPTED -> PAID status model that gates CHEW: The Lab
// and its rooms. The client_status table (see db/schema.sql) is the source
// of truth and audit trail; Clerk publicMetadata.clientStatus is a fast
// mirror that server components read per-request without a DB round trip.
// scripts/set-client-status.js is what writes to both — see that file for
// how status actually gets changed.

import { currentUser } from '@clerk/nextjs/server';

export const CLIENT_STATUSES = ['applicant', 'accepted', 'paid'];

const STATUS_RANK = { applicant: 0, accepted: 1, paid: 2 };

// The minimum status required to see The Lab hub at all — individual rooms
// (see lib/rooms.js's requiredStatus) can require more on top of this,
// never less.
export const LAB_REQUIRED_STATUS = 'accepted';

export function hasRequiredStatus(currentStatus, requiredStatus) {
  return (STATUS_RANK[currentStatus] ?? -1) >= (STATUS_RANK[requiredStatus] ?? Infinity);
}

// Reads the fast mirror off a Clerk user object (e.g. from currentUser()).
// A user with no status set yet defaults to 'applicant' — the lowest
// access level, never the highest.
export function statusFromClerkUser(user) {
  const status = user?.publicMetadata?.clientStatus;
  return CLIENT_STATUSES.includes(status) ? status : 'applicant';
}

// Server-only. Resolves the signed-in user and whether their status clears
// the given requiredStatus. Every gated surface in The Lab — the hub
// layout, every room's layout, AND every app/api/lab/** route — calls this
// independently. A page being gated does not protect the API routes
// underneath it; each one re-checks.
export async function getRoomAccess(requiredStatus) {
  const user = await currentUser();
  if (!user) {
    return { user: null, status: null, hasAccess: false };
  }
  const status = statusFromClerkUser(user);
  return { user, status, hasAccess: hasRequiredStatus(status, requiredStatus) };
}
