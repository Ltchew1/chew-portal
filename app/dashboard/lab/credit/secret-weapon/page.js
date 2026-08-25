// app/dashboard/lab/credit/secret-weapon/page.js — YOUR CREDIT SECRET WEAPON.
//
// Built now, using only verified existing data (per the directive: "the
// containers themselves do not [need more data]") — a synthesis of the
// same reconciled Credit intelligence shown on the room overview and War
// Room, in a different, more strategic-feeling shape. Gated by
// app/dashboard/lab/credit/layout.js (Paid) like every other Credit route.

import Link from 'next/link';
import PageHeader from '../../../../components/PageHeader';
import CreditRoomSubNav from '../../../../components/lab/credit/CreditRoomSubNav';
import EmptyState from '../../../../components/EmptyState';
import LockedFeatureCard from '../../../../components/lab/LockedFeatureCard';
import { IconSparkles, IconChevronRight } from '../../../../components/icons';
import { reconcileCreditIntelligence } from '../../../../../lib/intelligenceCore';
import { buildCreditSecretWeapon } from '../../../../../lib/secretWeapon';
import { getFeatureAccess } from '../../../../../lib/features';
import { STATUS_LABELS } from '../../../../../lib/featureCopy';

function Section({ label, children }) {
  return (
    <div style={{ marginBottom: '18px' }}>
      <span className="text-faint" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      <div style={{ marginTop: '4px' }}>{children}</div>
    </div>
  );
}

function ListSection({ label, items }) {
  return (
    <Section label={label}>
      <ul style={{ paddingLeft: '18px', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {items.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
    </Section>
  );
}

export default async function CreditSecretWeaponPage() {
  const { user, hasAccess, feature } = await getFeatureAccess('credit_secret_weapon');
  if (!hasAccess) {
    return (
      <>
        <PageHeader eyebrow="The Lab · Credit" title="Your Credit Secret Weapon" description="A strategic synthesis of your plan." />
        <CreditRoomSubNav />
        <LockedFeatureCard
          icon={<IconSparkles />}
          name={feature?.name ?? 'Your Credit Secret Weapon'}
          description={feature?.description ?? 'A deeper strategic synthesis is coming to CHEW.'}
          statusLabel={STATUS_LABELS[feature?.status] ?? STATUS_LABELS.locked}
        />
      </>
    );
  }

  const intel = await reconcileCreditIntelligence(user.id);
  const started = intel.planStatus !== null;

  return (
    <>
      <PageHeader
        eyebrow="The Lab · Credit"
        title="Your Credit Secret Weapon"
        description="A strategic synthesis of exactly what CHEW knows about your Credit plan right now."
      />

      <CreditRoomSubNav />

      {!started ? (
        <EmptyState
          icon={<IconSparkles />}
          title="Not enough logged yet"
          description="Flag your first item and this fills in — it gets more sophisticated the more CHEW knows."
          action={
            <Link href="/dashboard/lab/credit/walkthrough" className="btn btn-gold btn-sm">
              Start with the Report Walkthrough <IconChevronRight />
            </Link>
          }
        />
      ) : (
        (() => {
          const weapon = buildCreditSecretWeapon(intel);
          return (
            <div className="card">
              <Section label="Your Target">{weapon.target}</Section>
              <Section label="What Matters Most">{weapon.whatMattersMost}</Section>
              <Section label="What Doesn't Matter Right Now">{weapon.whatDoesntMatter}</Section>
              <Section label="Your Strongest Advantage">{weapon.strongestAdvantage}</Section>
              <Section label="Your Biggest Constraint">{weapon.biggestConstraint}</Section>
              <ListSection label="Your Move Sequence" items={weapon.sequence} />
              <ListSection label="What Could Knock You Off Track" items={weapon.whatCouldKnockYouOffTrack} />
              <ListSection label="What CHEW Will Watch" items={weapon.whatChewWillWatch} />
              <Section label="What Unlocks Next">{weapon.whatUnlocksNext}</Section>
            </div>
          );
        })()
      )}
    </>
  );
}
