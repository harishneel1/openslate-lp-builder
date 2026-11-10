import { fillIn, withoutEmptyParagraphs } from './reminders';
import { addDays, formatTime, toInstant, todayIn, zoned } from '../utils/slots';
import { dayLabels } from './buildBookingsJson';
import { DEFAULT_MEETING_LINK } from './bookingsStore';

// ------------------------------------------------------------
// A 1:1 call's reminder emails: three of them, to the person who booked.
//
//   24 hours before   "Your call with Harish is tomorrow at 4:00 pm"
//   2 hours before    "Starting in 2 hours", with the Join button
//                     (at the same moment as the 2-hour WhatsApp message,
//                     whatsappMessages.js, so both go at 24 hours, 2 hours
//                     and 5 minutes)
//   5 minutes before  "Starting in 5 minutes", with the Join button
//
// The coach doesn't set anything up: all three are on for every call. Each
// call can turn either off, and change either email's words (the call
// editor's Edit email, CallReminderEditor.jsx). Saved on the call's
// answers, in two keys so a switch and the words never overwrite each other:
//   callReminders:      { dayBefore, hourBefore, fiveBefore: true | false }
//                       A missing key means on, so calls made before
//                       reminders existed remind people too.
//   callReminderEmails: { dayBefore: { subject, body } }
//                       Only the emails the coach has changed; the rest
//                       use our template (below).
//
// The body is the same simple HTML as the webinar emails, with fill-in
// fields as markers ({{first_name}}): CALL_FIELDS lists them. Two parts
// aren't in the body, so they can't be deleted: the Join call button, and
// on the 24-hour and 2-hour emails the line with links to reschedule or
// cancel (a student's only way to move their booking; the same choice as
// the 2-hour WhatsApp message's "Can't make it? Change it").
//
// Every time is worked out from the booking as it is now, never stored:
//   - a rescheduled booking's reminders follow its new time
//   - a cancelled booking's reminders stop
//   - one whose time had already passed when they booked (or moved it)
//     is skipped; so is a 24-hour or 2-hour one that would land right
//     after, since the confirmation they just got says the same thing.
//     The 5-minute one always goes if its time is still ahead: it's the
//     nudge to join, which the confirmation can't be.
//
// In this prototype nothing is emailed: "sent" means its time has passed
// while it was on, as with the webinar emails (reminders.js). In the real
// product a job on the server sends each one at its time and keeps a log
// of what went out, which is what the booking's history should read.
// ------------------------------------------------------------

const MIN = 60_000;

// A reminder that would go out this soon after they booked or moved the
// call is skipped: the confirmation (or reschedule email) just did its job.
// Not the 5-minute one (noGap): see above.
export const MIN_GAP_MINS = 30;

// Each reminder:
//   name     what the editor and preview call it
//   short    for the booking's history and Activity ("24-hour email sent to Priya")
//   example  what the editor's grey Example box says, as segments: even
//            ones plain, odd ones bold (as bookingRules.js examples)
//   manage   has the fixed reschedule-or-cancel line under the Join button
//   noGap    goes out however soon after booking, as long as its time is ahead
// (dayBefore keeps its id from when it was called "1 day before", so
// saved switches carry on.)
export const CALL_REMINDERS = [
  {
    id: 'dayBefore',
    name: '24 hours before',
    short: '24-hour',
    example: ['If Rohan’s call with you is at 4:00 PM on Thursday, he gets this email at ', '4:00 PM on Wednesday', '.'],
    offsetMins: 24 * 60,
    manage: true,
    subject: 'Reminder: {{call_title}} with {{your_name}} tomorrow at {{time}}',
    body:
      '<p>Hi {{first_name}},</p>' +
      '<p>Just a reminder that your <b>{{call_title}}</b> with {{your_name}} is tomorrow, <b>{{date}} at {{time}}</b>.</p>' +
      '<p>Join with the button below. It’s the same link as in your calendar invite.</p>' +
      '<p>Talk soon,<br>{{your_name}}</p>',
  },
  {
    // Its id from when it went 1 hour before, so saved switches and the
    // coach's own words carry on (oldWording flags words written for then)
    id: 'hourBefore',
    name: '2 hours before',
    short: '2-hour',
    example: ['If Rohan’s call with you is at 4:00 PM on Thursday, he gets this email at ', '2:00 PM on Thursday', '.'],
    offsetMins: 120,
    manage: true,
    subject: 'Starting in 2 hours: {{call_title}} with {{your_name}}',
    body:
      '<p>Hi {{first_name}},</p>' +
      '<p>Your <b>{{call_title}}</b> with {{your_name}} starts in 2 hours, at <b>{{time}}</b>.</p>' +
      '<p>Join with the button below. It’s the same link as in your calendar invite.</p>' +
      '<p>Talk soon,<br>{{your_name}}</p>',
  },
  {
    id: 'fiveBefore',
    name: '5 minutes before',
    short: '5-minute',
    example: ['If Rohan’s call with you is at 4:00 PM on Thursday, he gets this email at ', '3:55 PM on Thursday', '.'],
    offsetMins: 5,
    noGap: true,
    subject: 'Starting in 5 minutes: {{call_title}} with {{your_name}}',
    body:
      '<p>Hi {{first_name}},</p>' +
      '<p>Your <b>{{call_title}}</b> with {{your_name}} starts in 5 minutes, at <b>{{time}}</b>.</p>' +
      '<p>Join with the button below.</p>' +
      '<p>See you there,<br>{{your_name}}</p>',
  },
];

