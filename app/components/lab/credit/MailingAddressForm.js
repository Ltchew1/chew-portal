// app/components/lab/credit/MailingAddressForm.js
//
// The client's own return address — captured once, used as the return
// address block on every letter they generate. Required before the Letter
// Generator will produce anything (enforced server-side too, in
// app/api/lab/credit/letters/route.js — this form isn't the only guard).

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function MailingAddressForm({ initialAddress }) {
  const router = useRouter();
  const [line1, setLine1] = useState(initialAddress?.addressLine1 || '');
  const [line2, setLine2] = useState(initialAddress?.addressLine2 || '');
  const [city, setCity] = useState(initialAddress?.city || '');
  const [state, setState] = useState(initialAddress?.state || '');
  const [postalCode, setPostalCode] = useState(initialAddress?.postalCode || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/lab/credit/mailing-address', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addressLine1: line1, addressLine2: line2, city, state, postalCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save your address.');
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card" style={{ marginBottom: '20px' }}>
      <h3>Your return address</h3>
      <p className="text-faint" style={{ fontSize: '0.85rem', marginBottom: '16px' }}>
        Every letter needs a real return address — this is where a bureau or creditor would write back to
        you. It's used on your letters only; it's never sent anywhere by us.
      </p>

      <div className="field">
        <label htmlFor="addr-line1">Address line 1</label>
        <input id="addr-line1" value={line1} onChange={(e) => setLine1(e.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor="addr-line2">Address line 2 (optional)</label>
        <input id="addr-line2" value={line2} onChange={(e) => setLine2(e.target.value)} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px' }}>
        <div className="field">
          <label htmlFor="addr-city">City</label>
          <input id="addr-city" value={city} onChange={(e) => setCity(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="addr-state">State</label>
          <input id="addr-state" value={state} onChange={(e) => setState(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="addr-zip">ZIP</label>
          <input id="addr-zip" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} required />
        </div>
      </div>

      {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{error}</p>}
      {saved && !error && <p className="text-faint" style={{ fontSize: '0.85rem' }}>Saved.</p>}

      <button type="submit" className="btn btn-gold" disabled={submitting}>
        {submitting ? 'Saving…' : 'Save address'}
      </button>
    </form>
  );
}
