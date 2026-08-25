// app/components/admin/NetworkAdmin.js
//
// Admin -> Network: the real internal tool for adding entities,
// capabilities, and pairings without touching code — see the network
// directive's "adding a new company should not require editing multiple
// code files." Deliberately utilitarian, not consumer-grade — this is an
// internal instrument, not a client-facing surface.

'use client';

import { useState } from 'react';

const CLASSIFICATION_LABELS = {
  chew_direct: 'CHEW Direct',
  affiliated_enterprise: 'Affiliated Enterprise',
  independent_professional: 'Independent Professional',
  external_provider: 'External Provider',
  future_managed_service: 'Future Managed Service',
};
const STATUS_OPTIONS = ['draft', 'ready', 'paused', 'retired'];

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
        <div className="field"><label>key (slug)</label><input value={key} onChange={(e) => setKey(e.target.value)} placeholder="insurance_review" /></div>
        <div className="field"><label>category</label><input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="insurance" /></div>
      </div>
      <div className="field"><label>name</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="field"><label>description</label><textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
      {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{error}</p>}
      <button type="submit" className="btn btn-outline btn-sm" disabled={saving}>{saving ? 'Saving…' : 'Add capability'}</button>
    </form>
  );
}

function NewProviderForm({ onCreated }) {
  const [fields, setFields] = useState({
    name: '', classification: 'affiliated_enterprise', serviceStatus: 'draft',
    jurisdiction: '', licensingNote: '', contactMethod: '', intakeProcess: '',
    disclosureText: '', dataSharingNotes: '', escalationProcess: '',
  });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  function set(k, v) { setFields((f) => ({ ...f, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/network/providers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create provider.');
      onCreated(data.provider);
      setFields({ ...fields, name: '', jurisdiction: '', licensingNote: '', contactMethod: '', intakeProcess: '', disclosureText: '', dataSharingNotes: '', escalationProcess: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="card" style={{ marginBottom: '16px' }}>
      <h3>New provider / entity</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div className="field"><label>name</label><input value={fields.name} onChange={(e) => set('name', e.target.value)} /></div>
        <div className="field">
          <label>classification</label>
          <select value={fields.classification} onChange={(e) => set('classification', e.target.value)}>
            {Object.entries(CLASSIFICATION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div className="field">
          <label>service status</label>
          <select value={fields.serviceStatus} onChange={(e) => set('serviceStatus', e.target.value)}>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="field"><label>jurisdiction</label><input value={fields.jurisdiction} onChange={(e) => set('jurisdiction', e.target.value)} placeholder="Florida" /></div>
      </div>
      <div className="field"><label>licensing note (or "N/A")</label><input value={fields.licensingNote} onChange={(e) => set('licensingNote', e.target.value)} /></div>
      <div className="field"><label>contact / routing method (internal)</label><input value={fields.contactMethod} onChange={(e) => set('contactMethod', e.target.value)} /></div>
      <div className="field"><label>intake process</label><input value={fields.intakeProcess} onChange={(e) => set('intakeProcess', e.target.value)} /></div>
      <div className="field"><label>disclosure text (client-facing — write this yourself, never auto-filled)</label><textarea rows={2} value={fields.disclosureText} onChange={(e) => set('disclosureText', e.target.value)} /></div>
      <div className="field"><label>data-sharing notes</label><input value={fields.dataSharingNotes} onChange={(e) => set('dataSharingNotes', e.target.value)} /></div>
      <div className="field"><label>escalation process</label><input value={fields.escalationProcess} onChange={(e) => set('escalationProcess', e.target.value)} /></div>
      {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{error}</p>}
      <button type="submit" className="btn btn-outline btn-sm" disabled={saving}>{saving ? 'Saving…' : 'Add provider'}</button>
    </form>
  );
}

function ProviderRow({ provider, onUpdated }) {
  const [status, setStatus] = useState(provider.serviceStatus);
  const [saving, setSaving] = useState(false);

  async function applyStatus() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/network/providers/${provider.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceStatus: status }),
      });
      const data = await res.json();
      if (res.ok) onUpdated(data.provider);
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr>
      <td>{provider.name}</td>
      <td>{CLASSIFICATION_LABELS[provider.classification]}</td>
      <td>
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ marginRight: '6px' }}>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {status !== provider.serviceStatus && (
          <button type="button" className="btn btn-outline btn-sm" onClick={applyStatus} disabled={saving}>
            {saving ? '…' : 'Save'}
          </button>
        )}
      </td>
      <td className="text-faint" style={{ fontSize: '0.8rem' }}>{provider.jurisdiction || '—'}</td>
    </tr>
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

export default function NetworkAdmin({ initialProviders, initialCapabilities, initialPairs }) {
  const [providers, setProviders] = useState(initialProviders);
  const [capabilities, setCapabilities] = useState(initialCapabilities);
  const [pairs, setPairs] = useState(initialPairs);

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
            <thead><tr><th>Name</th><th>Classification</th><th>Status</th><th>Jurisdiction</th></tr></thead>
            <tbody>
              {providers.map((p) => (
                <ProviderRow key={p.id} provider={p} onUpdated={(updated) => setProviders((prev) => prev.map((x) => x.id === updated.id ? updated : x))} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3>Capability ↔ Provider pairings</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Capability</th><th>Provider</th><th>Active</th><th>Ready to route</th></tr></thead>
            <tbody>
              {pairs.map((pair) => (
                <tr key={pair.id}>
                  <td>{pair.capabilityName}</td>
                  <td>{pair.providerName}</td>
                  <td>{pair.isActive ? 'Yes' : 'No'}</td>
                  <td><ReadinessDot ready={pair.readyToRoute} />{pair.readyToRoute ? 'Ready' : 'Not ready'}</td>
                </tr>
              ))}
              {pairs.length === 0 && <tr><td colSpan={4} className="text-faint">No pairings yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
