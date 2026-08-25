// app/components/lab/RoomComingSoon.js
//
// The premium locked placeholder for a room that's reserved in the room
// picker but has no real content yet (Credit Builder, Business, Funding,
// Financial Intelligence, Money Systems, Referral Hub). No data is
// fetched, no form is rendered, nothing here is a click target to
// anything unbuilt — see app/components/lab/LockedFeatureCard.js's file
// comment. The feature registry (lib/features.js) is the copy's source of
// truth, not a hardcoded string, so a status change there (e.g. 'locked'
// -> 'preview' while the founder tests internally) is reflected here
// automatically. Once a room's real content ships, its page.js stops
// rendering this entirely.

import PageHeader from '../PageHeader';
import LockedFeatureCard from './LockedFeatureCard';
import { getFeature, roomFeatureKey } from '../../../lib/features';
import { STATUS_LABELS } from '../../../lib/featureCopy';

export default async function RoomComingSoon({ room }) {
  const Icon = room.icon;
  const feature = await getFeature(roomFeatureKey(room.slug));

  return (
    <>
      <PageHeader eyebrow="CHEW: The Lab" title={room.name} description={room.tagline} />
      <LockedFeatureCard
        icon={<Icon />}
        name={feature?.name ?? room.name}
        description={feature?.description ?? room.tagline}
        statusLabel={STATUS_LABELS[feature?.status] ?? STATUS_LABELS.locked}
      />
    </>
  );
}
