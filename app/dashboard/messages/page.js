// app/dashboard/messages/page.js
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import { IconMessage } from '../../components/icons';

export default function MessagesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Messages"
        title="Talk with your CHEW strategist"
        description="Secure messages between you and your CHEW team will appear here."
      />

      <EmptyState
        icon={<IconMessage />}
        title="No messages yet"
        description="Once your account is fully set up, you'll be able to message your strategist directly from here."
      />
    </>
  );
}
