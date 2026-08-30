// app/components/AskChewBar.js
//
// The topbar's search-shaped entry point — same real backend as
// app/components/lab/AskChew.js (POST /api/home/ask, lib/askChew.js's
// deterministic keyword router; never a generated answer). A second
// presentation of one real capability, not a second capability.

'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

function SearchIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="16" height="16" {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

export default function AskChewBar() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [asking, setAsking] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    function onClickAway(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim() || asking) return;
    setAsking(true);
    setError(null);
    setResult(null);
    setOpen(true);
    try {
      const res = await fetch('/api/home/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not process that.');
      setResult(data.result);
      if (data.result?.dispatched) router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="topbar-search-wrap" ref={wrapRef}>
      <form onSubmit={handleSubmit} className="topbar-search">
        <SearchIcon />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => result && setOpen(true)}
          placeholder="Ask CHEW anything…"
          aria-label="Ask CHEW"
        />
        {asking && <span className="topbar-search-status">Thinking…</span>}
      </form>

      {open && (result || error) && (
        <div className="topbar-dropdown topbar-dropdown--search" role="status">
          {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{error}</p>}
          {result && (
            result.dispatched && result.dispatchType === 'goal_set' ? (
              <p style={{ fontSize: '0.88rem' }}>
                Done — set your credit score target to <strong>{result.targetScore}</strong>.{' '}
                <Link href="/dashboard/lab/credit" onClick={() => setOpen(false)}>View your updated plan</Link>
              </p>
            ) : result.matched ? (
              result.roomLive ? (
                <Link href={result.href} className="topbar-dropdown-item" onClick={() => setOpen(false)}>
                  <strong>{result.label}</strong>
                  <span className="text-faint">{result.blurb}</span>
                </Link>
              ) : (
                <p style={{ fontSize: '0.88rem' }}>
                  CHEW&apos;s deeper <strong>{result.roomName}</strong> tools are still being built. {result.message}
                </p>
              )
            ) : (
              <p style={{ fontSize: '0.88rem' }}>
                CHEW didn&apos;t find an exact match yet — it only routes to places already built.{' '}
                <Link href="/dashboard/lab/credit" onClick={() => setOpen(false)}>Start in Credit</Link>
              </p>
            )
          )}
        </div>
      )}
    </div>
  );
}
