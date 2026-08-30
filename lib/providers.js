// lib/providers.js
//
// Provider records, the qualification checklist, and the lifecycle a
// provider moves through before it can ever be matched — see
// CAPABILITY_NETWORK.md for the full model. isReadyForRouting() is the one
// gate every routing/matching function in lib/capabilityGraph.js defers
// to; a provider is never selectable just because a row exists for it, or
// because someone typed "ready" into a status field.
//
// `classification` is the internal relationship taxonomy (CHEW Direct /
// Affiliated Enterprise / Independent Professional / External Provider /
// Future Managed Service). It drives internal logic only — see the
// directive's "Do not expose internal classifications unnecessarily to the
// customer." `disclosure_text` is the one field a client ever sees, and it
// is never auto-filled from a template: a provider with an empty
// disclosure_text can never pass isReadyForRouting(), by design, because
// affiliation/compensation/licensing disclosure language needs a human
// (the founder, with counsel where warranted) to actually write it for
// that specific relationship — this file will not generate persuasive-
// sounding legal disclosure copy on anyone's behalf.

import { query, withTransaction } from './db';

export const CLASSIFICATIONS = [
  'chew_direct', 'affiliated_enterprise', 'independent_professional',
  'external_provider', 'future_managed_service',
];

// Lifecycle: discovered -> under_review -> verified -> approved -> pilot
// -> live, with suspended/retired as exits. Not cosmetic — see
// LIFECYCLE_TRANSITIONS below, which is the only path a status can
// actually change through (transitionProviderLifecycle), and
// isReadyForRouting(), which only a provider in 'pilot' or 'live' can
// ever pass.
export const LIFECYCLE_STATES = [
  'discovered', 'under_review', 'verified', 'approved', 'pilot', 'live', 'suspended', 'retired',
];
const ROUTABLE_LIFECYCLE_STATES = ['pilot', 'live'];

// Forward and lateral moves only where they make real sense; 'retired' is
// terminal on purpose (re-onboarding a retired provider is a new decision,
// not a resume). 'suspended' can resume to either 'pilot' or 'live' —
// wherever it was paused from is a judgment call for whoever resumes it,
// not something this map tries to remember.
export const LIFECYCLE_TRANSITIONS = {
  discovered: ['under_review'],
  under_review: ['verified', 'discovered'],
  verified: ['approved', 'under_review'],
  approved: ['pilot', 'verified'],
  pilot: ['live', 'suspended', 'approved'],
  live: ['suspended', 'retired'],
  suspended: ['pilot', 'live', 'retired'],
  retired: [],
};

export function canTransitionLifecycle(fromStatus, toStatus) {
  return (LIFECYCLE_TRANSITIONS[fromStatus] ?? []).includes(toStatus);
}

// The full qualification checklist from the directive, as code — not
// implied by a single status flag. A provider must be in a routable
// lifecycle stage AND have every required field filled in AND not be
// overdue for its next review. "Required verification expired" is a real,
// checkable condition, not a manual reminder someone has to remember.
export function isReadyForRouting(provider) {
  if (!provider || !ROUTABLE_LIFECYCLE_STATES.includes(provider.lifecycleStatus)) return false;
  if (!provider.identityVerified || !provider.serviceVerified) return false;
  if (provider.licensingVerified === 'pending') return false;
  const required = [
    provider.jurisdiction, provider.serviceGeography, provider.officialWebsite,
    provider.licensingNote, provider.contactMethod, provider.intakeProcess,
    provider.disclosureText, provider.dataSharingNotes, provider.escalationProcess,
  ];
  if (!required.every((field) => typeof field === 'string' && field.trim().length > 0)) return false;
  if (provider.capacityStatus === 'unavailable') return false;
  if (provider.nextReviewAt && new Date(provider.nextReviewAt) < new Date()) return false;
  return true;
}

