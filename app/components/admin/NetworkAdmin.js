// app/components/admin/NetworkAdmin.js
//
// Admin -> Network: the real internal tool for adding entities,
// capabilities, pairings, and inspecting the handoff/event trail without
// touching code. Deliberately utilitarian, not consumer-grade — "operational
// clarity matters more than polish."

'use client';

import { useState } from 'react';

const CLASSIFICATION_LABELS = {
  chew_direct: 'CHEW Direct',
  affiliated_enterprise: 'Affiliated Enterprise',
  independent_professional: 'Independent Professional',
  external_provider: 'External Provider',
  future_managed_service: 'Future Managed Service',
};
const LIFECYCLE_LABELS = {
  discovered: 'Discovered', under_review: 'Under Review', verified: 'Verified', approved: 'Approved',
  pilot: 'Pilot', live: 'Live', suspended: 'Suspended', retired: 'Retired',
};
const LIFECYCLE_TRANSITIONS = {
  discovered: ['under_review'],
  under_review: ['verified', 'discovered'],
  verified: ['approved', 'under_review'],
  approved: ['pilot', 'verified'],
  pilot: ['live', 'suspended', 'approved'],
  live: ['suspended', 'retired'],
  suspended: ['pilot', 'live', 'retired'],
  retired: [],
};

function ReadinessDot({ ready }) {
  return <span style={{ color: ready ? 'var(--success)' : 'var(--danger)', marginRight: '6px' }}>{ready ? '●' : '○'}</span>;
}

function NewCapabilityForm({ onCreated }) {
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/network/capabilities', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, name, description, category }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create capability.');
      onCreated(data.capability);
      setKey(''); setName(''); setDescription(''); setCategory('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="card" style={{ marginBottom: '16px' }}>
      <h3>New capability</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div className="field"><label>key (slug)</label><input value={key} onChange={(e) => setKey(e.target.value)} placeholder="ged_testing_navigation" /></div>
        <div className="field"><label>category</label><input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="education" /></div>
      </div>
      <div className="field"><label>name</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="field"><label>description</label><textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
      {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{error}</p>}
      <button type="submit" className="btn btn-outline btn-sm" disabled={saving}>{saving ? 'Saving…' : 'Add capability'}</button>
    </form>
  );
}

