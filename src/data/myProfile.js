import { SETUP_STORAGE_KEY } from './myPage';
import { CALL_DEFAULTS, callDescriptionOf } from './callDetails';

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

export function getMyProfile(answers = loadAnswers()) {
  const value = (id) => answers[id] ?? CALL_DEFAULTS[id];
  const free = value('callPricing') === 'free';

  const creator = {
    id: 'me',
    name: answers.name ?? '',
    handle: answers.handle ?? '',
    photo: answers.photo || null,
    headline: '',
    bio: answers.bio ?? '',
    rating: null,
    ratingCount: 0,
    bookingCount: 0,
  };

  const call = {
    id: MY_CALL_ID,
    kind: 'call',
    title: answers.callTitle ?? '',
    description: callDescriptionOf(answers),
    durationMins: Number(value('callDuration')),
    format: value('callFormat'),
    price: free ? 0 : Number(answers.callPrice) || 0,
    comparePrice: null,
    image: null,
    rating: null,
    ratingCount: 0,
    status: 'active',
    order: 1,
  };

  return { creator, services: [call], testimonials: [] };
}