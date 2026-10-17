// ------------------------------------------------------------
// The creator's availability: where the Availability screen saves
// it and where the booking page reads it. One schedule per creator,
// shared by all their 1:1 calls.
//
// Mock: kept in this browser. In the real product it's saved on
// the server with the creator's account.
// ------------------------------------------------------------

const KEY = 'pagebuilder:mock-availability';

const weekdayHours = [['10:00', '13:00'], ['16:00', '20:00']];

// Starting point until the creator saves their own
export const DEFAULT_SCHEDULE = {
  timeZone: 'Asia/Kolkata',
  weekly: {
    mon: weekdayHours,
    tue: weekdayHours,
    wed: weekdayHours,
    thu: [['16:00', '20:00']],
    fri: weekdayHours,
    sat: [['10:00', '14:00']],
    sun: [],
  },
  overrides: {},          // { '2026-10-26': [] } = a day off
  bufferMins: 15,
  minNoticeMins: 240,
  bookAheadDays: 14,
  startEveryMins: 15,
};

const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v);

// The saved schedule, or the default. Anything unreadable falls back to the default.
export function loadSchedule() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (!isObject(saved) || !isObject(saved.weekly)) return { ...DEFAULT_SCHEDULE, saved: false };
    return { ...DEFAULT_SCHEDULE, ...saved, saved: true };
  } catch {
    return { ...DEFAULT_SCHEDULE, saved: false };
  }
}

// Returns true if it saved
export function saveSchedule(schedule) {
  try {
    const { saved, ...rest } = schedule; // eslint-disable-line no-unused-vars
    localStorage.setItem(KEY, JSON.stringify(rest));
    return true;
  } catch {
    return false;
  }
}

// Back to the default (for testing)
export function clearSchedule() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nothing saved to clear
  }
}