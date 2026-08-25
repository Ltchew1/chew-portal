// lib/features.js
//
// The universal feature-status gate. "Hidden UI is not security" — every
// page or API route behind a non-'live' feature must call
// getFeatureAccess() itself, server-side, before rendering or mutating
// anything. There is no middleware-level wildcard doing this for you: each
// call site is explicit, same discipline as getRoomAccess() (clientStatus
// gating) that every Credit route already independently re-checks.
//
// Two independent axes, both real:
//   - clientStatus (lib/clientStatus.js) = "does THIS client's plan tier
//     unlock this room" (Applicant/Accepted/Paid)
//   - feature status (this file) = "does this capability exist in
//     production AT ALL, for anyone" (internal/preview/locked/beta/live)
// A room can pass one and fail the other. Both must pass.

import { query } from './db';
import { currentUser } from '@clerk/nextjs/server';

// The one place a room slug (lib/rooms.js) turns into its feature_key —
// used by both RoomComingSoon.js and Ask CHEW's routing so the transform
// only lives in one spot.
export function roomFeatureKey(slug) {
  return `room_${slug.replace(/-/g, '_')}`;
}

// Internal/preview access is a Clerk publicMetadata flag the founder sets
// directly (same trust model as clientStatus — no in-app admin UI exists
// or is needed for this). Never derived from anything a client can set
// themselves.
export function isInternalUser(user) {
  return user?.publicMetadata?.chewInternal === true;
}

export async function getFeature(featureKey) {
  const { rows } = await query(
    `SELECT id, feature_key AS "featureKey", name, room, description, status, visibility,
            allowed_roles AS "allowedRoles", beta_cohort AS "betaCohort", route,
            api_namespace AS "apiNamespace", launch_requirements AS "launchRequirements",
            compliance_status AS "complianceStatus", readiness_gates AS "readinessGates"
     FROM features WHERE feature_key = $1`,
    [featureKey]
  );
  return rows[0] ?? null;
}

export async function listFeatures() {
  const { rows } = await query(
    `SELECT id, feature_key AS "featureKey", name, room, description, status, visibility, route,
            beta_cohort AS "betaCohort"
     FROM features ORDER BY room NULLS LAST, name ASC`
  );
  return rows;
}

// Pure — given a feature row and a user, does this user have access right
// now. Separated from getFeatureAccess() so it's directly testable without
// a DB or a real Clerk session.
export function evaluateFeatureAccess(feature, user) {
  if (!feature) return false; // no registry row = fail closed, never implicitly allowed
  switch (feature.status) {
    case 'live':
      return true;
    case 'beta':
      return Boolean(user && Array.isArray(feature.betaCohort) && feature.betaCohort.includes(user.id));
    case 'internal':
    case 'preview':
      return isInternalUser(user);
    case 'locked':
    default:
      return false; // locked means locked — no exceptions, not even for internal users (use 'preview' for that)
  }
}

// The actual server-side call site for a page or API route. Resolves the
// signed-in user itself (same as getRoomAccess()) so callers can't forget
// to, and always re-fetches the feature row — never trust a cached/earlier
// read for an access decision.
export async function getFeatureAccess(featureKey) {
  const [user, feature] = await Promise.all([currentUser(), getFeature(featureKey)]);
  return { user, feature, hasAccess: evaluateFeatureAccess(feature, user) };
}

// The Release Gate checklist (Product/Design/Engineering/Data/Compliance/
// Support/Analytics) as a single pass/fail read of readiness_gates —
// internal-only, for whoever's deciding whether a feature is ready to move
// to 'live'. Never used to grant access itself; status is still the only
// thing evaluateFeatureAccess() looks at.
const RELEASE_GATES = ['product', 'design', 'engineering', 'data', 'compliance', 'support', 'analytics'];

export function releaseGateStatus(feature) {
  const gates = feature?.readinessGates ?? {};
  return RELEASE_GATES.map((key) => ({ key, passed: gates[key] === true }));
}

export function isReadyToGoLive(feature) {
  return releaseGateStatus(feature).every((g) => g.passed);
}
