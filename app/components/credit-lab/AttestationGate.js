// app/components/credit-lab/AttestationGate.js
//
// The reusable attestation gate: renders the standing disclosures again
// (variant="pre-generation" — the "before letter generation" placement),
// then one checkbox per flagged item using the exact canonical statement
// from ATTESTATION_STATEMENTS. Checking a box POSTs to
// /api/credit-lab/attestations immediately — that request is the real
// gate (lib/attestations.js rejects anything that doesn't match the
// canonical wording, and the DB won't allow a second attestation on the
// same item). This component's "all attested" state is UX only, so it
// must never be trusted as the enforcement point itself — Layer 4c's
// letter generator has to call assertItemsAttested() server-side before
// generating anything, regardless of what this component shows on screen.
//
// Unattested items can be removed (fixing a mistake before it becomes
// part of the permanent record) — attested items cannot; the Remove
// button doesn't even render for them, and the DELETE route enforces the
// same boundary server-side regardless.

'use client';

import { useState } from 'react';
import StandingDisclosures from './StandingDisclosures';
import { ATTESTATION_STATEMENTS } from '../../../lib/creditLabCompliance';

const BUREAU_LABELS = { equifax: 'Equifax', experian: 'Experian', transunion: 'TransUnion' };
const REASON_LABELS = { not_mine: "Don't recognize", not_authorized: "Didn't authorize" };

function ItemRow({ item, onAttested, onRemoved }) {
  const [attesting, setAttesting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState(null);
  const attested = Boolean(item.attested_at);
  const statement = ATTESTATION_STATEMENTS[item.reason];

  async function handleCheck(e) {
    if (!e.target.checked || attested || attesting) return;
    setAttesting(true);
    setError(null);
    try {
      const res = await fetch('/api/credit-lab/attestations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disputeItemId: item.id, statementText: statement }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not record attestation.');
      onAttested(item.id, data.attestation.attested_at);
    } catch (err) {
      setError(err.message);
    } finally {
      setAttesting(false);
    }
  }

  async function handleRemove() {
    if (attested || removing) return;
    setRemoving(true);
    setError(null);
    try {
      const res = await fetch(`/api/credit-lab/dispute-items/${item.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not remove this item.');
      onRemoved(item.id);
    } catch (err) {
      setError(err.message);
      setRemoving(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: '12px' }}>
      <div className="flex-between" style={{ marginBottom: '10px' }}>
        <div>
          <strong>{item.creditor_name}</strong>
          <div className="text-faint" style={{ fontSize: '0.8rem' }}>
            {BUREAU_LABELS[item.bureau]} · {REASON_LABELS[item.reason]}
            {item.account_number ? ` · ${item.account_number}` : ''}
          </div>
        </div>
        {attested ? (
          <span className="badge badge-success">Attested</span>
        ) : (
          <button type="button" className="btn btn-outline btn-sm" onClick={handleRemove} disabled={removing}>
            {removing ? 'Removing…' : 'Remove'}
          </button>
        )}
      </div>

      <label
        style={{
          display: 'flex', gap: '10px', alignItems: 'flex-start', fontSize: '0.88rem',
          cursor: attested ? 'default' : 'pointer',
        }}
      >
        <input
          type="checkbox"
          checked={attested}
          disabled={attested || attesting}
          onChange={handleCheck}
          style={{ marginTop: '3px' }}
        />
        <span>{statement}</span>
      </label>

      {attesting && <p className="text-faint" style={{ fontSize: '0.8rem', margin: '8px 0 0' }}>Recording…</p>}
      {attested && (
        <p className="text-faint" style={{ fontSize: '0.78rem', margin: '8px 0 0' }}>
          Attested {new Date(item.attested_at).toLocaleString()}
        </p>
      )}
      {error && <p style={{ color: 'var(--danger)', fontSize: '0.8rem', margin: '8px 0 0' }}>{error}</p>}
    </div>
  );
}

export default function AttestationGate({ items }) {
  const [localItems, setLocalItems] = useState(items);

  function handleAttested(itemId, attestedAt) {
    setLocalItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, attested_at: attestedAt } : i)));
  }

  function handleRemoved(itemId) {
    setLocalItems((prev) => prev.filter((i) => i.id !== itemId));
  }

  const attestedCount = localItems.filter((i) => i.attested_at).length;
  const allAttested = localItems.length > 0 && attestedCount === localItems.length;

  return (
    <div style={{ marginTop: '20px' }}>
      <StandingDisclosures variant="pre-generation" />

      {localItems.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          {localItems.map((item) => (
            <ItemRow key={item.id} item={item} onAttested={handleAttested} onRemoved={handleRemoved} />
          ))}
        </div>
      )}

      {localItems.length > 0 && (
        <p className="text-faint" style={{ fontSize: '0.85rem', marginTop: '4px' }}>
          {attestedCount} of {localItems.length} items attested.{' '}
          {allAttested
            ? "Letter generation isn't built yet (Layer 4c) — once it is, it only unlocks here once every item above is attested."
            : "Check each statement above to attest — a letter can't be generated for an item until you do."}
        </p>
      )}
    </div>
  );
}
