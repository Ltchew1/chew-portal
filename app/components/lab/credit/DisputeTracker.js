// app/components/lab/credit/DisputeTracker.js
//
// The Dispute Tracker: a timeline of what the client has actually done
// with each letter they've generated, in their own words — mailed it,
// heard back, what the response was. Every field here is something the
// client reports; there is no bureau-response lookup anywhere in this
// component or the API routes behind it (see lib/disputeTracker.js).
//
// The "expected response by" note is informational only, computed from
// FCRA §611's 30-day bureau reinvestigation window — shown only for
// bureau/secondary-bureau entries, since furnishers and CFPB/FTC don't
// carry that same statutory deadline. It's phrased as information, not a
// countdown or an "OVERDUE" flag — recognition, not pressure.

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const STAGE_LABELS = { 1: 'Stage 1 · Bureau', 2: 'Stage 2 · Furnisher', 3: 'Stage 3 · Secondary bureau', 4: 'Stage 4 · Escalation' };
// This UI only ever writes 'preparing' | 'mailed' | 'response_received' |
// 'resolved' — 'awaiting_response' stays in the schema/CHECK for forward
// compatibility but isn't a state this flow transitions into; it's treated
// as a synonym for 'mailed' wherever it's read, in case a row ever has it.
const STATUS_LABELS = {
  preparing: 'Preparing to mail',
  mailed: 'Mailed — awaiting response',
  awaiting_response: 'Mailed — awaiting response',
  response_received: 'Response logged',
  resolved: 'Resolved',
};
const STATUS_BADGE_CLASS = {
  preparing: 'badge-neutral',
  mailed: 'badge-pending',
  awaiting_response: 'badge-pending',
  response_received: 'badge-success',
  resolved: 'badge-success',
};
const RESPONSE_TYPE_LABELS = {
  verified: 'Verified as accurate (no change)',
  updated: 'Updated / corrected',
  deleted: 'Deleted',
  no_response: "Never heard back",
};
const RESPONDING_RECIPIENT_TYPES = ['bureau', 'secondary_bureau'];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function expectedResponseBy(mailedDateIso) {
  const d = new Date(mailedDateIso);
  d.setDate(d.getDate() + 30);
  return d;
}

function UntrackedLetterRow({ letter, onStart, starting }) {
  return (
    <div className="flex-between" style={{ padding: '10px 0', borderBottom: '1px solid var(--divider)' }}>
      <div>
        <strong>{letter.recipientName}</strong>
        <div className="text-faint" style={{ fontSize: '0.8rem' }}>
          {STAGE_LABELS[letter.stage]} · Generated {formatDate(letter.generatedAt)}
        </div>
      </div>
      <button type="button" className="btn btn-outline btn-sm" disabled={starting} onClick={() => onStart(letter.id)}>
        {starting ? 'Starting…' : 'Start tracking'}
      </button>
    </div>
  );
}