// The same check, but explainable — the admin-facing question is "would
// this provider be eligible right now, and if not, exactly why." Returns
// every failing reason, not just the first one, so a single glance shows
// the whole gap rather than one fix revealing the next blocker.
export function explainRoutingReadiness(provider) {
  const reasons = [];
  if (!provider) return { ready: false, reasons: ['Provider not found'] };

  if (!ROUTABLE_LIFECYCLE_STATES.includes(provider.lifecycleStatus)) {
    reasons.push(
      provider.lifecycleStatus === 'suspended' ? 'Provider paused'
      : provider.lifecycleStatus === 'retired' ? 'Provider retired'
      : `Provider not approved (currently: ${provider.lifecycleStatus})`
    );
  }
  if (!provider.identityVerified) reasons.push('Identity not verified');
  if (!provider.serviceVerified) reasons.push('Service/capability not verified');
  if (provider.licensingVerified === 'pending') reasons.push('Missing licensing verification');
  if (!provider.jurisdiction?.trim() || !provider.serviceGeography?.trim()) reasons.push('Jurisdiction/service geography not documented');
  if (!provider.officialWebsite?.trim()) reasons.push('Missing official website/source');
  if (!provider.contactMethod?.trim() || !provider.intakeProcess?.trim()) reasons.push('Missing handoff method');
  if (!provider.disclosureText?.trim()) reasons.push('Missing client disclosure language');
  if (!provider.dataSharingNotes?.trim()) reasons.push('Missing data-sharing notes');
  if (!provider.escalationProcess?.trim()) reasons.push('Missing escalation process');
  if (provider.capacityStatus === 'unavailable') reasons.push('Capacity unavailable');
  if (provider.nextReviewAt && new Date(provider.nextReviewAt) < new Date()) reasons.push('Required verification expired');

  return { ready: reasons.length === 0, reasons };
}

const PROVIDER_COLUMNS = `
  id, name, classification, lifecycle_status AS "lifecycleStatus", jurisdiction,
  service_geography AS "serviceGeography", official_website AS "officialWebsite",
  licensing_note AS "licensingNote", contact_method AS "contactMethod",
  intake_process AS "intakeProcess", disclosure_text AS "disclosureText",
  data_sharing_notes AS "dataSharingNotes", escalation_process AS "escalationProcess",
  capacity_status AS "capacityStatus", expected_response_time AS "expectedResponseTime",
  pricing_model AS "pricingModel", contract_status AS "contractStatus",
  outcome_reporting_capability AS "outcomeReportingCapability",
  last_verified_at AS "lastVerifiedAt", next_review_at AS "nextReviewAt",
  internal_owner AS "internalOwner", evidence_notes AS "evidenceNotes",
  identity_verified AS "identityVerified", service_verified AS "serviceVerified",
  licensing_verified AS "licensingVerified", created_at AS "createdAt"
`;

export async function createProvider(fields) {
  const { name, classification } = fields;
  if (!CLASSIFICATIONS.includes(classification)) {
    throw new Error(`classification must be one of: ${CLASSIFICATIONS.join(', ')}`);
  }
  const { rows } = await query(
    `INSERT INTO providers (name, classification) VALUES ($1, $2) RETURNING ${PROVIDER_COLUMNS}`,
    [name, classification]
  );
  // New providers always start at 'discovered', regardless of what the
  // caller passes — reaching any later stage requires going through
  // transitionProviderLifecycle(), which is the only place a transition is
  // validated and audited. Then fill in whatever qualification fields the
  // caller already has.
  return updateProvider(rows[0].id, fields);
}

export async function getProvider(providerId) {
  const { rows } = await query(`SELECT ${PROVIDER_COLUMNS} FROM providers WHERE id = $1`, [providerId]);
  return rows[0] ?? null;
}

export async function listProviders() {
  const { rows } = await query(`SELECT ${PROVIDER_COLUMNS} FROM providers ORDER BY name ASC`);
  return rows;
}

