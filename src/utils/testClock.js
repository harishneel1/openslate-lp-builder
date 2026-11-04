// ------------------------------------------------------------
// A test switch for Live classes: pretend today is another date, so
// renewals can be tried without waiting a month.
//
//   localhost:5173/?today=2026-12-06
//
// Live classes' screens (a batch's page and its members, the renewal
// page, the bell's fee lines) read the time from appNow() instead of
// Date.now(). It keeps today's clock time and moves the date, so a class
// at 6:30 am is still "earlier today" or "later today" as it really is.
// Everything else in the app keeps the real date.
//
// The switch stays on in this tab while you move around the app (it's
// remembered in sessionStorage), and ?today= with no date turns it off.
// The Prototype controls bar on a batch's page sets it too
// (setTestDate), so nobody has to remember the address.
// A prototype tool only: the real product uses the server's clock.
// ------------------------------------------------------------

const KEY = 'pagebuilder:test-today';
export const TEST_DATE_EVENT = 'test-date-changed';
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function pretendDate() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has('today')) {
      const asked = params.get('today');
      if (DATE.test(asked)) sessionStorage.setItem(KEY, asked);
      else sessionStorage.removeItem(KEY);
    }
    const saved = sessionStorage.getItem(KEY);
    return saved && DATE.test(saved) ? saved : null;
  } catch {
    return null;
  }
}

// Now, or now on the pretend date (same clock time, in this browser's zone)
export function appNow() {
  const real = Date.now();
  const date = pretendDate();
  if (!date) return real;
  const [y, m, d] = date.split('-').map(Number);
  const at = new Date(real);
  at.setFullYear(y, m - 1, d);
  return at.getTime();
}

// The pretend date, for a small "Testing as …" note, or null
export const testDate = () => pretendDate();

// Pretend it's this date ('YYYY-MM-DD'), or null for the real date.
// Clears ?today= from the address, so a refresh keeps this choice.
export function setTestDate(date) {
  try {
    if (date && DATE.test(date)) sessionStorage.setItem(KEY, date);
    else sessionStorage.removeItem(KEY);
    const url = new URL(window.location.href);
    if (url.searchParams.has('today')) {
      url.searchParams.delete('today');
      window.history.replaceState(null, '', url);
    }
  } catch {
    // Storage off: the switch just doesn't stick
  }
  window.dispatchEvent(new Event(TEST_DATE_EVENT));
}

// Calls fn when the pretend date changes. Returns a stop function.
export function onTestDateChange(fn) {
  window.addEventListener(TEST_DATE_EVENT, fn);
  return () => window.removeEventListener(TEST_DATE_EVENT, fn);
}