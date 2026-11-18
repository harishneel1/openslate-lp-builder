// ------------------------------------------------------------
// People who signed up on a contract's own checkout page
// (/web/checkout/<id>, ContractCheckoutPage.jsx): one record per
// payment, or per registration when it's free. Kept in this browser
// for the mock; in the real product the server saves each one when
// Razorpay confirms the payment.
//
// This is what course access checks: someone can open a course when
// they have a sign-up on the course's own contract (its Buy button's,
// students.js) that hasn't been refunded, matched by email or phone. So
// it keeps who they are, what they paid and when.
//
//   { id: 'ord_…', contractId, contractTitle,
//     name, email, phone, answers: [{ question, answer }] (callQuestions.js),
//     currency, price (before coupon), coupon: { code, percent } | null,
//     discount, gst: { amount, included } | null, total, free,
//     gstDetails: { gstin, business, address, state } | null,
//     paymentId: 'pay_…' | null, createdAt,
//     refundedAt, refunded }
//   total, price, discount: in the currency's main unit (rupees, dollars),
//     with paise or cents as decimals (1499, 49.5)
//   refundedAt, refunded: when, and how much was given back, in the same
//     currency and unit as total. Full or part. Missing until refunded.
//     Once only: a refunded sign-up can't be refunded again. A refund,
//     full or part, takes away the course it gave (students.js).
//
// saveContractSignup(fields) → the record, or null if it couldn't be saved
// getContractSignup(id) → the record, or null
// allContractSignups() → every record, newest first
// contractSignupsOf(contractId) → its records, newest first
// peopleOnContract(contractId) → how many people, one each however
//   many times they paid (matched by email)
// isRefunded(record) → true once it's been refunded (in full or part)
// refundableOf(record) → what can be given back (total, or 0 when it's
//   free or already refunded)
// refundSignup(id, amount, { at }) → the refunded record, or null (not
//   found, free, already refunded, or the amount doesn't work: more than
//   0 and no more than what they paid)
// onContractSignupsChange(fn) → runs fn when sign-ups change (here or in
//   another tab); returns the function that stops it
// CONTRACT_SIGNUPS_EVENT fires in this tab when one is saved or refunded
// (other tabs hear the browser's own storage event)
// CONTRACT_SIGNUPS_KEY: where they're kept, for other tabs' storage events
// ------------------------------------------------------------

const KEY = 'pagebuilder:contract-signups';
export const CONTRACT_SIGNUPS_KEY = KEY;
export const CONTRACT_SIGNUPS_EVENT = 'contract-signups-changed';

function load() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((r) => r && typeof r.id === 'string') : [];
  } catch {
    return [];
  }
}

function saveAll(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    return false;
  }
  window.dispatchEvent(new Event(CONTRACT_SIGNUPS_EVENT));
  return true;
}

const newId = (prefix) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const newestFirst = (a, b) => String(b.createdAt).localeCompare(String(a.createdAt));

export function saveContractSignup(fields) {
  const record = {
    ...fields,
    id: newId('ord'),
    email: String(fields.email ?? '').trim(),
    paymentId: fields.free ? null : newId('pay'),
    createdAt: new Date().toISOString(),
  };
  return saveAll([...load(), record]) ? record : null;
}

export const getContractSignup = (id) => (id ? load().find((r) => r.id === id) ?? null : null);

export const allContractSignups = () => load().sort(newestFirst);

export const contractSignupsOf = (contractId) => load().filter((r) => r.contractId === contractId).sort(newestFirst);

export function peopleOnContract(contractId) {
  return new Set(contractSignupsOf(contractId).map((r) => String(r.email ?? '').toLowerCase() || r.id)).size;
}

export const isRefunded = (record) => Number.isFinite(record?.refundedAt);

export const refundableOf = (record) =>
  record && !record.free && !isRefunded(record) ? Math.max(0, Number(record.total) || 0) : 0;

export function refundSignup(id, amount, { at = Date.now() } = {}) {
  const all = load();
  const record = all.find((r) => r.id === id);
  const most = refundableOf(record);
  const back = Math.round(Number(amount) * 100) / 100;
  if (!record || most <= 0 || !(back > 0) || back > most) return null;
  const next = { ...record, refundedAt: at, refunded: back };
  return saveAll(all.map((r) => (r === record ? next : r))) ? next : null;
}

export function onContractSignupsChange(fn) {
  const fromOtherTab = (e) => {
    if (e.key === KEY || e.key === null) fn();
  };
  window.addEventListener(CONTRACT_SIGNUPS_EVENT, fn);
  window.addEventListener('storage', fromOtherTab);
  return () => {
    window.removeEventListener(CONTRACT_SIGNUPS_EVENT, fn);
    window.removeEventListener('storage', fromOtherTab);
  };
}