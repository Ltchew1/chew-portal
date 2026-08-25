// app/api/admin/network/providers/[id]/route.js — Admin -> Network: edit one provider.

import { NextResponse } from 'next/server';
import { getAdminAccess } from '../../../../../../lib/features';
import { updateProvider } from '../../../../../../lib/providers';

export async function PATCH(req, { params }) {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const providerId = Number(params.id);
  if (!Number.isInteger(providerId)) {
    return NextResponse.json({ error: 'Invalid provider id' }, { status: 400 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  try {
    const provider = await updateProvider(providerId, body);
    return NextResponse.json({ provider });
  } catch (err) {
    const status = err.message === 'Provider not found.' ? 404 : 400;
    return NextResponse.json({ error: err.message }, { status });
  }
}
