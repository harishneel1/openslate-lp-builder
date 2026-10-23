import { isActive, loadBookings } from './bookingsStore';

// ------------------------------------------------------------
// MOCK: whether the guest has replied to the Google Calendar invite.
//
// In the real product the server creates a Google Calendar event for
// each booking with the guest invited, and reads each guest's reply
// from it (Google's attendee responseStatus: accepted, tentative,
// declined, needsAction), saving it on the booking. Nothing here talks
// to Google.
//
// For the mock, bookings take turns through the four replies in the
// order they were made, so testing shows every case:
//   1st booking  accepted
//   2nd          maybe (tentative)
//   3rd          hasn't replied
//   4th          declined
//   5th          accepted again, and so on
// A booking keeps its reply (cancelling another doesn't shift the rest).
//
// inviteOf(booking, now) → null (the call is cancelled), or
//   { status: 'accepted' | 'tentative' | 'none' | 'declined',
//     repliedAt: ISO time of the reply, or null when they haven't replied }
// ------------------------------------------------------------

const TURNS = ['accepted', 'tentative', 'none', 'declined'];

// Where this booking falls among every booking ever made, oldest first
function turnOf(booking) {
  const made = (b) => Date.parse(b.createdAt) || 0;
  const all = loadBookings().sort((a, b) => made(a) - made(b) || a.id.localeCompare(b.id));
  const i = all.findIndex((b) => b.id === booking.id);
  return i < 0 ? 0 : i;
}

export function inviteOf(booking, now = Date.now()) {
  if (!booking || !isActive(booking)) return null; // a cancelled call's invite is withdrawn

  const status = TURNS[turnOf(booking) % TURNS.length];
  if (status === 'none') return { status, repliedAt: null };

  // They replied 20 minutes after it was booked (or last moved, since
  // Google asks guests again when the time changes), never in the future
  const since = Date.parse(booking.rescheduledAt ?? booking.createdAt) || now;
  return { status, repliedAt: new Date(Math.min(since + 20 * 60_000, now)).toISOString() };
}