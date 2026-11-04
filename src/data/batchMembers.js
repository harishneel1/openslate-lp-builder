import { todayIn } from '../utils/slots';

// ------------------------------------------------------------
// A batch's members: the people holding its contract. Contracts are how
// access works (as services in TagMango): someone is in a batch because
// they bought its monthly contract and it's still active, so this is a
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
//     payments: [{ at (ms), amount, from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' }] }
//   A payment covers from its `from` day up to (not including) `to`,
//   which is the renewal date. Round 2 adds renewals as more payments.
//
// Round 1: everyone has paid for their first month, so everyone is
// "Paid", renewing on their own date. What happens on that date
// (reminders, grace, overdue, remove and restore) is round 2.
// ------------------------------------------------------------

const KEY = 'pagebuilder:batch-members';
export const MEMBERS_CHANGED_EVENT = 'batch-members-changed';

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

// Calls fn when members change, here or in another tab (someone joining
// on the batch's page). Returns a stop function.
export function onMembersChange(fn) {
  const onStorage = (e) => (e.key === null || e.key === KEY) && fn();
  window.addEventListener(MEMBERS_CHANGED_EVENT, fn);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(MEMBERS_CHANGED_EVENT, fn);
    window.removeEventListener('storage', onStorage);
  };
}

// ---------- Renewal dates ----------

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

// '2026-12-14' → '14 Dec'
export function shortDate(date) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' });
}

// The day of the month they renew on, in words: 14 → '14th', 31 → 'last day'
export function renewalDayLine(date) {
  const d = Number(date.split('-')[2]);
  if (d > 28) return `${d}${suffix(d)} (or the month’s last day)`;
  return `${d}${suffix(d)}`;
}
function suffix(n) {
  if (n % 100 >= 11 && n % 100 <= 13) return 'th';
  return { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th';
}

// ---------- Members ----------

// One member, as the batch's page shows them:
//   ... the saved member, plus joinedOn, renewsOn (dates on the batch's
//   clock), status: 'paid' (round 1 has no other)
function describe(m) {
  const last = (Array.isArray(m.payments) ? m.payments : []).at(-1) ?? null;
  return {
    ...m,
    joinedOn: m.payments?.[0]?.from ?? null,
    renewsOn: last?.to ?? null,
    status: 'paid',
  };
}

// A batch's members, newest first
export function membersOf(batchId) {
  return readAll()
    .filter((m) => m.batchId === batchId)
    .sort((a, b) => b.joinedAt - a.joinedAt)
    .map(describe);
}

// Everyone in any batch, newest first (for the bell)
export const allMembers = () => readAll().sort((a, b) => b.joinedAt - a.joinedAt).map(describe);

// How many people hold a batch's contract
export const memberCount = (batchId) => readAll().filter((m) => m.batchId === batchId).length;

const sameEmail = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();

// Already in this batch (by email), or null
export const memberByEmail = (batchId, email) =>
  readAll().find((m) => m.batchId === batchId && sameEmail(m.email, email)) ?? null;

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
    payments: [{ at: now, amount: batch.price, from, to: nextRenewal(from) }],
  };
  return writeAll([...readAll(), member]) ? describe(member) : null;
}

// A batch deleted: its members go with it (only possible once it has none
// in this round, since a batch with members can't be deleted)
export const deleteMembersOf = (batchId) => writeAll(readAll().filter((m) => m.batchId !== batchId));