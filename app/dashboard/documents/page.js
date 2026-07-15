// app/dashboard/documents/page.js
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import { IconVault, IconLock } from '../../components/icons';

export default function DocumentsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Secure Documents"
        title="Your document vault"
        description="Documents you upload or that CHEW shares with you are encrypted and organized here."
        action={<button className="btn btn-gold" disabled title="Available once your vault is activated">Upload Document</button>}
      />

      <EmptyState
        icon={<IconVault />}
        title="Your vault is empty"
        description="Once your account is activated, you'll be able to securely upload, request, and track documents here."
      />

      <div className="alert" style={{ marginTop: '24px' }}>
        <IconLock />
        <span><strong>Security first.</strong> All documents are encrypted and only accessible by you and your CHEW strategist.</span>
      </div>
    </>
  );
}
