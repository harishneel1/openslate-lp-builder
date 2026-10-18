// ------------------------------------------------------------
// Helpers for weekly hours ([['10:00', '13:00'], ...] per day),
// shared by the screens that edit them.
// ------------------------------------------------------------

export const WEEK = [
  { id: 'mon', label: 'Monday', short: 'Mon' },
  { id: 'tue', label: 'Tuesday', short: 'Tue' },
  { id: 'wed', label: 'Wednesday', short: 'Wed' },
  { id: 'thu', label: 'Thursday', short: 'Thu' },
  { id: 'fri', label: 'Friday', short: 'Fri' },
  { id: 'sat', label: 'Saturday', short: 'Sat' },
  { id: 'sun', label: 'Sunday', short: 'Sun' },
];

// '16:30' ⇄ 990
export const toMinutes = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
export const toTime = (mins) =>
  `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

// 990 → '4:30 pm', 1440 → 'Midnight'
export function timeLabel(mins) {
  if (mins === 1440) return 'Midnight';
  const h = Math.floor(mins / 60);
  return `${h % 12 || 12}:${String(mins % 60).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

// Every quarter hour, for start and end dropdowns
export const QUARTERS = Array.from({ length: 97 }, (_, i) => i * 15);

// Problems with one day's hours: { [index]: message }
export function dayProblems(ranges) {
  const found = {};
  ranges.forEach(([from, to], i) => {
    if (toMinutes(to) <= toMinutes(from)) found[i] = 'Ends before it starts';
  });
  ranges.forEach(([from, to], i) => {
    if (found[i]) return;
    const clash = ranges.findIndex(
      ([f, t], j) => j !== i && !found[j] && toMinutes(from) < toMinutes(t) && toMinutes(to) > toMinutes(f),
    );
    if (clash !== -1) {
      found[i] = `Overlaps with ${timeLabel(toMinutes(ranges[clash][0]))} to ${timeLabel(toMinutes(ranges[clash][1]))}`;
    }
  });
  return found;
}

// "10:00 am – 1:00 pm, 4:00 pm – 8:00 pm"
export const rangesText = (ranges) =>
  ranges.map(([f, t]) => `${timeLabel(toMinutes(f))} – ${timeLabel(toMinutes(t))}`).join(', ');
// ---------- A short summary, for showing hours at a glance ----------

// 600 → '10 am', 990 → '4:30 pm', 1440 → 'midnight'
export function shortTime(mins) {
  if (mins === 1440) return 'midnight';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'am' : 'pm'}`;
}

// [['10:00', '13:00'], ['16:00', '20:00']] → '10 am – 1 pm, 4 pm – 8 pm'
const shortRanges = (ranges) =>
  ranges.map(([f, t]) => `${shortTime(toMinutes(f))} – ${shortTime(toMinutes(t))}`).join(', ');

// Days in week order, runs of 3 or more joined: ['mon','tue','wed','fri'] → 'Mon–Wed, Fri'
function dayList(ids) {
  const idx = ids.map((id) => WEEK.findIndex((d) => d.id === id)).sort((a, b) => a - b);
  const parts = [];
  for (let i = 0; i < idx.length; ) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1] === idx[j] + 1) j += 1;
    const run = idx.slice(i, j + 1).map((k) => WEEK[k].short);
    parts.push(run.length >= 3 ? `${run[0]}–${run[run.length - 1]}` : run.join(', '));
    i = j + 1;
  }
  return parts.join(', ');
}

// Days with the same hours grouped together, in week order:
// { open: [{ days: 'Mon–Wed, Fri', hours: '10 am – 1 pm, 4 pm – 8 pm' }, ...], closed: 'Sun' }
export function weekSummary(weekly = {}) {
  const groups = new Map(); // hours text → day ids
  const closed = [];
  WEEK.forEach(({ id }) => {
    const ranges = weekly[id] ?? [];
    if (ranges.length === 0) {
      closed.push(id);
      return;
    }
    const key = shortRanges(ranges);
    groups.set(key, [...(groups.get(key) ?? []), id]);
  });
  return {
    open: [...groups].map(([hours, ids]) => ({ days: dayList(ids), hours })),
    closed: dayList(closed),
  };
}

// The longest single block of time in the week, in minutes (0 if none)
export function longestBlock(weekly = {}) {
  return Math.max(
    0,
    ...Object.values(weekly)
      .flat()
      .map(([f, t]) => toMinutes(t) - toMinutes(f)),
  );
}