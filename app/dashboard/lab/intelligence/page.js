// app/dashboard/lab/intelligence/page.js
import RoomComingSoon from '../../../components/lab/RoomComingSoon';
import { getRoom } from '../../../../lib/rooms';

const room = getRoom('intelligence');

export default function IntelligenceRoomPage() {
  return <RoomComingSoon room={room} />;
}
