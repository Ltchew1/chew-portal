// app/components/lab/HiddenLeverageCard.js
//
// Hidden Leverage — the first narrow proof of the concept, not the final
// form: a real, already-created resource sitting unused. Today that's
// exactly one thing (see lib/homeIntelligence.js's undownloadedLetters
// comment) — a generated letter nobody has downloaded yet. Nothing here
// implies the letter guarantees an outcome; it only states what's real
// (you made this, it's sitting there) and the smallest real next action
// (download it — the same GET /api/lab/credit/letters/[id]?download=1
// route LetterGenerator.js already uses for a just-generated letter,
// reused here for a past one instead of inventing a new endpoint).
//
// ONE-SHOT, keyed on real identity: sessionStorage remembers the exact
// sorted set of undownloaded letter ids already shown in this browser
// tab (same pattern as SessionChoreography.js's eventKey) — an ordinary
// revisit with the same set renders the settled state with no entrance
// motion; a genuinely new undownloaded letter changes the key and plays
// again. Reduced motion collapses the entrance animation's duration via
// the existing global media query (globals.css) — the content itself
// never depends on the animation running.

'use client';

import { useEffect, useState } from 'react';

const STAGE_LABELS = { 1: 'Stage 1 · Bureau', 2: 'Stage 2 · Furnisher', 3: 'Stage 3 · Secondary bureau', 4: 'Stage 4 · Escalation' };

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function filenameFromResponse(res, letterId) {
  const fromHeader = res.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1];
  if (fromHeader) return fromHeader;
  const isPdf = res.headers.get('content-type')?.includes('pdf');
  return `chew-lab-letter-${letterId}.${isPdf ? 'pdf' : 'txt'}`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString();
}

function LetterRow({ letter, onDownloaded }) {
  const [state, setState] = useState('idle'); // idle | downloading | done | error

  async function handleDownload() {
    setState('downloading');
    try {
      const res = await fetch(`/api/lab/credit/letters/${letter.id}?download=1`);
      if (!res.ok) throw new Error('request failed');
      const blob = await res.blob();
      downloadBlob(filenameFromResponse(res, letter.id), blob);
      setState('done');
      onDownloaded(letter.id);
    } catch {
      setState('error');
    }
  }

  return (
    <div className="leverage-item">
      <div>
        <strong className="leverage-item-title">{letter.recipientName}</strong>
        <span className="leverage-item-meta">
          {STAGE_LABELS[letter.stage] ?? `Stage ${letter.stage}`} · Generated {formatDate(letter.generatedAt)} · Ready to download
        </span>
      </div>
      <button
        type="button"
        className="btn btn-gold btn-sm"
        onClick={handleDownload}
        disabled={state === 'downloading' || state === 'done'}
      >
        {state === 'done' ? 'Downloaded' : state === 'downloading' ? 'Downloading…' : 'Download this letter'}
      </button>
      {state === 'error' && (
        <p className="leverage-item-error">Couldn&apos;t download just now — try again from your Letters page.</p>
      )}
    </div>
  );
}

export default function HiddenLeverageCard({ letters = [] }) {
  const [entering, setEntering] = useState(false);
  const [downloadedIds, setDownloadedIds] = useState(() => new Set());

  const visibleLetters = letters.filter((l) => !downloadedIds.has(l.id));

  // Mount-only: decide once whether this exact real set of undownloaded
  // letters has already played its entrance in this browser tab.
  useEffect(() => {
    if (letters.length === 0) return;
    if (typeof window === 'undefined') return;
    const key = `chew-hidden-leverage:${[...letters].map((l) => l.id).sort((a, b) => a - b).join(',')}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, '1');
    } catch {
      // Private-browsing/storage-blocked: fail toward "don't replay."
      return;
    }
    setEntering(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (visibleLetters.length === 0) return null;

  return (
    <div className={`card leverage-card${entering ? ' leverage-card--entering' : ''}`} style={{ marginBottom: '20px' }}>
      <div className="flex-between weather-card-head">
        <span className="weather-card-eyebrow">HIDDEN LEVERAGE</span>
      </div>
      <p className="weather-detail">
        {visibleLetters.length === 1
          ? "You already created this — it just hasn't been downloaded yet."
          : `You already created these ${visibleLetters.length} letters — they haven't been downloaded yet.`}
      </p>
      <div className="leverage-list">
        {visibleLetters.map((letter) => (
          <LetterRow
            key={letter.id}
            letter={letter}
            onDownloaded={(id) => setDownloadedIds((prev) => new Set(prev).add(id))}
          />
        ))}
      </div>
      <p className="text-faint leverage-disclaimer">
        Downloading doesn&apos;t send anything on its own — you still print, sign, and mail it yourself.
      </p>
    </div>
  );
}
