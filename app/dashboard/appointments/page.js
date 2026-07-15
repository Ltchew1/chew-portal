// app/dashboard/appointments/page.js
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import { IconCalendar } from '../../components/icons';

export default function AppointmentsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Appointments"
        title="Manage your sessions"
        description="Upcoming and past CHEW strategy sessions appear here, all times shown in your local timezone."
        action={<button className="btn btn-gold" disabled title="Available once your account is activated">Book New Appointment</button>}
      />

      <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
        <span className="badge badge-neutral">Upcoming</span>
        <span className="badge badge-neutral">Past</span>
      </div>

      <EmptyState
        icon={<IconCalendar />}
        title="No upcoming appointments"
        description="You don't have any sessions scheduled yet. Message your strategist to find a time that works."
        action={
          <a href="/dashboard/messages" className="btn btn-gold btn-sm">Message Your Strategist</a>
        }
      />
    </>
  );
}
