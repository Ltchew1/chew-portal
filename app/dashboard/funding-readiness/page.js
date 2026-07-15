// app/dashboard/funding-readiness/page.js
import PageHeader from '../../components/PageHeader';

const PERSONAL = [
  'Check your credit reports for accuracy',
  'Establish consistent on-time payment history',
  'Keep credit utilization low',
  'Maintain a stable, verifiable income history',
];

const BUSINESS = [
  'Separate business and personal finances',
  'Build a business credit file (EIN, D-U-N-S, trade lines)',
  'Prepare a clear use-of-funds statement',
  'Organize financial statements and tax documents',
];

function List({ title, items }) {
  return (
    <div className="card">
      <h3>{title}</h3>
      <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-faint)', fontSize: '0.9rem' }}>
        {items.map((i) => <li key={i} style={{ marginBottom: '8px' }}>{i}</li>)}
      </ul>
    </div>
  );
}

export default function FundingReadinessPage() {
  return (
    <>
      <PageHeader
        eyebrow="Funding Readiness"
        title="What lenders typically look for"
        description="This is general education on funding preparation. CHEW does not guarantee approval, terms, or specific outcomes with any lender."
      />
      <div className="card-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <List title="Personal readiness" items={PERSONAL} />
        <List title="Business readiness" items={BUSINESS} />
      </div>
    </>
  );
}
