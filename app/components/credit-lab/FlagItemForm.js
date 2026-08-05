// app/components/credit-lab/FlagItemForm.js — Layer 4b: Self-Flagging Tool.
//
// Creates a dispute_items row via app/api/credit-lab/dispute-items/route.js.
// The reason radios have no default checked value — the client must
// actively pick one; nothing here pre-selects or suggests a reason
// (client-decision enforcement). Flagging an item is a separate, earlier
// step from attesting to it (see AttestationGate) — two deliberate actions,
// not one click, on purpose.

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const BUREAUS = [
  { value: 'equifax', label: 'Equifax' },
  { value: 'experian', label: 'Experian' },
  { value: 'transunion', label: 'TransUnion' },
];

export default function FlagItemForm() {
  const router = useRouter();
  const [bureau, setBureau] = useState('');
  const [creditorName, setCreditorName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [reason, setReason] = useState('');
  const [clientNotes, setClientNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [justFlagged, setJustFlagged] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!bureau || !creditorName.trim() || !reason) {
      setError('Bureau, creditor name, and a reason are all required.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setJustFlagged(false);
    try {
      const res = await fetch('/api/credit-lab/dispute-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bureau, creditorName, accountNumber, reason, clientNotes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not flag this item.');
      setBureau('');
      setCreditorName('');
      setAccountNumber('');
      setReason('');
      setClientNotes('');
      setJustFlagged(true);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card" style={{ marginTop: '20px' }}>
      <h3>Flag an item</h3>
      <p className="text-faint" style={{ fontSize: '0.85rem', marginBottom: '16px' }}>
        Found something on your report while going through the walkthrough that you don&apos;t
        recognize or didn&apos;t authorize? Enter it exactly as it appears below, then attest to
        it in the list above once it&apos;s added.
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
          I don&apos;t recognize this account
        </label>
        <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontWeight: 400 }}>
          <input
            type="radio" name="reason" value="not_authorized"
            checked={reason === 'not_authorized'} onChange={(e) => setReason(e.target.value)}
          />
          I didn&apos;t authorize this item
        </label>
      </div>

      <div className="field">
        <label htmlFor="clientNotes">Notes (optional, just for you)</label>
        <textarea
          id="clientNotes" rows={2} value={clientNotes}
          onChange={(e) => setClientNotes(e.target.value)}
        />
      </div>

      {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{error}</p>}
      {justFlagged && !error && (
        <p className="text-faint" style={{ fontSize: '0.85rem' }}>
          Added — attest to it in the list above to make it official.
        </p>
      )}

      <button type="submit" className="btn btn-gold" disabled={submitting}>
        {submitting ? 'Flagging…' : 'Flag this item'}
      </button>
    </form>
  );
}
