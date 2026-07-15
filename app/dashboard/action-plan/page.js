// app/dashboard/action-plan/page.js
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import { IconClipboard, IconCalendar, IconMessage } from '../../components/icons';
import Link from 'next/link';

const STEPS = [
  { icon: IconMessage, title: 'Book your strategy session', description: 'Meet with a CHEW strategist to review your goals and starting point.' },
  { icon: IconClipboard, title: 'Receive your personalized plan', description: 'Your strategist builds a step-by-step plan tailored to your situation.' },
  { icon: IconCalendar, title: 'Work the plan together', description: 'Check off milestones and meet regularly to track progress.' },
];

export default function ActionPlanPage() {
  return (
    <>
      <PageHeader
        eyebrow="My Action Plan"
        title="Your personalized roadmap"
        description="Once your strategist builds your plan, every step, milestone, and completion percentage will live here."
      />

      <EmptyState
        icon={<IconClipboard />}
        title="Your action plan hasn't been built yet"
        description="This starts with a strategy session. Once that's complete, your personalized steps will appear here."
        action={
          <Link href="/dashboard/appointments" className="btn btn-gold btn-sm">
            Book a Strategy Session
          </Link>
        }
      />

      <h2 style={{ marginTop: '48px' }}>How this works</h2>
      <div className="card-grid">
        {STEPS.map((s) => {
          const Icon = s.icon;
          return (
            <div className="card" key={s.title}>
              <div className="card-icon"><Icon /></div>
              <h3>{s.title}</h3>
              <p style={{ fontSize: '0.88rem' }}>{s.description}</p>
            </div>
          );
        })}
      </div>
    </>
  );
}
