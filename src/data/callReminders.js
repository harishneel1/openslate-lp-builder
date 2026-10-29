import { fillIn, withoutEmptyParagraphs } from './reminders';
import { formatTime, zoned } from '../utils/slots';
import { dayLabels } from './buildBookingsJson';

// ------------------------------------------------------------
// A 1:1 call's reminder emails: two of them, to the person who booked.
//
//   24 hours before  "Your call with Harish is tomorrow at 4:00 pm"
//   1 hour before    "Starting in an hour", with the Join button
//
// The coach doesn't set anything up: both are on for every call. Each
// call can turn either off (saved on the call's answers, below). The
// words are ours and can't be edited yet.
//
// Saved on the call's answers as callReminders:
//   { dayBefore: true | false, hourBefore: true | false }
//   A missing key means on, so calls made before reminders existed
//   remind people too, with nothing to move over.
//
// Every time is worked out from the booking as it is now, never stored:
//   - a rescheduled booking's reminders follow its new time
//   - a cancelled booking's reminders stop
//   - one whose time had already passed when they booked (or moved it)
//     is skipped; so is one that would land right after, since the
//     confirmation they just got says the same thing
//
// In this prototype nothing is emailed: "sent" means its time has passed
// while it was on, as with the webinar emails (reminders.js). In the real
// product a job on the server sends each one at its time and keeps a log
// of what went out, which is what the booking's history should read.
// ------------------------------------------------------------

const MIN = 60_000;

// A reminder that would go out this soon after they booked or moved the
// call is skipped: the confirmation (or reschedule email) just did its job
export const MIN_GAP_MINS = 30;

// Each reminder:
//   name     what the editor and preview call it
//   short    for the booking's history ("24-hour reminder sent to Priya")
//   example  what the editor's grey Example box says, as segments: even
//            ones plain, odd ones bold (as bookingRules.js examples)
// (dayBefore keeps its id from when it was called "1 day before", so
// saved switches carry on.)
export const CALL_REMINDERS = [
  {
    id: 'dayBefore',
    name: '24 hours before',
    short: '24-hour',
    example: ['If Rohan’s call with you is at 4:00 PM on Thursday, he gets this email at ', '4:00 PM on Wednesday', '.'],
    offsetMins: 24 * 60,
    subject: 'Reminder: {{call_title}} with {{your_name}} tomorrow at {{time}}',
    body:
      '<p>Hi {{first_name}},</p>' +
      '<p>Just a reminder that your <b>{{call_title}}</b> with {{your_name}} is tomorrow, <b>{{date}} at {{time}}</b>.</p>' +
      '<p>{{how_to_join}}</p>' +
      '<p>Can’t make it any more? You can <a href="{{reschedule_link}}">pick another time</a> or <a href="{{cancel_link}}">cancel</a>.</p>' +
      '<p>Talk soon,<br>{{your_name}}</p>',
  },
  {
    id: 'hourBefore',
    name: '1 hour before',
    short: '1-hour',
    example: ['If Rohan’s call with you is at 4:00 PM on Thursday, he gets this email at ', '3:00 PM on Thursday', '.'],
    offsetMins: 60,
    subject: 'Starting in 1 hour: {{call_title}} with {{your_name}}',
    body:
      '<p>Hi {{first_name}},</p>' +
      '<p>Your <b>{{call_title}}</b> with {{your_name}} starts in an hour, at <b>{{time}}</b>.</p>' +
      '<p>{{how_to_join}}</p>' +
      '<p>Talk soon,<br>{{your_name}}</p>',
  },
];

export const callReminderById = (id) => CALL_REMINDERS.find((r) => r.id === id) ?? null;

// ---------- The call's switches ----------

// { dayBefore: true, hourBefore: true }: on unless the call turned it off
export function remindersOf(callAnswers) {
  const saved = callAnswers?.callReminders ?? {};
  return Object.fromEntries(CALL_REMINDERS.map((r) => [r.id, saved[r.id] !== false]));
}

// The call's callReminders with one switched, ready to save on the call
export function withReminderOn(callAnswers, id, on) {
  return { ...remindersOf(callAnswers), [id]: on };
}

// The same switches, on and off alike
export const sameReminders = (a, b) => CALL_REMINDERS.every((r) => remindersOf({ callReminders: a })[r.id] === remindersOf({ callReminders: b })[r.id]);

// "Emails 24 hours and 1 hour before", "Email 1 hour before", "Off"
export function remindersSummary(callAnswers) {
  const on = CALL_REMINDERS.filter((r) => remindersOf(callAnswers)[r.id]).map((r) => r.name);
  if (on.length === 0) return 'Off';
  if (on.length === 1) return `Email ${on[0]}`;
  return `Emails ${on.map((n) => n.replace(/ before$/, '')).join(' and ')} before`;
}

// ---------- When each goes out, for one booking ----------

// When this reminder goes out for this booking (ms)
export function sendTime(booking, id) {
  return Date.parse(booking.start) - callReminderById(id).offsetMins * MIN;
}

// From when the booking's current time was known: when it was moved, or booked
function settledAt(booking) {
  const at = Date.parse(booking.rescheduledAt ?? booking.createdAt);
  return Number.isFinite(at) ? at : 0;
}

