// app/dashboard/lab/business/page.js
import RoomComingSoon from '../../../components/lab/RoomComingSoon';
import { getRoom } from '../../../../lib/rooms';

const room = getRoom('business');

export default function BusinessRoomPage() {
  return <RoomComingSoon room={room} />;
}
