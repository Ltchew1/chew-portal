// app/dashboard/layout.js
import { currentUser } from '@clerk/nextjs/server';
import { UserButton } from '@clerk/nextjs';
import { redirect } from 'next/navigation';
import Sidebar from '../components/Sidebar';
import DisclaimerBar from '../components/DisclaimerBar';

export default async function DashboardLayout({ children }) {
  const user = await currentUser();
  if (!user) {
    redirect('/sign-in');
  }

  return (
    <div className="portal-shell">
      <header className="portal-header">
        <div className="portal-brand">
          <img src="/chew-logo.png" alt="CHEW" style={{ height: '30px', width: 'auto' }} />
          <span>
            CHEW LLC
            <span className="portal-brand-sub">Private Client Portal</span>
          </span>
        </div>
        <UserButton afterSignOutUrl="/" />
      </header>

      <div className="portal-body">
        <Sidebar />
        <main className="portal-main">
          {children}
          <DisclaimerBar />
        </main>
      </div>
    </div>
  );
}
