// app/components/lab/credit/LetterGenerator.js
//
// The interactive letter-generation flow: pick who to write to, pick which
// attested items, generate, preview, download. The actual "no attestation
// = no generation" enforcement lives server-side (lib/letters.js calls
// assertItemsAttested() before composing anything) — this component only
// ever offers items that are already attested, as a UX convenience, never
// as the real gate.
//
// Three targets, matching the escalation ladder: a bureau (primary or
// secondary — this component figures out which from the item's own
// `bureau` field, so the client just picks "which bureau" rather than
// learning the stage-3-vs-stage-1 distinction), a furnisher (the creditor
// itself, grouped by name), or CFPB/FTC (escalating a prior letter).

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import StandingDisclosures from './StandingDisclosures';
import { BUREAU_LABELS, PRIMARY_BUREAUS, SECONDARY_BUREAUS } from '../../../../lib/creditAddresses';
import { ESCALATION_FAILURE_CITATIONS } from '../../../../lib/fcraCitations';

const REASON_LABELS = { not_mine: "Don't recognize", not_authorized: "Didn't authorize" };
const TARGETS = [
  { id: 'bureau', label: 'A bureau' },
  { id: 'furnisher', label: 'The creditor directly' },
  { id: 'escalate', label: 'CFPB / FTC' },
];

function groupBy(items, keyFn) {
  const groups = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}

function downloadTextFile(filename, content) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function LetterPreview({ letter, onDownload }) {
  return (
    <div className="card" style={{ marginTop: '20px' }}>
      <div className="flex-between" style={{ marginBottom: '12px' }}>
        <h3 style={{ margin: 0 }}>Your letter is ready</h3>
        <button type="button" className="btn btn-gold btn-glow" onClick={onDownload}>
          Download
        </button>
      </div>
      <p className="text-faint" style={{ fontSize: '0.82rem', marginBottom: '14px' }}>
        Download it, print it, sign it by hand, and mail it yourself — certified mail with return
        receipt is worth the few extra dollars, since it starts the clock with proof of when it arrived.
      </p>
      <pre
        style={{
          whiteSpace: 'pre-wrap',
          fontFamily: 'inherit',
          fontSize: '0.85rem',
          lineHeight: 1.7,
          background: 'var(--black-elev)',
          border: '1px solid var(--panel-border)',
          borderRadius: 'var(--radius)',
          padding: '20px',
          maxHeight: '420px',
          overflowY: 'auto',
        }}
      >
        {letter.content}
      </pre>
    </div>
  );
}