// Each reminder for one booking, in the order they go out:
//   { id, name, at (ms), state, moved }
//   state:
//     'sent'       its time has passed (it went out)
//     'scheduled'  it goes out at `at`
//     'off'        the call has it turned off
//     'skipped'    booked (or moved) too close to the call for it
//     'stopped'    the call was cancelled before its time
//   moved: the booking was rescheduled, so 'skipped' means "moved too close",
//          not "booked too close"
// switches: remindersOf(the call's answers)
export function reminderTimeline(booking, switches, now = Date.now()) {
  const since = settledAt(booking);
  const cancelledAt = booking.status === 'cancelled' ? Date.parse(booking.cancelledAt) || 0 : null;
  const moved = Boolean(booking.rescheduledAt);

  return CALL_REMINDERS.map((r) => {
    const at = sendTime(booking, r.id);
    const row = { id: r.id, name: r.name, at, moved };
    if (at < since + MIN_GAP_MINS * MIN) return { ...row, state: 'skipped' };
    if (cancelledAt !== null && at > cancelledAt) return { ...row, state: 'stopped' };
    if (!switches[r.id]) return { ...row, state: 'off' };
    return { ...row, state: at <= now ? 'sent' : 'scheduled' };
  });
}

// The reminders worth showing in a booking's history (BookingDrawer.jsx),
// each as { key, id, kind, when, span, moved }:
//   kind 'sent'       went out at `when`
//   kind 'scheduled'  goes out at `when` (still to come)
//   kind 'skipped'    never had a chance: `when` is when they booked or
//                     moved it, so it sits right after that step
//   span: '24 hours' or '1 hour', for the words around it
// Left out: ones that are off (the coach chose that) and ones a
// cancellation stopped (the history's "cancelled" step says so).
export function reminderSteps(booking, switches, now = Date.now()) {
  const settled = booking.rescheduledAt ?? booking.createdAt ?? null;
  return reminderTimeline(booking, switches, now)
    .filter((row) => ['sent', 'scheduled', 'skipped'].includes(row.state))
    .map((row) => ({
      key: `reminder-${row.id}`,
      id: row.id,
      kind: row.state,
      when: row.state === 'skipped' ? settled : new Date(row.at).toISOString(),
      span: row.name.replace(/ before$/, ''),
      moved: row.moved,
    }));
}

// ---------- The email, filled in ----------

// The time-zone name people know: "IST", "GMT", "EDT"; the offset
// ("GMT+8") where there's no common name
export function zoneAbbr(ms, zone) {
  const name = (locale) =>
    new Intl.DateTimeFormat(locale, { timeZone: zone, timeZoneName: 'short' })
      .formatToParts(new Date(ms))
      .find((p) => p.type === 'timeZoneName')?.value ?? '';
  const india = name('en-IN'); // IST, GMT, GST
  if (india && !/^GMT[+-]/.test(india)) return india;
  return name('en-US') || india; // EDT, PST, or GMT+8
}

// What fills in the markers, for one booking on the guest's own clock.
//   booking:  { id, title, start, format, guest: { name, phone }, guestTimeZone, meetingLink }
//   hostName: the coach's name
//   fallbackZone: the coach's zone, for bookings saved before guestTimeZone was
// The manage links are this prototype's; the real ones are in the
// confirmation email and go to the same page.
export function emailValues(booking, hostName, fallbackZone = 'Asia/Kolkata') {
  const zone = booking.guestTimeZone || fallbackZone;
  const start = Date.parse(booking.start);
  const l = dayLabels(zoned(start, zone).date);
  const host = String(hostName ?? '').trim() || 'Your host';
  const hostFirst = host.split(/\s+/)[0];
  const { origin, pathname } = window.location;
  const manage = `${origin}${pathname}?mock=manage&booking=${encodeURIComponent(booking.id)}&tz=${encodeURIComponent(zone)}`;
  const phone = String(booking.guest?.phone ?? '').trim();

  return {
    first_name: String(booking.guest?.name ?? '').trim().split(/\s+/)[0] || 'there',
    call_title: String(booking.title ?? '').trim() || 'Your call',
    date: `${l.weekday} ${l.day} ${l.month}`,
    time: `${formatTime(start, zone)} ${zoneAbbr(start, zone)}`.trim(),
    your_name: host,
    how_to_join:
      booking.format === 'phone'
        ? `${hostFirst} will call you on ${phone || 'the number you gave'}.`
        : 'Join with the button below. It’s the same link as in your calendar invite.',
    join_link: booking.format === 'phone' ? '' : booking.meetingLink || '',
    reschedule_link: `${manage}&action=reschedule`,
    cancel_link: `${manage}&action=cancel`,
  };
}

// One reminder, ready to show or send:
//   { subject, bodyHtml, join: { label, href } | null, footer }
export function buildReminderEmail(id, booking, hostName, fallbackZone) {
  const r = callReminderById(id);
  const values = emailValues(booking, hostName, fallbackZone);
  return {
    subject: fillIn(r.subject, values),
    bodyHtml: withoutEmptyParagraphs(fillIn(r.body, values, { html: true })),
    join: values.join_link ? { label: 'Join call', href: values.join_link } : null,
    footer: `You’re getting this because you booked ${values.call_title} with ${values.your_name}.`,
  };
}