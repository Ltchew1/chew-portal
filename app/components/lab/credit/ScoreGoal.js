// app/components/lab/credit/ScoreGoal.js
//
// The Score Path Engine's UI: set a target score, log what you've actually
// seen, see the gap. Every score here is something the client typed in —
// CHEW has no bureau connection (see lib/creditScore.js) — so this
// component never claims to show "your score," only "the score you told
// CHEW about."

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const BUREAU_OPTIONS = [
  { value: 'overall', label: 'Overall / not sure which bureau' },
  { value: 'equifax', label: 'Equifax' },
  { value: 'experian', label: 'Experian' },
  { value: 'transunion', label: 'TransUnion' },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function ScoreGoal({ initialGoal, initialSnapshots, initialScorePath, initialScoreProvenance }) {
  const router = useRouter();
  const [goal, setGoal] = useState(initialGoal);
  const [snapshots, setSnapshots] = useState(initialSnapshots);
  const [scorePath, setScorePath] = useState(initialScorePath);
  const [scoreProvenance, setScoreProvenance] = useState(initialScoreProvenance);
  const [targetInput, setTargetInput] = useState(goal?.targetValue ?? '');
  const [scoreInput, setScoreInput] = useState('');
  const [bureau, setBureau] = useState('overall');
  const [savingGoal, setSavingGoal] = useState(false);
  const [savingScore, setSavingScore] = useState(false);
  const [error, setError] = useState(null);

  async function refreshPath() {
    const res = await fetch('/api/lab/credit/score');
    const data = await res.json();
    setSnapshots(data.snapshots);
    setGoal(data.goal);
    setScoreProvenance(data.scoreProvenance);
    router.refresh();
  }

  async function handleSetGoal(e) {
    e.preventDefault();
    const targetScore = Number(targetInput);
    if (!Number.isInteger(targetScore) || targetScore < 300 || targetScore > 900) {
      setError('Enter a whole number target score between 300 and 900.');
      return;
    }
    setSavingGoal(true);
    setError(null);
    try {
      const res = await fetch('/api/lab/credit/score/goal', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetScore }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save that target.');
      setGoal(data.goal);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingGoal(false);
    }
  }

  async function handleLogScore(e) {
    e.preventDefault();
    const score = Number(scoreInput);
    if (!Number.isInteger(score) || score < 300 || score > 900) {
      setError('Enter a whole number score between 300 and 900.');
      return;
    }
    setSavingScore(true);
    setError(null);
    try {
      const res = await fetch('/api/lab/credit/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bureau, score, reportedDate: todayIso() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not log that score.');
      setScoreInput('');
      await refreshPath();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingScore(false);
    }
  }

  const latest = snapshots[0];

  return (
    <div className="card" style={{ marginTop: '20px' }}>
      <h3>Score &amp; goal</h3>
      <p className="text-faint" style={{ fontSize: '0.85rem', marginBottom: '16px' }}>
        Whatever score you&apos;ve seen — on your own report, a card app, wherever — log it here. CHEW never pulls
        this itself; it only knows what you tell it.
      </p>

      {scorePath ? (
        <div style={{ marginBottom: '18px' }}>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '14px' }}>
            <div>
              <span className="text-faint" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Target</span>
              <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{scorePath.target}</div>
            </div>
            <div>
              <span className="text-faint" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Current</span>
              <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{scorePath.current}</div>
            </div>
            <div>
              <span className="text-faint" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Gap</span>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: scorePath.gap <= 0 ? 'var(--success)' : 'var(--gold-light)' }}>
                {scorePath.gap <= 0 ? 'Met' : scorePath.gap}
              </div>
            </div>
          </div>
          <p className="text-faint" style={{ fontSize: '0.78rem', marginBottom: '12px' }}>
            As of {new Date(scorePath.asOfDate).toLocaleDateString()}. Reassessment: {scorePath.reassessmentTrigger}
          </p>
          <details>
            <summary style={{ cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>What&apos;s behind this gap</summary>
            <div style={{ marginTop: '10px', display: 'grid', gap: '12px', fontSize: '0.83rem' }}>
              <div>
                <strong>You control</strong>
                <ul style={{ paddingLeft: '18px', marginTop: '4px' }}>
                  {scorePath.controllableFactors.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              </div>
              <div>
                <strong>Time-dependent</strong>
                <ul style={{ paddingLeft: '18px', marginTop: '4px' }}>
                  {scorePath.timeDependentFactors.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              </div>
              <div>
                <strong>Unknown to CHEW</strong>
                <ul style={{ paddingLeft: '18px', marginTop: '4px' }}>
                  {scorePath.unknownFactors.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              </div>
            </div>
          </details>
        </div>
      ) : (
        <p className="text-faint" style={{ fontSize: '0.85rem', marginBottom: '16px' }}>
          {goal ? 'Log a score below to see your gap toward your target.' : 'Set a target and log a score to see your gap.'}
        </p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
        <form onSubmit={handleSetGoal}>
          <div className="field">
            <label htmlFor="target-score">{goal ? 'Update target score' : 'Set a target score'}</label>
            <input
              id="target-score" type="number" min="300" max="900"
              value={targetInput} onChange={(e) => setTargetInput(e.target.value)}
              placeholder="e.g. 750"
            />
          </div>
          <button type="submit" className="btn btn-outline btn-sm" disabled={savingGoal}>
            {savingGoal ? 'Saving…' : goal ? 'Update target' : 'Set target'}
          </button>
        </form>

        <form onSubmit={handleLogScore}>
          <div className="field">
            <label htmlFor="log-score">Log a score you&apos;ve seen</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select value={bureau} onChange={(e) => setBureau(e.target.value)} style={{ flex: '0 0 auto' }}>
                {BUREAU_OPTIONS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
              <input
                id="log-score" type="number" min="300" max="900"
                value={scoreInput} onChange={(e) => setScoreInput(e.target.value)}
                placeholder="Score"
              />
            </div>
          </div>
          <button type="submit" className="btn btn-outline btn-sm" disabled={savingScore}>
            {savingScore ? 'Logging…' : 'Log score'}
          </button>
        </form>
      </div>

      {latest && (
        <p className="text-faint" style={{ fontSize: '0.78rem', marginTop: '14px' }}>
          Last logged: {latest.score} ({latest.bureau ?? 'overall'}) on {new Date(latest.reportedDate).toLocaleDateString()}
          {scoreProvenance?.freshness === 'needs_update' && (
            <> · <span style={{ color: 'var(--gold-light)', fontWeight: 600 }}>{scoreProvenance.freshnessLabel}</span></>
          )}
        </p>
      )}

      {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginTop: '12px' }}>{error}</p>}
    </div>
  );
}
