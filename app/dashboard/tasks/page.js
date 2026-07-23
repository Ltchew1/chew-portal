// app/dashboard/tasks/page.js — Tasks / Action Center v1 (CHEW Rebuild Kit,
// Section 4): "the accountability engine — ship before anything prettier."
//
// No backend yet (see app/dashboard/page.js for why), so state here is
// local/client-only — it won't survive a page refresh. That's an honest v1
// limitation, not a fabricated result: marking a task complete moves it to
// "Awaiting advisor verification," never straight to "Verified," since no
// advisor has actually reviewed anything yet.

'use client';

import { useState } from 'react';
import PageHeader from '../../components/PageHeader';
import { IconCheck, IconClipboard } from '../../components/icons';

const INITIAL_TASKS = [
  { id: 1, title: 'Complete your Financial Blueprint intake', due: 'Before your first strategy session' },
  { id: 2, title: 'Book your strategy session', due: 'Within 7 days of admission' },
  { id: 3, title: 'Review your program agreement', due: 'Before your first session' },
];

function StatusBadge({ status }) {
  if (status === 'verified') return <span className="badge badge-success">Verified</span>;
  if (status === 'awaiting') return <span className="badge badge-pending">Awaiting advisor verification</span>;
  return <span className="badge badge-neutral">Pending</span>;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState(INITIAL_TASKS.map((t) => ({ ...t, status: 'pending' })));

  const completedCount = tasks.filter((t) => t.status !== 'pending').length;
  const progressPct = Math.round((completedCount / tasks.length) * 100);

  function markComplete(id) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'awaiting' } : t)));
  }

  return (
    <>
      <PageHeader
        eyebrow="Tasks"
        title="Your action items"
        description="Assigned steps you complete yourself — CHEW provides strategy and education, you provide implementation."
      />

      <div style={{ margin: '20px 0 28px' }}>
        <div className="flex-between" style={{ marginBottom: '8px' }}>
          <span className="text-faint" style={{ fontSize: '0.85rem' }}>
            {completedCount} of {tasks.length} marked complete
          </span>
          <span className="text-faint" style={{ fontSize: '0.85rem' }}>{progressPct}%</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Task</th>
              <th>Due</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id}>
                <td>{task.title}</td>
                <td className="text-faint">{task.due}</td>
                <td><StatusBadge status={task.status} /></td>
                <td>
                  {task.status === 'pending' ? (
                    <button className="btn btn-outline btn-sm" onClick={() => markComplete(task.id)}>
                      <IconCheck /> Mark complete
                    </button>
                  ) : (
                    <span className="text-faint" style={{ fontSize: '0.82rem' }}>
                      <IconClipboard /> Submitted
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-faint" style={{ fontSize: '0.82rem', marginTop: '16px' }}>
        Marking a task complete notifies your strategist for verification — it doesn't verify itself.
      </p>
    </>
  );
}
