// app/dashboard/lab/layout.js
//
// Gates The Lab hub itself: seeing the room picker at all requires at
// least Accepted status (LAB_REQUIRED_STATUS in lib/clientStatus.js).
// Individual rooms (app/dashboard/lab/<room>/layout.js) can require more
// on top of this — Credit requires Paid — but never less; both gates run
// independently on every request, same defense-in-depth pattern as the
// Credit room's API routes re-checking access on top of its page gate.

import RoomGate from '../../components/lab/RoomGate';
import { LAB_REQUIRED_STATUS } from '../../../lib/clientStatus';

export default function LabLayout({ children }) {
  return (
    <RoomGate name="The Lab" requiredStatus={LAB_REQUIRED_STATUS}>
      {children}
    </RoomGate>
  );
}
