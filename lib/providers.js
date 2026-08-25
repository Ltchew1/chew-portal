// lib/providers.js
//
// Provider records + the readiness checklist from the network directive,
// translated into an actual executable check rather than a policy
// document. isReadyForRouting() is the one gate every routing/matching
// function in lib/capabilityGraph.js defers to — a provider is never
// selectable just because a row exists for it.
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

import { query } from './db';

export const CLASSIFICATIONS = [
  'chew_direct', 'affiliated_enterprise', 'independent_professional',
  'external_provider', 'future_managed_service',
];

// The full provider-readiness checklist from the directive, as code:
// service status, jurisdiction, licensing (or an explicit "not
// applicable"), a contact/routing method, an intake process, disclosure
// language, data-sharing notes, and an escalation process. Every field
// must be a real, non-empty string — "not applicable" is a valid, honest
// answer for licensing_note; a missing field is not.
export function isReadyForRouting(provider) {
  if (!provider || provider.serviceStatus !== 'ready') return false;
  const required = [
    provider.jurisdiction, provider.licensingNote, provider.contactMethod,
    provider.intakeProcess, provider.disclosureText, provider.dataSharingNotes,
    provider.escalationProcess,
  ];
  return required.every((field) => typeof field === 'string' && field.trim().length > 0);
}

export async function createProvider({
  name, classification, serviceStatus, jurisdiction, licensingNote, contactMethod,
  intakeProcess, disclosureText, dataSharingNotes, escalationProcess,
}) {
  if (!CLASSIFICATIONS.includes(classification)) {
    throw new Error(`classification must be one of: ${CLASSIFICATIONS.join(', ')}`);
  }
  const { rows } = await query(
    `INSERT INTO providers
       (name, classification, service_status, jurisdiction, licensing_note, contact_method,
        intake_process, disclosure_text, data_sharing_notes, escalation_process)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, name, classification, service_status AS "serviceStatus", jurisdiction,
               licensing_note AS "licensingNote", contact_method AS "contactMethod",
               intake_process AS "intakeProcess", disclosure_text AS "disclosureText",
               data_sharing_notes AS "dataSharingNotes", escalation_process AS "escalationProcess",
               created_at AS "createdAt"`,
    [name, classification, serviceStatus ?? 'draft', jurisdiction ?? null, licensingNote ?? null,
      contactMethod ?? null, intakeProcess ?? null, disclosureText ?? null, dataSharingNotes ?? null,
      escalationProcess ?? null]
  );
  return rows[0];
}

export async function getProvider(providerId) {
  const { rows } = await query(
    `SELECT id, name, classification, service_status AS "serviceStatus", jurisdiction,
            licensing_note AS "licensingNote", contact_method AS "contactMethod",
            intake_process AS "intakeProcess", disclosure_text AS "disclosureText",
            data_sharing_notes AS "dataSharingNotes", escalation_process AS "escalationProcess"
     FROM providers WHERE id = $1`,
    [providerId]
  );
  return rows[0] ?? null;
}

export async function listProviders() {
  const { rows } = await query(
    `SELECT id, name, classification, service_status AS "serviceStatus", jurisdiction,
            licensing_note AS "licensingNote", contact_method AS "contactMethod",
            intake_process AS "intakeProcess", disclosure_text AS "disclosureText",
            data_sharing_notes AS "dataSharingNotes", escalation_process AS "escalationProcess"
     FROM providers ORDER BY name ASC`
  );
  return rows;
}