function TrackerEntryCard({ entry, onUpdate }) {
  const [mailedDate, setMailedDate] = useState(entry.mailedDate ? entry.mailedDate.slice(0, 10) : todayIso());
  const [responseType, setResponseType] = useState('');
  const [responseDate, setResponseDate] = useState(todayIso());
  const [notes, setNotes] = useState(entry.clientNotes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function save(patch) {
    setSaving(true);
    setError(null);
    try {
      await onUpdate(entry.id, patch);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const canLogResponse = entry.status === 'mailed' || entry.status === 'awaiting_response';
  const expectedBy = entry.mailedDate && RESPONDING_RECIPIENT_TYPES.includes(entry.recipientType)
    ? expectedResponseBy(entry.mailedDate) : null;
  const windowPassed = expectedBy && new Date() > expectedBy && canLogResponse;

  return (
    <div className="card" style={{ marginBottom: '14px' }}>
      <div className="flex-between" style={{ marginBottom: '8px' }}>
        <div>
          <strong>{entry.recipientName}</strong>
          <div className="text-faint" style={{ fontSize: '0.8rem' }}>{STAGE_LABELS[entry.stage] ?? ''}</div>
        </div>
        <span className={`badge ${STATUS_BADGE_CLASS[entry.status]}`}>{STATUS_LABELS[entry.status]}</span>
      </div>

      {entry.status === 'preparing' && (
        <div style={{ marginTop: '10px' }}>
          <p className="text-faint" style={{ fontSize: '0.85rem', marginBottom: '10px' }}>
            No rush — log the date once you've actually mailed it.
          </p>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor={`mailed-${entry.id}`}>Date mailed</label>
              <input id={`mailed-${entry.id}`} type="date" value={mailedDate} onChange={(e) => setMailedDate(e.target.value)} max={todayIso()} />
            </div>
            <button type="button" className="btn btn-gold btn-sm" disabled={saving} onClick={() => save({ status: 'mailed', mailedDate })}>
              {saving ? 'Saving…' : "I've mailed this"}
            </button>
          </div>
        </div>
      )}

      {canLogResponse && (
        <div style={{ marginTop: '10px' }}>
          <p style={{ fontSize: '0.85rem', margin: '0 0 6px' }}>
            Mailed {formatDate(entry.mailedDate)}.
          </p>
          {expectedBy && (
            <p className="text-faint" style={{ fontSize: '0.8rem', margin: '0 0 10px' }}>
              {windowPassed
                ? `Under FCRA §611, a bureau generally has 30 days to respond (45 if you sent more information) — that window has passed. If you still haven't heard anything, `
                : `Under FCRA §611, a bureau generally has 30 days to respond (45 if you sent more information) — informationally, that's on or around ${formatDate(expectedBy.toISOString())}. `}
              {windowPassed && (
                <>a <Link href="/dashboard/lab/credit/letters">CFPB or FTC complaint</Link> citing "no response" is a reasonable next step whenever you're ready.</>
              )}
            </p>
          )}
          <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: '1.3fr 1fr', alignItems: 'end' }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor={`response-type-${entry.id}`}>What happened? (once you know)</label>
              <select id={`response-type-${entry.id}`} value={responseType} onChange={(e) => setResponseType(e.target.value)}>
                <option value="">Nothing to log yet…</option>
                {Object.entries(RESPONSE_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor={`response-date-${entry.id}`}>Date</label>
              <input id={`response-date-${entry.id}`} type="date" value={responseDate} onChange={(e) => setResponseDate(e.target.value)} max={todayIso()} />
            </div>
          </div>
          <div className="field">
            <label htmlFor={`notes-${entry.id}`}>Notes (optional, just for you)</label>
            <textarea id={`notes-${entry.id}`} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <button
            type="button"
            className="btn btn-gold btn-sm"
            disabled={saving || !responseType}
            onClick={() => save({ status: 'response_received', responseType, responseDate, clientNotes: notes })}
          >
            {saving ? 'Saving…' : 'Log this'}
          </button>
        </div>
      )}

      {entry.status === 'response_received' && (
        <div style={{ marginTop: '10px' }}>
          <p style={{ fontSize: '0.85rem', margin: '0 0 4px' }}>
            {RESPONSE_TYPE_LABELS[entry.responseType] ?? entry.responseType} — {formatDate(entry.responseDate)}
          </p>
          {entry.clientNotes && <p className="text-faint" style={{ fontSize: '0.82rem', margin: '0 0 10px' }}>{entry.clientNotes}</p>}
          <button type="button" className="btn btn-outline btn-sm" disabled={saving} onClick={() => save({ status: 'resolved' })}>
            {saving ? 'Saving…' : 'Mark resolved'}
          </button>
          {(entry.responseType === 'verified' || entry.responseType === 'no_response') && (
            <p className="text-faint" style={{ fontSize: '0.8rem', marginTop: '10px' }}>
              If this isn't the outcome you wanted, escalating with a{' '}
              <Link href="/dashboard/lab/credit/letters">follow-up letter or complaint</Link> is always an option — never
              required, just there if you want it.
            </p>
          )}
        </div>
      )}

      {entry.status === 'resolved' && (
        <p className="text-faint" style={{ fontSize: '0.85rem', marginTop: '10px' }}>
          Closed out — {RESPONSE_TYPE_LABELS[entry.responseType] ?? 'resolved'}
          {entry.responseDate ? `, ${formatDate(entry.responseDate)}` : ''}.
        </p>
      )}

      {error && <p style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '8px' }}>{error}</p>}
    </div>
  );
}

export default function DisputeTracker({ initialEntries, initialUntrackedLetters }) {
  const router = useRouter();
  const [entries, setEntries] = useState(initialEntries);
  const [untracked, setUntracked] = useState(initialUntrackedLetters);
  const [startingId, setStartingId] = useState(null);
  const [error, setError] = useState(null);

  async function handleStart(letterId) {
    setStartingId(letterId);
    setError(null);
    try {
      const res = await fetch('/api/lab/credit/tracker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ letterId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not start tracking that letter.');
      setEntries((prev) => [{ ...data.entry, stage: untracked.find((l) => l.id === letterId)?.stage }, ...prev]);
      setUntracked((prev) => prev.filter((l) => l.id !== letterId));
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setStartingId(null);
    }
  }

  async function handleUpdate(entryId, patch) {
    const res = await fetch(`/api/lab/credit/tracker/${entryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not save that update.');
    setEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, ...data.entry } : e)));
    router.refresh();
  }

  return (
    <>
      {untracked.length > 0 && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <h3>Letters you haven&apos;t started tracking</h3>
          <p className="text-faint" style={{ fontSize: '0.85rem', marginBottom: '4px' }}>
            Only shows up here once you&apos;ve actually generated a letter for it.
          </p>
          {untracked.map((letter) => (
            <UntrackedLetterRow key={letter.id} letter={letter} onStart={handleStart} starting={startingId === letter.id} />
          ))}
        </div>
      )}

      {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '12px' }}>{error}</p>}

      {entries.length === 0 ? (
        untracked.length === 0 && (
          <p className="text-faint" style={{ fontSize: '0.9rem' }}>
            Nothing to track yet — generate a letter first, then come back here to log what happens with it.
          </p>
        )
      ) : (
        entries.map((entry) => <TrackerEntryCard key={entry.id} entry={entry} onUpdate={handleUpdate} />)
      )}
    </>
  );
}
