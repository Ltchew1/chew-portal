// app/dashboard/lab/referral-hub/page.js
import RoomComingSoon from '../../../components/lab/RoomComingSoon';
import { getRoom } from '../../../../lib/rooms';

const room = getRoom('referral-hub');

export default function ReferralHubRoomPage() {
  return <RoomComingSoon room={room} />;
}
