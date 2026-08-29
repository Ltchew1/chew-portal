// app/api/lab/credit/letters/[id]/route.js
//
// The one canonical download path for a generated letter — used both by
// LetterGenerator.js (a just-generated letter) and HiddenLeverageCard.js
// (a past, undownloaded one). Always returns the real file: a genuine
// PDF (lib/letterPdf.js) for a stage 1-3 mailed dispute letter, plain
// text for a Stage 4 CFPB/FTC complaint narrative (meant to be copied
// into their own web form, not mailed — see letterContent.js) or for a
// legacy letter generated before structured_content existed.
//
// ORDER MATTERS: the file body is built FIRST; downloaded_at is only
// ever stamped after that succeeds. If PDF rendering throws, the client
// gets a real error and the letter is correctly NOT marked downloaded —
// CHEW never records "delivered" for a delivery that didn't happen.

import { NextResponse } from 'next/server';
import { getRoomAccess } from '../../../../../../lib/clientStatus';
import { getRoom } from '../../../../../../lib/rooms';
import { getOwnedLetter, markDownloaded } from '../../../../../../lib/letters';
import { renderDisputeLetterPdf } from '../../../../../../lib/letterPdf';

const CREDIT_REQUIRED_STATUS = getRoom('credit').requiredStatus;

export async function GET(req, { params }) {
  const { user, hasAccess } = await getRoomAccess(CREDIT_REQUIRED_STATUS);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const letterId = Number(params.id);
  if (!Number.isInteger(letterId)) {
    return NextResponse.json({ error: 'Invalid letter id' }, { status: 400 });
  }

  const letter = await getOwnedLetter(user.id, letterId);
  if (!letter) {
    return NextResponse.json({ error: 'Letter not found for this account.' }, { status: 404 });
  }

  let body;
  let headers;
  if (letter.stage < 4 && letter.structuredContent) {
    body = await renderDisputeLetterPdf(letter.structuredContent);
    headers = { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="chew-lab-letter-${letterId}.pdf"` };
  } else {
    body = letter.content;
    headers = { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Disposition': `attachment; filename="chew-lab-letter-${letterId}.txt"` };
  }

  const url = new URL(req.url);
  if (url.searchParams.get('download') === '1') {
    await markDownloaded(user.id, letterId);
  }

  // This is a member's own dispute letter — name, address, account
  // details. Explicit no-store on top of Next's own dynamic-rendering
  // behavior (this route reads the authenticated session, so it was
  // never eligible for shared/CDN caching to begin with) covers the
  // remaining case: a shared/public machine's own browser cache.
  headers['Cache-Control'] = 'private, no-store';

  return new NextResponse(body, { status: 200, headers });
}
