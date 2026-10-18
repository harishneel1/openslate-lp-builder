import { SETUP_STORAGE_KEY } from './myPage';
import { CALL_DEFAULTS, aboutParagraphs, callDescriptionOf } from './callDetails';

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

// The id of the creator's own call, as it appears in booking links
export const MY_CALL_ID = 'my-call';

// Whose page a call belongs to: the creator's own call reads their setup
// answers; anything else is Meera's (mockProfile.js)
export const isMyCall = (serviceId) => serviceId === MY_CALL_ID;

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

export function getMyProfile(answers = loadAnswers()) {
  const value = (id) => answers[id] ?? CALL_DEFAULTS[id];
  const free = value('callPricing') === 'free';
  // Their one call holds all their ratings, so the page and the call show the same rating
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

  const call = {
    id: MY_CALL_ID,
    kind: 'call',
    title: answers.callTitle ?? '',
    description: callDescriptionOf(answers),
    about: aboutParagraphs(answers),
    durationMins: Number(value('callDuration')),
    format: value('callFormat'),
    price: free ? 0 : Number(answers.callPrice) || 0,
    // Regular price, crossed out. Ignored for a free call; only shows when it's higher (buildProfileJson)
    comparePrice: free ? null : Number(answers.callComparePrice) || null,
    image: null,
    rating: stats.rating ?? null,
    ratingCount: stats.ratingCount ?? 0,
    status: 'active',
    order: 1,
  };

  return { creator, services: [call], testimonials: [] };
}