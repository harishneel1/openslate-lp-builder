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
//   refundedAt, refunded: when and how much they were refunded (rupees),
//     in full or in part: when their session was cancelled (refundAll),
//     or when the coach removed them (removeOne); missing otherwise
//   removedAt: when the coach took them out of the session (removeOne);
//     missing while they're attending. Removed people stay in the list as
//     a record, but nothing about the session reaches them any more: no
//     reminders, no cancellation or reschedule email, no cancel refund.
//     Nobody is emailed about the removal: the coach tells them.
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

// Taken out of the session by the coach (removeOne)
export const isRemoved = (person) => Number.isFinite(person?.removedAt);

// Who's still attending: everyone except people removed. What every email
// to the session's people (reminders, cancel, reschedule) and every count
// of who's coming uses.
export const attendingOf = (webinarId) => peopleOf(webinarId).filter((p) => !isRemoved(p));

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
// yet) is marked refunded. In full by default: each gets back what they
// paid. each: a part refund instead, the same whole-rupee amount for
// everyone, more than 0 and less than the least anyone paid (the cancel
// flow checks it; here it's never more than what someone paid). In the
// prototype no money moves; the real product asks the payment provider
// for each refund.
// Returns { count, total, each } (rupees; each is null for a full refund).
export function refundAll(webinarId, { each = null, at = Date.now() } = {}) {
  const part = Number.isInteger(each) && each > 0 ? each : null;
  const all = loadAll();
  let count = 0;
  let total = 0;
  const next = all.map((p) => {
    if (p.webinarId !== webinarId || !(p.amount > 0) || p.refundedAt || isRemoved(p)) return p;
    const back = part === null ? p.amount : Math.min(part, p.amount);
    count += 1;
    total += back;
    return { ...p, refundedAt: at, refunded: back };
  });
  if (count > 0) saveAll(next);
  return { count, total, each: part };
}

// Removing one person from a session, by hand (say, they asked for their
// money back). They're marked removed, and, when they paid and haven't
// been refunded, refunded: in full by default, or part of it (refund:
// whole rupees, more than 0 and less than what they paid). Once only: a
// removed person can't be removed again. In the prototype no money moves
// and nobody is emailed. Returns the removed person, or null when they
// can't be (not found, already removed, the amount doesn't work) or it
// couldn't be saved.
export function removeOne(webinarId, personId, { refund = null, at = Date.now() } = {}) {
  const all = loadAll();
  const person = all.find((p) => p.webinarId === webinarId && p.id === personId);
  if (!person || isRemoved(person)) return null;
  let next = { ...person, removedAt: at };
  if (person.amount > 0 && !person.refundedAt) {
    const back = refund === null ? person.amount : refund;
    if (!Number.isInteger(back) || back <= 0 || back > person.amount) return null;
    next = { ...next, refundedAt: at, refunded: back };
  }
  return saveAll(all.map((p) => (p === person ? next : p))) ? next : null;
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
  const removed = people.some(isRemoved);
  const head = [
    'Name',
    'Email',
    'Phone',
    'Registered',
    ...(paid ? ['Paid (₹)'] : []),
    ...(refunds ? ['Refunded (₹)'] : []),
    ...(removed ? ['Removed'] : []),
  ];
  const rows = people.map((p) => [
    p.name,
    p.email,
    p.phone,
    when(p.registeredAt),
    ...(paid ? [p.amount] : []),
    ...(refunds ? [p.refunded ?? 0] : []),
    ...(removed ? [isRemoved(p) ? when(p.removedAt) : ''] : []),
  ]);
  return `\uFEFF${[head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')}`;
}