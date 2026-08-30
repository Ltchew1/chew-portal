// app/dashboard/lab/funding/page.js
import RoomComingSoon from '../../../components/lab/RoomComingSoon';
import { getRoom } from '../../../../lib/rooms';

const room = getRoom('funding');

export default function FundingRoomPage() {
  return <RoomComingSoon room={room} />;
}