// Partial update for the qualification fields ONLY — lifecycle_status is
// deliberately excluded here (see transitionProviderLifecycle). The
// Admin -> Network workflow this exists for is "fill in one more
// readiness field," not replacing the whole row every time; every field
// is COALESCE'd so an omitted one keeps its current value. Boolean/enum
// fields need an explicit "was this key present" check since `false` and
// `'pending'` are meaningful values, not absence.
export async function updateProvider(providerId, fields) {
  const {
    name, classification, jurisdiction, serviceGeography, officialWebsite, licensingNote,
    contactMethod, intakeProcess, disclosureText, dataSharingNotes, escalationProcess,
    capacityStatus, expectedResponseTime, pricingModel, contractStatus, outcomeReportingCapability,
    lastVerifiedAt, nextReviewAt, internalOwner, evidenceNotes,
  } = fields;
  if (classification && !CLASSIFICATIONS.includes(classification)) {
    throw new Error(`classification must be one of: ${CLASSIFICATIONS.join(', ')}`);
  }
  // Strict-typed on purpose: Boolean("false") === true in JS, so a
  // malformed caller sending the string "false" must NOT silently flip
  // this to verified=true. Anything that isn't an actual boolean is
  // treated as "not provided" (COALESCE keeps the current value), never
  // coerced.
  const identityVerified = typeof fields.identityVerified === 'boolean' ? fields.identityVerified : null;
  const serviceVerified = typeof fields.serviceVerified === 'boolean' ? fields.serviceVerified : null;
  const licensingVerified = fields.licensingVerified ?? null;

  const { rows } = await query(
    `UPDATE providers SET
       name = COALESCE($2, name), classification = COALESCE($3, classification),
       jurisdiction = COALESCE($4, jurisdiction), service_geography = COALESCE($5, service_geography),
       official_website = COALESCE($6, official_website), licensing_note = COALESCE($7, licensing_note),
       contact_method = COALESCE($8, contact_method), intake_process = COALESCE($9, intake_process),
       disclosure_text = COALESCE($10, disclosure_text), data_sharing_notes = COALESCE($11, data_sharing_notes),
       escalation_process = COALESCE($12, escalation_process), capacity_status = COALESCE($13, capacity_status),
       expected_response_time = COALESCE($14, expected_response_time), pricing_model = COALESCE($15, pricing_model),
       contract_status = COALESCE($16, contract_status),
       outcome_reporting_capability = COALESCE($17, outcome_reporting_capability),
       last_verified_at = COALESCE($18, last_verified_at), next_review_at = COALESCE($19, next_review_at),
       internal_owner = COALESCE($20, internal_owner), evidence_notes = COALESCE($21, evidence_notes),
       identity_verified = COALESCE($22, identity_verified), service_verified = COALESCE($23, service_verified),
       licensing_verified = COALESCE($24, licensing_verified),
       updated_at = now()
     WHERE id = $1
     RETURNING ${PROVIDER_COLUMNS}`,
    [providerId, name ?? null, classification ?? null, jurisdiction ?? null, serviceGeography ?? null,
      officialWebsite ?? null, licensingNote ?? null, contactMethod ?? null, intakeProcess ?? null,
      disclosureText ?? null, dataSharingNotes ?? null, escalationProcess ?? null, capacityStatus ?? null,
      expectedResponseTime ?? null, pricingModel ?? null, contractStatus ?? null,
      outcomeReportingCapability ?? null, lastVerifiedAt ?? null, nextReviewAt ?? null,
      internalOwner ?? null, evidenceNotes ?? null, identityVerified, serviceVerified, licensingVerified]
  );
  if (!rows[0]) throw new Error('Provider not found.');
  return rows[0];
}

// The ONLY way lifecycle_status changes — validates the transition against
// LIFECYCLE_TRANSITIONS and writes a provider_lifecycle_events row in the
// same transaction, every time. A caller cannot silently change status
// through updateProvider(); this function is the single audited path.
export async function transitionProviderLifecycle(providerId, toStatus, { note, changedBy } = {}) {
  if (!LIFECYCLE_STATES.includes(toStatus)) {
    throw new Error(`toStatus must be one of: ${LIFECYCLE_STATES.join(', ')}`);
  }
  return withTransaction(async (client) => {
    const current = await client.query('SELECT lifecycle_status FROM providers WHERE id = $1 FOR UPDATE', [providerId]);
    if (!current.rows[0]) throw new Error('Provider not found.');
    const fromStatus = current.rows[0].lifecycle_status;

    if (!canTransitionLifecycle(fromStatus, toStatus)) {
      throw new Error(`Cannot move a provider from '${fromStatus}' to '${toStatus}'. Valid next states: ${(LIFECYCLE_TRANSITIONS[fromStatus] ?? []).join(', ') || 'none (terminal)'}.`);
    }

    const updated = await client.query(
      `UPDATE providers SET lifecycle_status = $2, updated_at = now() WHERE id = $1 RETURNING ${PROVIDER_COLUMNS}`,
      [providerId, toStatus]
    );
    await client.query(
      `INSERT INTO provider_lifecycle_events (provider_id, from_status, to_status, note, changed_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [providerId, fromStatus, toStatus, note ?? null, changedBy ?? null]
    );
    return updated.rows[0];
  });
}

export async function listLifecycleEvents(providerId) {
  const { rows } = await query(
    `SELECT id, from_status AS "fromStatus", to_status AS "toStatus", note, changed_by AS "changedBy", created_at AS "createdAt"
     FROM provider_lifecycle_events WHERE provider_id = $1 ORDER BY created_at DESC`,
    [providerId]
  );
  return rows;
}
