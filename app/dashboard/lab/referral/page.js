// app/dashboard/lab/referral/page.js
import RoomComingSoon from '../../../components/lab/RoomComingSoon';
import { getRoom } from '../../../../lib/rooms';

const room = getRoom('referral');

export default function ReferralRoomPage() {
  return <RoomComingSoon room={room} />;
}
