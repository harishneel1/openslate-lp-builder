import { loadBookings } from './bookingsStore';

// ------------------------------------------------------------
// Sign-ups: how many people have signed up on a contract. Everyone who
// gave their details counts, paid or free, whether or not the call or
// webinar has happened yet, and a cancelled booking still counts (they
// signed up). One person counts once, however many times they book.
//
// For the mock:
//   a 1:1 call's contract   the people who booked that call (bookingsStore.js),
//                           matched by email, else phone, else name
//   the sample contracts    a made-up number (signups in mockServices.js)
//   anything else           0, since webinar sign-ups and course
//                           enrolments aren't saved yet
// In the real product the server counts the people on each contract.
//
// signupCounts(contracts) → { [contractId]: number }
// ------------------------------------------------------------

// Who a booking's guest is, so the same person booking twice counts once
function personOf(booking) {
  const g = booking.guest ?? {};
  const email = String(g.email ?? '').trim().toLowerCase();
  if (email) return `e:${email}`;
  const phone = String(g.phone?.number ?? g.phone ?? '').replace(/\D/g, '');
  if (phone) return `p:${phone}`;
  const name = String(g.name ?? '').trim().toLowerCase();
  return name ? `n:${name}` : `b:${booking.id}`;
}

export function signupCounts(contracts) {
  // People per call, from every booking ever made
  const byCall = {};
  loadBookings().forEach((b) => {
    if (!b.serviceId) return;
    (byCall[b.serviceId] ??= new Set()).add(personOf(b));
  });

  return Object.fromEntries(
    contracts.map((c) => [
      c.id,
      c.callId ? byCall[c.callId]?.size ?? 0 : Math.max(0, Math.round(Number(c.signups) || 0)),
    ]),
  );
}