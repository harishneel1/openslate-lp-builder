import { addDays, formatTime, todayIn, weekdayOf, zoned } from '../utils/slots';
import { shortTime, timeLabel } from '../utils/weeklyHours';
import { loadCallHours, loadDaysOff } from './availabilityStore';
import { getMyProfile, MY_CALL_ID } from './myProfile';
import { DEFAULT_MEETING_LINK, isActive } from './bookingsStore';
import { zoneOptions } from './timeZones';

// ------------------------------------------------------------
// What the creator's Bookings page shows, built from the saved
// bookings (bookingsStore.js) and their hours (availabilityStore.js).
// Pure apart from reading those stores, so it can be ported and tested.
//
// Everything is on the creator's clock: the zone their first call's
// hours are set in. (Each call can have its own zone; creators almost
// always use one, so the page uses the first call's.)
//
// Dates are 'YYYY-MM-DD' on that clock; times within a day are minutes
// from midnight (600 = 10:00 am).
// ------------------------------------------------------------

const MIN = 60_000;
const PAST_DAYS = 14; // how far back the date strip goes
const AHEAD_DAYS = 30; // how far ahead it goes
export const JOIN_EARLY_MINS = 10; // Join stands out this long before a call starts

export const coachZone = () => loadCallHours(MY_CALL_ID).timeZone ?? 'Asia/Kolkata';

// 'India (Kolkata), GMT+5:30'
export const zoneLabel = (zone) => zoneOptions(zone).find((o) => o.id === zone)?.label ?? zone;

// A saved instant → its date and minute of the day on that clock
function onClock(iso, zone) {
  const z = zoned(Date.parse(iso), zone);
  return { date: z.date, mins: z.hour * 60 + z.minute };
}

// '2026-10-20' → labels for the strip and headings
export function dayLabels(date) {
  const [y, m, d] = date.split('-').map(Number);
  const value = new Date(Date.UTC(y, m - 1, d));
  const part = (opts) => value.toLocaleDateString('en-GB', { timeZone: 'UTC', ...opts });
  return {
    weekday: part({ weekday: 'short' }),
    weekdayLong: part({ weekday: 'long' }),
    day: d,
    month: part({ month: 'short' }),
    monthLong: part({ month: 'long' }),
  };
}

// 'Today', 'Tomorrow', 'Yesterday' or null
export function relativeDay(date, today) {
  if (date === today) return 'Today';
  if (date === addDays(today, 1)) return 'Tomorrow';
  if (date === addDays(today, -1)) return 'Yesterday';
  return null;
}

// 'Thu 22 Oct', or 'Today' / 'Tomorrow'
export function shortDay(date, today) {
  const l = dayLabels(date);
  return relativeDay(date, today) ?? `${l.weekday} ${l.day} ${l.month}`;
}

// Always the date itself, never 'Today': 'Tue 20 Oct'.
// For the record of what happened (booked, rescheduled, cancelled).
export function exactDay(date) {
  const l = dayLabels(date);
  return `${l.weekday} ${l.day} ${l.month}`;
}

// Mid-sentence: 'today', 'tomorrow', 'yesterday' or 'Thu 22 Oct'
export function dayInSentence(date, today) {
  const rel = relativeDay(date, today);
  if (rel) return rel.toLowerCase();
  const l = dayLabels(date);
  return `${l.weekday} ${l.day} ${l.month}`;
}

// 'today', 'tomorrow' or 'on Thu 22 Oct', as in "Your next call is on Thu 22 Oct"
export const onDay = (date, today) =>
  relativeDay(date, today) ? dayInSentence(date, today) : `on ${dayInSentence(date, today)}`;

// 'Thursday 22 October'
export function longDay(date) {
  const l = dayLabels(date);
  return `${l.weekdayLong} ${l.day} ${l.monthLong}`;
}

// 90 → '1 hr 30 min', 45 → '45 min', 120 → '2 hr'
export function lengthLabel(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!h) return `${m} min`;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

// How long until a start, in words: 'in 25 min', 'in 3 hr', or null when it's a day or more off
export function startsIn(startMs, now) {
  const mins = Math.round((startMs - now) / MIN);
  if (mins <= 0) return null;
  if (mins < 60) return `in ${mins} min`;
  const hours = Math.round(mins / 60);
  return hours < 24 ? `in ${hours} hr` : null;
}

// Where a booking is at this moment
//   'cancelled' | 'ended' | 'live' (happening now) | 'soon' (Join time) | 'upcoming'
export function statusOf(booking, now) {
  if (!isActive(booking)) return 'cancelled';
  const start = Date.parse(booking.start);
  const end = Date.parse(booking.end);
  if (now >= end) return 'ended';
  if (now >= start) return 'live';
  if (now >= start - JOIN_EARLY_MINS * MIN) return 'soon';
  return 'upcoming';
}

// A booking with its times on the creator's clock, for showing
export function describeBooking(booking, zone, now) {
  const start = Date.parse(booking.start);
  const end = Date.parse(booking.end);
  const { date, mins } = onClock(booking.start, zone);
  return {
    ...booking,
    // Video calls always have a link to join (older bookings saved none)
    meetingLink: booking.format === 'phone' ? null : booking.meetingLink || DEFAULT_MEETING_LINK,
    date,
    from: mins,
    to: mins + Math.round((end - start) / MIN),
    time: formatTime(start, zone),
    ends: formatTime(end, zone),
    lengthMins: Math.round((end - start) / MIN),
    state: statusOf(booking, now),
    // What changed since it was booked, on the creator's clock (null when nothing did).
    // by: 'creator' | 'guest'. Older bookings saved no …By: only the creator could change them.
    moved: booking.previousStart
      ? {
          date: onClock(booking.previousStart, zone).date,
          time: formatTime(Date.parse(booking.previousStart), zone),
          by: booking.rescheduledBy ?? 'creator',
        }
      : null,
    cancelledBy: isActive(booking) ? null : (booking.cancelledBy ?? 'creator'),
  };
}

