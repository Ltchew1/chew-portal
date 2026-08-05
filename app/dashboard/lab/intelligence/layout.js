// app/dashboard/lab/intelligence/layout.js
import RoomGate from '../../../components/lab/RoomGate';
import { getRoom } from '../../../../lib/rooms';

const room = getRoom('intelligence');

export default function IntelligenceRoomLayout({ children }) {
  return (
    <RoomGate name={room.name} requiredStatus={room.requiredStatus}>
      {children}
    </RoomGate>
  );
}
