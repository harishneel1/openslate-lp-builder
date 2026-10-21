import { buildProfileJson } from './buildProfileJson';
import { getMockProfile } from './mockProfile';
import { getMyProfile, isMyCall, loadAnswers } from './myProfile';
import { loadCallDraft, withDraftCall } from './callDraft';
import { getMockAvailability, getMyAvailability } from './mockAvailability';
import { findSlots } from '../utils/slots';
import { DEFAULT_QUESTIONS } from './callQuestions';

// ------------------------------------------------------------
// Everything the booking page shows, for one call. Reuses the
// profile's page JSON so a call looks the same on both pages.
//
// In the real product this would be one API response; here it
// reads the mocks (mockProfile, mockAvailability), or the creator's own
// page from their setup answers when it's their call (myProfile).
//
// Returns { creator, service, durationMins, questions, reviews, availability }, or with
// service: null when the id isn't a call this creator offers.
// draft: true reads the call being made (callDraft.js) as well, for the
// preview beside "Create a 1:1 call". serviceId is then the draft's id.
// ------------------------------------------------------------
export function buildBookingJson({ serviceId, profileState, slotsState, timeZone, draft = false, now = Date.now() }) {
  const mine = isMyCall(serviceId);
  const raw = mine
    ? getMyProfile(draft ? withDraftCall(loadAnswers(), loadCallDraft()) : undefined)
    : getMockProfile(profileState);
  const page = buildProfileJson(raw);
  const { name, initials, photo, headline, stats } = page.creator;
  // Rating and bookings for the coach card (reviews are shown on the page itself)
  const creator = {
    name,
    firstName: name.split(' ')[0] || name,
    initials,
    photo,
    headline,
    stats: stats.filter((s) => s.id !== 'reviews'),
  };

  // Only calls are booked here: DMs have their own page
  const service = page.services.find((s) => s.id === serviceId && s.kind === 'call') ?? null;
  if (!service) return { creator, service: null, reviews: [], availability: null };

  const { durationMins, questions } = raw.services.find((s) => s.id === serviceId);

  return {
    creator,
    service,
    durationMins,
    // What checkout asks after name, email and phone. Meera's demo calls ask the default.
    questions: questions ?? DEFAULT_QUESTIONS,
    reviews: page.testimonials.filter((t) => t.serviceId === serviceId),
    // Their own calls: this call's hours minus their bookings and Google Calendar busy times.
    // &slots=<id> still shows the mock situations, for testing.
    availability: findSlots({
      ...(mine && !slotsState ? getMyAvailability(serviceId) : getMockAvailability(slotsState, serviceId, now)),
      durationMins,
      timeZone,
      now,
    }),
  };
}