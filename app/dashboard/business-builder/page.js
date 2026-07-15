// app/dashboard/business-builder/page.js
import PageHeader from '../../components/PageHeader';
import { IconCheck } from '../../components/icons';

const STEPS = [
  { title: 'Form your LLC', description: 'Register your business entity with your state.' },
  { title: 'Get your EIN', description: 'Obtain a federal Employer Identification Number from the IRS, free of charge.' },
  { title: 'Set up a business address', description: 'Use a dedicated address, separate from your home, for licensing and mail.' },
  { title: 'Get a business phone number', description: 'A dedicated line helps establish your business as a distinct entity.' },
  { title: 'Build a business website', description: 'A professional web presence supports credibility with vendors and lenders.' },
  { title: 'Register for a D-U-N-S number', description: 'Dun & Bradstreet uses this to build your business credit file.' },
  { title: 'Open a business bank account', description: 'Keep business finances fully separate from personal finances.' },
  { title: 'Establish business credit', description: 'Build a track record with vendor and trade credit over time.' },
];

export default function BusinessBuilderPage() {
  return (
    <>
      <PageHeader
        eyebrow="Business Builder"
        title="Build your business foundation"
        description="Educational, step-by-step guidance for structuring a business that can qualify for funding down the road. This is general education, not a guarantee of approval or outcome."
      />

      <div className="card-grid" style={{ gridTemplateColumns: '1fr' }}>
        {STEPS.map((s, i) => (
          <div className="card" key={s.title} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
            <div className="card-icon" style={{ marginBottom: 0, flexShrink: 0 }}><IconCheck /></div>
            <div>
              <h3>{i + 1}. {s.title}</h3>
              <p style={{ fontSize: '0.88rem' }}>{s.description}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
