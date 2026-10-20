import { mockAccount } from './myPage';

// ------------------------------------------------------------
// The creator's Google Calendar connection.
//
// Stand-in until the real Google sign-in is wired up: GoogleConsent.jsx
// plays Google's part, and the connection is kept in this browser. In
// the real product the server keeps it, along with the access Google
// gives us.
//
// Saved as null (never connected, or disconnected) or:
//   {
//     status: 'connected' | 'lost',   lost: Google stopped letting us in
//                                     (password change, access removed...)
//     email: 'harish.neel@gmail.com',
//     calendars: [{ id, name, color, primary, writable }],
//     checkIds: ['primary'],          checked for busy times. Never empty.
//     writeId: 'primary',             where new bookings go. Always writable.
//     connectedAt: ISO string,
//   }
// ------------------------------------------------------------

const KEY = 'pagebuilder:mock-calendar';

// Fired on every change, so every screen showing the connection follows it
export const CALENDAR_CHANGED_EVENT = 'calendar-changed';

// What we ask Google for. Both are needed: without either, we can't keep
// people off times the creator is busy. `why` finishes the sentence shown
// when Google comes back without it.
export const PERMISSIONS = [
  {
    id: 'events',
    label: 'See and edit events on all your calendars',
    why: 'it’s how we see when you’re busy, and add each booking to your calendar',
  },
  {
    id: 'calendars',
    label: 'See the list of calendars you have',
    why: 'it’s how you choose which calendars we check',
  },
];

// The Google accounts the stand-in sign-in offers: "Harish Neel" →
// harish.neel@gmail.com and harish@harishneel.in
const nameParts = mockAccount.name.toLowerCase().split(/\s+/).filter(Boolean);
export const MOCK_GOOGLE_ACCOUNTS = [
  { email: `${nameParts.join('.')}@gmail.com`, name: mockAccount.name },
  { email: `${nameParts[0]}@${nameParts.join('')}.in`, name: mockAccount.name },
];

// What Google would list for an account: their main calendar, a couple of
// their own, and a holidays calendar they follow (can't be written to)
function calendarsFor(email) {
  return [
    { id: 'primary', name: email, color: '#039be5', primary: true, writable: true },
    { id: 'work', name: 'Work', color: '#0b8043', primary: false, writable: true },
    { id: 'family', name: 'Family', color: '#e67c73', primary: false, writable: true },
  ];
}

const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v);

// The saved connection, or null. Anything malformed counts as not connected.
export function loadCalendar() {
  try {
    const c = JSON.parse(localStorage.getItem(KEY));
    if (!isObject(c) || typeof c.email !== 'string' || !['connected', 'lost'].includes(c.status)) return null;
    if (!Array.isArray(c.calendars) || !Array.isArray(c.checkIds) || c.checkIds.length === 0) return null;
    return c;
  } catch {
    return null;
  }
}

// true when saved (or cleared with null)
function saveCalendar(connection) {
  try {
    if (connection) localStorage.setItem(KEY, JSON.stringify(connection));
    else localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(CALENDAR_CHANGED_EVENT));
    return true;
  } catch {
    return false;
  }
}

export const isCalendarConnected = (connection) => connection?.status === 'connected';

// After Google says yes to everything. Reconnecting the same account keeps
// their choices; a different account starts from its main calendar.
// Returns the new connection, or null if it couldn't be saved.
export function connectCalendar(email) {
  const before = loadCalendar();
  const calendars = calendarsFor(email);
  const sameAccount = before?.email === email;
  const exists = (id) => calendars.some((c) => c.id === id);

  const keptChecks = sameAccount ? before.checkIds.filter(exists) : [];
  const keptWrite =
    sameAccount && calendars.some((c) => c.id === before.writeId && c.writable) ? before.writeId : null;

  const connection = {
    status: 'connected',
    email,
    calendars,
    checkIds: keptChecks.length ? keptChecks : ['primary'],
    writeId: keptWrite ?? 'primary',
    connectedAt: new Date().toISOString(),
  };
  return saveCalendar(connection) ? connection : null;
}

// changes: { checkIds } or { writeId }. Returns the connection, or null.
export function updateCalendar(changes) {
  const current = loadCalendar();
  if (!current) return null;
  const next = { ...current, ...changes };
  if (!next.checkIds.length) return null; // always at least one to check
  return saveCalendar(next) ? next : null;
}

export const disconnectCalendar = () => saveCalendar(null);

// For trying the "lost access" screens (?calendar=lost on the offerings home).
// The real product finds out when Google refuses us.
export function markCalendarLost() {
  const current = loadCalendar();
  return current ? saveCalendar({ ...current, status: 'lost' }) : false;
}