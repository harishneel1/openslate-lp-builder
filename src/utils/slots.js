// ------------------------------------------------------------
// Prototype slot engine: the creator's hours and rules, minus
// their existing bookings → the times a visitor can book, shown
// in the visitor's time zone.
//
// Pure functions with no React, so the real codebase can port
// them and test them directly. All instants are milliseconds or
// ISO strings in UTC; local dates are 'YYYY-MM-DD' strings.
// ------------------------------------------------------------

const MIN = 60_000;
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

// ---------- Time zone helpers (built on Intl, no library) ----------

const formatters = new Map();
function formatter(timeZone) {
  if (!formatters.has(timeZone)) {
    formatters.set(
      timeZone,
      new Intl.DateTimeFormat('en-US', {
        timeZone,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
    );
  }
  return formatters.get(timeZone);
}

// An instant as a clock in that zone shows it: { date: '2026-10-17', hour: 12, minute: 30 }
export function zoned(ms, timeZone) {
  const p = Object.fromEntries(formatter(timeZone).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), minute: Number(p.minute) };
}

// How far ahead of UTC the zone is at that instant (ms). India: +5:30 all year.
function offsetMs(ms, timeZone) {
  const z = zoned(ms, timeZone);
  const [y, m, d] = z.date.split('-').map(Number);
  return Date.UTC(y, m - 1, d, z.hour, z.minute) - Math.floor(ms / MIN) * MIN;
}

// '2026-10-20' at '16:30' on a clock in that zone → the instant (ms)
export function toInstant(date, time, timeZone) {
  const [y, m, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const asUtc = Date.UTC(y, m - 1, d, h, mi);
  const first = asUtc - offsetMs(asUtc, timeZone);
  return asUtc - offsetMs(first, timeZone); // second pass corrects across a daylight-saving change
}

// Today's date on a clock in that zone
export const todayIn = (timeZone, now = Date.now()) => zoned(now, timeZone).date;

// '2026-10-30' + 3 → '2026-11-02'
export function addDays(date, n) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

// '2026-10-19' → 'mon'
export const weekdayOf = (date) => {
  const [y, m, d] = date.split('-').map(Number);
  return DAY_KEYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
};

// '16:30' → 990, and back
const toMinutes = (time) => {
  const [h, m] = String(time).split(':').map(Number);
  return h * 60 + m;
};
const toTime = (mins) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

// An instant → '4:30 pm' on a clock in that zone
export function formatTime(ms, timeZone) {
  const z = zoned(ms, timeZone);
  return timeLabel(z.hour, z.minute);
}

// 16, 30 → '4:30 pm'
const timeLabel = (h, m) => `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;

// When in their day a slot falls, for grouping the time grid
const periodOf = (h) => (h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening');

// '2026-10-17' → { weekday: 'Sat', day: 17, month: 'Oct' }
function dayLabels(date) {
  const [y, m, d] = date.split('-').map(Number);
  const value = new Date(Date.UTC(y, m - 1, d));
  const part = (opts) => value.toLocaleDateString('en-GB', { timeZone: 'UTC', ...opts });
  return { weekday: part({ weekday: 'short' }), day: d, month: part({ month: 'short' }) };
}

// ---------- The engine ----------

// schedule: the creator's rules (one calendar for all their services):
//   timeZone       their zone, e.g. 'Asia/Kolkata'; their hours are on this clock
//   weekly         { mon: [['10:00', '13:00'], ['16:00', '20:00']], ..., sun: [] }
//   overrides      { '2026-10-24': [] } a day off, or different hours on one date
//   bufferMins     free time kept before and after every booking
//   minNoticeMins  nothing bookable sooner than this from now
//   bookAheadDays  how many days ahead people can book
//   startEveryMins calls can start every N minutes (15 → 10:00, 10:15, 10:30...)
// bookings: [{ start, end }] ISO strings, from all their services
// durationMins: this call's length
// timeZone: the visitor's zone; times and days are shown on their clock
//
// Returns { timeZone, days, firstAvailable }:
//   days: one per day of the booking window on the visitor's clock, fully booked
//         days included (with no slots), so the date strip can grey them out:
//         { date, weekday, day, month, relative: 'Today' | 'Tomorrow' | null,
//           slots: [{ start: ISO, time: '4:30 pm', period: 'evening' }] }
//   firstAvailable: date of the first day with a slot, or null if there are none
export function findSlots({ schedule, bookings = [], durationMins, timeZone, now = Date.now() }) {
  const {
    timeZone: hostZone,
    weekly = {},
    overrides = {},
    bufferMins = 0,
    minNoticeMins = 0,
    bookAheadDays = 14,
    startEveryMins = 15,
  } = schedule;
  const viewerZone = timeZone || hostZone;
  const length = Math.max(1, Number(durationMins) || 0);
  const step = Math.max(5, Number(startEveryMins) || 15);

  const earliest = now + minNoticeMins * MIN;
  const latest = now + bookAheadDays * 1440 * MIN;
  // Each booking blocks its own time plus the buffer on both sides
  const busy = bookings
    .map((b) => [Date.parse(b.start) - bufferMins * MIN, Date.parse(b.end) + bufferMins * MIN])
    .filter(([s, e]) => Number.isFinite(s) && Number.isFinite(e));

  // Every start time that fits, walking the creator's days.
  // One extra day each side covers visitors whose day starts or ends at a different time.
  const starts = [];
  const hostToday = todayIn(hostZone, now);
  for (let i = -1; i <= bookAheadDays + 1; i++) {
    const date = addDays(hostToday, i);
    const windows = overrides[date] ?? weekly[weekdayOf(date)] ?? [];
    for (const [from, to] of windows) {
      for (let t = toMinutes(from); t + length <= toMinutes(to); t += step) {
        const start = toInstant(date, toTime(t), hostZone);
        const end = start + length * MIN;
        if (start < earliest || start > latest) continue;
        if (busy.some(([bs, be]) => start < be && end > bs)) continue;
        starts.push(start);
      }
    }
  }
  starts.sort((a, b) => a - b);

  // The visitor's days, then each start dropped into the day it falls on for them
  const viewerToday = todayIn(viewerZone, now);
  const days = Array.from({ length: bookAheadDays }, (_, i) => {
    const date = addDays(viewerToday, i);
    return { date, ...dayLabels(date), relative: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : null, slots: [] };
  });
  const byDate = new Map(days.map((d) => [d.date, d]));
  for (const ms of starts) {
    const z = zoned(ms, viewerZone);
    byDate.get(z.date)?.slots.push({
      start: new Date(ms).toISOString(),
      time: timeLabel(z.hour, z.minute),
      period: periodOf(z.hour),
    });
  }

  return {
    timeZone: viewerZone,
    days,
    firstAvailable: days.find((d) => d.slots.length > 0)?.date ?? null,
  };
}