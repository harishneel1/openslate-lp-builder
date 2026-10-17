import { buildProfileJson } from './buildProfileJson';
import { getMockProfile } from './mockProfile';
import { getMockAvailability } from './mockAvailability';
import { findSlots } from '../utils/slots';

// ------------------------------------------------------------
// Everything the booking page shows, for one call. Reuses the
// profile's page JSON so a call looks the same on both pages.
//
// In the real product this would be one API response; here it
// reads the mocks (mockProfile, mockAvailability).
//
// Returns { creator, service, durationMins, reviews, availability }, or with
// service: null when the id isn't a call this creator offers.
// ------------------------------------------------------------
export function buildBookingJson({ serviceId, profileState, slotsState, timeZone, now = Date.now() }) {
  const raw = getMockProfile(profileState);
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

  const { durationMins } = raw.services.find((s) => s.id === serviceId);

  return {
    creator,
    service,
    durationMins,
    reviews: page.testimonials.filter((t) => t.serviceId === serviceId),
    availability: findSlots({ ...getMockAvailability(slotsState, now), durationMins, timeZone, now }),
  };
}