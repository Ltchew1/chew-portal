// app/components/lab/AskChew.js
//
// The natural-language entry point to The Lab home. Routes to the right
// page via lib/askChew.js's deterministic matcher (POST /api/home/ask) —
// never a generated answer, since nothing here is an LLM call (see that
// file's comment for why). A miss is shown honestly as a miss, with a
// manual way forward, rather than a vague non-answer dressed up as
// understanding.

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { IconMessage, IconChevronRight } from '../icons';

const EXAMPLES = [
  "I don't recognize an account on my report",
  'I want a 750 score',
  'I mailed a letter — what now?',
];

export default function AskChew() {
  const [text, setText] = useState('');
  const [asking, setAsking] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim() || asking) return;
    setAsking(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/home/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not process that.');
      setResult(data.result);
    } catch (err) {
      setError(err.message);
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: '20px' }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 260px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <IconMessage />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ask CHEW — what's on your mind?"
            style={{ flex: 1, background: 'transparent', border: 'none', fontSize: '0.95rem', outline: 'none' }}
          />
        </div>
        <button type="submit" className="btn btn-gold btn-sm" disabled={asking || !text.trim()}>
          {asking ? 'Thinking…' : 'Ask'}
        </button>
      </form>

      {!result && !error && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              className="btn btn-outline btn-sm"
              style={{ fontSize: '0.78rem' }}
              onClick={() => setText(ex)}
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginTop: '12px' }}>{error}</p>}

      {result && (
        <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--divider)' }}>
          {result.dispatched && result.dispatchType === 'goal_set' ? (
            <p style={{ fontSize: '0.88rem' }}>
              Done — set your credit score target to <strong>{result.targetScore}</strong>. CHEW&apos;s already using
              it — see your{' '}
              <Link href="/dashboard/lab/credit">updated plan in Credit</Link>.
            </p>
          ) : result.matched ? (
            result.roomLive ? (
              <Link href={result.href} className="flex-between" style={{ color: 'inherit' }}>
                <span>
                  <strong>{result.label}</strong>
                  <p className="text-faint" style={{ fontSize: '0.85rem', margin: '4px 0 0' }}>{result.blurb}</p>
                </span>
                <IconChevronRight />
              </Link>
            ) : (
              <p style={{ fontSize: '0.88rem' }}>
                CHEW&apos;s deeper <strong>{result.roomName}</strong> tools are still being built. {result.message} In
                the meantime, your <Link href="/dashboard/lab/credit">Credit room</Link> is fully available.
              </p>
            )
          ) : (
            <p style={{ fontSize: '0.88rem' }}>
              CHEW didn&apos;t find an exact match for that yet — Ask CHEW only routes to places already built in
              your Lab. Your <Link href="/dashboard/lab/credit">Credit room</Link> is the place to start.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
