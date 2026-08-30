// app/components/lab/tour/tourSteps.js
//
// Content for the first-visit guided tour at /dashboard/lab. `voiceoverId`
// is an inert hook for a future AI-voiceover pass — nothing reads it yet,
// and TourExperience must never wait on audio to advance a step.
//
// Note: this deliberately does not make any claim about billing terms
// (subscription vs. lifetime access, pricing, etc.) — nothing in this
// codebase establishes what CHEW's actual terms are, and inventing one
// here would be a factual claim shown to real clients with no source of
// truth behind it. If "yours for life, not a subscription" is accurate,
// that copy should be added once confirmed.

export const TOUR_STEPS = [
  {
    id: 'welcome',
    voiceoverId: 'tour-welcome',
    eyebrow: 'CHEW: The Lab',
    title: (firstName) => `Welcome, ${firstName}.`,
    body: "This is your Lab — a private space built around where you're headed, not where you've been. Take a moment before you start.",
  },
  {
    id: 'how-it-works',
    voiceoverId: 'tour-how-it-works',
    eyebrow: 'How it works',
    title: () => 'You execute. We build the path.',
    body: "Every room gives you real tools and honest education — never something done to you, or for you, without your say. You stay in control of every step; we make sure you're never guessing what comes next.",
  },
  {
    id: 'rooms',
    voiceoverId: 'tour-rooms',
    eyebrow: 'Your rooms',
    title: () => 'Six rooms, one goal: yours.',
    body: 'Credit, Credit Builder, Business, Funding, Financial Intelligence, and Money Systems — each a focused space for a different part of your financial life. Rooms unlock as your account and your journey do.',
  },
  {
    id: 'enter',
    voiceoverId: 'tour-enter',
    eyebrow: 'Ready',
    title: () => 'Step in.',
    body: "The Lab remembers you from here — every time you come back, you'll land right where you left off.",
    cta: 'Enter The Lab',
  },
];
