// app/components/lab/credit/EvidenceVault.js
//
// Client-owned recordkeeping — log what evidence you have, not upload the
// file itself (see lib/evidenceVault.js for why: no blob-storage provider
// is wired into this app). Honest about that limitation right in the UI
// copy, not just in code comments.

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const CATEGORY_LABELS = {
  credit_report: 'Credit report',
  screenshot: 'Screenshot',
  mailing_receipt: 'Mailing receipt',
  certified_mail: 'Certified mail record',
  response: 'Response received',
  statement: 'Statement',
  contract: 'Contract',
  license: 'License',
  business_document: 'Business document',
  school_document: 'School document',
  certification: 'Certification',
  financial_document: 'Financial document',
  client_note: 'Note',
  other: 'Other',
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function EvidenceVault({ initialRecords }) {
  const router = useRouter();
  const [records, setRecords] = useState(initialRecords);
  const [category, setCategory] = useState('mailing_receipt');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [occurredDate, setOccurredDate] = useState(todayIso());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) {
      setError('Give it a short title.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/lab/credit/evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, title, description, occurredDate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not log that.');
      setRecords((prev) => [data.record, ...prev]);
      setTitle('');
      setDescription('');
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    try {
      const res = await fetch(`/api/lab/credit/evidence/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Could not remove that record.');
      setRecords((prev) => prev.filter((r) => r.id !== id));
      router.refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <div className="card" style={{ marginBottom: '20px' }}>
        <h3>Log a piece of evidence</h3>
        <p className="text-faint" style={{ fontSize: '0.85rem', marginBottom: '16px' }}>
          This is a record of what you have and where it pertains to — not a file upload. Keep the
          actual document itself (printed, in your email, wherever) and log it here so you have one
          list of everything.
        </p>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="field">
              <label htmlFor="ev-category">Type</label>
              <select id="ev-category" value={category} onChange={(e) => setCategory(e.target.value)}>
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="ev-date">Date it pertains to</label>
              <input id="ev-date" type="date" value={occurredDate} onChange={(e) => setOccurredDate(e.target.value)} max={todayIso()} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="ev-title">Title</label>
            <input id="ev-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Certified mail receipt — Experian letter" />
          </div>
          <div className="field">
            <label htmlFor="ev-desc">Notes (optional)</label>
            <textarea id="ev-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Where you actually keep it, tracking number, etc." />
          </div>
          {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{error}</p>}
          <button type="submit" className="btn btn-gold btn-sm" disabled={submitting}>
            {submitting ? 'Logging…' : 'Log it'}
          </button>
        </form>
      </div>

      {records.length === 0 ? (
        <p className="text-faint" style={{ fontSize: '0.9rem' }}>Nothing logged yet.</p>
      ) : (
        <div className="card">
          <h3 style={{ marginBottom: '12px' }}>Your evidence log</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {records.map((r) => (
              <div key={r.id} className="flex-between" style={{ paddingBottom: '10px', borderBottom: '1px solid var(--divider)' }}>
                <div>
                  <span className="badge badge-neutral" style={{ marginRight: '8px' }}>{CATEGORY_LABELS[r.category]}</span>
                  <strong style={{ fontSize: '0.9rem' }}>{r.title}</strong>
                  {r.occurredDate && <span className="text-faint" style={{ fontSize: '0.8rem' }}> — {new Date(r.occurredDate).toLocaleDateString()}</span>}
                  {r.description && <p className="text-faint" style={{ fontSize: '0.82rem', margin: '4px 0 0' }}>{r.description}</p>}
                </div>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => handleDelete(r.id)}>Remove</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