// The confirmation email, sent as soon as someone books. Always on (it's
// how people get their booking's details), so it has no switch and isn't
// one of the timed reminders above: nothing about "skipped" or "still to
// come" applies to it. Its words can be changed like the reminders', and
// are saved the same way (callReminderEmails.booked).
//   goes      the editor's line under its title
//   editNote  the editor's note: only bookings made after a change get it
export const CALL_CONFIRMATION = {
  id: 'booked',
  name: 'Confirmation after booking',
  goes: 'Goes out as soon as someone books. It’s always on.',
  editNote: 'New bookings get the new words. People who’ve already booked got theirs.',
  manage: true,
  subject: 'Booked: {{call_title}} with {{your_name}} on {{date}}',
  body:
    '<p>Hi {{first_name}},</p>' +
    '<p>Your <b>{{call_title}}</b> with {{your_name}} is booked for <b>{{date}} at {{time}}</b>.</p>' +
    '<p>Join with the button below when it’s time. It’s also in your calendar invite.</p>' +
    '<p>Talk soon,<br>{{your_name}}</p>',
};

export const callReminderById = (id) =>
  id === CALL_CONFIRMATION.id ? CALL_CONFIRMATION : (CALL_REMINDERS.find((r) => r.id === id) ?? null);

// The fill-in fields the email editor's "+ Insert detail" offers
//   hint: what it fills in with, for the hover hint
export const CALL_FIELDS = [
  { key: 'first_name', label: 'First name', hint: 'Fills in each person’s first name' },
  { key: 'call_title', label: 'Call name', hint: 'Fills in this call’s name' },
  { key: 'date', label: 'Date', hint: 'Fills in the call’s date, e.g. Thu 5 Nov' },
  { key: 'time', label: 'Time', hint: 'Fills in the call’s time on their clock, e.g. 4:00 pm IST' },
  { key: 'your_name', label: 'Coach name', hint: 'Fills in your name as the coach' },
];

// ---------- The words of each email ----------

// One email's words: the coach's own, or our template
//   { subject, body, edited }
export function emailTextOf(callAnswers, id) {
  const r = callReminderById(id);
  const saved = callAnswers?.callReminderEmails?.[id];
  const edited = typeof saved?.subject === 'string' && typeof saved?.body === 'string';
  return { subject: edited ? saved.subject : r.subject, body: edited ? saved.body : r.body, edited };
}

// The call's callReminderEmails after one email changes, ready to save.
// Words that match the template store nothing (it's not "edited").
export function withEmailText(emails = {}, id, { subject, body }) {
  const r = callReminderById(id);
  const next = { ...emails };
  if (subject === r.subject && body === r.body) delete next[id];
  else next[id] = { subject, body };
  return next;
}

// The coach's own words for the 2-hour email still talk about 1 hour
// (written when it went 1 hour before): worth a look. A guess from the
// words, since edits weren't dated.
export function oldWording(callAnswers, id) {
  if (id !== 'hourBefore') return false;
  const { subject, body, edited } = emailTextOf(callAnswers, id);
  return edited && /\b(1|one|an)\s+hour\b/i.test(`${subject} ${body}`.replace(/<[^>]+>/g, ' '));
}

// The same words in every email
export const sameEmailTexts = (a, b) =>
  CALL_REMINDERS.every((r) => {
    const x = emailTextOf({ callReminderEmails: a }, r.id);
    const y = emailTextOf({ callReminderEmails: b }, r.id);
    return x.subject === y.subject && x.body === y.body;
  });

// ---------- The call's switches ----------

// { dayBefore: true, hourBefore: true, fiveBefore: true }: on unless the call turned it off
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

