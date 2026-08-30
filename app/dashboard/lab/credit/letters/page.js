// app/dashboard/lab/credit/letters/page.js — the Letter Generator.
//
// Gated by app/dashboard/lab/credit/layout.js like every other Credit room
// route. Requires a saved mailing address before it will show the
// generator; requires attested items before it will show anything to
// select — both real prerequisites, not just UI conditions (the API route
// enforces the address requirement itself; assertItemsAttested enforces
// the attestation requirement).

import { currentUser } from '@clerk/nextjs/server';
import Link from 'next/link';
import PageHeader from '../../../../components/PageHeader';
import EmptyState from '../../../../components/EmptyState';
import CreditRoomSubNav from '../../../../components/lab/credit/CreditRoomSubNav';
import MailingAddressForm from '../../../../components/lab/credit/MailingAddressForm';
import LetterGenerator from '../../../../components/lab/credit/LetterGenerator';
import { IconScale } from '../../../../components/icons';
import { listDisputeItemsForUser } from '../../../../../lib/disputeItems';
import { listLettersForUser } from '../../../../../lib/letters';
import { getMailingAddress, hasCompleteMailingAddress } from '../../../../../lib/users';
import { BUREAU_LABELS } from '../../../../../lib/creditAddresses';

const RECIPIENT_TYPE_LABELS = {
  bureau: 'Bureau',
  secondary_bureau: 'Secondary bureau',
  furnisher: 'Furnisher',
  cfpb: 'CFPB',
  ftc: 'FTC',
};

export default async function CreditLettersPage() {
  const user = await currentUser();
  const [items, address, letters] = await Promise.all([
    listDisputeItemsForUser(user.id),
    getMailingAddress(user.id),
    listLettersForUser(user.id),
  ]);

  const attestedItems = items.filter((item) => item.attested_at);
  const addressReady = hasCompleteMailingAddress(address);

  return (
    <>
      <PageHeader
        eyebrow="The Lab · Credit"
        title="Letters"
        description="Generate a letter for items you've flagged and attested — you download it, sign it, and mail it yourself."
      />

      <CreditRoomSubNav />

      <MailingAddressForm initialAddress={address} />

      {!addressReady ? (
        <EmptyState
          icon={<IconScale />}
          title="Add your address to continue"
          description="Every letter needs a real return address before it can be generated."
        />
      ) : attestedItems.length === 0 ? (
        <EmptyState
          icon={<IconScale />}
          title="Nothing attested yet"
          description="Flag an item and attest to it on the Flag Items page first — a letter can't be generated without at least one attested item."
        />
      ) : (
        <LetterGenerator attestedItems={attestedItems} pastLetters={letters} />
      )}

      {letters.length > 0 && (
        <div className="card" style={{ marginTop: '28px' }}>
          <h3>Your letters</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>To</th>
                  <th>Type</th>
                  <th>Generated</th>
                  <th>Downloaded</th>
                </tr>
              </thead>
              <tbody>
                {letters.map((letter) => (
                  <tr key={letter.id}>
                    <td>{letter.recipientName || (letter.bureau && BUREAU_LABELS[letter.bureau])}</td>
                    <td>{RECIPIENT_TYPE_LABELS[letter.recipientType] || letter.recipientType}</td>
                    <td className="text-faint">{new Date(letter.generatedAt).toLocaleDateString()}</td>
                    <td className="text-faint">
                      {letter.downloadedAt ? new Date(letter.downloadedAt).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-faint" style={{ fontSize: '0.85rem', marginTop: '12px' }}>
            Once you&apos;ve mailed one, log it in the{' '}
            <Link href="/dashboard/lab/credit/tracker">Dispute Tracker</Link> to keep your own timeline.
          </p>
        </div>
      )}
    </>
  );
}
