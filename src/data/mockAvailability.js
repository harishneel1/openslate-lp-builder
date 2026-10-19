import { addDays, toInstant, todayIn, weekdayOf } from '../utils/slots';
import { loadSchedule } from './availabilityStore';
import { loadBookings } from './bookingsStore';

// ------------------------------------------------------------
// Mock availability for the booking page. Each call has its own
// hours, but one calendar per creator: a booking for any of their
// calls blocks that time for all of them. Dates are worked out
// from today, so the mock never goes stale.
//
// Add &slots=<id> to the booking page URL for other situations:
//   default  the call's saved hours (set while editing the call), with a few
//            bookings on their next working days. Until they save one: the
//            starting schedule, plus a mock day off.
//   busy     fully booked for the next week
//   none     no hours set at all
//   clear    the saved schedule as it is, with no mock bookings (a new creator's own call)
// ------------------------------------------------------------

// The call's hours and the creator's days off, if they've saved any;
// otherwise the starting hours (see availabilityStore.js)
const currentSchedule = (serviceId) => {
  const { saved, ...schedule } = loadSchedule(serviceId);
  return { schedule, saved };
};

// The creator's next working days after today, so the mock bookings
// always land on days they work, whatever day the page is opened
function workingDays(schedule, today, count) {
  const days = [];
  for (let i = 1; days.length < count && i < 30; i++) {
    const date = addDays(today, i);
    if ((schedule.overrides?.[date] ?? schedule.weekly[weekdayOf(date)] ?? []).length) days.push(date);
  }
  return days;
}

// A booking on the creator's clock
function booking(zone, date, from, to) {
  return {
    start: new Date(toInstant(date, from, zone)).toISOString(),
    end: new Date(toInstant(date, to, zone)).toISOString(),
  };
}

export function getMockAvailability(state, serviceId, now = Date.now()) {
  const { schedule, saved } = currentSchedule(serviceId);
  const zone = schedule.timeZone;
  const today = todayIn(zone, now);

  if (state === 'clear') return { schedule, bookings: [] };

  if (state === 'none') {
    return { schedule: { ...schedule, weekly: {}, overrides: {} }, bookings: [] };
  }

  if (state === 'busy') {
    // Every day for the next week is off or full; the first free day is 8 days out
    const overrides = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [addDays(today, i), []]));
    return { schedule: { ...schedule, overrides: { ...schedule.overrides, ...overrides } }, bookings: [] };
  }

  // Mock bookings: two on the first working day, one on the second, one on the fourth
  const [first, second, third, fourth] = workingDays(schedule, today, 4);
  const at = (date, from, to) => (date ? [booking(zone, date, from, to)] : []);
  return {
    // Until the creator saves their own schedule, the third working day is a mock day off
    schedule: saved || !third ? schedule : { ...schedule, overrides: { ...schedule.overrides, [third]: [] } },
    bookings: [
      ...at(first, '10:00', '11:00'),
      ...at(first, '17:00', '17:15'),
      ...at(second, '16:00', '17:15'),
      ...at(fourth, '18:00', '19:00'),
    ],
  };
}

// ------------------------------------------------------------
// The creator's own calls: this call's saved hours, minus the times
// already booked (bookingsStore.js). One calendar for all their calls,
// so a booking for one blocks that time for every call.
// ------------------------------------------------------------
export function getMyAvailability(serviceId) {
  const { saved, ...schedule } = loadSchedule(serviceId); // eslint-disable-line no-unused-vars
  const bookings = loadBookings().map(({ start, end }) => ({ start, end }));
  return { schedule, bookings };
}