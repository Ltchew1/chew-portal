// lib/letterPdf.js
//
// Renders a composed dispute letter's structured `sections`
// (lib/letterContent.js's composeDisputeLetter) into a real PDF —
// genuine vector/text rendering via @react-pdf/renderer's PDFKit engine,
// not a screenshot of HTML. Uses the built-in Times-Roman standard font
// (no embedding needed, guaranteed crisp at any zoom) and a plain
// full-block business-letter layout: sender block, date, recipient
// block, subject line, body, itemized list, legal paragraph, signature.
//
// Deliberately carries NO CHEW branding — this is correspondence FROM
// the member TO a bureau or furnisher, signed with the member's own
// name; a logo or letterhead here would misrepresent who is writing.
//
// Only stage 1-3 dispute letters get a PDF. Stage 4 (composeEscalationNarrative)
// returns sections: null on purpose — that text is meant to be copied
// into CFPB/FTC's own web complaint form, so a PDF would work against
// the one real thing a client needs to do with it (see letterContent.js's
// comment on that function).

import { createElement as h } from 'react';
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer';

// lineHeight is deliberately set per text style below, never on `page`
// itself: @react-pdf/renderer's layout engine silently drops a `fixed`
// element (the page-number footer) from every page once real pagination
// occurs, but only when `lineHeight` is set on the Page's own style —
// confirmed by isolated reproduction (removing it from `page` and
// applying it to each text style individually is enough to fix it; a
// single-page letter is unaffected either way, so this was easy to miss
// without actually forcing a page break during review). Same reasoning
// for `footer` using point numbers instead of 'in' strings: the two
// unit systems interacting on a `fixed` absolutely-positioned element
// across a page break hit the same class of bug — 72pt = 1in, 28.8pt =
// 0.4in, so this is the same physical position, not a smaller margin.
const styles = StyleSheet.create({
  page: { paddingTop: '1in', paddingBottom: '0.75in', paddingHorizontal: '1in', fontSize: 11, fontFamily: 'Times-Roman', color: '#141414' },
  block: { marginBottom: 18, lineHeight: 1.4 },
  line: { marginBottom: 2, lineHeight: 1.4 },
  subject: { marginBottom: 18, fontFamily: 'Times-Bold', lineHeight: 1.4 },
  salutation: { marginBottom: 12, lineHeight: 1.4 },
  paragraph: { marginBottom: 12, textAlign: 'justify', lineHeight: 1.4 },
  itemsIntro: { marginBottom: 8, lineHeight: 1.4 },
  itemLine: { marginBottom: 8, lineHeight: 1.4 },
  itemNote: { marginTop: 2, marginLeft: 16, fontFamily: 'Times-Italic', fontSize: 10, lineHeight: 1.4 },
  signatureBlock: { marginTop: 30, lineHeight: 1.4 },
  signatureName: { marginTop: 30, lineHeight: 1.4 },
  footer: { position: 'absolute', bottom: 28.8, left: 72, right: 72, fontSize: 8, textAlign: 'center', color: '#8a8a8a' },
});

function AddressBlock({ name, lines }) {
  return h(View, { style: styles.block },
    h(Text, { style: styles.line }, name),
    ...lines.map((l, i) => h(Text, { key: i, style: styles.line }, l)),
  );
}

function DisputeLetterDocument({ sections }) {
  const legalParagraphs = [sections.legalParagraph, sections.movParagraph].filter(Boolean);

  return h(Document, {},
    h(Page, { size: 'LETTER', style: styles.page },
      h(AddressBlock, { name: sections.senderName, lines: sections.senderAddressLines }),
      h(Text, { style: styles.block }, sections.date),
      h(AddressBlock, { name: sections.recipientName, lines: sections.recipientAddressLines }),
      h(Text, { style: styles.subject }, sections.subject),
      h(Text, { style: styles.salutation }, sections.salutation),
      h(Text, { style: styles.paragraph }, sections.opening),
      h(Text, { style: styles.itemsIntro }, sections.itemsIntro),
      ...sections.items.flatMap((item) => {
        const label = `${item.index}. ${item.creditorName}${item.accountNumber ? ` (Account: ${item.accountNumber})` : ''} — ${item.reasonText}`;
        const nodes = [h(Text, { key: `item-${item.index}`, style: styles.itemLine }, label)];
        if (item.clientNotes) {
          nodes.push(h(Text, { key: `note-${item.index}`, style: styles.itemNote }, `Additional context I provided: ${item.clientNotes}`));
        }
        return nodes;
      }),
      ...legalParagraphs.map((p, i) => h(Text, { key: `legal-${i}`, style: styles.paragraph }, p)),
      h(Text, { style: styles.paragraph }, sections.closing),
      h(View, { style: styles.signatureBlock },
        h(Text, {}, sections.signOff),
        h(Text, { style: styles.signatureName }, sections.signatureName),
      ),
      h(Text, {
        style: styles.footer, fixed: true,
        render: ({ pageNumber, totalPages }) => (totalPages > 1 ? `Page ${pageNumber} of ${totalPages}` : ''),
      }),
    ),
  );
}

export async function renderDisputeLetterPdf(sections) {
  return renderToBuffer(h(DisputeLetterDocument, { sections }));
}
