import { SETUP_STORAGE_KEY, accountHandle, mockAccount } from './myPage';
import { CALL_DEFAULTS, aboutParagraphs, callDescriptionOf, readMeetingLink } from './callDetails';
import { askedQuestions, questionsOf } from './callQuestions';

// ------------------------------------------------------------
// The creator's own page, built from their setup answers, in the
// same raw shape as mockProfile.js so the profile page can show it
// (?mock=profile&source=mine). Kept in this browser for now; in the
// real product it comes from the server.
// ------------------------------------------------------------

export function loadAnswers() {
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
//     callPrice, callComparePrice, callDescription, callAbout, serviceId,
//     callQuestions }
// so the same fields and page-building work for every call.
// ------------------------------------------------------------
export const addedCallsOf = (answers) => (Array.isArray(answers?.addedCalls) ? answers.addedCalls : []);

// The setup call's own answers, saved on the setup answers themselves
// (plus the bits setup's call screens keep along the way)
const SETUP_CALL_KEYS = [
  'callTitle', 'callDuration', 'callFormat', 'callPricing', 'callPrice', 'callComparePrice',
  'callDescription', 'callAbout', 'serviceId', 'callQuestions', 'callStats', 'hoursStatus',
];

// The answers with no setup call: for setup finishing with calls they'd
// already made, after they'd started making one and gone back
export function withoutSetupCall(answers) {
  return Object.fromEntries(Object.entries(answers).filter(([key]) => !SETUP_CALL_KEYS.includes(key)));
}

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

// The answers with a new call added, at the front.
// onPage: false keeps it off their offerings page (made in the 1:1 calls tab)
export function withAddedCall(answers, call, { onPage = true } = {}) {
  const { shared, own } = splitShared(call);
  const added = { ...answers, ...shared, addedCalls: [own, ...addedCallsOf(answers)] };
  return onPage ? added : withOnPage(added, call.id, false);
}

// ------------------------------------------------------------
// On their offerings page, or not. A call lives in the 1:1 calls tab;
// showing it on the page is a yes/no on that call. Kept as the ids that
// are NOT on the page (answers.offPage), so every call made before this
// existed stays on the page, and a call only leaves it when they say so.
// A call that's off the page still has its own link and can be booked.
// ------------------------------------------------------------
export const offPageIdsOf = (answers) => (Array.isArray(answers?.offPage) ? answers.offPage : []);

export const isOnPage = (answers, id) => !offPageIdsOf(answers).includes(id);

// The answers with one call put on, or taken off, the page
export function withOnPage(answers, id, on) {
  const rest = offPageIdsOf(answers).filter((x) => x !== id);
  return { ...answers, offPage: on ? rest : [...rest, id] };
}

// The answers with one call deleted: gone from 1:1 calls, from the
// offerings page, and its link stops working (main.jsx finds no such call).
// The setup call lives on the answers themselves, so its fields are cleared;
// an added call is dropped from addedCalls. Bookings already made keep their
// own copy of its name and time (bookingsStore.js), so they're untouched.
export function withoutCall(answers, id) {
  const rest = id === MY_CALL_ID ? withoutSetupCall(answers) : { ...answers, addedCalls: addedCallsOf(answers).filter((c) => c.id !== id) };
  return { ...rest, offPage: offPageIdsOf(rest).filter((x) => x !== id) };
}

// Their setup call (the first one, saved on the setup answers) only counts
// once setup is finished. Before that it's half-filled answers, not a call.
// And only if setup made one: someone who picked calls they'd already
// made in 1:1 calls finished setup without a setup call.
export const hasSetupCall = (answers) =>
  Boolean(answers?.publishedAt) && String(answers?.callTitle ?? '').trim() !== '';

// The ids of every call they have, newest first: added calls, then the setup call
export function myCallIds(answers) {
  const ids = addedCallsOf(answers).map((c) => c.id);
  return hasSetupCall(answers) ? [...ids, MY_CALL_ID] : ids;
}

// The link people use to join their video calls, ready to use, or null
export function myMeetingLink(answers = loadAnswers()) {
  const link = readMeetingLink(answers.meetingLink);
  return link.valid ? link.url : null;
}

// Whether a call has a services page to go back to. Their calls work on
// their own links, like Calendly events, so there may be no page at all:
// it exists once they've picked its link in setup. Meera's always has one.
export function hasPageFor(serviceId) {
  return !isMyCall(serviceId) || Boolean(loadAnswers().handle);
}

// Back to the page the call is on: theirs at /<handle>, or Meera's.
// With no page, the call's own booking page, so "Book again" and the like
// still lead somewhere that works.
export function profileHrefFor(serviceId, stateParam = '') {
  if (isMyCall(serviceId)) {
    const { handle } = loadAnswers();
    return handle ? `/${handle}` : `/${accountHandle()}/${encodeURIComponent(serviceId)}`;
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
    format: 'video', // every call is a video call (older saved 'phone' calls included)
    price: free ? 0 : Number(c.callPrice) || 0,
    // Regular price, crossed out. Ignored for a free call; only shows when it's higher (buildProfileJson)
    comparePrice: free ? null : Number(c.callComparePrice) || null,
    image: null,
    rating: stats.rating ?? null,
    ratingCount: stats.ratingCount ?? 0,
    status: 'active',
    order,
    questions: askedQuestions(questionsOf(c)), // what checkout asks: the ones that are on (callQuestions.js)
  };
}

export function getMyProfile(answers = loadAnswers()) {
  // Their first call holds all their ratings, so the page and that call show the same rating
  const stats = answers.callStats ?? {};

  const creator = {
    id: 'me',
    // Their account's name and link until setup gives the page its own,
    // so a call booked before there's a page still says who it's with
    name: answers.name ?? mockAccount.name,
    handle: answers.handle || accountHandle(),
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
  // No setup call when setup put calls they'd already made on the page instead
  const hasFirst = String(answers.callTitle ?? '').trim() !== '';

  return { creator, services: hasFirst ? [...added, first] : added, testimonials: [] };
}

// Their offerings page: the same, with only the calls that are on it.
// Booking and checkout use getMyProfile, so a call that's off the page
// can still be booked from its own link.
// While setup is picking from calls they'd already made (not live yet, and
// not making a new one), the page is what it will be: just the ticked calls.
// That's what the preview beside that screen shows. Half-made setup call
// answers, from going into the call screens and back, don't count.
export function getMyPage(answers = loadAnswers()) {
  const profile = getMyProfile(answers);
  const picking = !answers.publishedAt && answers.callSource !== 'new' && addedCallsOf(answers).length > 0;
  const picked = Array.isArray(answers.pickedCalls) ? answers.pickedCalls : [];
  const shows = (id) => (picking ? picked.includes(id) : isOnPage(answers, id));
  return { ...profile, services: profile.services.filter((s) => shows(s.id)) };
}