// Where a rescheduled call was before, as short as it can be:
// '11:00 am' when it was the same day, else 'Mon 19 Oct, 11:00 am'
export function movedFromLabel(booking) {
  if (!booking.moved) return null;
  const { date, time } = booking.moved;
  return date === booking.date ? time : `${exactDay(date)}, ${time}`;
}

// The creator's hours on one date: the days-off list wins, else every
// call's weekly hours for that weekday, merged. [[600, 1020], ...] in minutes.
export function hoursOn(date) {
  const daysOff = loadDaysOff();
  const toMins = (t) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const ranges = (
    daysOff[date] ??
    getMyProfile().services.flatMap((s) => loadCallHours(s.id).weekly?.[weekdayOf(date)] ?? [])
  ).map(([f, t]) => [toMins(f), toMins(t)]);

  // Merge overlapping ranges, so two calls with the same hours read as one block
  return ranges
    .sort((a, b) => a[0] - b[0])
    .reduce((out, [f, t]) => {
      const last = out[out.length - 1];
      if (last && f <= last[1]) last[1] = Math.max(last[1], t);
      else out.push([f, t]);
      return out;
    }, []);
}

// ------------------------------------------------------------
// The whole page: the date strip, the next call, and which day to open on
// ------------------------------------------------------------
export function buildBookingsJson({ bookings, now = Date.now() }) {
  const zone = coachZone();
  const today = todayIn(zone, now);
  const shown = bookings.map((b) => describeBooking(b, zone, now));

  // Calls still to come (or happening now), soonest first
  const ahead = shown
    .filter((b) => b.state !== 'cancelled' && b.state !== 'ended')
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));

  // Active calls per date, for the dots under each day
  const counts = new Map();
  for (const b of shown) if (b.state !== 'cancelled') counts.set(b.date, (counts.get(b.date) ?? 0) + 1);

  // The strip: two weeks back to a month ahead, stretched to reach every booking
  const dates = [...counts.keys()].sort();
  let first = addDays(today, -PAST_DAYS);
  let last = addDays(today, AHEAD_DAYS);
  if (dates.length && dates[0] < first) first = dates[0];
  if (dates.length && dates[dates.length - 1] > last) last = dates[dates.length - 1];

  const days = [];
  for (let date = first; date <= last; date = addDays(date, 1)) {
    days.push({
      date,
      ...dayLabels(date),
      relative: relativeDay(date, today),
      count: counts.get(date) ?? 0,
      past: date < today,
    });
  }

  // Open on today when it still has a call to come; else the next day that has one; else today
  const next = ahead[0] ?? null;
  const openOn = ahead.some((b) => b.date === today) ? today : (next?.date ?? today);

  return {
    zone,
    zoneLabel: zoneLabel(zone),
    today,
    days,
    next,
    openOn,
    hasAny: shown.length > 0,
    upcomingToday: ahead.filter((b) => b.date === today).length,
  };
}

// ------------------------------------------------------------
// One day as an hour grid: the hours to draw, which of them the
// creator works, the calls placed on them, and where "now" is.
//
// Returns {
//   range:     { from, to } whole hours to draw, covering their working
//              hours and every call (null when there's nothing to draw)
//   hours:     [[from, to], ...] their working hours that day ([] = not working)
//   calls:     the day's calls in time order (see describeBooking)
//   cancelled: the day's cancelled calls, shown apart so they don't
//              take up the time they no longer hold
//   nowMins:   minutes into the day right now, on today only (else null)
//   callCount, bookedMins
// }
// ------------------------------------------------------------
export function buildDayTimeline({ date, bookings, now = Date.now() }) {
  const zone = coachZone();
  const today = todayIn(zone, now);
  const nowMins = date === today ? onClock(new Date(now).toISOString(), zone).mins : null;

  const all = bookings
    .map((b) => describeBooking(b, zone, now))
    .filter((b) => b.date === date)
    .sort((a, b) => a.from - b.from);
  const calls = all.filter((b) => b.state !== 'cancelled');
  const cancelled = all.filter((b) => b.state === 'cancelled');
  const hours = hoursOn(date);

  // Draw whole hours, from the earliest start to the latest end of hours and calls
  const edges = [...hours.flat(), ...calls.flatMap((c) => [c.from, Math.min(c.to, 1440)])];
  const range = edges.length
    ? { from: Math.floor(Math.min(...edges) / 60) * 60, to: Math.ceil(Math.max(...edges) / 60) * 60 }
    : null;

  return {
    range,
    hours,
    calls,
    cancelled,
    nowMins,
    callCount: calls.length,
    bookedMins: calls.reduce((sum, c) => sum + c.lengthMins, 0),
  };
}

// Within a range, the stretches outside working hours: [[from, to], ...]
export function offHours(range, hours) {
  const out = [];
  let cursor = range.from;
  for (const [f, t] of hours) {
    if (f > cursor) out.push([cursor, Math.min(f, range.to)]);
    cursor = Math.max(cursor, t);
  }
  if (cursor < range.to) out.push([cursor, range.to]);
  return out.filter(([f, t]) => t > f);
}

// Minutes → '4:30 pm'
export const clockLabel = (mins) => timeLabel(Math.min(mins, 1440));

// Minutes → '9 am', '4:30 pm', for the grid's hour labels
export const hourLabel = (mins) => shortTime(Math.min(mins, 1440));