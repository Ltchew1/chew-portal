// app/dashboard/page.js
import { currentUser } from '@clerk/nextjs/server';
import Link from 'next/link';
import {
  IconClipboard, IconCalendar, IconVault, IconTrendUp,
  IconBook, IconBuilding, IconShield, IconSparkles, IconChevronRight,
} from '../components/icons';

const CARDS = [
  {
    icon: IconClipboard,
    title: 'My Action Plan',
    href: '/dashboard/action-plan',
    description: 'View the personalized steps assigned to your CHEW strategy.',
    status: 'Setup in progress',
  },
  {
    icon: IconCalendar,
    title: 'Upcoming Appointment',
    href: '/dashboard/appointments',
    description: 'Your scheduled CHEW sessions will appear here.',
    status: 'No appointment scheduled',
  },
  {
    icon: IconVault,
    title: 'Secure Documents',
    href: '/dashboard/documents',
    description: 'Your requested and completed documents are organized here.',
    status: 'Vault setup in progress',
  },
  {
    icon: IconTrendUp,
    title: 'Progress Overview',
    href: '/dashboard/progress',
    description: 'Track completed steps and milestones through your CHEW journey.',
    status: 'Profile setup incomplete',
  },
  {
    icon: IconBook,
    title: 'Education Center',
    href: '/dashboard/education',
    description: 'Access educational resources tied to your financial goals.',
    status: 'Resources being prepared',
  },
  {
    icon: IconBuilding,
    title: 'Business Builder',
    href: '/dashboard/business-builder',
    description: 'Step-by-step guidance for structuring and funding your business.',
    status: 'Not started',
  },
  {
    icon: IconShield,
    title: 'Funding Readiness',
    href: '/dashboard/funding-readiness',
    description: 'See what lenders typically look for before you apply.',
    status: 'Not started',
  },
  {
    icon: IconSparkles,
    title: 'CHEW Guidance',
    href: '/dashboard/guidance',
    description: 'Personalized educational guidance, built from your strategy.',
    status: 'Coming soon',
  },
];

export default async function OverviewPage() {
  const user = await currentUser();
  const firstName = user?.firstName || 'there';

  return (
    <>
      <span className="page-eyebrow">Overview</span>
      <h1>Welcome back, {firstName}.</h1>
      <p className="text-faint" style={{ maxWidth: '60ch' }}>
        Here's your personalized CHEW overview and the next actions that deserve your attention.
      </p>

      <div className="card-grid">
        {CARDS.map((c) => {
          const Icon = c.icon;
          return (
            <Link key={c.href} href={c.href} className="card" style={{ display: 'block', color: 'inherit' }}>
              <div className="card-icon"><Icon /></div>
              <h3>{c.title}</h3>
              <p style={{ fontSize: '0.88rem' }}>{c.description}</p>
              <div className="card-footer">
                <span className="badge badge-soon">{c.status}</span>
                <IconChevronRight />
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
