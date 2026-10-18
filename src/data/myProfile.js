import { SETUP_STORAGE_KEY } from './myPage';
import { CALL_DEFAULTS, aboutParagraphs, callDescriptionOf, readMeetingLink } from './callDetails';

// ------------------------------------------------------------
// The creator's own page, built from their setup answers, in the
// same raw shape as mockProfile.js so the profile page can show it
// (?mock=profile&source=mine). Kept in this browser for now; in the
// real product it comes from the server.
// ------------------------------------------------------------

function loadAnswers() {
  try {
    return JSON.parse(localStorage.getItem(SETUP_STORAGE_KEY)) ?? {};
  } catch {
    return {};
  }
}

// The id of the creator's first call (made during setup), as it appears in booking links.
// Calls added later get ids that start the same way: 'my-call-<something>'.
export const MY_CALL_ID = 'my-call';

// Whose page a call belongs to: the creator's own calls read their setup
// answers; anything else is Meera's (mockProfile.js)
export const isMyCall = (serviceId) =>
  serviceId === MY_CALL_ID || String(serviceId ?? '').startsWith(`${MY_CALL_ID}-`);

// ------------------------------------------------------------
// Calls added from "Add a new offering", after setup. The first call
// stays where setup saved it (callTitle, callPrice, ... on the answers);
// added ones are kept beside it as answers.addedCalls, newest first.
// Each uses the same answer ids as the first call, plus its own id:
//   { id, createdAt, callTitle, callDuration, callFormat, callPricing,
//     callPrice, callComparePrice, callDescription, callAbout, serviceId }
// so the same fields and page-building work for every call.
// ------------------------------------------------------------
export const addedCallsOf = (answers) => (Array.isArray(answers?.addedCalls) ? answers.addedCalls : []);

// A fresh id for a new call, e.g. 'my-call-mgx3k2a1'
export const newCallId = () => `${MY_CALL_ID}-${Date.now().toString(36)}`;

// One call's answers by id: the first call is the setup answers themselves.
// null when there's no such call.
export function callAnswersOf(answers, id) {
  if (id === MY_CALL_ID) return answers;
  return addedCallsOf(answers).find((c) => c.id === id) ?? null;
}

// Answers that belong to the creator, not to one call, even when they're
// changed while editing a call: the meeting link every video call uses.
// These always save on the setup answers, so changing one changes it for every call.
export const SHARED_CALL_KEYS = ['meetingLink'];

// Splits changes into the creator's own (shared) and the call's
function splitShared(changes) {
  const shared = {};
  const own = {};
  Object.entries(changes).forEach(([key, value]) => {
    if (SHARED_CALL_KEYS.includes(key)) shared[key] = value;
    else own[key] = value;
  });
  return { shared, own };
}

// The answers with one call's changes saved
export function withCallChanges(answers, id, changes) {
  if (id === MY_CALL_ID) return { ...answers, ...changes };
  const { shared, own } = splitShared(changes);
  return {
    ...answers,
    ...shared,
    addedCalls: addedCallsOf(answers).map((c) => (c.id === id ? { ...c, ...own } : c)),
  };
}

// The answers with a new call added, at the front
export function withAddedCall(answers, call) {
  const { shared, own } = splitShared(call);
  return { ...answers, ...shared, addedCalls: [own, ...addedCallsOf(answers)] };
}

// The link people use to join their video calls, ready to use, or null
export function myMeetingLink(answers = loadAnswers()) {
  const link = readMeetingLink(answers.meetingLink);
  return link.valid ? link.url : null;
}

// Back to the page the call is on: theirs at /<handle>, or Meera's
export function profileHrefFor(serviceId, stateParam = '') {
  if (isMyCall(serviceId)) {
    const { handle } = loadAnswers();
    return handle ? `/${handle}` : '/';
  }
  return `?mock=profile${stateParam}`;
}

// ------------------------------------------------------------
// Made-up numbers so a new creator's page doesn't look empty: a rating,
// how many people rated, booked and reviewed. Made once, when their
// service is created, and saved as callStats so they never change on
// reload or when the call is edited.
// ------------------------------------------------------------
const between = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

export function makeMockStats() {
  const ratingCount = between(15, 40);
  return {
    rating: between(45, 50) / 10, // 4.5–5.0
    ratingCount,
    bookingCount: Math.round(ratingCount * (2 + Math.random())), // 2–3× the ratings: not everyone rates
    reviewCount: between(4, 10),
  };
}

// One call, from its answers, in the raw service shape (see mockProfile.js)
function callService(c, { id, order, stats = {} }) {
  const value = (key) => c[key] ?? CALL_DEFAULTS[key];
  const free = value('callPricing') === 'free';
  return {
    id,
    kind: 'call',
    title: c.callTitle ?? '',
    description: callDescriptionOf(c),
    about: aboutParagraphs(c),
    durationMins: Number(value('callDuration')),
    format: value('callFormat'),
    price: free ? 0 : Number(c.callPrice) || 0,
    // Regular price, crossed out. Ignored for a free call; only shows when it's higher (buildProfileJson)
    comparePrice: free ? null : Number(c.callComparePrice) || null,
    image: null,
    rating: stats.rating ?? null,
    ratingCount: stats.ratingCount ?? 0,
    status: 'active',
    order,
  };
}

export function getMyProfile(answers = loadAnswers()) {
  // Their first call holds all their ratings, so the page and that call show the same rating
  const stats = answers.callStats ?? {};

  const creator = {
    id: 'me',
    name: answers.name ?? '',
    handle: answers.handle ?? '',
    photo: answers.photo || null,
    headline: '',
    bio: answers.bio ?? '',
    rating: stats.rating ?? null,
    ratingCount: stats.ratingCount ?? 0,
    bookingCount: stats.bookingCount ?? 0,
    reviewCount: stats.reviewCount ?? 0,
  };

  // Newest first: added calls (already newest first), then the first call.
  // Added calls start with no ratings of their own.
  const added = addedCallsOf(answers).map((c, i) => callService(c, { id: c.id, order: i }));
  const first = callService(answers, { id: MY_CALL_ID, order: added.length, stats });

  return { creator, services: [...added, first], testimonials: [] };
}