export default function LetterGenerator({ attestedItems, pastLetters }) {
  const router = useRouter();
  const [target, setTarget] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [furnisherAddress, setFurnisherAddress] = useState({ line1: '', line2: '', city: '', state: '', postalCode: '' });
  const [priorLetterId, setPriorLetterId] = useState('');
  const [failureReason, setFailureReason] = useState('');
  const [failureDetail, setFailureDetail] = useState('');
  const [escalateTo, setEscalateTo] = useState('cfpb');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [letter, setLetter] = useState(null);

  const byBureau = groupBy(attestedItems, (i) => i.bureau);
  const byCreditor = groupBy(attestedItems, (i) => i.creditor_name);
  const escalatable = pastLetters.filter((l) => l.stage < 4);

  function toggleId(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function resetSelection() {
    setSelectedIds([]);
    setLetter(null);
    setError(null);
  }

  async function handleGenerateDispute(recipientType) {
    if (selectedIds.length === 0) {
      setError('Select at least one item.');
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/lab/credit/letters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disputeItemIds: selectedIds,
          recipientType,
          recipientAddress: recipientType === 'furnisher' ? furnisherAddress : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not generate that letter.');
      setLetter(data.letter);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleGenerateEscalation() {
    if (!priorLetterId || !failureReason) {
      setError('Choose which letter this follows up on, and what happened.');
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/lab/credit/letters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'escalation',
          priorLetterId: Number(priorLetterId),
          recipientType: escalateTo,
          failureReason,
          failureDetail,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not generate that escalation.');
      setLetter(data.letter);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  function handleDownload() {
    downloadTextFile(`chew-lab-letter-${letter.id}.txt`, letter.content);
    fetch(`/api/lab/credit/letters/${letter.id}?download=1`).catch(() => {});
  }

  if (letter) {
    return (
      <>
        <LetterPreview letter={letter} onDownload={handleDownload} />
        <button
          type="button"
          className="btn btn-outline btn-sm"
          style={{ marginTop: '14px' }}
          onClick={() => {
            setTarget(null);
            resetSelection();
          }}
        >
          Generate another letter
        </button>
      </>
    );
  }

  return (
    <div className="card" style={{ marginTop: '20px' }}>
      <h3>Generate a letter</h3>

      {!target && (
        <>
          <p className="text-faint" style={{ fontSize: '0.85rem', marginBottom: '16px' }}>
            Who do you want to write to?
          </p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {TARGETS.map((t) => (
              <button key={t.id} type="button" className="btn btn-outline" onClick={() => setTarget(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
        </>
      )}

      {target === 'bureau' && (
        <div>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => { setTarget(null); resetSelection(); }}>
            ← Back
          </button>
          <p style={{ margin: '16px 0 10px', fontSize: '0.85rem', color: 'var(--text-faint)' }}>
            Pick a bureau — a letter goes to one bureau at a time. Only items attested for that bureau
            are selectable.
          </p>
          {[...byBureau.entries()].length === 0 && (
            <p className="text-faint" style={{ fontSize: '0.85rem' }}>
              No attested items yet. Flag and attest an item first.
            </p>
          )}
          {[...byBureau.entries()].map(([bureau, items]) => (
            <div key={bureau} style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--divider)' }}>
              <strong style={{ display: 'block', marginBottom: '8px' }}>
                {BUREAU_LABELS[bureau]}
                {SECONDARY_BUREAUS.includes(bureau) && (
                  <span className="badge badge-neutral" style={{ marginLeft: '8px' }}>Secondary bureau</span>
                )}
              </strong>
              {items.map((item) => (
                <label key={item.id} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '0.85rem', marginBottom: '6px' }}>
                  <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleId(item.id)} style={{ marginTop: '3px' }} />
                  <span>
                    {item.creditor_name}
                    <span className="text-faint"> — {REASON_LABELS[item.reason]}{item.status === 'letter_generated' ? ' · letter already generated for this item' : ''}</span>
                  </span>
                </label>
              ))}
              <button
                type="button"
                className="btn btn-gold btn-sm"
                style={{ marginTop: '8px' }}
                disabled={generating || selectedIds.length === 0 || !selectedIds.every((id) => items.some((i) => i.id === id))}
                onClick={() => handleGenerateDispute(PRIMARY_BUREAUS.includes(bureau) ? 'bureau' : 'secondary_bureau')}
              >
                {generating ? 'Generating…' : `Generate letter to ${BUREAU_LABELS[bureau]}`}
              </button>
            </div>
          ))}
        </div>
      )}

      {target === 'furnisher' && (
        <div>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => { setTarget(null); resetSelection(); }}>
            ← Back
          </button>
          <p style={{ margin: '16px 0 10px', fontSize: '0.85rem', color: 'var(--text-faint)' }}>
            Pick the creditor — furnisher letters go directly to the company that reported the item, not
            a bureau. You'll need their mailing address (check your report or a past statement).
          </p>
          {[...byCreditor.entries()].map(([creditor, items]) => (
            <div key={creditor} style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--divider)' }}>
              <strong style={{ display: 'block', marginBottom: '8px' }}>{creditor}</strong>
              {items.map((item) => (
                <label key={item.id} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '0.85rem', marginBottom: '6px' }}>
                  <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleId(item.id)} style={{ marginTop: '3px' }} />
                  <span>{BUREAU_LABELS[item.bureau]} · {REASON_LABELS[item.reason]}</span>
                </label>
              ))}
              {selectedIds.some((id) => items.some((i) => i.id === id)) && (
                <div style={{ marginTop: '10px' }}>
                  <div className="field">
                    <label>Their mailing address</label>
                    <input placeholder="Address line 1" value={furnisherAddress.line1} onChange={(e) => setFurnisherAddress((a) => ({ ...a, line1: e.target.value }))} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '10px' }}>
                    <input placeholder="City" value={furnisherAddress.city} onChange={(e) => setFurnisherAddress((a) => ({ ...a, city: e.target.value }))} />
                    <input placeholder="State" value={furnisherAddress.state} onChange={(e) => setFurnisherAddress((a) => ({ ...a, state: e.target.value }))} />
                    <input placeholder="ZIP" value={furnisherAddress.postalCode} onChange={(e) => setFurnisherAddress((a) => ({ ...a, postalCode: e.target.value }))} />
                  </div>
                  <button
                    type="button"
                    className="btn btn-gold btn-sm"
                    style={{ marginTop: '10px' }}
                    disabled={generating}
                    onClick={() => handleGenerateDispute('furnisher')}
                  >
                    {generating ? 'Generating…' : `Generate letter to ${creditor}`}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {target === 'escalate' && (
        <div>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => { setTarget(null); resetSelection(); }}>
            ← Back
          </button>
          {escalatable.length === 0 ? (
            <p className="text-faint" style={{ fontSize: '0.85rem', marginTop: '16px' }}>
              Escalation follows up on a letter you've already generated and mailed — generate a bureau
              or furnisher letter first.
            </p>
          ) : (
            <>
              <div className="field" style={{ marginTop: '16px' }}>
                <label htmlFor="prior-letter">Which letter is this following up on?</label>
                <select id="prior-letter" value={priorLetterId} onChange={(e) => setPriorLetterId(e.target.value)}>
                  <option value="">Select a letter…</option>
                  {escalatable.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.recipientName} — {new Date(l.generatedAt).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="failure-reason">What happened?</label>
                <select id="failure-reason" value={failureReason} onChange={(e) => setFailureReason(e.target.value)}>
                  <option value="">Select…</option>
                  {Object.entries(ESCALATION_FAILURE_CITATIONS).map(([key, { label }]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="failure-detail">Anything else worth including? (optional)</label>
                <textarea id="failure-detail" rows={2} value={failureDetail} onChange={(e) => setFailureDetail(e.target.value)} />
              </div>
              <div className="field">
                <label>Escalate to</label>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <label style={{ display: 'flex', gap: '6px', alignItems: 'center', fontWeight: 400 }}>
                    <input type="radio" name="escalate-to" checked={escalateTo === 'cfpb'} onChange={() => setEscalateTo('cfpb')} />
                    CFPB
                  </label>
                  <label style={{ display: 'flex', gap: '6px', alignItems: 'center', fontWeight: 400 }}>
                    <input type="radio" name="escalate-to" checked={escalateTo === 'ftc'} onChange={() => setEscalateTo('ftc')} />
                    FTC
                  </label>
                </div>
                <p className="text-faint" style={{ fontSize: '0.78rem', marginTop: '6px' }}>
                  {escalateTo === 'cfpb'
                    ? 'CFPB accepts this by mail or, faster, at consumerfinance.gov/complaint.'
                    : 'The FTC takes complaints online only, at reportfraud.ftc.gov — this gives you the narrative to paste in there.'}
                </p>
              </div>
              <button type="button" className="btn btn-gold" disabled={generating} onClick={handleGenerateEscalation}>
                {generating ? 'Generating…' : 'Generate escalation'}
              </button>
            </>
          )}
        </div>
      )}

      {target && (
        <div style={{ marginTop: '20px' }}>
          <StandingDisclosures variant="pre-generation" />
        </div>
      )}

      {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginTop: '12px' }}>{error}</p>}
    </div>
  );
}
