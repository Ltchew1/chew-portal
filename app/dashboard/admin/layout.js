// app/dashboard/admin/layout.js
//
// Gates the entire Admin surface to internal staff (Clerk
// publicMetadata.chewInternal === true — see lib/features.js's
// isInternalUser/getAdminAccess). A signed-in client who is not internal
// gets Next's standard 404, not an "access denied, staff only" page —
// revealing that an admin area exists at all is unnecessary information
// leakage to a normal customer. This runs server-side on every request,
// same as every other gate in this app; nothing here is a frontend-only
// hide.

import { notFound } from 'next/navigation';
import { getAdminAccess } from '../../../lib/features';

export default async function AdminLayout({ children }) {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) {
    notFound();
  }
  return children;
}
