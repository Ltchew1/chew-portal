// lib/todayIntelligence.js
//
// Pure composition layer behind the portal's home screen ("Today" — see
// app/dashboard/page.js). Every other room-level signal already exists
// (lib/homeIntelligence.js, lib/intelligenceCore.js); this file does not
// invent new intelligence, it only reshapes what's real into the five
// questions Today has to answer: Where am I? What changed? What matters
// now? What move should I make next? What becomes possible afterward?
//
// Kept side-effect-free and DB-free, same pattern as buildCreditIntelligence
// — everything here is a pure function over already-fetched data, so it's
// directly testable and never itself decides what's true.
//
// Nothing in this file fabricates state. Where CHEW genuinely doesn't have
// verified data yet (every room but Credit, today), the honest label is
// "not yet connected" / "not yet built" — never a invented score, state,
// or opportunity. See the portal directive's EMPTY STATES section.

import { hasRequiredStatus } from './clientStatus';

const STATUS_LABELS = { applicant: 'Applicant', accepted: 'Accepted', paid: 'Paid' };

export function timeOfDayGreeting(now = new Date()) {
  const h = now.getHours();
  if (h < 12) return 'Good morning.';
  if (h < 18) return 'Good afternoon.';
  return 'Good evening.';
}

// Whether the client's real economic-intelligence room (Credit, today) is
// even reachable at their current account status — the same gate
// lib/clientStatus.js enforces on the room itself. Today never renders a
// "next move" that points at a page the client can't actually open.
export function canSeeRoomIntelligence(status, room) {
  return hasRequiredStatus(status, room.requiredStatus);
}

// "3 things changed. 1 deserves your attention today." — both numbers
// computed from real signals already on the reconciled room object, never
// a flat notification count. A barrier is always attention-worthy; the
// recommendation itself only counts if CHEW is actually asking for
// something (not "on_track"/nothing-to-do).
export function buildChangeSummary(rooms) {
  let changedCount = 0;
  let attentionCount = 0;
  for (const room of rooms) {
    changedCount += room.whatChanged?.length ?? 0;
    attentionCount += room.activeBarriers?.length ?? 0;
    if (room.nextBestMove && room.planStatus && room.planStatus !== 'on_track') {
      attentionCount += 1;
    }
  }
  return { changedCount, attentionCount };
}

// Before a client has verified activity in any room (or hasn't reached the
// status required to see one), Today still owes them a real move — just an
// account-level one instead of a room-level one. These are the same honest
// starter steps the old static dashboard listed, now attached to the
// client's actual status rather than shown to everyone regardless of it.
const ACCOUNT_LEVEL_MOVES = {
  applicant: {
    action: 'Complete your Financial Blueprint intake',
    why: 'Your Blueprint is what CHEW and your strategist review to determine your account status and which rooms open next.',
    href: '/dashboard/blueprint',
    linkLabel: 'Go to Blueprint',
  },
  accepted: {
    action: 'Book your strategy session',
    why: 'A strategist walks through your Blueprint with you and sets the plan that unlocks your paid rooms.',
    href: '/dashboard/appointments',
    linkLabel: 'Go to Appointments',
  },
};

export function buildAccountLevelMove(status) {
  return ACCOUNT_LEVEL_MOVES[status] ?? null;
}

// Life Map preview — one node per real room (lib/rooms.js), never a
// fabricated domain with no room behind it. State is computed only from
// data that actually exists: Credit's reconciled planStatus when the
// client can see it, "Locked" when their status doesn't clear the room's
// gate yet, "Not yet built" for every room that isn't live regardless of
// status. No node here is ever a guess.
const PLAN_STATUS_TO_NODE_STATE = {
  on_track: { state: 'stable', label: 'Stable' },
  watch: { state: 'improving', label: 'Watch' },
  action_needed: { state: 'needs_attention', label: 'Needs attention' },
  plan_at_risk: { state: 'blocked', label: 'Blocked' },
};

