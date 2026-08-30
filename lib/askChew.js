// lib/askChew.js
//
// "Ask CHEW" — a real, honest router, not a chatbot pretending to
// understand more than it does. Deliberately not an LLM call: the whole
// Credit room's compliance model depends on every possible output being
// known in advance and auditable (see lib/letterContent.js's comment on
// the same choice), and a natural-language answer engine sits outside that
// guarantee entirely. So instead of generating prose, Ask CHEW matches
// intent to the right destination in the portal — the same job a very good
// front-desk person does: "here's exactly where that lives," not "let me
// tell you what I think about it."
//
// Pure function, no DB access — easy to test. Deliberately does NOT decide
// whether a matched room is actually live: that's an async, DB-backed
// question (lib/features.js's feature registry, the one real source of
// truth — see the network/feature-flag directive's "hidden UI is not
// security"), so the API route resolves it after matching, the same
// pattern already used there for the score-goal dispatch.

// Ordered by specificity — the first matching entry wins, so more specific
// phrasing (e.g. "cfpb complaint") should sit above a broader one (e.g.
// "credit") that would otherwise catch it first.
const INTENTS = [
  {
    keywords: ['cfpb', 'ftc', 'escalate', 'escalation', 'no response', 'never heard back', 'complaint'],
    href: '/dashboard/lab/credit/letters',
    label: 'Letters — Escalate',
    blurb: 'Generate a CFPB or FTC complaint that follows up on a letter you already sent.',
    room: 'credit',
  },
  {
    keywords: ['furnisher', 'creditor directly', 'contact the creditor'],
    href: '/dashboard/lab/credit/letters',
    label: 'Letters',
    blurb: 'Generate a letter directly to the creditor that furnished the item.',
    room: 'credit',
  },
  {
    keywords: ['track', 'tracker', 'mailed', 'did i hear back', 'status of my dispute', 'what happened to my letter'],
    href: '/dashboard/lab/credit/tracker',
    label: 'Dispute Tracker',
    blurb: 'Log what you mailed and what happened, or check where things stand.',
    room: 'credit',
  },
  {
    keywords: ['letter', 'dispute letter', 'write to', 'mail a letter'],
    href: '/dashboard/lab/credit/letters',
    label: 'Letters',
    blurb: 'Generate a dispute letter for anything you\'ve already flagged and attested.',
    room: 'credit',
  },
  {
    keywords: ['flag', "don't recognize", 'not mine', "didn't authorize", 'dispute an item', 'wrong on my report', 'error on my report'],
    href: '/dashboard/lab/credit/flag',
    label: 'Flag Items',
    blurb: 'Flag an account you don\'t recognize or didn\'t authorize, and attest to it.',
    room: 'credit',
  },
  {
    keywords: ['pull my report', 'free report', 'annualcreditreport', 'read my report', 'understand my report', 'credit report'],
    href: '/dashboard/lab/credit/walkthrough',
    label: 'Report Walkthrough',
    blurb: 'How to pull your free reports and what each section actually means.',
    room: 'credit',
  },
  {
    keywords: ['score', 'target', '700', '720', '750', '780', '800', 'credit goal'],
    href: '/dashboard/lab/credit',
    label: 'Credit',
    blurb: 'Set a score target and see your gap, based on the score you\'ve told CHEW about.',
    room: 'credit',
    dispatch: 'score_goal',
  },
  {
    keywords: ['denied', 'declined', 'rejected'],
    href: '/dashboard/lab/credit',
    label: 'Credit',
    blurb: 'Start with what\'s actually on your report — a denial is usually a credit-profile question first.',
    room: 'credit',
  },
  {
    keywords: ['secured card', 'authorized user', 'tradeline', 'build credit', 'rent reporting'],
    href: '/dashboard/lab/credit-builder',
    label: 'Credit Builder',
    blurb: 'Building credit history deliberately, one step at a time.',
    room: 'credit-builder',
  },
  {
    keywords: ['business', 'llc', 'entity', 'ein', 'sunbiz', 'operating agreement', 'laundromat', 'buy a business', 'start a company'],
    href: '/dashboard/lab/business',
    label: 'Business',
    blurb: 'Structuring and crediting a business.',
    room: 'business',
  },
  {
    keywords: ['funding', 'loan', 'lender', 'line of credit', 'capital', 'grant', '$25,000', 'high-limit card', 'credit limit'],
    href: '/dashboard/lab/funding',
    label: 'Funding',
    blurb: 'What lenders actually look for, and how to close the gaps yourself.',
    room: 'funding',
  },
  {
    keywords: ['invest', 'investment', 'property', 'real estate', 'buy a house', 'rental', 'mortgage'],
    href: '/dashboard/lab/intelligence',
    label: 'Financial Intelligence',
    blurb: 'Real data on the moves you\'re weighing — no guarantees, just what the numbers say.',
    room: 'intelligence',
  },
  {
    keywords: ['budget', 'cash flow', 'banking', 'chexsystems', 'savings', 'reserve'],
    href: '/dashboard/lab/money-systems',
    label: 'Money Systems',
    blurb: 'The infrastructure behind day-to-day financial capability.',
    room: 'money-systems',
  },
];

// Pulls a plausible target score (300-900) out of free text like "I want a
// 750" or "750 score" — used by the API route to actually dispatch a goal
// update, not just link to the page. Deliberately narrow: only fires on a
// 3-digit number in the real credit-score range, never guesses.
export function parseScoreTarget(text) {
  const match = (text ?? '').match(/\b([3-8]\d{2}|900)\b/);
  if (!match) return null;
  const value = Number(match[1]);
  return value >= 300 && value <= 900 ? value : null;
}

// Returns { matched, label, blurb, href, roomSlug, dispatch } — the caller
// (app/api/home/ask/route.js) resolves roomSlug against the feature
// registry to decide whether this is actually reachable right now, and
// shapes the final response accordingly. See that route for the one
// intent (score/target) currently wired to actually dispatch a write
// (setting the goal), rather than only linking — the architecture Ask CHEW
// is meant to grow into for every intent, per the portal directive: "Ask
// CHEW isn't primarily supposed to answer questions — it should
// increasingly activate CHEW systems."
export function routeAskChew(text) {
  const q = (text ?? '').toLowerCase().trim();
  if (!q) {
    return { matched: false };
  }

  for (const intent of INTENTS) {
    if (intent.keywords.some((kw) => q.includes(kw))) {
      return {
        matched: true,
        label: intent.label,
        blurb: intent.blurb,
        href: intent.href,
        roomSlug: intent.room,
        dispatch: intent.dispatch ?? null,
      };
    }
  }

  return { matched: false };
}
