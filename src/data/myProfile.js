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
    id: 'my-call',
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