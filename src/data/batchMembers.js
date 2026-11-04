import { addDays, todayIn } from '../utils/slots';

// ------------------------------------------------------------
// A batch's members: the people holding its contract. Contracts are how
// access works (as services in TagMango): someone is in a batch because
// they bought its monthly contract and still hold it, so this is a
// record of those contract holders, kept per batch for the mock.
// In the real product the server keeps them on the contract, and the
// student's feed shows a batch's classes to whoever holds it.
//
// Monthly, from the day they join: someone who joins on the 14th pays
// the full fee that day and renews on the 14th of every month. A month
// with no such day renews on its last day (joined on the 31st → 30 Nov,
// 28 or 29 Feb, 31 Dec). Coaches always get a full month for a full fee;
// there's no part-month price.
//
// One member, as saved:
//   { id, batchId, contractId, name, email, phone: { code, number },
//     answers: [{ question, answer }] (as checkout saves them),
//     joinedAt (ms),
//     payments: [{ at (ms), amount, from, to ('YYYY-MM-DD'),
//                  method: 'join' | 'link' | 'marked' | 'restore' | 'rejoin' }],
//     reminders: [{ at (ms), dueOn ('YYYY-MM-DD') }],
//     rejoinLinks: [{ at (ms) }]  (payment links sent to come back, once removed),
//     removedAt (ms) or null,
//     sample: true for the Prototype controls' made-up members }
//   A payment covers from its `from` day up to (not including) `to`,
//   which is the next renewal date.
//
// Round 2: what happens on that date. Nothing is sent or cut off on its
// own. The status says where each member is, and the coach acts:
//
//   paid        more than 3 days before their date
//   soon        the 3 days before it ("Due soon")
//   today       on it ("Due today")
//   overdue     the 5 days after it (the grace period)
//   past-grace  from the 6th day after: flagged for the coach to decide
//   removed     the coach took them out: they no longer hold the
//               contract, so the batch's classes leave their feed
//
// Paying a renewal (their payment link, or the coach marking it paid)
// adds one month from their date, even when it's paid late, so the date
// never drifts.
//
// Every payment is made on the batch's own page (its contract), which
// knows people by the email they joined with (memberByEmail):
//   in the batch, payment due → payRenewal(…, 'link'): their next month
//   removed                  → restoreMember(…, 'rejoin'): back in, with a
//                              fresh month from that day
// so nobody is ever added twice. Cash or UPI paid to the coach: they
// mark it paid, or restore someone removed ('restore').
// ------------------------------------------------------------

const KEY = 'pagebuilder:batch-members';
export const MEMBERS_CHANGED_EVENT = 'batch-members-changed';

export const SOON_DAYS = 3; // "Due soon" starts this many days before
export const GRACE_DAYS = 5; // "Overdue" lasts this many days after

const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v);

function readAll() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((m) => isObject(m) && typeof m.id === 'string') : [];
  } catch {
    return [];
  }
}

function writeAll(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    window.dispatchEvent(new Event(MEMBERS_CHANGED_EVENT));
    return true;
  } catch {
    return false;
  }
}

// Changes one member and saves. Returns the changed member, or null.
function update(id, change) {
  const list = readAll();
  const i = list.findIndex((m) => m.id === id);
  if (i === -1) return null;
  list[i] = { ...list[i], ...change(list[i]) };
  return writeAll(list) ? list[i] : null;
}

// Calls fn when members change, here or in another tab (someone joining
// on the batch's page, or paying their renewal). Returns a stop function.
export function onMembersChange(fn) {
  const onStorage = (e) => (e.key === null || e.key === KEY) && fn();
  window.addEventListener(MEMBERS_CHANGED_EVENT, fn);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(MEMBERS_CHANGED_EVENT, fn);
    window.removeEventListener('storage', onStorage);
  };
}

// ---------- Dates ----------

const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m: 1–12

// The same day next month, or that month's last day:
// '2026-11-14' → '2026-12-14', '2027-01-31' → '2027-02-28'
// day: the day of the month they joined on (31 stays 31 after a short month)
export function nextRenewal(date, day = Number(date.split('-')[2])) {
  const [y, m] = date.split('-').map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  const nd = Math.min(day, daysIn(ny, nm));
  return `${ny}-${String(nm).padStart(2, '0')}-${String(nd).padStart(2, '0')}`;
}

// Days from one date to another: ('2026-12-14', '2026-12-17') → 3
export function daysBetween(from, to) {
  const ms = (d) => Date.UTC(...d.split('-').map((n, i) => Number(n) - (i === 1 ? 1 : 0)));
  return Math.round((ms(to) - ms(from)) / 86_400_000);
}

