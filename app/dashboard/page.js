// app/dashboard/page.js — Dashboard v1 (CHEW Rebuild Kit, Section 4)
//
// Readiness Score, active goals, and action items are meant to come from a
// client's application record — but chew-portal has no database connection
// or Clerk-to-application link yet (separate project, separate database).
// This ships the real v1 layout now with honest pending states rather than
// fabricated numbers, so wiring real data later is a props change, not a
// rebuild.

import { currentUser } from '@clerk/nextjs/server';
import Link from 'next/link';
import { IconShield, IconTrendUp, IconClipboard, IconChevronRight } from '../components/icons';

const STARTER_TASKS = [
  'Complete your Financial Blueprint intake',
  'Book your strategy session',
  'Review your program agreement',
];

export default async function DashboardPage() {
  const user = await currentUser();
  const firstName = user?.firstName || 'there';

  return (
    <>
      <span className="page-eyebrow">Dashboard</span>
      <h1>Welcome back, {firstName}.</h1>
      <p className="text-faint" style={{ maxWidth: '60ch' }}>
        Your readiness, goals, and next actions will live here as your CHEW strategy comes together.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px', marginTop: '28px' }}>
        <div className="card">
          <div className="card-icon"><IconShield /></div>
          <h3>Readiness Score</h3>
          <p style={{ fontSize: '0.88rem' }}>
            Calculated after your Financial Blueprint Assessment is reviewed.
          </p>
          <span className="badge badge-pending">Not yet available</span>
        </div>

        <div className="card">
          <div className="card-icon"><IconTrendUp /></div>
          <h3>Active Goals</h3>
          <p style={{ fontSize: '0.88rem' }}>
            Up to three goals, drawn from your application answers, will appear here once set with your strategist.
          </p>
          <span className="badge badge-pending">Not yet set</span>
        </div>
      </div>

      <h2 style={{ marginTop: '36px' }}>Getting started</h2>
      <p className="text-faint" style={{ maxWidth: '60ch' }}>
        A few first steps every client works through. Track and check these off on your{' '}
        <Link href="/dashboard/tasks">Tasks</Link> page.
      </p>
      <div className="card" style={{ marginTop: '16px' }}>
        {STARTER_TASKS.map((task, i) => (
          <div
            key={task}
            className="flex-between"
            style={{
              padding: '10px 0',
              borderBottom: i < STARTER_TASKS.length - 1 ? '1px solid var(--divider)' : 'none',
            }}
          >
            <span style={{ fontSize: '0.9rem' }}>{task}</span>
            <span className="badge badge-neutral">Pending</span>
          </div>
        ))}
        <Link
          href="/dashboard/tasks"
          className="flex-between"
          style={{ paddingTop: '16px', color: 'inherit' }}
        >
          <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>
            <IconClipboard /> Go to Tasks
          </span>
          <IconChevronRight />
        </Link>
      </div>
    </>
  );
}
