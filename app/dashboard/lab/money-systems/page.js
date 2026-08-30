// app/dashboard/lab/money-systems/page.js
import RoomComingSoon from '../../../components/lab/RoomComingSoon';
import { getRoom } from '../../../../lib/rooms';

const room = getRoom('money-systems');

export default function MoneySystemsRoomPage() {
  return <RoomComingSoon room={room} />;
}
