import { isActive, loadBookings, setWhatsAppConfirm } from './bookingsStore';
import { WHATSAPP_CHANGED_EVENT, hasNumber, isConnected, loadWhatsApp, messageStatus } from './whatsappConnection';
import { WHATSAPP_SWITCHES_EVENT, switchesOf } from './whatsappMessages';
import { CHOICES_CHANGED_EVENT, TEMPLATES_CHANGED_EVENT, choicesOf, loadTemplates, messageFor } from './whatsappTemplates';
import { whatsappNumber } from '../utils/whatsapp';

// ------------------------------------------------------------
// Did the student say they're coming? The 2-hour WhatsApp message
// (whatsappMessages.js, 'call-2h') asks, with a "Yes, I'll be there"
// button. Its answer is shown to the coach on every booking: the rows
// and next-call card (ConfirmStatus.jsx), the booking's side panel and
// History (BookingDrawer.jsx), and the call's Activity (callActivity.js).
//
// confirmOf(booking, now) → null, or
//   { status: 'waiting' | 'confirmed' | 'none', askedAt, repliedAt, closedAt }
//   waiting    asked, no answer yet, and the call hasn't started
//   confirmed  they tapped Yes (repliedAt)
//   none       the call started (closedAt) and they never tapped Yes
//
// null whenever the call's 2-hour WhatsApp message is switched off,
// answers already in included: the coach turned the question off, so
// nothing about it shows.
// null, too, when they were never asked, so nothing shows: WhatsApp isn't
// connected (or is paused), the 2-hour message is off for this call or
// not approved by Meta, the student's number can't get WhatsApp, the
// call was booked or moved less than 2 hours (and a little) before it
// started, or it's not 2 hours before yet. Showing "No reply" then would
// blame the student for a message they never got.
//
// "Can't make it? Change it" has no status: it opens their booking page,
// and what they do there (reschedule, cancel) shows as it always has.
//
// A reschedule starts over: the answer is kept with the start it was
// about (forStart), so a moved call is asked again at its new time.
//
// THE MOCK. Nothing is sent. Two things stand in for the real product:
//   1. Asking: a booking counts as asked once 2 hours before its start
//      has passed, if it would have gone (askPlan). Worked out from the
//      settings as they are now, not as they were then.
//   2. Answers: bookings take turns, by the order they were made, as the
//      calendar invite's replies do (inviteStatus.js): two of every three
//      tap Yes 12 minutes after being asked, the third never does.
// The booking's side panel has Prototype controls that set an answer
// directly (saved as booking.whatsappConfirm), and a saved answer wins
// over both. The real product saves askedAt when our WhatsApp partner
// says the message went, and repliedAt when the student's tap comes in.
// ------------------------------------------------------------

const MIN = 60_000;
export const ASK_BEFORE_MINS = 120; // the 2-hour message
// Not asked when it would land this soon after they booked or moved the
// call: they've just said when they're coming. The same gap as the
// reminder emails' (MIN_GAP_MINS in callReminders.js).
const GAP_MINS = 30;
const REPLY_AFTER_MINS = 12; // the mock: how long after asking a student taps Yes
const MESSAGE_ID = 'call-2h';

// When the question goes for a booking at its current start (ms)
export const askTimeOf = (booking) => Date.parse(booking.start) - ASK_BEFORE_MINS * MIN;

// Whether the 2-hour message would go for this booking, and if not, why:
//   { will: true } or { will: false, reason }
//   reason 'whatsapp'  no number connected, or WhatsApp paused it
//          'off'       the coach switched the 2-hour message off for this call
//          'approval'  Meta hasn't approved the message it would send
//          'phone'     the student's number can't be used on WhatsApp
//          'late'      booked or moved too close to the call for it
export function askPlan(booking, connection = loadWhatsApp()) {
  if (!isConnected(connection)) return { will: false, reason: 'whatsapp' };
  const offering = `call:${booking.serviceId}`;
  if (!switchesOf(offering, 'call')[MESSAGE_ID]) return { will: false, reason: 'off' };
  const sends = messageFor(MESSAGE_ID, choicesOf(offering).picks, loadTemplates());
  // Their own template is approved already (only approved ones can be picked)
  if (!sends.own && messageStatus(connection, MESSAGE_ID) !== 'approved') return { will: false, reason: 'approval' };
  if (!whatsappNumber(booking.guest?.phone)) return { will: false, reason: 'phone' };
  const since = Date.parse(booking.rescheduledAt ?? booking.createdAt) || 0;
  if (askTimeOf(booking) < since + GAP_MINS * MIN) return { will: false, reason: 'late' };
  return { will: true };
}

