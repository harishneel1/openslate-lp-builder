import { addDays, formatTime, zoned } from './slots';

// ------------------------------------------------------------
// Days off, read for people. They're saved one date at a time
// ({ '2026-10-26': [], '2026-10-27': [] }, see availabilityStore.js),
// so the booking page needs no change; here, back-to-back dates
// read as one range ("26–28 Oct"), the way people take time off.
// ------------------------------------------------------------

export const MAX_RANGE_DAYS = 90; // one trip at a time, not the whole year

// '2026-10-26' → that date at midnight UTC, for formatting only
function asDate(date) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

const fmt = (date, opts) => asDate(date).toLocaleDateString('en-GB', { timeZone: 'UTC', ...opts });

// Days off from today on, in order. A date with hours (not []) is
// different hours on one day, not a day off, so it's left out.
export function upcomingDaysOff(overrides, today) {
  return Object.keys(overrides ?? {})
    .filter((date) => date >= today && Array.isArray(overrides[date]) && overrides[date].length === 0)
    .sort();
}

// Sorted dates → back-to-back runs: [{ from, to }]
export function groupRanges(dates) {
  const ranges = [];
  for (const date of dates) {
    const last = ranges[ranges.length - 1];
    if (last && addDays(last.to, 1) === date) last.to = date;
    else ranges.push({ from: date, to: date });
  }
  return ranges;
}

// Every date from `from` to `to`, both included
export function daysBetween(from, to) {
  const days = [];
  for (let d = from; d <= to && days.length <= MAX_RANGE_DAYS; d = addDays(d, 1)) days.push(d);
  return days;
}

const yearOf = (date) => date.slice(0, 4);

// For the row: '26 Oct', '26–28 Oct', '30 Oct – 2 Nov'. The year only
// when it isn't this year.
export function shortRange({ from, to }, today) {
  const year = yearOf(from) !== yearOf(today) || yearOf(to) !== yearOf(today);
  const dm = (d) => fmt(d, { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}) });
  if (from === to) return dm(from);
  if (from.slice(0, 7) === to.slice(0, 7)) return `${Number(from.slice(8))}–${dm(to)}`;
  return `${dm(from)} – ${dm(to)}`;
}

// For the panel: 'Monday 26 October', or 'Mon 26 Oct – Wed 28 Oct'
export function longRange({ from, to }, today) {
  const year = yearOf(from) !== yearOf(today) || yearOf(to) !== yearOf(today);
  const withYear = year ? { year: 'numeric' } : {};
  if (from === to) return fmt(from, { weekday: 'long', day: 'numeric', month: 'long', ...withYear });
  const part = (d) => fmt(d, { weekday: 'short', day: 'numeric', month: 'short', ...withYear });
  return `${part(from)} – ${part(to)}`;
}

// Bookings still to come that start on any of these dates, on the
// creator's clock, soonest first. Pass active (not cancelled) bookings.
export function bookingsOnDays(bookings, days, zone, now = Date.now()) {
  if (!days.length) return [];
  const set = new Set(days);
  return bookings
    .filter((b) => Date.parse(b.end ?? b.start) > now && set.has(zoned(Date.parse(b.start), zone).date))
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
}

// One clashing booking, as a line: 'Mon 26 Oct, 4:00 pm with Asha'
export function clashLabel(booking, zone) {
  const ms = Date.parse(booking.start);
  const day = fmt(zoned(ms, zone).date, { weekday: 'short', day: 'numeric', month: 'short' });
  const who = booking.guest?.name?.trim() || booking.title || 'a guest';
  return `${day}, ${formatTime(ms, zone)} with ${who}`;
}