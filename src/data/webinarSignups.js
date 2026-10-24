// ------------------------------------------------------------
// People who registered for a webinar, from its sign-up page. Kept in
// this browser for now (localStorage); in the real product the server
// keeps them. Each webinar has its own people: a webinar run again is a
// new webinar, so it starts with nobody (see data/webinar.js).
//
// One person:
//   { id, webinarId, name, email, phone, amount, registeredAt }
//   phone:  '<code> <number>', as checkout saves it ('+91 98765 43210')
//   amount: what they paid in rupees, 0 when it's free
//   registeredAt: when they registered (ms)
//
// The same email registering twice for one webinar counts once: the
// second time just returns the first.
// ------------------------------------------------------------

const KEY = 'pagebuilder:webinar-signups';
const CHANGED_EVENT = 'webinar-signups-changed';

function loadAll() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((p) => p && typeof p.id === 'string' && typeof p.webinarId === 'string') : [];
  } catch {
    return [];
  }
}

function saveAll(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    window.dispatchEvent(new Event(CHANGED_EVENT));
    return true;
  } catch {
    return false;
  }
}

const sameEmail = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();

// Everyone who registered for this webinar, newest first
export function peopleOf(webinarId) {
  return loadAll()
    .filter((p) => p.webinarId === webinarId)
    .sort((a, b) => b.registeredAt - a.registeredAt);
}

// Saves one registration. Returns the person, or null if it couldn't be saved.
export function addSignup({ webinarId, name, email, phone, amount = 0 }) {
  const all = loadAll();
  const existing = all.find((p) => p.webinarId === webinarId && sameEmail(p.email, email));
  if (existing) return existing;
  const person = {
    id: `p-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    webinarId,
    name: String(name).trim(),
    email: String(email).trim(),
    phone: String(phone).trim(),
    amount: Math.max(0, Math.round(Number(amount) || 0)),
    registeredAt: Date.now(),
  };
  return saveAll([...all, person]) ? person : null;
}

// A deleted webinar takes its people with it
export function deleteSignupsOf(webinarId) {
  const all = loadAll();
  const left = all.filter((p) => p.webinarId !== webinarId);
  if (left.length !== all.length) saveAll(left);
}

// Calls back when people change, here or in another tab (someone
// registering on the link while the coach has the webinar open)
export function onSignupsChange(callback) {
  const fromOtherTab = (e) => {
    if (e.key === KEY || e.key === null) callback();
  };
  window.addEventListener(CHANGED_EVENT, callback);
  window.addEventListener('storage', fromOtherTab);
  return () => {
    window.removeEventListener(CHANGED_EVENT, callback);
    window.removeEventListener('storage', fromOtherTab);
  };
}

// For the Download button: one row per person, as a CSV file that Excel
// opens. The first character (a byte-order mark) makes Excel read ₹ and
// non-English names correctly.
export function peopleCsv(people, { paid = false } = {}) {
  const cell = (v) => {
    const text = String(v ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const when = (ms) =>
    new Date(ms).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  const head = ['Name', 'Email', 'Phone', 'Registered', ...(paid ? ['Paid (₹)'] : [])];
  const rows = people.map((p) => [p.name, p.email, p.phone, when(p.registeredAt), ...(paid ? [p.amount] : [])]);
  return `\uFEFF${[head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')}`;
}