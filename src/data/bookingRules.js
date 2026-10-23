// ------------------------------------------------------------
// A call's booking rules: the settings beside its weekly hours.
// Each is a key on the call's hours (availabilityStore.js) and a
// list of [value, label] choices, plus the words around it in the
// hours panel (HoursDrawer.jsx):
//
//   label     the rule's name
//   hint      optional line under the name
//   why       what the (i) beside the name says: why you'd use it
//   summary(label)  the chosen value as the edit screen's summary
//             shows it, so the row reads as a sentence
//   example(value, now)  a worked example for the chosen value, as
//             segments: even ones plain, odd ones bold (the part
//             that changes when they pick another value)
//
// Examples use times and dates the way people here read them:
// 12-hour times with AM/PM ("3:15 PM"), dates as "5 Nov".
// Break and notice use fixed example times (3:00 PM, 10:00 AM), so
// they make sense at any hour; how far ahead uses the real date.
// ------------------------------------------------------------
export const BOOKING_RULES = [
  {
    key: 'bufferMins',
    label: 'Break between calls',
    hint: 'Kept before and after all your 1:1 calls, not just this one.',
    why: 'Gives you time to rest, write notes or have chai before your next call.',
    options: [0, 5, 10, 15, 30, 45, 60].map((v) => [v, v === 0 ? 'No break' : `${v} minutes`]),
    summary: (label) => label,
    example: (mins) =>
      mins > 0
        ? ['If a call ends at 3:00 PM, the next one can start at ', clock(15 * 60 + mins), ' at the earliest.']
        : ['If a call ends at 3:00 PM, the next one can start ', 'right at 3:00 PM', '.'],
  },
  {
    key: 'minNoticeMins',
    label: 'How soon people can book',
    why: 'Stops last-minute bookings that leave you no time to prepare.',
    options: [[60, '1 hour'], [120, '2 hours'], [240, '4 hours'], [720, '12 hours'], [1440, '1 day'], [2880, '2 days']],
    summary: (label) => `At least ${label} before the call`,
    example: (mins) => {
      const at = 10 * 60 + mins; // from 10:00 AM
      return ['If it’s 10:00 AM now, the earliest someone can book is ', `${clock(at)} ${dayWord(Math.floor(at / 1440))}`, '.'];
    },
  },
  {
    key: 'bookAheadDays',
    label: 'How far ahead people can book',
    why: 'Keeps your calendar from filling up too far ahead, when your plans may change.',
    options: [[7, '1 week'], [14, '2 weeks'], [30, '30 days'], [60, '60 days'], [90, '90 days']],
    summary: (label) => `Up to ${label} ahead`,
    // Today counts as the first day (see slots.js), so the last is days − 1 away
    example: (days, now = new Date()) => {
      const last = new Date(now);
      last.setDate(last.getDate() + Math.max(1, days) - 1);
      return [`Today is ${shortDate(now)}, so people can book up to `, shortDate(last), '.'];
    },
  },
];

// Minutes from midnight (any day) as "3:15 PM"
function clock(totalMins) {
  const mins = ((totalMins % 1440) + 1440) % 1440;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

function dayWord(offset) {
  if (offset === 0) return 'today';
  if (offset === 1) return 'tomorrow';
  if (offset === 2) return 'the day after tomorrow';
  return `in ${offset} days`;
}

// "5 Nov"
function shortDate(date) {
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}