function NewProviderForm({ onCreated }) {
  const [name, setName] = useState('');
  const [classification, setClassification] = useState('external_provider');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/network/providers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, classification }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create provider.');
      onCreated(data.provider);
      setName('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="card" style={{ marginBottom: '16px' }}>
      <h3>New provider / entity</h3>
      <p className="text-faint" style={{ fontSize: '0.82rem', marginBottom: '10px' }}>
        Starts at &quot;Discovered.&quot; Fill in the qualification checklist and move it through the lifecycle below.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div className="field"><label>name</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="field">
          <label>classification</label>
          <select value={classification} onChange={(e) => setClassification(e.target.value)}>
            {Object.entries(CLASSIFICATION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>
      {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{error}</p>}
      <button type="submit" className="btn btn-outline btn-sm" disabled={saving}>{saving ? 'Saving…' : 'Add provider'}</button>
    </form>
  );
}

const QUALIFICATION_FIELDS = [
  ['jurisdiction', 'Jurisdiction (licensing scope)'], ['serviceGeography', 'Service geography'],
  ['officialWebsite', 'Official website'], ['licensingNote', 'Licensing note (or "N/A")'],
  ['contactMethod', 'Contact / routing method (internal)'], ['intakeProcess', 'Intake process'],
  ['disclosureText', 'Disclosure text (client-facing)'], ['dataSharingNotes', 'Data-sharing notes'],
  ['escalationProcess', 'Escalation process'], ['expectedResponseTime', 'Expected response time'],
  ['pricingModel', 'Pricing model'], ['contractStatus', 'Contract status'],
  ['outcomeReportingCapability', 'Outcome-reporting capability'], ['internalOwner', 'Internal owner'],
  ['evidenceNotes', 'Evidence / verification notes'],
];

function ProviderDetail({ provider, onUpdated }) {
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState(provider);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [transitioning, setTransitioning] = useState(false);
  const [readiness, setReadiness] = useState(null);

  function set(k, v) { setFields((f) => ({ ...f, [k]: v })); }

  async function saveQualification() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/network/providers/${provider.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save.');
      onUpdated(data.provider);
      setFields(data.provider);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function transition(toStatus) {
    setTransitioning(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/network/providers/${provider.id}/lifecycle`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not transition.');
      onUpdated(data.provider);
      setFields(data.provider);
    } catch (err) {
      setError(err.message);
    } finally {
      setTransitioning(false);
    }
  }

  return (
    <>
      <tr>
        <td>{provider.name}</td>
        <td>{CLASSIFICATION_LABELS[provider.classification]}</td>
        <td><span className="badge badge-neutral">{LIFECYCLE_LABELS[provider.lifecycleStatus]}</span></td>
        <td className="text-faint" style={{ fontSize: '0.8rem' }}>{provider.jurisdiction || '—'}</td>
        <td><button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen((o) => !o)}>{open ? 'Close' : 'Manage'}</button></td>
      </tr>
      {open && (
        <tr>
          <td colSpan={5}>
            <div className="card" style={{ margin: '8px 0' }}>
              <div style={{ marginBottom: '14px' }}>
                <strong style={{ fontSize: '0.85rem' }}>Lifecycle: {LIFECYCLE_LABELS[provider.lifecycleStatus]}</strong>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                  {LIFECYCLE_TRANSITIONS[provider.lifecycleStatus]?.map((toStatus) => (
                    <button key={toStatus} type="button" className="btn btn-gold btn-sm" disabled={transitioning} onClick={() => transition(toStatus)}>
                      {transitioning ? '…' : `Move to ${LIFECYCLE_LABELS[toStatus]}`}
                    </button>
                  ))}
                  {LIFECYCLE_TRANSITIONS[provider.lifecycleStatus]?.length === 0 && <span className="text-faint" style={{ fontSize: '0.82rem' }}>Terminal state — no further transitions.</span>}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '14px' }}>
                <label style={{ display: 'flex', gap: '6px', alignItems: 'center', fontWeight: 400 }}>
                  <input type="checkbox" checked={Boolean(fields.identityVerified)} onChange={(e) => set('identityVerified', e.target.checked)} /> Identity verified
                </label>
                <label style={{ display: 'flex', gap: '6px', alignItems: 'center', fontWeight: 400 }}>
                  <input type="checkbox" checked={Boolean(fields.serviceVerified)} onChange={(e) => set('serviceVerified', e.target.checked)} /> Service verified
                </label>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>Licensing</label>
                  <select value={fields.licensingVerified} onChange={(e) => set('licensingVerified', e.target.value)}>
                    <option value="pending">Pending</option>
                    <option value="verified">Verified</option>
                    <option value="not_applicable">Not applicable</option>
                  </select>
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>Capacity</label>
                  <select value={fields.capacityStatus || ''} onChange={(e) => set('capacityStatus', e.target.value)}>
                    <option value="">—</option>
                    <option value="available">Available</option>
                    <option value="limited">Limited</option>
                    <option value="unavailable">Unavailable</option>
                  </select>
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>Last verified</label>
                  <input type="date" value={fields.lastVerifiedAt ? String(fields.lastVerifiedAt).slice(0, 10) : ''} onChange={(e) => set('lastVerifiedAt', e.target.value)} />
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>Next review</label>
                  <input type="date" value={fields.nextReviewAt ? String(fields.nextReviewAt).slice(0, 10) : ''} onChange={(e) => set('nextReviewAt', e.target.value)} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {QUALIFICATION_FIELDS.map(([key, label]) => (
                  <div className="field" key={key}>
                    <label>{label}</label>
                    <input value={fields[key] || ''} onChange={(e) => set(key, e.target.value)} />
                  </div>
                ))}
              </div>

              {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{error}</p>}
              <button type="button" className="btn btn-outline btn-sm" onClick={saveQualification} disabled={saving}>
                {saving ? 'Saving…' : 'Save qualification fields'}
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function LinkForm({ capabilities, providers, onLinked }) {
  const [capabilityId, setCapabilityId] = useState('');
  const [providerId, setProviderId] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [eligibilityNotes, setEligibilityNotes] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!capabilityId || !providerId) { setError('Choose a capability and a provider.'); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/network/pairings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capabilityId: Number(capabilityId), providerId: Number(providerId), isActive, eligibilityNotes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not link them.');
      onLinked();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="card" style={{ marginBottom: '16px' }}>
      <h3>Link a provider to a capability</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div className="field">
          <label>capability</label>
          <select value={capabilityId} onChange={(e) => setCapabilityId(e.target.value)}>
            <option value="">Select…</option>
            {capabilities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>provider</label>
          <select value={providerId} onChange={(e) => setProviderId(e.target.value)}>
            <option value="">Select…</option>
            {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>
      <div className="field"><label>eligibility notes</label><input value={eligibilityNotes} onChange={(e) => setEligibilityNotes(e.target.value)} /></div>
      <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontWeight: 400, marginBottom: '10px' }}>
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> active for this capability
      </label>
      {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{error}</p>}
      <button type="submit" className="btn btn-outline btn-sm" disabled={saving}>{saving ? 'Saving…' : 'Link'}</button>
    </form>
  );
}

export default function NetworkAdmin({ initialProviders, initialCapabilities, initialPairs, initialHandoffs, initialEvents }) {
  const [providers, setProviders] = useState(initialProviders);
  const [capabilities, setCapabilities] = useState(initialCapabilities);
  const [pairs, setPairs] = useState(initialPairs);
  const [handoffs] = useState(initialHandoffs);
  const [events] = useState(initialEvents);

  async function refreshPairs() {
    const res = await fetch('/api/admin/network/pairings');
    const data = await res.json();
    if (res.ok) setPairs(data.pairs);
  }

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        <NewCapabilityForm onCreated={(c) => setCapabilities((prev) => [...prev, c])} />
        <NewProviderForm onCreated={(p) => setProviders((prev) => [...prev, p])} />
      </div>

      <LinkForm capabilities={capabilities} providers={providers} onLinked={refreshPairs} />

      <div className="card" style={{ marginBottom: '16px' }}>
        <h3>Providers</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Name</th><th>Classification</th><th>Lifecycle</th><th>Jurisdiction</th><th></th></tr></thead>
            <tbody>
              {providers.map((p) => (
                <ProviderDetail key={p.id} provider={p} onUpdated={(updated) => setProviders((prev) => prev.map((x) => x.id === updated.id ? updated : x))} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '16px' }}>
        <h3>Capability ↔ Provider pairings</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Capability</th><th>Provider</th><th>Active</th><th>Ready to route</th><th>Why not</th></tr></thead>
            <tbody>
              {pairs.map((pair) => (
                <tr key={pair.id}>
                  <td>{pair.capabilityName}</td>
                  <td>{pair.providerName}</td>
                  <td>{pair.isActive ? 'Yes' : 'No'}</td>
                  <td>
                    <ReadinessDot ready={pair.readyToRoute} />
                    {pair.readyToRoute ? (pair.blockedByGlobalSwitch ? 'Ready (routing off globally)' : 'Ready') : 'Not ready'}
                  </td>
                  <td className="text-faint" style={{ fontSize: '0.78rem' }}>{pair.blockReasons?.join('; ') || '—'}</td>
                </tr>
              ))}
              {pairs.length === 0 && <tr><td colSpan={5} className="text-faint">No pairings yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '16px' }}>
        <h3>Handoffs</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Capability</th><th>Provider</th><th>Status</th><th>Outcome</th><th>Simulated</th><th>Created</th></tr></thead>
            <tbody>
              {handoffs.map((h) => (
                <tr key={h.id}>
                  <td>{h.capabilityName}</td>
                  <td>{h.providerName}</td>
                  <td>{h.status}</td>
                  <td className="text-faint" style={{ fontSize: '0.8rem' }}>{h.outcomeClassification || '—'}</td>
                  <td>{h.isSimulatedTransmission ? 'Yes' : 'No'}</td>
                  <td className="text-faint" style={{ fontSize: '0.78rem' }}>{new Date(h.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {handoffs.length === 0 && <tr><td colSpan={6} className="text-faint">No handoffs yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3>Network event trail</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Type</th><th>Subject</th><th>Severity</th><th>When</th></tr></thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td>{e.eventType}</td>
                  <td>{e.subject}</td>
                  <td>{e.severity}</td>
                  <td className="text-faint" style={{ fontSize: '0.78rem' }}>{new Date(e.occurredAt).toLocaleString()}</td>
                </tr>
              ))}
              {events.length === 0 && <tr><td colSpan={4} className="text-faint">No network events yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
