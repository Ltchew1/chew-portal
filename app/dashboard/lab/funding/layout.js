// app/dashboard/lab/funding/layout.js
import RoomGate from '../../../components/lab/RoomGate';
import { getRoom } from '../../../../lib/rooms';

const room = getRoom('funding');

export default function FundingRoomLayout({ children }) {
  return (
    <RoomGate name={room.name} requiredStatus={room.requiredStatus}>
      {children}
    </RoomGate>
  );
}