// The relational Life Map's real substructure — only ever attached to the
// one room with an actual data model behind it (Credit, today). Every
// sub-node here is read straight off lib/barriers.js/opportunities.js rows
// (both carry a real relatedGoalId — see db/schema.sql), never invented to
// fill out the graph. A room with no barriers/opportunities/move simply
// gets an empty list — the map shows an honestly quiet territory, not a
// fabricated connection.
function buildCreditSubNodes(creditIntel) {
  if (!creditIntel) return null;
  // Ordered as the real chain the directive asks for: current state (the
  // goal) -> barrier -> move -> opportunity. Each one is only present when
  // the real row backing it exists — `goal` is null the moment no score
  // goal has been set, never a placeholder value.
  const goal = creditIntel.goal
    ? { id: 'goal', kind: 'goal', label: `Score goal: ${creditIntel.goal.targetValue}` }
    : null;
  const move = creditIntel.nextBestMove
    ? { id: 'move', kind: 'move', label: creditIntel.nextBestMove.action }
    : null;
  const barriers = (creditIntel.activeBarriers ?? []).map((b) => ({
    id: `barrier-${b.id}`, kind: 'barrier', label: b.title, severity: b.severity,
  }));
  const opportunities = (creditIntel.activeOpportunities ?? []).map((o) => ({
    id: `opportunity-${o.id}`, kind: 'opportunity', label: o.title,
  }));
  return { goal, move, barriers, opportunities };
}

export function buildLifeMapGraph({ rooms, status, isRoomLive, creditIntel }) {
  const domains = buildLifeMapDomains({ rooms, status, isRoomLive, creditIntel });
  return domains.map((domain) => ({
    ...domain,
    subNodes: domain.slug === 'credit' ? buildCreditSubNodes(creditIntel) : null,
  }));
}

export function buildLifeMapDomains({ rooms, status, isRoomLive, creditIntel }) {
  return rooms.map((room) => {
    const unlocked = hasRequiredStatus(status, room.requiredStatus);
    const live = isRoomLive(room.slug);
    const enterable = unlocked && live;

    if (!live) {
      return {
        slug: room.slug, name: room.name, href: room.href, enterable: false,
        state: 'unbuilt', stateLabel: 'Not yet built',
        detail: 'This room is still being built — no data model connected yet.',
      };
    }
    if (!unlocked) {
      return {
        slug: room.slug, name: room.name, href: room.href, enterable: false,
        state: 'locked', stateLabel: 'Locked',
        detail: `Unlocks at ${STATUS_LABELS[room.requiredStatus]}.`,
      };
    }
    // Only Credit has a real intelligence signal today (see
    // lib/homeIntelligence.js's header comment) — every other live-but-
    // unmapped room honestly reads "Unknown" rather than an invented state.
    if (room.slug === 'credit' && creditIntel) {
      if (!creditIntel.planStatus) {
        return {
          slug: room.slug, name: room.name, href: room.href, enterable,
          state: 'unknown', stateLabel: 'Not started',
          detail: 'No verified data yet — start with the Report Walkthrough.',
        };
      }
      const mapped = PLAN_STATUS_TO_NODE_STATE[creditIntel.planStatus] ?? { state: 'unknown', label: 'Unknown' };
      return {
        slug: room.slug, name: room.name, href: room.href, enterable,
        state: mapped.state, stateLabel: mapped.label,
        detail: creditIntel.nextBestMove?.action ?? 'No open item right now.',
      };
    }
    return {
      slug: room.slug, name: room.name, href: room.href, enterable,
      state: 'unknown', stateLabel: 'Unknown',
      detail: 'CHEW doesn\'t have verified data connected for this room yet.',
    };
  });
}

// Opportunity Ladder preview — "Available now" holds only real, already-
// vetted opportunities (lib/homeIntelligence.js's grounded opportunities
// array, never speculative). Everything else is one honest "Locked" bucket
// with a real count and a real reason, per the directive's "no mysterious
// locks" — the reason here is always "not enough verified data," which is
// true today for every room but Credit.
// Visual consequence: "if a constraint disappears, show that relationship"
// (portal directive). lib/intelligenceCore.js already logs a real
// 'back_on_track' notification the moment a barrier resolves — this just
// reads that back for the window Today cares about, rather than
// inventing a separate "resolved" concept. Real event, real timestamp,
// never a fabricated animation trigger.
const RESOLVED_WINDOW_DAYS = 14;

export function buildRecentlyResolved(notifications, now = new Date()) {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - RESOLVED_WINDOW_DAYS);
  return (notifications ?? []).filter((n) => n.type === 'back_on_track' && new Date(n.createdAt) >= cutoff);
}

export function buildOpportunityLadder({ creditIntel, dormantRoomCount }) {
  const availableNow = creditIntel?.opportunities ?? [];
  return {
    availableNow,
    locked: {
      count: dormantRoomCount,
      note: dormantRoomCount > 0
        ? `CHEW doesn't have enough verified information yet to identify opportunities in ${dormantRoomCount} other room${dormantRoomCount === 1 ? '' : 's'}.`
        : null,
    },
  };
}
