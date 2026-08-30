// app/dashboard/lab/referral/layout.js
import RoomGate from '../../../components/lab/RoomGate';
import { getRoom } from '../../../../lib/rooms';

const room = getRoom('referral');

export default function ReferralRoomLayout({ children }) {
  return (
    <RoomGate name={room.name} requiredStatus={room.requiredStatus}>
      {children}
    </RoomGate>
  );
}