// "Emails 24 hours, 2 hours and 5 minutes before", "Email 2 hours before", "Off"
export function remindersSummary(callAnswers) {
  const on = CALL_REMINDERS.filter((r) => remindersOf(callAnswers)[r.id]).map((r) => r.name);
  if (on.length === 0) return 'Off';
  if (on.length === 1) return `Email ${on[0]}`;
  const spans = on.map((n) => n.replace(/ before$/, ''));
  return `Emails ${spans.slice(0, -1).join(', ')} and ${spans[spans.length - 1]} before`;
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
    const gap = r.noGap ? 0 : MIN_GAP_MINS * MIN;
    if (at < since + gap) return { ...row, state: 'skipped' };
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
//   span: '24 hours' or '2 hours', for the words around it
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

// ---------- Across one call's bookings, for its Emails tab ----------

// For each reminder, who it has gone to and who it's going to, across
// every booking of one call (CallEmails.jsx):
//   { id, on, sent, scheduled, skipped, off }, each list of { booking, at, moved }
//   sent       went out; newest first. Includes bookings cancelled after it went.
//   scheduled  goes out at `at`; soonest first
//   skipped    calls still to come it won't reach: booked (or moved) less
//              than its time before the call (see reminderTimeline)
//   off        calls still to come it would reach if it were switched on
// Cancelled bookings only count for what was sent before they were cancelled.
//
// Like the booking's history, this is worked out from the switches as they
// are now: a reminder switched off shows nothing as sent, even for calls
// before it was. The real product reads the server's log of what went out
// (and what failed), so a switch can't rewrite the past.
//
// bookings: the call's saved bookings (bookingsStore.js)
// switches: remindersOf(the call's answers)
export function reminderReport(bookings, switches, now = Date.now()) {
  const report = CALL_REMINDERS.map((r) => ({ id: r.id, on: switches[r.id], sent: [], scheduled: [], skipped: [], off: [] }));
  const byId = Object.fromEntries(report.map((row) => [row.id, row]));

  for (const booking of bookings) {
    const active = booking.status !== 'cancelled';
    const ahead = active && Date.parse(booking.end) > now;
    for (const step of reminderTimeline(booking, switches, now)) {
      const row = byId[step.id];
      const item = { booking, at: step.at, moved: step.moved };
      if (step.state === 'sent') row.sent.push(item);
      else if (step.state === 'scheduled') row.scheduled.push(item);
      else if (step.state === 'skipped' && ahead) row.skipped.push(item);
      else if (step.state === 'off' && ahead && step.at > now) row.off.push(item);
    }
  }

  for (const row of report) {
    row.sent.sort((a, b) => b.at - a.at);
    row.scheduled.sort((a, b) => a.at - b.at);
    row.skipped.sort((a, b) => a.at - b.at);
    row.off.sort((a, b) => a.at - b.at);
  }
  return report;
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

  return {
    first_name: String(booking.guest?.name ?? '').trim().split(/\s+/)[0] || 'there',
    call_title: String(booking.title ?? '').trim() || 'Your call',
    date: `${l.weekday} ${l.day} ${l.month}`,
    time: `${formatTime(start, zone)} ${zoneAbbr(start, zone)}`.trim(),
    your_name: host,
    // Every call is a video call now; a phone booking from before has no
    // link, so it gets no button (and a line saying who calls whom)
    join_link: booking.format === 'phone' ? '' : booking.meetingLink || '',
    phone_line: booking.format === 'phone' ? `${hostFirst} will call you on ${String(booking.guest?.phone ?? '').trim() || 'the number you gave'}.` : '',
    reschedule_link: `${manage}&action=reschedule`,
    cancel_link: `${manage}&action=cancel`,
  };
}

// The fixed line under the Join button on the 24-hour and 2-hour emails, filled in
// (escaped: the values are the person's own)
const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export const manageLineHtml = (values) =>
  `<p>Can’t make it? <a href="${esc(values.reschedule_link)}">Pick another time</a> or <a href="${esc(values.cancel_link)}">cancel</a>.</p>`;

export const JOIN_LABEL = 'Join call';

export const footerOf = (values) => `You’re getting this because you booked ${values.call_title} with ${values.your_name}.`;

// One reminder, ready to send (or show):
//   { subject, bodyHtml, join: { label, href } | null, afterJoinHtml, footer }
// text: the call's own words (emailTextOf), or the template if left out
export function buildReminderEmail(id, booking, hostName, fallbackZone, text = null) {
  const r = callReminderById(id);
  const { subject, body } = text ?? r;
  const values = emailValues(booking, hostName, fallbackZone);
  const phone = values.phone_line ? `<p>${esc(values.phone_line)}</p>` : '';
  return {
    subject: fillIn(subject, values),
    bodyHtml: withoutEmptyParagraphs(fillIn(body, values, { html: true })) + phone,
    join: values.join_link ? { label: JOIN_LABEL, href: values.join_link } : null,
    afterJoinHtml: r.manage ? manageLineHtml(values) : '',
    footer: footerOf(values),
  };
}

// A made-up booking of a call, for the editor's preview and a test email:
// Rohan (the student in the editor's examples), tomorrow at 4:00 pm on the
// call's own clock.
//   call: { title, durationMins, timeZone, meetingLink }
export const SAMPLE_GUEST = { name: 'Rohan Mehta', email: 'rohan@example.com', phone: '+91 98765 43210' };

export function sampleBooking({ title, durationMins, timeZone, meetingLink }) {
  const zone = timeZone || 'Asia/Kolkata';
  const start = toInstant(addDays(todayIn(zone), 1), '16:00', zone);
  const length = Number(durationMins) || 30;
  return {
    id: 'sample',
    title: String(title ?? '').trim() || 'Your call',
    start: new Date(start).toISOString(),
    end: new Date(start + length * 60_000).toISOString(),
    format: 'video',
    guest: SAMPLE_GUEST,
    guestTimeZone: zone,
    meetingLink: meetingLink || DEFAULT_MEETING_LINK, // none set yet: the stand-in, as bookings get
  };
}