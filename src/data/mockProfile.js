// ------------------------------------------------------------
// Mock data for the public profile page (?mock=profile).
// Shaped like what the real API would send: raw values, no
// formatting. buildProfileJson turns it into what the page shows.
//
// Add &state=<id> to the URL to see other situations:
//   default     an established coach with calls and priority DMs
//   calls-only  calls but no DMs, so no filter tabs
//   new         a brand-new coach: no ratings, bookings or reviews yet
//   single      only one call on offer
// ------------------------------------------------------------

const creator = {
  id: 'cr-meera',
  name: 'Meera Joshi',
  handle: 'meerajoshi',
  photo: null, // image URL, or null to show initials
  headline: 'Life & relationship coach',
  bio:
    'I spent 14 years in corporate HR before I trained as a coach. Now I help people who feel stuck, ' +
    'in a relationship, a career or their own head, understand what keeps happening and change it. ' +
    'My sessions are calm, practical and confidential, and you always leave with something to try that week.',
  rating: 4.9,
  ratingCount: 21,
  bookingCount: 80,
};

//   kind: 'call' | 'dm' (see serviceKinds.js; unknown kinds aren't shown)
//   price / comparePrice: rupees. price 0 = free; comparePrice is the crossed-out price, or null
//   calls only: durationMins, format ('video' | 'phone')
//   DMs only:   replyWithinDays
//   about:   paragraphs for the service's own page (optional; falls back to description)
//   status: 'active' | 'inactive' (inactive ones aren't shown)
//   order: position on the page, set by the creator
const services = [
  {
    id: 'call-discovery',
    kind: 'call',
    title: 'Discovery call',
    description:
      "Not sure where to start? We'll talk about what's going on and whether working together makes sense.",
    about: [
      "A short, no-pressure call to get to know each other. Tell me what's been going on, and I'll ask a few questions to understand it better.",
      "By the end, you'll know whether coaching with me is a good fit, and which kind of session would help most. If it isn't the right fit, I'll say so and suggest where to look instead.",
    ],
    durationMins: 15,
    format: 'video',
    price: 0,
    comparePrice: null,
    image: null,
    rating: 4.9,
    ratingCount: 9,
    status: 'active',
    order: 1,
  },
  {
    id: 'call-coaching',
    kind: 'call',
    title: '1:1 coaching session',
    description: "A focused hour on one thing that's weighing on you, with clear next steps to take away.",
    about: [
      "Bring one thing that's been weighing on you: a decision you keep putting off, a pattern at work or at home, or a feeling you can't shake. We'll spend the hour on that alone.",
      "We'll get to what's really underneath it, then agree on one or two small things for you to try in the week after. You'll get a short written summary by email afterwards.",
    ],
    durationMins: 60,
    format: 'video',
    price: 2500,
    comparePrice: 3000,
    image: null,
    rating: 5,
    ratingCount: 8,
    status: 'active',
    order: 2,
  },
  {
    id: 'call-inner-child',
    kind: 'call',
    title: 'Inner child healing session',
    description: 'A gentle, guided session to understand old patterns and begin letting them go.',
    about: [
      'Many of the ways we react as adults were learned early on. In this session I guide you, gently and at your pace, to notice where a pattern began and what it was protecting you from.',
      "It's calm and conversational, and you stay in control throughout. Many people find it best after a regular coaching session, but it isn't required.",
    ],
    durationMins: 75,
    format: 'video',
    price: 3500,
    comparePrice: null,
    image: null,
    rating: 4.8,
    ratingCount: 4,
    status: 'active',
    order: 3,
  },
  {
    id: 'call-relationship',
    kind: 'call',
    title: 'Relationship clarity call',
    description:
      'For couples or individuals stuck in the same argument. Leave knowing the one honest conversation to have.',
    durationMins: 45,
    format: 'phone',
    price: 1800,
    comparePrice: null,
    image: null,
    rating: null,
    ratingCount: 0,
    status: 'active',
    order: 4,
  },
  {
    id: 'call-festive-reset',
    kind: 'call',
    title: 'Festive season reset',
    description: 'A one-off offer from last year.',
    durationMins: 30,
    format: 'video',
    price: 999,
    comparePrice: null,
    image: null,
    rating: null,
    ratingCount: 0,
    status: 'inactive', // shouldn't appear on the page
    order: 9,
  },
  {
    id: 'dm-quick',
    kind: 'dm',
    title: 'Ask me one question',
    description:
      'Stuck on something about a relationship, stress or work? Send it in and get a thoughtful written answer.',
    replyWithinDays: 2,
    price: 299,
    comparePrice: null,
    image: null,
    rating: 5,
    ratingCount: 6,
    status: 'active',
    order: 5,
  },
  {
    id: 'dm-review',
    kind: 'dm',
    title: 'Review my situation',
    description:
      "Describe what's going on in as much detail as you like. You'll get a written plan with clear next steps.",
    replyWithinDays: 3,
    price: 799,
    comparePrice: 999,
    image: null,
    rating: null,
    ratingCount: 0,
    status: 'active',
    order: 6,
  },
];

//   name: null when they left it anonymously
//   pinned: the creator chose to show it first
//   date: YYYY-MM-DD
const testimonials = [
  {
    id: 't1',
    name: 'Ananya R.',
    serviceId: 'call-coaching',
    text:
      'I came in with focus problems, constant distraction and a short temper. One session gave me a way to ' +
      "notice it happening, and three weeks later I'm still using it.",
    date: '2026-01-05',
    pinned: true,
  },
  {
    id: 't2',
    name: 'Jevin S.',
    serviceId: 'call-discovery',
    text: 'Even the short discovery call was insightful. Meera listened properly and was honest about what would help.',
    date: '2026-08-24',
    pinned: false,
  },
  {
    id: 't3',
    name: 'Puja H.',
    serviceId: 'call-inner-child',
    text: 'I felt lighter and calmer afterwards. It was a lot gentler than I expected.',
    date: '2026-10-12',
    pinned: false,
  },
  {
    id: 't4',
    name: null,
    serviceId: 'call-coaching',
    text: 'Practical, kind, and no fluff. I finally understand why I keep reacting the way I do.',
    date: '2026-09-30',
    pinned: false,
  },
  {
    id: 't5',
    name: 'Rohit and Sana',
    serviceId: 'call-relationship',
    text: "We'd had the same fight for a year. We left the call knowing exactly what we were actually arguing about.",
    date: '2026-07-18',
    pinned: false,
  },
  {
    id: 't6',
    name: 'Kavya M.',
    serviceId: 'dm-quick',
    text: 'I sent one question late at night and had a calm, clear answer two days later. Exactly what I needed.',
    date: '2026-10-02',
    pinned: false,
  },
];

const calls = services.filter((s) => s.kind === 'call');

const states = {
  default: { creator, services, testimonials },
  'calls-only': {
    creator,
    services: calls,
    testimonials: testimonials.filter((t) => calls.some((s) => s.id === t.serviceId)),
  },
  new: {
    creator: { ...creator, rating: null, ratingCount: 0, bookingCount: 0 },
    services: services.map((s) => ({ ...s, rating: null, ratingCount: 0 })),
    testimonials: [],
  },
  single: {
    creator,
    services: services.filter((s) => s.id === 'call-coaching'),
    testimonials: testimonials.filter((t) => t.serviceId === 'call-coaching'),
  },
};

export const PROFILE_STATES = Object.keys(states);

// One situation's raw data. Unknown ids fall back to the default.
export function getMockProfile(state) {
  return states[state] ?? states.default;
}