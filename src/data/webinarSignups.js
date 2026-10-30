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
//   refundedAt, refunded: when and how much they were refunded (rupees):
//     everyone at once when a session is cancelled (refundAll), or one
//     person by hand (refundOne); missing otherwise
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

// When the latest person registered, for any webinar, between two moments
// (ms), or null. The Meta Pixel panel uses it for "Last sign-up sent to
// Meta": sign-ups after it was connected (and before it stopped working).
export function latestSignupAt({ after = 0, before = Infinity } = {}) {
  let latest = null;
  loadAll().forEach((p) => {
    const at = Number(p.registeredAt);
    if (at >= after && at < before && (latest === null || at > latest)) latest = at;
  });
  return latest;
}

// A cancelled session's refunds: everyone who paid (and isn't refunded
// yet) is marked refunded with what they paid. In the prototype no money
// moves; the real product asks the payment provider for each refund.
// Returns { count, total } (rupees).
export function refundAll(webinarId, at = Date.now()) {
  const all = loadAll();
  let count = 0;
  let total = 0;
  const next = all.map((p) => {
    if (p.webinarId !== webinarId || !(p.amount > 0) || p.refundedAt) return p;
    count += 1;
    total += p.amount;
    return { ...p, refundedAt: at, refunded: p.amount };
  });
  if (count > 0) saveAll(next);
  return { count, total };
}

// One person's refund, by hand: the coach refunds someone who asked (say,
// they can't make a session's new date). In full, or part of it (amount:
// whole rupees, more than 0 and up to what they paid). Once per person:
// after a part refund, the rest can't be refunded later. In the prototype
// no money moves. Returns the refunded person, or null when there's
// nothing to refund (not found, didn't pay, already refunded), the amount
// isn't one they can get back, or it couldn't be saved.
export function refundOne(webinarId, personId, { amount = null, at = Date.now() } = {}) {
  const all = loadAll();
  const person = all.find((p) => p.webinarId === webinarId && p.id === personId);
  if (!person || !(person.amount > 0) || person.refundedAt) return null;
  const back = amount === null ? person.amount : amount;
  if (!Number.isInteger(back) || back <= 0 || back > person.amount) return null;
  const refunded = { ...person, refundedAt: at, refunded: back };
  return saveAll(all.map((p) => (p === person ? refunded : p))) ? refunded : null;
}

// What someone paid that they still have paid: what they paid, less any
// refund (rupees)
export const keptOf = (person) => Math.max(0, (Number(person.amount) || 0) - (Number(person.refunded) || 0));

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
  const refunds = paid && people.some((p) => p.refundedAt);
  const head = ['Name', 'Email', 'Phone', 'Registered', ...(paid ? ['Paid (₹)'] : []), ...(refunds ? ['Refunded (₹)'] : [])];
  const rows = people.map((p) => [
    p.name,
    p.email,
    p.phone,
    when(p.registeredAt),
    ...(paid ? [p.amount] : []),
    ...(refunds ? [p.refunded ?? 0] : []),
  ]);
  return `\uFEFF${[head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')}`;
}