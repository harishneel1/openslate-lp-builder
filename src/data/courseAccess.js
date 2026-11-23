import { loadBookings } from './bookingsStore';
import { isRemoved, peopleOf } from './webinarSignups';
import { contractSignupsOf, isRefunded } from './contractSignupsStore';

// ------------------------------------------------------------
// Who holds a contract right now, for course access. A course opens for
// anyone who holds its own contract (the one its Buy button sells) or a
// contract it's "also included with" (courses.js, extraContractsOf), and
// that's checked here, by email or mobile number (the last 10 digits).
//
// Holding a contract, by kind (the same people as Contracts' sign-ups,
// contractSignups.js, less the ones who've lost it):
//   a 1:1 call's contract   everyone who booked that call, unless the
//                           booking was cancelled (bookingsStore.js)
//   a webinar's contract    everyone who registered for that webinar,
//                           unless they were removed, with or without a
//                           refund (webinarSignups.js)
//   any other contract      (a live class's too) everyone who signed up on its own checkout
//                           page (contractSignupsStore.js), unless that
//                           sign-up was refunded, in full or in part
// The made-up sign-up numbers on the sample contracts (mockServices.js)
// are only a number, not people, so they never give access.
// In the real product the server checks this.
//
// holdersOf(contract) → [{ email, phone }], one each per sign-up that
//   still holds it (the same person can be there more than once)
// holderCount(contract) → how many people hold it now, one each (matched
//   by email, else phone)
// holds(contract, { emails, phones }) → true when any of those emails or
//   numbers holds it. emails: lower-case; phones: the last 10 digits
// matchOf(student) → { emails, phones } for holds(), from every email and
//   number a student has had (students.js)
// ------------------------------------------------------------

const lower = (v) => String(v ?? '').trim().toLowerCase();
// '+91 98765 43210', { code, number } → '9876543210'
const last10 = (v) => String(v?.number ?? v ?? '').replace(/\D/g, '').slice(-10);

export function holdersOf(contract) {
  if (!contract) return [];
  if (contract.callId) {
    return loadBookings()
      .filter((b) => b.serviceId === contract.callId && b.status !== 'cancelled')
      .map((b) => ({ email: b.guest?.email, phone: b.guest?.phone }));
  }
  if (contract.webinarId) {
    return peopleOf(contract.webinarId)
      .filter((p) => !isRemoved(p))
      .map((p) => ({ email: p.email, phone: p.phone }));
  }
  return contractSignupsOf(contract.id)
    .filter((r) => !isRefunded(r))
    .map((r) => ({ email: r.email, phone: r.phone }));
}

export function holderCount(contract) {
  const keys = new Set(
    holdersOf(contract).map((h, i) => (lower(h.email) ? `e:${lower(h.email)}` : last10(h.phone) ? `p:${last10(h.phone)}` : `x:${i}`)),
  );
  return keys.size;
}

export function holds(contract, { emails, phones }) {
  return holdersOf(contract).some(
    (h) => (lower(h.email) && emails.has(lower(h.email))) || (last10(h.phone).length === 10 && phones.has(last10(h.phone))),
  );
}

export const matchOf = (student) => ({
  emails: new Set((student?.emails ?? [student?.email]).map(lower).filter(Boolean)),
  phones: new Set((student?.phones ?? [student?.phone]).map(last10).filter((p) => p.length === 10)),
});