// '2026-12-14' → '14 Dec'
export function shortDate(date) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' });
}

// The day of the month they renew on, in words: 14 → '14th', 31 → '31st (or the month's last day)'
export function renewalDayLine(date) {
  const d = Number(date.split('-')[2]);
  if (d > 28) return `${d}${suffix(d)} (or the month’s last day)`;
  return `${d}${suffix(d)}`;
}
function suffix(n) {
  if (n % 100 >= 11 && n % 100 <= 13) return 'th';
  return { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th';
}

// ---------- Where a member is ----------

// zone: the batch's time zone (their dates are on its clock)
// → the saved member, plus:
//   joinedOn, renewsOn (their next date), payDay (the day of the month they renew on)
//   status: 'paid' | 'soon' | 'today' | 'overdue' | 'past-grace' | 'removed'
//   daysLate: days past their date (overdue and past grace), else 0
//   graceEnds: the last day of their grace period
//   lastReminder: their latest reminder for this date, or null
function describe(m, zone, now) {
  const payments = Array.isArray(m.payments) ? m.payments : [];
  const last = payments.at(-1) ?? null;
  const renewsOn = last?.to ?? null;
  const today = todayIn(zone, now);
  const removed = Number.isFinite(m.removedAt);
  const toGo = renewsOn ? daysBetween(today, renewsOn) : 0;
  const status = removed
    ? 'removed'
    : !renewsOn || toGo > SOON_DAYS
      ? 'paid'
      : toGo > 0
        ? 'soon'
        : toGo === 0
          ? 'today'
          : -toGo <= GRACE_DAYS
            ? 'overdue'
            : 'past-grace';
  const reminders = Array.isArray(m.reminders) ? m.reminders : [];
  return {
    ...m,
    payments,
    reminders,
    joinedOn: payments[0]?.from ?? null,
    renewsOn,
    payDay: m.payDay ?? Number((payments[0]?.from ?? '2000-01-01').split('-')[2]),
    status,
    daysLate: toGo < 0 ? -toGo : 0,
    daysToGo: toGo > 0 ? toGo : 0,
    graceEnds: renewsOn ? addDays(renewsOn, GRACE_DAYS) : null,
    lastReminder: reminders.filter((r) => r.dueOn === renewsOn).at(-1) ?? null,
    // The latest payment link sent to come back, since they were removed
    lastRejoinLink: removed
      ? ((Array.isArray(m.rejoinLinks) ? m.rejoinLinks : []).filter((l) => l.at >= m.removedAt).at(-1) ?? null)
      : null,
  };
}

// Statuses that need the coach: a reminder, a payment, or a decision
export const NEEDS_ACTION = ['soon', 'today', 'overdue', 'past-grace'];
export const isActive = (m) => m.status !== 'removed';

// A batch's members, newest first
export function membersOf(batch, now = Date.now()) {
  return readAll()
    .filter((m) => m.batchId === batch.id)
    .sort((a, b) => b.joinedAt - a.joinedAt)
    .map((m) => describe(m, batch.timeZone, now));
}


// Everyone in any batch, newest first (for the bell). zone: the coach's.
export const allMembers = (zone = 'Asia/Kolkata', now = Date.now()) =>
  readAll()
    .sort((a, b) => b.joinedAt - a.joinedAt)
    .map((m) => describe(m, zone, now));

// How many people are in a batch now (not removed)
export const memberCount = (batchId) => readAll().filter((m) => m.batchId === batchId && !Number.isFinite(m.removedAt)).length;

// How many people ever held a batch's contract (Contracts' sign-ups count everyone)
// Sample members (Prototype controls) don't count, so a batch with only
// samples can still be deleted.
export const everJoined = (batchId) => readAll().filter((m) => m.batchId === batchId && !m.sample).length;

// How many of a batch's members are in each status: { paid, soon, today, ... }
export function statusCounts(batch, now = Date.now()) {
  const counts = { paid: 0, soon: 0, today: 0, overdue: 0, 'past-grace': 0, removed: 0 };
  membersOf(batch, now).forEach((m) => {
    counts[m.status] += 1;
  });
  return counts;
}

const sameEmail = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();

// Already in this batch, or removed from it (by email), or null
export function memberByEmail(batch, email, now = Date.now()) {
  const m = readAll().find((x) => x.batchId === batch.id && sameEmail(x.email, email));
  return m ? describe(m, batch.timeZone, now) : null;
}

// ---------- What happens to members ----------

// Someone just paid on the batch's page: they hold its contract from today,
// paid up to the same day next month. Returns the member, or null if
// storage failed.
// batch: the batch (for its contract, fee and clock)
// person: { name, email, phone, answers }
export function addMember(batch, person, now = Date.now()) {
  const from = todayIn(batch.timeZone, now);
  const member = {
    id: `mem-${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    batchId: batch.id,
    contractId: batch.contractId,
    name: String(person.name ?? '').trim(),
    email: String(person.email ?? '').trim(),
    phone: person.phone ?? null,
    answers: Array.isArray(person.answers) ? person.answers : [],
    joinedAt: now,
    payDay: Number(from.split('-')[2]),
    payments: [{ at: now, amount: batch.price, from, to: nextRenewal(from), method: 'join' }],
    reminders: [],
    removedAt: null,
  };
  return writeAll([...readAll(), member]) ? describe(member, batch.timeZone, now) : null;
}

// A renewal paid (on the batch's page: 'link'; the coach, for cash or
// UPI: 'marked'). One month from their date, at the batch's fee now (a new
// fee applies from each member's next renewal). Returns the member, or null.
export function payRenewal(memberId, batch, method, now = Date.now()) {
  const saved = update(memberId, (m) => {
    const d = describe(m, batch.timeZone, now);
    if (d.status === 'removed' || !d.renewsOn) return {};
    return {
      payments: [
        ...d.payments,
        { at: now, amount: batch.price, from: d.renewsOn, to: nextRenewal(d.renewsOn, d.payDay), method },
      ],
    };
  });
  return saved ? describe(saved, batch.timeZone, now) : null;
}

// Undo the latest renewal the coach marked paid (a slip of the finger).
// Only a marked one, and never their first payment.
export function undoMarkedPayment(memberId, batch, now = Date.now()) {
  const saved = update(memberId, (m) => {
    const payments = Array.isArray(m.payments) ? m.payments : [];
    const last = payments.at(-1);
    return payments.length > 1 && last?.method === 'marked' ? { payments: payments.slice(0, -1) } : {};
  });
  return saved ? describe(saved, batch.timeZone, now) : null;
}

// The coach opened WhatsApp to remind them about this date
export function noteReminder(memberId, batch, now = Date.now()) {
  const saved = update(memberId, (m) => {
    const d = describe(m, batch.timeZone, now);
    return { reminders: [...d.reminders, { at: now, dueOn: d.renewsOn }] };
  });
  return saved ? describe(saved, batch.timeZone, now) : null;
}

// The coach opened WhatsApp to send a removed member their payment link
export function noteRejoinLink(memberId, batch, now = Date.now()) {
  const saved = update(memberId, (m) => ({ rejoinLinks: [...(Array.isArray(m.rejoinLinks) ? m.rejoinLinks : []), { at: now }] }));
  return saved ? describe(saved, batch.timeZone, now) : null;
}

// Removed: they no longer hold the batch's contract. Everything about them stays.
export function removeMember(memberId, batch, now = Date.now()) {
  const saved = update(memberId, () => ({ removedAt: now }));
  return saved ? describe(saved, batch.timeZone, now) : null;
}

// Back in the batch: they paid again, so they hold the contract again,
// with a fresh month from today (their date moves to today's).
// method: 'restore' (the coach, for cash or UPI) or 'rejoin' (they paid
// again on the batch's page)
export function restoreMember(memberId, batch, now = Date.now(), method = 'restore') {
  const from = todayIn(batch.timeZone, now);
  const day = Number(from.split('-')[2]);
  const saved = update(memberId, (m) => ({
    removedAt: null,
    payDay: day,
    payments: [
      ...(Array.isArray(m.payments) ? m.payments : []),
      { at: now, amount: batch.price, from, to: nextRenewal(from, day), method },
    ],
  }));
  return saved ? describe(saved, batch.timeZone, now) : null;
}

// A batch deleted: its members go with it (only possible once nobody has
// ever joined, since a batch with members can't be deleted)
export const deleteMembersOf = (batchId) => writeAll(readAll().filter((m) => m.batchId !== batchId));

// ---------- In words ----------
// Plain words coaches use: "Payment pending", not "overdue" or "grace".
//   pill: the status, short. tone: its colour. detail: the date beside it.
//   paid     [Paid]             Next payment 4 Dec
//   soon     [Due soon]         Due in 2 days / Due tomorrow
//   today    [Payment pending]  Due today
//   overdue  [Payment pending]  3 days late
//   past     [Payment pending]  8 days late   (red: over 5 days)
//   removed  [Removed]          Removed 10 Dec
// zone: the batch's clock, for the day they were removed
export function statusWords(m, zone) {
  const days = (n) => `${n} ${n === 1 ? 'day' : 'days'} late`;
  switch (m.status) {
    case 'soon':
      return {
        pill: 'Due soon',
        tone: 'soon',
        detail: m.daysToGo === 1 ? 'Due tomorrow' : `Due in ${m.daysToGo} days`,
      };
    case 'today':
      return { pill: 'Payment pending', tone: 'pending', detail: 'Due today' };
    case 'overdue':
      return { pill: 'Payment pending', tone: 'pending', detail: days(m.daysLate) };
    case 'past-grace':
      return { pill: 'Payment pending', tone: 'late', detail: days(m.daysLate) };
    case 'removed':
      return { pill: 'Removed', tone: 'removed', detail: `Removed ${shortDate(todayIn(zone, m.removedAt))}` };
    default:
      return { pill: 'Paid', tone: 'paid', detail: `Next payment ${shortDate(m.renewsOn)}` };
  }
}

// Payments not made yet (due today or late), and how many of those are
// over 5 days late, from statusCounts: { pending, late }
export const pendingOf = (counts) => ({
  pending: counts.today + counts.overdue + counts['past-grace'],
  late: counts['past-grace'],
});

// "2 payments pending (1 for over 5 days)", or '' when none
export function pendingLine({ pending, late }) {
  if (pending === 0) return '';
  const main = `${pending} ${pending === 1 ? 'payment' : 'payments'} pending`;
  return late > 0 ? `${main} (${late} for over ${GRACE_DAYS} days)` : main;
}

// ---------- Sample members (Prototype controls) ----------

// The date one month before, on their pay day: '2026-12-14' → '2026-11-14'
function prevRenewal(date, day) {
  const [y, m] = date.split('-').map(Number);
  const py = m === 1 ? y - 1 : y;
  const pm = m === 1 ? 12 : m - 1;
  const pd = Math.min(day, daysIn(py, pm));
  return `${py}-${String(pm).padStart(2, '0')}-${String(pd).padStart(2, '0')}`;
}

// One of each situation, dated from now, so every case shows at once.
// [name, days from today to their next date, extras]
const SAMPLES = [
  ['Priya Raman', 16, {}],
  ['Karthik Iyer', 2, {}],
  ['Divya Shankar', 0, {}],
  ['Anand Subramanian', -3, {}],
  ['Ravi Kumar', -8, {}],
  ['Suresh Babu', 0, { noPhone: true }],
  ['Meena Krishnan', -12, { removed: true }],
  ['Lakshmi Narayanan', null, { day: 31 }], // pays on the 31st: her next date is a month's last day
];

// The next date on or after `from` that someone paying on the 31st renews
// on: this month's last day, or next month's if that's already gone
function nextMonthEnd(from) {
  const [y, m] = from.split('-').map(Number);
  const end = `${y}-${String(m).padStart(2, '0')}-${String(daysIn(y, m)).padStart(2, '0')}`;
  return end > from ? end : nextRenewal(end, 31);
}

// Adds the samples to a batch. Returns true if it saved.
export function addSampleMembers(batch, now = Date.now()) {
  const today = todayIn(batch.timeZone, now);
  const made = SAMPLES.map(([name, offset, extra], i) => {
    const due = offset === null ? nextMonthEnd(today) : addDays(today, offset);
    const day = extra.day ?? Number(due.split('-')[2]);
    const from = prevRenewal(due, day);
    const first = name.split(' ')[0].toLowerCase();
    return {
      id: `mem-sample-${now.toString(36)}${i}`,
      batchId: batch.id,
      contractId: batch.contractId,
      name,
      email: `${first}@example.com`,
      phone: extra.noPhone ? null : { code: '+91', number: `98765 ${String(43210 + i * 7).slice(-5)}` },
      answers: (batch.questions ?? []).map((q, n) => ({
        question: q.text,
        answer: n === 0 && i % 3 === 0 ? 'Mild lower back pain' : n === 0 ? 'None' : '',
      })),
      joinedAt: now - (i + 1) * 3_600_000,
      payDay: day,
      payments: [{ at: now - 30 * 86_400_000, amount: batch.price, from, to: due, method: 'join' }],
      reminders: [],
      removedAt: extra.removed ? now - 2 * 86_400_000 : null,
      sample: true,
    };
  });
  return writeAll([...readAll(), ...made]);
}

export const hasSampleMembers = (batchId) => readAll().some((m) => m.batchId === batchId && m.sample);

export const clearSampleMembers = (batchId) => writeAll(readAll().filter((m) => !(m.batchId === batchId && m.sample)));