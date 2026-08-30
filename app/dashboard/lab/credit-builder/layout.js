// app/dashboard/lab/credit-builder/layout.js
import RoomGate from '../../../components/lab/RoomGate';
import { getRoom } from '../../../../lib/rooms';

const room = getRoom('credit-builder');

export default function CreditBuilderRoomLayout({ children }) {
  return (
    <RoomGate name={room.name} requiredStatus={room.requiredStatus}>
      {children}
    </RoomGate>
  );
}
