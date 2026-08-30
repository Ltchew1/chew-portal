// app/dashboard/lab/business/layout.js
import RoomGate from '../../../components/lab/RoomGate';
import { getRoom } from '../../../../lib/rooms';

const room = getRoom('business');

export default function BusinessRoomLayout({ children }) {
  return (
    <RoomGate name={room.name} requiredStatus={room.requiredStatus}>
      {children}
    </RoomGate>
  );
}
