// ------------------------------------------------------------
// People who signed up on a contract's own checkout page
// (/web/checkout/<id>, ContractCheckoutPage.jsx): one record per
// payment, or per registration when it's free. Kept in this browser
// for the mock; in the real product the server saves each one when
// Razorpay confirms the payment.
//
// This is what course access will check later: someone can open a
// course when they have a sign-up on a contract attached to it, matched
// by email. So it keeps who they are, what they paid and when.
//
//   { id: 'ord_…', contractId, contractTitle,
//     name, email, phone, answers: [{ question, answer }] (callQuestions.js),
//     currency, price (before coupon), coupon: { code, percent } | null,
//     discount, gst: { amount, included } | null, total, free,
//     gstDetails: { gstin, business, address, state } | null,
//     paymentId: 'pay_…' | null, createdAt }
//
// saveContractSignup(fields) → the record, or null if it couldn't be saved
// getContractSignup(id) → the record, or null
// contractSignupsOf(contractId) → its records, newest first
// peopleOnContract(contractId) → how many people, one each however
//   many times they paid (matched by email)
// CONTRACT_SIGNUPS_EVENT fires in this tab when one is saved (other tabs
// hear the browser's own storage event)
// ------------------------------------------------------------

const KEY = 'pagebuilder:contract-signups';
export const CONTRACT_SIGNUPS_EVENT = 'contract-signups-changed';

function load() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((r) => r && typeof r.id === 'string') : [];
  } catch {
    return [];
  }
}

const newId = (prefix) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export function saveContractSignup(fields) {
  const record = {
    ...fields,
    id: newId('ord'),
    email: String(fields.email ?? '').trim(),
    paymentId: fields.free ? null : newId('pay'),
    createdAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(KEY, JSON.stringify([...load(), record]));
  } catch {
    return null;
  }
  window.dispatchEvent(new Event(CONTRACT_SIGNUPS_EVENT));
  return record;
}

export const getContractSignup = (id) => (id ? load().find((r) => r.id === id) ?? null : null);

export const contractSignupsOf = (contractId) =>
  load()
    .filter((r) => r.contractId === contractId)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

export function peopleOnContract(contractId) {
  return new Set(contractSignupsOf(contractId).map((r) => r.email.toLowerCase() || r.id)).size;
}