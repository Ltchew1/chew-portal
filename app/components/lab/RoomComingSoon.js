// app/components/lab/RoomComingSoon.js
//
// Honest placeholder for a room that's reserved in the room picker but has
// no real content yet (Credit Builder, Business, Funding, Financial
// Intelligence, Money Systems) — same "coming soon, not faked" pattern
// used everywhere else in the portal. Once a room's real content ships,
// its page.js stops rendering this.

import PageHeader from '../PageHeader';
import EmptyState from '../EmptyState';

export default function RoomComingSoon({ room }) {
  const Icon = room.icon;
  return (
    <>
      <PageHeader eyebrow="CHEW: The Lab" title={room.name} description={room.tagline} />
      <EmptyState
        icon={<Icon />}
        title="Coming to your Lab"
        description={`${room.name} isn't built yet — this room is reserved and will unlock here as it's ready.`}
      />
    </>
  );
}
