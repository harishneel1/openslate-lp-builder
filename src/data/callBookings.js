import { loadBookings } from './bookingsStore';
import { describeBooking } from './buildBookingsJson';
import { formatTime, zoned } from '../utils/slots';
import { matchZone } from './timeZones';

// ------------------------------------------------------------
// One 1:1 call's bookings, for its details page (CallOverview.jsx).
// Built on describeBooking (buildBookingsJson.js), so every state means
// exactly what it means on the Bookings page:
//   upcoming   still to come, about to start, or happening now; soonest first
//   past       ended; newest first
//   cancelled  by either side, whenever the call was; newest call first
// Pure apart from reading the bookings, so it can be ported and tested.
// ------------------------------------------------------------

// How many bookings a list shows before "Show more"
export const PAGE_SIZE = 20;

const startOf = (b) => Date.parse(b.start);

// callId: the call's id (a booking's serviceId)
// zone: the creator's clock, for dates and times
export function callBookingsOf(callId, { bookings = loadBookings(), zone, now = Date.now() }) {
  const mine = bookings.filter((b) => b.serviceId === callId).map((b) => describeBooking(b, zone, now));

  const upcoming = mine
    .filter((b) => b.state !== 'cancelled' && b.state !== 'ended')
    .sort((a, b) => startOf(a) - startOf(b));
  const past = mine.filter((b) => b.state === 'ended').sort((a, b) => startOf(b) - startOf(a));
  const cancelled = mine.filter((b) => b.state === 'cancelled').sort((a, b) => startOf(b) - startOf(a));

  return { all: mine, upcoming, past, cancelled, next: upcoming[0] ?? null };
}

// Which list a booking belongs in: 'upcoming' | 'past' | 'cancelled'
export function listOf(booking) {
  if (booking.state === 'cancelled') return 'cancelled';
  if (booking.state === 'ended') return 'past';
  return 'upcoming';
}

// A sorted list → one group per date, in the same order:
// [{ date, items: [...] }]
export function byDay(list) {
  const groups = [];
  for (const b of list) {
    const last = groups[groups.length - 1];
    if (last && last.date === b.date) last.items.push(b);
    else groups.push({ date: b.date, items: [b] });
  }
  return groups;
}

// The guest's own time, when their clock differs from the creator's:
// '11:30 am, UK (London)', or with the day when that's different too:
// '1:30 am Wed 5 Nov, US (New York)'. null when it's the same clock or unknown.
// label(zone): the zone's name ('UK (London), GMT+1'); only the place is kept.
export function guestClock(booking, zone, label) {
  const theirs = matchZone(booking.guestTimeZone);
  if (!theirs || theirs === matchZone(zone)) return null;
  const ms = startOf(booking);
  const time = formatTime(ms, theirs);
  if (time === formatTime(ms, zone) && zoned(ms, theirs).date === zoned(ms, zone).date) return null;
  const place = String(label(theirs)).split(',')[0];
  const theirDate = zoned(ms, theirs).date;
  if (theirDate === booking.date) return `${time}, ${place}`;
  const day = new Date(`${theirDate}T00:00:00Z`).toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  return `${time} ${day.replace(',', '')}, ${place}`;
}