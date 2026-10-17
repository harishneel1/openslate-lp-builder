import { addDays, toInstant, todayIn, weekdayOf } from '../utils/slots';

// ------------------------------------------------------------
// Mock availability for the booking page. One calendar per
// creator: a booking for any of their calls blocks that time
// for all of them. Dates are worked out from today, so the
// mock never goes stale.
//
// Add &slots=<id> to the booking page URL for other situations:
//   default  bookings on the next two working days, then a day off
//   busy     fully booked for the next week
//   none     no hours set at all
// ------------------------------------------------------------

const ZONE = 'Asia/Kolkata';

const weekdayHours = [['10:00', '13:00'], ['16:00', '20:00']];

const baseSchedule = {
  timeZone: ZONE,
  weekly: {
    mon: weekdayHours,
    tue: weekdayHours,
    wed: weekdayHours,
    thu: [['16:00', '20:00']],   // afternoons off
    fri: weekdayHours,
    sat: [['10:00', '14:00']],
    sun: [],                     // never on Sundays
  },
  overrides: {},
  bufferMins: 15,
  minNoticeMins: 240,            // 4 hours
  bookAheadDays: 14,
  startEveryMins: 15,
};

// The creator's next working days after today, so the mock bookings
// always land on days they work, whatever day the page is opened
function workingDays(today, count) {
  const days = [];
  for (let i = 1; days.length < count && i < 30; i++) {
    const date = addDays(today, i);
    if ((baseSchedule.weekly[weekdayOf(date)] ?? []).length) days.push(date);
  }
  return days;
}

// A booking on the creator's clock
function booking(date, from, to) {
  return {
    start: new Date(toInstant(date, from, ZONE)).toISOString(),
    end: new Date(toInstant(date, to, ZONE)).toISOString(),
  };
}

export function getMockAvailability(state, now = Date.now()) {
  const today = todayIn(ZONE, now);

  if (state === 'none') {
    return { schedule: { ...baseSchedule, weekly: {} }, bookings: [] };
  }

  if (state === 'busy') {
    // Every day for the next week is off or full; the first free day is 8 days out
    const overrides = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [addDays(today, i), []]));
    return { schedule: { ...baseSchedule, overrides }, bookings: [] };
  }

  const [first, second, third, fourth] = workingDays(today, 4);
  return {
    schedule: { ...baseSchedule, overrides: { [third]: [] } }, // a day off
    bookings: [
      booking(first, '10:00', '11:00'),
      booking(first, '17:00', '17:15'),
      booking(second, '16:00', '17:15'),
      booking(fourth, '18:00', '19:00'),
    ],
  };
}