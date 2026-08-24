// app/dashboard/lab/credit/walkthrough/page.js — Report Walkthrough.
//
// Pure education: how to pull your own free reports, and what each section
// means in plain English. No DB reads/writes here — nothing to persist for
// a walkthrough. Gated by app/dashboard/lab/credit/layout.js like every
// other Credit room route. Accuracy guard in the copy itself: every section
// below describes what a field IS, never whether a given entry looks
// "wrong" — that judgment call stays with the client (see Flag Items).
//
// Tone: this is where the doctrine's "psychology of money" section is most
// directly true — pulling your own report and actually reading it is a
// genuinely tense moment for a lot of people (what if there's something
// bad in there?). Steps 1-3 in particular are written to meet that gently,
// not just to convey information.

import PageHeader from '../../../../components/PageHeader';
import CreditRoomSubNav from '../../../../components/lab/credit/CreditRoomSubNav';

const STEPS = [
  {
    label: 'Step 1',
    title: 'Get your three free reports',
    body: (
      <>
        <p>
          Before anything else — pulling your own report doesn&apos;t hurt your score, and it
          doesn&apos;t obligate you to do anything with what you find. There&apos;s no shame in
          not having looked before. Most people haven&apos;t.
        </p>
        <p>
          Go to{' '}
          <a href="https://www.annualcreditreport.com" target="_blank" rel="noopener noreferrer">
            annualcreditreport.com
          </a>{' '}
          — the only site authorized by federal law to give you free credit reports from all
          three bureaus. It takes about ten minutes.
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
        <p>
          The biggest section, and usually the one that takes a breath before opening. Come sit
          with it at your own pace — you can close the tab and come back. Each account — credit
          cards, auto loans, mortgages, student loans — shows:
        </p>
        <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}>
          <li><strong>Creditor name</strong> — who the account is with.</li>
          <li><strong>Account status</strong> — open, closed, current, past due, in collections, or charged off.</li>
          <li><strong>Balance</strong> and credit limit or original loan amount.</li>
          <li><strong>Payment history</strong> — usually a grid of the last 24+ months.</li>
          <li><strong>Date opened</strong> and date of last activity.</li>
        </ul>
        <p>
          Read through every account and ask yourself one question for each: <em>do I recognize
          this, and did I authorize it?</em> That&apos;s it — you&apos;re not grading yourself or
          the account, just checking whether it&apos;s yours. An account you do recognize, even one
          you&apos;d rather forget, isn&apos;t something to flag — it's accurate, and accurate
          information belongs on a report. This walkthrough is only about finding what
          <em> isn&apos;t</em> actually yours.
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
  {
    label: 'Step 6',
    title: 'The other two bureaus almost nobody checks',
    body: (
      <>
        <p>
          Equifax, Experian, and TransUnion aren&apos;t the only companies keeping a file on you.{' '}
          <strong>LexisNexis Risk Solutions</strong> and <strong>Innovis</strong> are &quot;secondary&quot;
          consumer reporting agencies — they compile their own separate reports, sometimes used for
          insurance or background checks, and something can be wrong on one of these without ever
          showing up on your &quot;big three&quot; reports.
        </p>
        <p>
          Both owe you one free report a year, same as the big three, just requested separately:
        </p>
        <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <li>
            LexisNexis: request online at{' '}
            <a href="https://consumer.risk.lexisnexis.com/request" target="_blank" rel="noopener noreferrer">
              consumer.risk.lexisnexis.com/request
            </a>{' '}
            or by phone at 1-866-897-8126.
          </li>
          <li>
            Innovis: request online at{' '}
            <a href="https://www.innovis.com/personal/creditReport" target="_blank" rel="noopener noreferrer">
              innovis.com
            </a>{' '}
            or by phone at 1-800-877-3100.
          </li>
        </ul>
        <p style={{ marginTop: '10px' }}>
          These aren&apos;t urgent the way your first report is — most people are fine to come back
          to this step later. Read them the same way: do you recognize each entry, did you authorize it.
        </p>
      </>
    ),
  },
  {
    label: 'Know your rights',
    title: 'What the law actually gives you',
    body: (
      <>
        <p>
          This is general information about the Fair Credit Reporting Act (FCRA), not legal advice
          about your specific situation — for that, talk to a licensed attorney. But the basics are
          worth knowing before you flag anything:
        </p>
        <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
          <li>
            <strong>§609</strong> gives you the right to request the actual contents of your file
            from a reporting agency — it&apos;s the basis for Step 1 and Step 6 above.
          </li>
          <li>
            <strong>§611</strong> is the one that actually moves things: once you dispute an item
            with a bureau, they must reasonably reinvestigate — generally within 30 days — and
            delete or fix anything that can&apos;t be verified.
          </li>
          <li>
            <strong>§623</strong> covers furnishers — the actual creditors who report to the
            bureaus. They can&apos;t knowingly report inaccurate information, and they have to
            investigate a dispute you send them directly, not just ones a bureau forwards.
          </li>
        </ul>
        <p style={{ marginTop: '10px' }}>
          The Letters tool uses these same citations, matched to whoever you&apos;re actually
          writing to.
        </p>
      </>
    ),
  },
];

export default function CreditWalkthroughPage() {
  return (
    <>
      <PageHeader
        eyebrow="The Lab · Credit"
        title="Report Walkthrough"
        description="How to pull your own credit reports and read each section, in plain English."
      />

      <CreditRoomSubNav />

      {STEPS.map((step) => (
        <div key={step.title} className="card" style={{ marginBottom: '16px' }}>
          <span className="badge badge-pending" style={{ marginBottom: '10px' }}>{step.label}</span>
          <h3>{step.title}</h3>
          {step.body}
        </div>
      ))}

      <div className="alert">
        <span>
          Once you&apos;ve been through your reports, you&apos;re ready to{' '}
          <a href="/dashboard/lab/credit/flag">flag anything you don&apos;t recognize or didn&apos;t
          authorize</a>. You decide what gets flagged; CHEW never decides for you.
        </span>
      </div>
    </>
  );
}