// Whether any of a 1:1 call's WhatsApp messages would go for this booking
// ('call-confirm', 'call-24h', 'call-2h', 'call-5m'), leaving its timing
// to the caller (the emails' rules, callReminders.js): the booking's
// History says what went by email and WhatsApp (BookingDrawer.jsx).
//   { will: true } or { will: false, reason }
//   reason 'unused'    no number connected: they don't use WhatsApp
//          'paused'    connected, but WhatsApp paused the number
//          'off'       the coach switched this message off for the call
//          'approval'  Meta hasn't approved the message it would send
//          'phone'     the student's number can't be used on WhatsApp
// Worked out from the settings as they are now, as everything here is;
// the real product reads what our WhatsApp partner says went.
export function messagePlan(booking, messageId, connection = loadWhatsApp()) {
  if (!hasNumber(connection)) return { will: false, reason: 'unused' };
  if (!isConnected(connection)) return { will: false, reason: 'paused' };
  const offering = `call:${booking.serviceId}`;
  if (!switchesOf(offering, 'call')[messageId]) return { will: false, reason: 'off' };
  const sends = messageFor(messageId, choicesOf(offering).picks, loadTemplates());
  if (!sends.own && messageStatus(connection, messageId) !== 'approved') return { will: false, reason: 'approval' };
  if (!whatsappNumber(booking.guest?.phone)) return { will: false, reason: 'phone' };
  return { will: true };
}

// What the prototype controls can't do, in words, by askPlan's reason
export const WHY_NOT_ASKED = {
  whatsapp: 'WhatsApp isn’t connected, or is paused.',
  off: 'The 2-hour WhatsApp message is switched off for this call.',
  approval: 'Meta hasn’t approved the 2-hour message yet.',
  phone: 'Their phone number can’t be used on WhatsApp.',
  late: 'Booked less than 2 hours before the call.',
};

// The answer saved for this booking's current start, or null
const savedFor = (booking) => {
  const rec = booking.whatsappConfirm;
  return rec && rec.forStart === booking.start ? rec : null;
};

// The mock's turn for a booking: its place among every booking ever made
function turnOf(booking) {
  const made = (b) => Date.parse(b.createdAt) || 0;
  const all = loadBookings().sort((a, b) => made(a) - made(b) || a.id.localeCompare(b.id));
  const i = all.findIndex((b) => b.id === booking.id);
  return i < 0 ? 0 : i;
}

const iso = (ms) => (Number.isFinite(ms) ? new Date(ms).toISOString() : null);

export function confirmOf(booking, now = Date.now()) {
  if (!booking || !isActive(booking)) return null;
  // The 2-hour message off for this call: no status at all, saved or not
  if (!switchesOf(`call:${booking.serviceId}`, 'call')[MESSAGE_ID]) return null;
  const start = Date.parse(booking.start);
  const rec = savedFor(booking);

  let askedAt = Date.parse(rec?.askedAt);
  let repliedAt = Date.parse(rec?.repliedAt);
  const closedAt = Date.parse(rec?.closedAt);

  if (!rec) {
    // The mock: asked when its time came, and answered by turns
    const at = askTimeOf(booking);
    if (at > now || !askPlan(booking).will) return null;
    askedAt = at;
    const replies = turnOf(booking) % 3 !== 2;
    const tapped = at + REPLY_AFTER_MINS * MIN;
    if (replies && tapped <= now && tapped < start) repliedAt = tapped;
  }
  if (!Number.isFinite(askedAt)) return null;

  const base = { askedAt: iso(askedAt), repliedAt: null, closedAt: null };
  if (Number.isFinite(repliedAt)) return { ...base, status: 'confirmed', repliedAt: iso(repliedAt) };
  if (Number.isFinite(closedAt)) return { ...base, status: 'none', closedAt: iso(closedAt) };
  if (now >= start) return { ...base, status: 'none', closedAt: iso(start) };
  return { ...base, status: 'waiting' };
}

// Runs callback whenever something confirmOf reads changes, other than the
// bookings themselves: the connection, a message's switch or Meta review,
// or which template a call sends. Pages showing statuses redraw on it, so
// switching the 2-hour message off clears them at once. Returns the
// function that stops listening.
export function onConfirmInputsChange(callback) {
  const events = [WHATSAPP_CHANGED_EVENT, WHATSAPP_SWITCHES_EVENT, CHOICES_CHANGED_EVENT, TEMPLATES_CHANGED_EVENT];
  events.forEach((e) => window.addEventListener(e, callback));
  window.addEventListener('storage', callback);
  return () => {
    events.forEach((e) => window.removeEventListener(e, callback));
    window.removeEventListener('storage', callback);
  };
}

// ---------- Prototype controls (the booking's side panel) ----------
// Each saves an answer for the booking's current start, as the real
// product would from what our WhatsApp partner tells us.
const save = (booking, change) =>
  setWhatsAppConfirm(booking.id, { ...(savedFor(booking) ?? {}), forStart: booking.start, ...change });

export const confirmDemo = {
  // The 2-hour message goes now, instead of 2 hours before the call
  askNow: (booking) => save(booking, { askedAt: new Date().toISOString(), repliedAt: null, closedAt: null }),
  // The student taps "Yes, I'll be there"
  tapYes: (booking, confirm) =>
    save(booking, {
      askedAt: confirm?.askedAt ?? new Date().toISOString(),
      repliedAt: new Date().toISOString(),
      closedAt: null,
    }),
  // The call starts with no answer (now, instead of at its start)
  noReply: (booking, confirm) =>
    save(booking, { askedAt: confirm?.askedAt ?? new Date().toISOString(), repliedAt: null, closedAt: new Date().toISOString() }),
  // Back to the mock's own timing and turns
  clear: (booking) => setWhatsAppConfirm(booking.id, null),
  hasSaved: (booking) => Boolean(savedFor(booking)),
};