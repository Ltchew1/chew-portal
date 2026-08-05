// app/dashboard/credit-lab/walkthrough/page.js — Layer 4a: Report Walkthrough.
//
// Pure education: how to pull your own free reports, and what each section
// means in plain English. No DB reads/writes here — nothing to persist for
// a walkthrough. Gated by app/dashboard/credit-lab/layout.js like every
// other Credit Lab route. Accuracy guard in the copy itself: every section
// below describes what a field IS, never whether a given entry looks
// "wrong" — that judgment call stays with the client (Layer 4b).

import PageHeader from '../../../components/PageHeader';
import CreditLabSubNav from '../../../components/credit-lab/CreditLabSubNav';

const STEPS = [
  {
    label: 'Step 1',
    title: 'Get your three free reports',
    body: (
      <>
        <p>
          Go to{' '}
          <a href="https://www.annualcreditreport.com" target="_blank" rel="noopener noreferrer">
            annualcreditreport.com
          </a>{' '}
          — the only site authorized by federal law to give you free credit reports from all
          three bureaus. It takes about ten minutes and doesn&apos;t affect your credit score.
        </p>
        <p>
          Request all three: Equifax, Experian, and TransUnion. They&apos;re compiled separately
          and often differ from each other, so pulling only one means you might miss something.
          Download or print each one so you can look them over side by side.
        </p>
      </>
    ),
  },
  {
    label: 'Step 2',
    title: 'Personal Information',
    body: (
      <p>
        At the top of each report: your name, current and past addresses, date of birth, and past
        employers. This is the easiest section to check first — does everything here actually
        belong to you? An unfamiliar old address isn&apos;t automatically a problem (bureaus pull
        from public records and it can just be outdated), but a name or address that looks like it
        belongs to a stranger is worth a closer look.
      </p>
    ),
  },
  {
    label: 'Step 3',
    title: 'Accounts (also called "Tradelines")',
    body: (
      <>
        <p>The biggest section. Each account — credit cards, auto loans, mortgages, student loans — shows:</p>
        <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}>
          <li><strong>Creditor name</strong> — who the account is with.</li>
          <li><strong>Account status</strong> — open, closed, current, past due, in collections, or charged off.</li>
          <li><strong>Balance</strong> and credit limit or original loan amount.</li>
          <li><strong>Payment history</strong> — usually a grid of the last 24+ months.</li>
          <li><strong>Date opened</strong> and date of last activity.</li>
        </ul>
        <p>
          Read through every account and ask yourself one question for each: <em>do I recognize
          this, and did I authorize it?</em> That&apos;s it — you&apos;re not grading the account,
          just checking whether it&apos;s yours.
        </p>
      </>
    ),
  },
  {
    label: 'Step 4',
    title: 'Credit Inquiries',
    body: (
      <p>
        Inquiries record who&apos;s looked at your credit. <strong>Hard inquiries</strong> happen
        when you apply for new credit and can stay on your report about two years.{' '}
        <strong>Soft inquiries</strong> — checking your own score, or a company pre-screening you
        for an offer — don&apos;t affect anything and are usually shown separately. A hard inquiry
        from a company you never applied to is worth noting.
      </p>
    ),
  },
  {
    label: 'Step 5',
    title: 'Public Records & Collections',
    body: (
      <p>
        Bankruptcies and any accounts sent to a collections agency show up here. Not everyone has
        entries in this section. If you do, ask the same two questions: is this account yours, and
        did you authorize it?
      </p>
    ),
  },
];

export default function CreditLabWalkthroughPage() {
  return (
    <>
      <PageHeader
        eyebrow="CHEW Credit Lab"
        title="Report Walkthrough"
        description="How to pull your own credit reports and read each section, in plain English."
      />

      <CreditLabSubNav />

      {STEPS.map((step) => (
        <div key={step.title} className="card" style={{ marginBottom: '16px' }}>
          <span className="badge badge-pending" style={{ marginBottom: '10px' }}>{step.label}</span>
          <h3>{step.title}</h3>
          {step.body}
        </div>
      ))}

      <div className="alert">
        <span>
          Once you&apos;ve been through all three reports, you&apos;re ready to flag anything you
          don&apos;t recognize or didn&apos;t authorize — on the{' '}
          <a href="/dashboard/credit-lab">Credit Lab overview</a>. You decide what gets flagged;
          CHEW never decides for you.
        </span>
      </div>
    </>
  );
}
