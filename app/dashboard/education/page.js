// app/dashboard/education/page.js
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import { IconBook } from '../../components/icons';

const CATEGORIES = [
  'Credit Basics', 'Budgeting', 'Home Buying', 'Business Credit',
  'Entrepreneurship', 'Funding', 'Personal Finance', 'AI Guides',
];

export default function EducationPage() {
  return (
    <>
      <PageHeader
        eyebrow="Education Center"
        title="Learn at your own pace"
        description="Guides and resources organized by topic, matched to your financial goals."
      />

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
        {CATEGORIES.map((c) => (
          <span key={c} className="badge badge-neutral">{c}</span>
        ))}
      </div>

      <EmptyState
        icon={<IconBook />}
        title="Resources are being prepared"
        description="Your Education Center is being built out with guides tailored to your strategy. Check back soon."
      />
    </>
  );
}
