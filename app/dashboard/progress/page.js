// app/dashboard/progress/page.js
import PageHeader from '../../components/PageHeader';

const MILESTONES = [
  'Onboarding complete',
  'Strategy session booked',
  'Personalized action plan created',
  'Credit foundation steps started',
  'Business foundation steps started',
];

export default function ProgressPage() {
  return (
    <>
      <PageHeader
        eyebrow="Progress"
        title="Your CHEW journey"
        description="A high-level view of milestones as you move through your strategy."
      />

      <div className="card" style={{ marginTop: '8px' }}>
        <div className="flex-between" style={{ marginBottom: '10px' }}>
          <strong>Overall completion</strong>
          <span className="text-faint">0%</span>
        </div>
        <div className="progress-track"><div className="progress-fill" style={{ width: '0%' }} /></div>
      </div>

      <h2 style={{ marginTop: '32px' }}>Milestones</h2>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr><th>Milestone</th><th>Status</th></tr>
          </thead>
          <tbody>
            {MILESTONES.map((m) => (
              <tr key={m}>
                <td>{m}</td>
                <td><span className="badge badge-neutral">Not started</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
