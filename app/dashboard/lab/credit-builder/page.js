// app/dashboard/lab/credit-builder/page.js
import RoomComingSoon from '../../../components/lab/RoomComingSoon';
import { getRoom } from '../../../../lib/rooms';

const room = getRoom('credit-builder');

export default function CreditBuilderRoomPage() {
  return <RoomComingSoon room={room} />;
}
