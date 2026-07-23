// app/dashboard/blueprint/page.js — Blueprint tab (CHEW Rebuild Kit,
// Section 4): "the delivered assessment as a living document."
//
// No Clerk-to-application link exists yet, so there's no real assessment
// to render here — honest pending state, same reasoning as Dashboard v1.

import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import { IconShield } from '../../components/icons';

export default function BlueprintPage() {
  return (
    <>
      <PageHeader
        eyebrow="Blueprint"
        title="Your Financial Blueprint Assessment"
        description="A complete diagnostic of your financial infrastructure — systems, habits, business readiness, cash flow, and credit profile as one component among many."
      />

      <EmptyState
        icon={<IconShield />}
        title="Your Blueprint isn't ready yet"
        description="Once your application is reviewed, your Readiness Score and personalized roadmap will live here as a document you can return to any time — not a one-time PDF."
      />
    </>
  );
}
