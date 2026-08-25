// app/api/admin/network/capabilities/route.js — Admin -> Network: list/create capabilities.

import { NextResponse } from 'next/server';
import { getAdminAccess } from '../../../../../lib/features';
import { createCapability, listCapabilities } from '../../../../../lib/capabilities';

export async function GET() {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const capabilities = await listCapabilities();
  return NextResponse.json({ capabilities });
}

export async function POST(req) {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { key, name, description, category } = body;
  if (!key?.trim() || !name?.trim() || !description?.trim()) {
    return NextResponse.json({ error: 'key, name, and description are required' }, { status: 400 });
  }

  const capability = await createCapability({ key: key.trim(), name: name.trim(), description: description.trim(), category: category?.trim() || null });
  return NextResponse.json({ capability }, { status: 201 });
}
