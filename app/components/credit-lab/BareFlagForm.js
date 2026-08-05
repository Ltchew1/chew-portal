// app/components/credit-lab/BareFlagForm.js
//
// Deliberately bare-bones: exists only so the attestation gate above has
// real, client-created items to attest to and can be verified end-to-end
// before Layer 4b exists. It is a real form doing a real POST to
// app/api/credit-lab/dispute-items/route.js, writing real rows — just
// intentionally minimal. Layer 4b replaces this with the full
// self-flagging tool integrated into the report walkthrough; it is not a
// second version of that feature.
//
// Note the reason radios have no default checked value — the client must
// actively pick one. This is the client-decision guardrail: nothing here
// pre-selects or suggests a reason.

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const BUREAUS = [
  { value: 'equifax', label: 'Equifax' },
  { value: 'experian', label: 'Experian' },
  { value: 'transunion', label: 'TransUnion' },
];

export default function BareFlagForm() {
  const router = useRouter();
  const [bureau, setBureau] = useState('');
  const [creditorName, setCreditorName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!bureau || !creditorName.trim() || !reason) {
      setError('Bureau, creditor name, and a reason are all required.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/credit-lab/dispute-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bureau, creditorName, accountNumber, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not flag this item.');
      setBureau('');
      setCreditorName('');
      setAccountNumber('');
      setReason('');
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card" style={{ marginTop: '20px' }}>
      <p className="text-faint" style={{ fontSize: '0.8rem', marginBottom: '16px' }}>
        Placeholder form for testing the attestation gate (Layer 3). Layer 4b replaces this with
        the full self-flagging tool, built into the report walkthrough.
      </p>

      <div className="field">
        <label htmlFor="bureau">Bureau</label>
        <select id="bureau" value={bureau} onChange={(e) => setBureau(e.target.value)}>
          <option value="">Select a bureau…</option>
          {BUREAUS.map((b) => (
            <option key={b.value} value={b.value}>{b.label}</option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="creditorName">Creditor / account name (as shown on your report)</label>
        <input id="creditorName" value={creditorName} onChange={(e) => setCreditorName(e.target.value)} />
      </div>

      <div className="field">
        <label htmlFor="accountNumber">Account number (optional, as shown on your report)</label>
        <input id="accountNumber" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
      </div>

      <div className="field">
        <label>Why are you flagging this? (choose one — nothing is pre-selected)</label>
        <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontWeight: 400, marginBottom: '6px' }}>
          <input
            type="radio" name="reason" value="not_mine"
            checked={reason === 'not_mine'} onChange={(e) => setReason(e.target.value)}
          />
          I don't recognize this account
        </label>
        <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontWeight: 400 }}>
          <input
            type="radio" name="reason" value="not_authorized"
            checked={reason === 'not_authorized'} onChange={(e) => setReason(e.target.value)}
          />
          I didn't authorize this item
        </label>
      </div>

      {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{error}</p>}

      <button type="submit" className="btn btn-gold" disabled={submitting}>
        {submitting ? 'Flagging…' : 'Flag this item'}
      </button>
    </form>
  );
}
