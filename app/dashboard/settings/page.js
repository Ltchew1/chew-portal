// app/dashboard/settings/page.js
import { UserProfile } from '@clerk/nextjs';
import PageHeader from '../../components/PageHeader';

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Account Settings"
        title="Manage your account"
        description="Update your profile, security, and notification preferences."
      />
      <div style={{ marginTop: '16px' }}>
        <UserProfile
          appearance={{
            variables: {
              colorPrimary: '#C8A63C',
              colorBackground: '#131311',
              colorInputBackground: '#1A1917',
              colorText: '#F5F3EE',
              colorTextSecondary: '#9C978A',
              borderRadius: '14px',
            },
          }}
        />
      </div>
    </>
  );
}
