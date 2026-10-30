import { formatTime, zoned } from '../utils/slots';
import { describeBooking, exactDay } from './buildBookingsJson';
import { callReminderById, reminderTimeline } from './callReminders';
import { money } from './checkoutRules';

// ------------------------------------------------------------
// Everything that happened to one 1:1 call's bookings, for the Activity
// tab of the call's page (CallOverview.jsx). The call version of
// sessionActivity.js: nothing new is stored, each line is put together
// from the saved bookings, so older bookings have their lines too.
//
//   Today
//   ✉  24-hour reminder sent to Priya                    Automatic   3:20 pm
//   ↻  Rohan rescheduled                                  By Rohan   11:02 am
//      From Sat 31 Oct, 12:20 pm to Sat 31 Oct, 2:20 pm
//   Yesterday
//   ＋ Kavya booked                                      By Kavya    9:12 pm
//      For Fri 30 Oct, 5:20 pm · Paid ₹999.00
//   ✕  Tarun cancelled                                   By Tarun    6:40 pm
//      “Clashes with work”
//
// Lines, newest first, each { key, kind, at (ms), title, detail, by, byName, open }:
//   kind    'booked' | 'moved' | 'cancelled' | 'reminder' | 'declined' | 'ended'
//   by      'auto' (the system), 'you' (the creator) or 'guest'
//   byName  the guest's first name, when by is 'guest'
//   open    the booking's id: a click opens it in the side panel
//
// The same limits as the booking's History (BookingDrawer.jsx), since
// both read the same saved fields:
//   - only a booking's latest reschedule is saved, so a call moved twice
//     shows one move
//   - reminders count as sent once their time passed while switched on
//     (callReminders.js). The real product reads its log of sent emails.
// Of the replies to the calendar invite, only a decline is a line: the
// one worth acting on, as on the Bookings page.
// ------------------------------------------------------------

const first = (name) =>
  String(name ?? '')
    .trim()
    .split(/\s+/)[0] || 'Your guest';

// bookings: the call's saved bookings (bookingsStore.js), cancelled too
// switches: remindersOf(the call's answers)
// zone: the creator's clock
export function callActivity(bookings, switches, zone, now = Date.now()) {
  const at = (ms) => `${exactDay(zoned(ms, zone).date)}, ${formatTime(ms, zone)}`;
  const out = [];

  for (const raw of bookings) {
    const b = describeBooking(raw, zone, now);
    const name = first(b.guest?.name);
    const guestDid = { by: 'guest', byName: name };
    const line = (key, rest) => out.push({ key: `${b.id}-${key}`, open: b.id, detail: null, ...rest });

    // Booked, for the time it was first booked at
    const bookedAt = Date.parse(b.createdAt);
    if (Number.isFinite(bookedAt)) {
      const paid = typeof b.paid === 'number' ? (b.paid > 0 ? `Paid ${money(b.paid)}` : 'Free') : null;
      line('booked', {
        kind: 'booked',
        at: bookedAt,
        title: `${name} booked`,
        detail: [`For ${at(Date.parse(b.previousStart ?? b.start))}`, paid].filter(Boolean).join(' · '),
        ...guestDid,
      });
    }

    // Moved to a new time, by either side
    const movedAt = Date.parse(b.rescheduledAt);
    if (b.previousStart && Number.isFinite(movedAt)) {
      line('moved', {
        kind: 'moved',
        at: movedAt,
        title: b.moved?.by === 'guest' ? `${name} rescheduled` : `You rescheduled ${name}’s call`,
        detail: `From ${at(Date.parse(b.previousStart))} to ${at(Date.parse(b.start))}`,
        ...(b.moved?.by === 'guest' ? guestDid : { by: 'you' }),
      });
    }

    // Declined the calendar invite
    if (b.invite?.status === 'declined' && b.invite.repliedAt) {
      line('declined', {
        kind: 'declined',
        at: Date.parse(b.invite.repliedAt),
        title: `${name} declined the calendar invite`,
        detail: 'The booking is still on',
        ...guestDid,
      });
    }

    // Cancelled, by either side: the guest's reason, or the creator's note
    const cancelledAt = Date.parse(b.cancelledAt);
    if (b.state === 'cancelled' && Number.isFinite(cancelledAt)) {
      const note = String(b.cancelMessage ?? '').trim();
      line('cancelled', {
        kind: 'cancelled',
        at: cancelledAt,
        title: b.cancelledBy === 'guest' ? `${name} cancelled` : `You cancelled ${name}’s call`,
        detail: [
          `Was ${at(Date.parse(b.start))}`,
          note && (b.cancelledBy === 'guest' ? `“${note}”` : `Your note: ${note}`),
        ]
          .filter(Boolean)
          .join(' · '),
        ...(b.cancelledBy === 'guest' ? guestDid : { by: 'you' }),
      });
    }

    // Each reminder that went out
    for (const step of reminderTimeline(raw, switches, now)) {
      if (step.state !== 'sent') continue;
      line(`reminder-${step.id}`, {
        kind: 'reminder',
        at: step.at,
        title: `${callReminderById(step.id).short} reminder sent to ${name}`,
        detail: `For ${at(Date.parse(b.start))}`,
        by: 'auto',
      });
    }

    // The call's time came and went
    if (b.state === 'ended') {
      line('ended', {
        kind: 'ended',
        at: Date.parse(b.end),
        title: `Call with ${name} ended`,
        detail: `${b.time} to ${b.ends}`,
        by: 'auto',
      });
    }
  }

  return out.filter((e) => Number.isFinite(e.at) && e.at <= now + 60_000).sort((a, b) => b.at - a.at);
}