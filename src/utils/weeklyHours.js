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