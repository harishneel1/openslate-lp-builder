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
//     guestTimeZone: the zone they booked in, e.g. 'Europe/London'
//                    (null on bookings made before it was saved),
//     topic: what they'd like to talk about ('' when they left it empty),
//     paid: the total they paid in rupees, 0 for a free call
//           (null on bookings made before it was saved),
//     meetingLink: the creator's link when it was booked (what the
//                  confirmation email sent), DEFAULT_MEETING_LINK when they
//                  had none, or null for a phone call,
//     status: 'booked' | 'cancelled',
//     cancelledAt, cancelMessage   once cancelled
//     rescheduledAt, previousStart once moved
//     createdAt }
//
// Every change fires BOOKINGS_CHANGED_EVENT, so open screens (the
// Bookings page, the sidebar's count) refresh. Other tabs hear it
// through the browser's own storage event (see onBookingsChange).
// ------------------------------------------------------------

const KEY = 'pagebuilder:mock-bookings';

// Every video call has a Google Meet link. Until each call has its own,
// bookings use this one (new bookings save it; older ones read it).
export const DEFAULT_MEETING_LINK = 'https://meet.google.com/abc-defg-hij';
export const BOOKINGS_CHANGED_EVENT = 'pagebuilder:bookings-changed';

export function loadBookings() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((b) => b && typeof b.id === 'string') : [];
  } catch {
    return [];
  }
}

// Still happening (not cancelled). Older bookings have no status: they're booked.
export const isActive = (booking) => booking?.status !== 'cancelled';

// The bookings that hold a time: what the booking page and checkout check against
export const activeBookings = () => loadBookings().filter(isActive);

export function getBooking(id) {
  if (!id) return null;
  return loadBookings().find((b) => b.id === id) ?? null;
}

// Returns true if it saved
function saveAll(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    return false;
  }
  window.dispatchEvent(new Event(BOOKINGS_CHANGED_EVENT));
  return true;
}

// Runs `callback` whenever bookings change, here or in another tab.
// Returns the function that stops listening.
export function onBookingsChange(callback) {
  const fromOtherTab = (e) => {
    if (e.key === KEY || e.key === null) callback();
  };
  window.addEventListener(BOOKINGS_CHANGED_EVENT, callback);
  window.addEventListener('storage', fromOtherTab);
  return () => {
    window.removeEventListener(BOOKINGS_CHANGED_EVENT, callback);
    window.removeEventListener('storage', fromOtherTab);
  };
}

// Saves a booking. meetingLink: the creator's link, for a video call.
// Returns the booking, or null if it couldn't be saved.
export function createBooking({
  serviceId,
  title,
  start,
  durationMins,
  format,
  guest,
  guestTimeZone = null,
  topic = '',
  paid = null,
  meetingLink = null,
}) {
  const startMs = Date.parse(start);
  const booking = {
    id: `bk_${startMs.toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    serviceId,
    title,
    start: new Date(startMs).toISOString(),
    end: new Date(startMs + durationMins * 60_000).toISOString(),
    format,
    guest,
    guestTimeZone,
    topic: String(topic ?? '').trim(),
    paid: Number.isFinite(paid) ? paid : null,
    meetingLink: format === 'video' ? meetingLink || DEFAULT_MEETING_LINK : null,
    status: 'booked',
    createdAt: new Date().toISOString(),
  };

  return saveAll([...loadBookings(), booking]) ? booking : null;
}

// Changes one booking. Returns the changed booking, or null if it
// isn't there or couldn't be saved.
function updateBooking(id, change) {
  const list = loadBookings();
  const index = list.findIndex((b) => b.id === id);
  if (index === -1) return null;
  const next = { ...list[index], ...change(list[index]) };
  const copy = [...list];
  copy[index] = next;
  return saveAll(copy) ? next : null;
}

// Cancels a booking, which frees its time for others to book.
// message: the creator's note to the guest (the real product emails it).
export function cancelBooking(id, { message = '' } = {}) {
  return updateBooking(id, () => ({
    status: 'cancelled',
    cancelledAt: new Date().toISOString(),
    cancelMessage: String(message).trim(),
  }));
}

// Moves a booking to a new start, keeping its length.
// The real product updates the guest's calendar invite too.
export function rescheduleBooking(id, start) {
  const startMs = Date.parse(start);
  if (!Number.isFinite(startMs)) return null;
  return updateBooking(id, (b) => ({
    start: new Date(startMs).toISOString(),
    end: new Date(startMs + (Date.parse(b.end) - Date.parse(b.start))).toISOString(),
    previousStart: b.start,
    rescheduledAt: new Date().toISOString(),
  }));
}

// Clear them all (for testing)
export function clearBookings() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nothing saved to clear
  }
  window.dispatchEvent(new Event(BOOKINGS_CHANGED_EVENT));
}