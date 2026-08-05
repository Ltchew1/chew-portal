// lib/clientStatus.js
//
// The APPLICANT -> ACCEPTED -> PAID status model that gates the Credit Lab
// (and anything else client-status-gated later). The client_status table
// (see db/schema.sql) is the source of truth and audit trail; Clerk
// publicMetadata.clientStatus is a fast mirror that server components read
// per-request without a DB round trip. scripts/set-client-status.js is what
// writes to both — see that file for how status actually gets changed.

import { currentUser } from '@clerk/nextjs/server';

export const CLIENT_STATUSES = ['applicant', 'accepted', 'paid'];

const STATUS_RANK = { applicant: 0, accepted: 1, paid: 2 };

// The minimum status required to enter the Credit Lab. Later layers'
// server routes (attestation writes, letter generation) should import and
// check against this same constant rather than re-deciding the threshold.
export const CREDIT_LAB_REQUIRED_STATUS = 'paid';

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
// CREDIT_LAB_REQUIRED_STATUS. Every Credit Lab surface — the page layout
// AND every app/api/credit-lab/** route — calls this independently. A page
// being gated does not protect the API routes underneath it; each one
// re-checks.
export async function getCreditLabAccess() {
  const user = await currentUser();
  if (!user) {
    return { user: null, status: null, hasAccess: false };
  }
  const status = statusFromClerkUser(user);
  return { user, status, hasAccess: hasRequiredStatus(status, CREDIT_LAB_REQUIRED_STATUS) };
}
