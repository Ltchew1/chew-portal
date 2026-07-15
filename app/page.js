// app/page.js
import { SignedIn, SignedOut } from '@clerk/nextjs';
import Link from 'next/link';
import DisclaimerBar from './components/DisclaimerBar';
import { IconLock, IconShield, IconVault, IconSparkles, IconMessage } from './components/icons';

const TRUST_ITEMS = [
  { icon: IconLock, title: 'Private Access', description: 'Secure authentication and encrypted data.' },
  { icon: IconShield, title: 'Secure & Confidential', description: 'Your information is always protected.' },
  { icon: IconMessage, title: 'Personalized Guidance', description: 'Custom strategies built for your goals.' },
];

export default function HomePage() {
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
        <SignedOut>
          <Link href="/sign-in" className="btn btn-outline">Sign In</Link>
        </SignedOut>
        <SignedIn>
          <Link href="/dashboard" className="btn btn-gold">Go to Dashboard</Link>
        </SignedIn>
      </header>

      <main className="portal-main" style={{ maxWidth: '760px', textAlign: 'center', paddingTop: '80px' }}>
        <img src="/chew-logo.png" alt="" style={{ height: '140px', width: 'auto', margin: '0 auto 32px', display: 'block' }} />
        <h1 style={{ fontSize: '2.6rem' }}>
          Your strategy.<br />Your progress.<br />Your financial future.
        </h1>
        <p className="text-faint" style={{ maxWidth: '48ch', margin: '20px auto 36px', fontSize: '1.02rem' }}>
          Access your personalized financial strategy, secure documents, appointments,
          educational resources, and progress through one private dashboard.
        </p>

        <SignedOut>
          <Link href="/sign-in" className="btn btn-gold">Sign In to Your Account</Link>
          <span style={{ margin: '0 8px' }} />
          <Link href="/sign-up" className="btn btn-outline">Learn About CHEW</Link>
        </SignedOut>
        <SignedIn>
          <Link href="/dashboard" className="btn btn-gold">Go to Dashboard</Link>
        </SignedIn>

        <div className="card-grid" style={{ marginTop: '64px', textAlign: 'left' }}>
          {TRUST_ITEMS.map((t) => {
            const Icon = t.icon;
            return (
              <div key={t.title} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div className="card-icon" style={{ marginBottom: 0, flexShrink: 0 }}><Icon /></div>
                <div>
                  <h3 style={{ fontSize: '0.95rem' }}>{t.title}</h3>
                  <p style={{ fontSize: '0.85rem', margin: 0 }}>{t.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <DisclaimerBar />
    </div>
  );
}
