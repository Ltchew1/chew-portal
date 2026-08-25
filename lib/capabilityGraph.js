// lib/capabilityGraph.js
//
// "Who can solve what, for whom, where, and when" — the actual matching
// query behind the network directive's Capability Graph. Deliberately not
// wired into Ask CHEW, notifications, or any recommendation surface yet
// (see lib/networkRouting.js) — this file is the real, working backend a
// future UI calls, proven correct against synthetic data (see the pure
// shapeForClient() below), but with nothing seeded in production so every
// call today honestly returns no matches.
//
// matchCapability() is the one path a client-facing surface would ever
// call, and it only ever returns providers that pass BOTH gates: the
// provider's own isReadyForRouting() checklist, AND
// capability_providers.is_active for that specific pairing — a provider
// can be ready for one capability and not another.

import { query } from './db';
import { isReadyForRouting } from './providers';

// Strips every internal field (classification, contact_method, internal
// notes) down to what a client is actually allowed to see. This is the
// one place "Do not expose internal classifications unnecessarily to the
// customer" is enforced in code, not just policy.
export function shapeForClient(row) {
  return {
    providerId: row.providerId,
    providerName: row.providerName,
    disclosure: row.disclosureText,
    intakeProcess: row.intakeProcess,
    eligibilityNotes: row.eligibilityNotes,
    clientProfileFit: row.clientProfileFit,
    prerequisiteSteps: row.prerequisiteSteps,
    documentsNeeded: row.documentsNeeded,
    dataSharingNotes: row.dataSharingNotes,
  };
}

export async function matchCapability(capabilityKey) {
  const { rows } = await query(
    `SELECT p.id AS "providerId", p.name AS "providerName", p.service_status AS "serviceStatus",
            p.jurisdiction, p.licensing_note AS "licensingNote", p.contact_method AS "contactMethod",
            p.intake_process AS "intakeProcess", p.disclosure_text AS "disclosureText",
            p.data_sharing_notes AS "dataSharingNotes", p.escalation_process AS "escalationProcess",
            cp.eligibility_notes AS "eligibilityNotes", cp.client_profile_fit AS "clientProfileFit",
            cp.prerequisite_steps AS "prerequisiteSteps", cp.documents_needed AS "documentsNeeded",
            cp.is_active AS "isActive"
     FROM capability_providers cp
     JOIN providers p ON p.id = cp.provider_id
     JOIN capabilities c ON c.id = cp.capability_id
     WHERE c.key = $1`,
    [capabilityKey]
  );

  return rows
    .filter((row) => row.isActive && isReadyForRouting(row))
    .map(shapeForClient);
}

// Admin -> Network's linking action: pair a provider with a capability, or
// update the pairing's specifics if one already exists (same capability +
// provider). This is the one write path in this file — everything above
// is read-only matching.
export async function upsertCapabilityProviderPair({
  capabilityId, providerId, isActive, eligibilityNotes, clientProfileFit, prerequisiteSteps, documentsNeeded,
}) {
  const { rows } = await query(
    `INSERT INTO capability_providers (capability_id, provider_id, is_active, eligibility_notes, client_profile_fit, prerequisite_steps, documents_needed)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (capability_id, provider_id)
     DO UPDATE SET is_active = EXCLUDED.is_active, eligibility_notes = EXCLUDED.eligibility_notes,
                   client_profile_fit = EXCLUDED.client_profile_fit, prerequisite_steps = EXCLUDED.prerequisite_steps,
                   documents_needed = EXCLUDED.documents_needed
     RETURNING id, capability_id AS "capabilityId", provider_id AS "providerId", is_active AS "isActive"`,
    [capabilityId, providerId, isActive ?? false, eligibilityNotes ?? null, clientProfileFit ?? null,
      JSON.stringify(prerequisiteSteps ?? []), JSON.stringify(documentsNeeded ?? [])]
  );
  return rows[0];
}

// Admin listing — every pairing, with enough of each side's fields to
// show real readiness at a glance (not just names), and whether it would
// actually pass matchCapability()'s two gates right now.
export async function listCapabilityProviderPairs() {
  const { rows } = await query(
    `SELECT cp.id, c.key AS "capabilityKey", c.name AS "capabilityName", p.id AS "providerId",
            p.name AS "providerName", p.service_status AS "serviceStatus", p.jurisdiction,
            p.licensing_note AS "licensingNote", p.contact_method AS "contactMethod",
            p.intake_process AS "intakeProcess", p.disclosure_text AS "disclosureText",
            p.data_sharing_notes AS "dataSharingNotes", p.escalation_process AS "escalationProcess",
            cp.is_active AS "isActive", cp.eligibility_notes AS "eligibilityNotes"
     FROM capability_providers cp
     JOIN providers p ON p.id = cp.provider_id
     JOIN capabilities c ON c.id = cp.capability_id
     ORDER BY c.name ASC, p.name ASC`
  );
  return rows.map((row) => ({ ...row, readyToRoute: row.isActive && isReadyForRouting(row) }));
}
