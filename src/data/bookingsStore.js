// ------------------------------------------------------------
// Bookings of the creator's own calls, for the mock: saved when
// checkout succeeds, so a booked time can't be booked again (one
// calendar for all their calls). Kept in this browser; in the real
// product the server saves them when payment goes through, emails
// the creator (ideally with a calendar invite attached), and the
// confirmation page loads one by its id.
//
// Saved shape:
//   { id, serviceId, title, start, end, format: 'video' | 'phone',
//     guest: { name, email, phone },
//     meetingLink: the creator's link when it was booked (what the
//                  confirmation email sent), or null for a phone call,
//     createdAt }
// ------------------------------------------------------------

const KEY = 'pagebuilder:mock-bookings';

export function loadBookings() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((b) => b && typeof b.id === 'string') : [];
  } catch {
    return [];
  }
}

export function getBooking(id) {
  if (!id) return null;
  return loadBookings().find((b) => b.id === id) ?? null;
}

// Saves a booking. meetingLink: the creator's link, for a video call.
// Returns the booking, or null if it couldn't be saved.
export function createBooking({ serviceId, title, start, durationMins, format, guest, meetingLink = null }) {
  const startMs = Date.parse(start);
  const booking = {
    id: `bk_${startMs.toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    serviceId,
    title,
    start: new Date(startMs).toISOString(),
    end: new Date(startMs + durationMins * 60_000).toISOString(),
    format,
    guest,
    meetingLink: format === 'video' ? meetingLink : null,
    createdAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(KEY, JSON.stringify([...loadBookings(), booking]));
    return booking;
  } catch {
    return null;
  }
}

// Clear them all (for testing)
export function clearBookings() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nothing saved to clear
  }
}