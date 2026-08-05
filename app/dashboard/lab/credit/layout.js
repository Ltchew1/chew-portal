// app/dashboard/lab/credit/layout.js
//
// Gates the Credit room using the shared RoomGate + the room's own
// requiredStatus from lib/rooms.js. The Lab hub layout above this one
// already requires 'accepted'; Credit requires 'paid' on top of that —
// both checks run independently (see RoomGate's file comment).

import RoomGate from '../../../components/lab/RoomGate';
import { getRoom } from '../../../../lib/rooms';

const room = getRoom('credit');

export default function CreditRoomLayout({ children }) {
  return (
    <RoomGate name={room.name} requiredStatus={room.requiredStatus}>
      {children}
    </RoomGate>
  );
}
