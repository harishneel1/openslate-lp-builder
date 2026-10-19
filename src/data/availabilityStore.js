// ------------------------------------------------------------
// The creator's availability: where it's saved, and where the
// booking page reads it.
//
// Each 1:1 call has its own hours:
//   timeZone, weekly hours, and its booking rules (break between
//   calls, minimum notice, how far ahead, how often times start)
// Days off belong to the creator, not a call: a day away blocks
// every call.
//
// Saved as:
//   {
//     calls:     { [callId]: hours },   each call's own hours
//     shared:    hours | null,          the one schedule every call used
//                                       before hours were per call
//     overrides: { '2026-10-26': [] },  days off, for every call
//   }
//
// Moving over: the first read copies the old shared schedule into
// `shared`. A call with no hours of its own reads those, so nobody's
// hours change. A new call has the defaults saved for it when it's
// made, so it starts at weekdays 9–5, not on the old shared hours.
//
// Mock: kept in this browser. In the real product it's saved on
// the server with the creator's account.
// ------------------------------------------------------------

const KEY = 'pagebuilder:mock-availability-v2';
const OLD_KEY = 'pagebuilder:mock-availability'; // one schedule for every call

// One block on weekdays, weekends off: the same start Calendly gives everyone.
// Also the hours a day gets when it's switched back on.
export const weekdayHours = [['09:00', '17:00']];

// A new call's hours, until its creator changes them
export const DEFAULT_HOURS = {
  timeZone: 'Asia/Kolkata',
  weekly: {
    mon: weekdayHours,
    tue: weekdayHours,
    wed: weekdayHours,
    thu: weekdayHours,
    fri: weekdayHours,
    sat: [],
    sun: [],
  },
  bufferMins: 15,
  minNoticeMins: 240,
  bookAheadDays: 14,
  startEveryMins: 15,
};

const HOUR_KEYS = Object.keys(DEFAULT_HOURS);

const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v);

// Only a call's own settings, with the defaults filling any gaps.
// null when there's nothing usable.
function hoursFrom(value) {
  if (!isObject(value) || !isObject(value.weekly)) return null;
  const picked = Object.fromEntries(HOUR_KEYS.filter((k) => k in value).map((k) => [k, value[k]]));
  return structuredClone({ ...DEFAULT_HOURS, ...picked });
}

const readJson = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null');
  } catch {
    return null;
  }
};

const writeStore = (store) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
};

// Everything saved, moving the old shared schedule over the first time
function readStore() {
  const saved = readJson(KEY);
  if (isObject(saved)) {
    return {
      calls: isObject(saved.calls) ? saved.calls : {},
      shared: hoursFrom(saved.shared),
      overrides: isObject(saved.overrides) ? saved.overrides : {},
    };
  }

  const old = readJson(OLD_KEY);
  const store = {
    calls: {},
    shared: hoursFrom(old),
    overrides: isObject(old?.overrides) ? old.overrides : {},
  };
  writeStore(store); // best effort: if it fails, the next read moves it over again
  return store;
}

// ---------- One call's hours ----------

// The call's own hours; else the schedule every call shared before;
// else the defaults. saved: false only when it's the defaults.
export function loadCallHours(callId) {
  const store = readStore();
  const own = hoursFrom(store.calls[callId]);
  if (own) return { ...own, saved: true };
  if (store.shared) return { ...store.shared, saved: true };
  return { ...structuredClone(DEFAULT_HOURS), saved: false };
}

// Returns true if it saved
export function saveCallHours(callId, hours) {
  const clean = hoursFrom(hours);
  if (!callId || !clean) return false;
  const store = readStore();
  return writeStore({ ...store, calls: { ...store.calls, [callId]: clean } });
}

// Two sets of hours the same? (Ignores the saved flag and key order of days.)
export function sameHours(a, b) {
  const x = hoursFrom(a);
  const y = hoursFrom(b);
  if (!x || !y) return x === y;
  return HOUR_KEYS.every((k) =>
    k === 'weekly'
      ? Object.keys({ ...x.weekly, ...y.weekly }).every(
          (day) => JSON.stringify(x.weekly[day] ?? []) === JSON.stringify(y.weekly[day] ?? []),
        )
      : x[k] === y[k],
  );
}

// ---------- Days off (every call) ----------

export function loadDaysOff() {
  return readStore().overrides;
}

// Returns true if it saved
export function saveDaysOff(overrides) {
  if (!isObject(overrides)) return false;
  return writeStore({ ...readStore(), overrides });
}

// ---------- What the booking page uses ----------

// One call's hours with the creator's days off: the shape findSlots expects
export function loadSchedule(callId) {
  return { ...loadCallHours(callId), overrides: loadDaysOff() };
}

// Back to nothing saved (for testing)
export function clearSchedule() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(OLD_KEY);
  } catch {
    // nothing saved to clear
  }
}