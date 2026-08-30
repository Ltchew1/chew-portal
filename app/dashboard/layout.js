// app/dashboard/layout.js
import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';
import DisclaimerBar from '../components/DisclaimerBar';
import { statusFromClerkUser } from '../../lib/clientStatus';
import { listRecentNotifications } from '../../lib/notifications';

const STATUS_LABELS = { applicant: 'Applicant', accepted: 'Accepted', paid: 'Paid' };

export default async function DashboardLayout({ children }) {
  const user = await currentUser();
  if (!user) {
    redirect('/sign-in');
  }
  const status = statusFromClerkUser(user);
  const notifications = await listRecentNotifications(user.id);

  return (
    <div className="portal-shell">
      <TopBar firstName={user.firstName || 'there'} notifications={notifications} />

      <div className="portal-body">
        <Sidebar
          firstName={user.firstName}
          lastName={user.lastName}
          statusLabel={STATUS_LABELS[status]}
        />
        <main className="portal-main">
          {children}
          <DisclaimerBar />
        </main>
      </div>
    </div>
  );
}
