import { classDay, classTime, nextClassDayAfter } from './batches';
import { shortDate } from './batchMembers';
import { MESSAGES } from './whatsappMessages';
import { fillIn } from './reminders';
import { todayIn, toInstant } from '../utils/slots';

// ------------------------------------------------------------
// Telling a batch's members that a class is cancelled. Broadcast once, by
// email and WhatsApp, to everyone in the batch (not removed members),
// from the cancel page (BatchAnnounce.jsx). Built like a webinar's
// cancellation email (reminders.js cancelTemplate): it starts from a
// template with blanks, the coach can change it, and it isn't saved as a
// template; each cancellation starts fresh.
//
// The WhatsApp side is fixed wording with blanks (Meta's rule), the
// batch-cancel message in whatsappMessages.js. It adds to the email; it
// never replaces it. Members with no phone number get the email only.
//
// Breaks send nothing: the coach tells members in class.
// No money in either: a cancelled class never changes a fee.
//
// change: { kind: 'cancel', date } (the class, on its date)
// ------------------------------------------------------------

// What + Insert detail offers in the email (the editor's field shape)
export const NOTICE_FIELDS = [
  { key: 'first_name', label: 'First name', hint: 'Fills in each member’s first name' },
  { key: 'batch_title', label: 'Batch name', hint: 'Fills in the batch’s name' },
  { key: 'date', label: 'Date', hint: 'Fills in the class’s date' },
  { key: 'time', label: 'Time', hint: 'Fills in the class’s time' },
  { key: 'next_class', label: 'Next class', hint: 'Fills in when the next class is' },
  { key: 'your_name', label: 'Your name', hint: 'Fills in your name' },
];

// The email each cancellation starts from
export const noticeTemplate = () => ({
  subject: 'No {{batch_title}} class on {{date}}',
  body:
    '<p>Hi {{first_name}},</p>' +
    '<p>I’m sorry, but I’ve had to cancel the <b>{{batch_title}}</b> class on <b>{{date}} at {{time}}</b>.</p>' +
    '<p>Your next class is on <b>{{next_class}}</b>, at the usual time.</p>' +
    '<p>{{your_name}}</p>',
});

// '1 Jan' or '1–7 Jan' or '30 Dec – 3 Jan', for a run of days off
export function rangeLine(from, to) {
  if (from === to) return shortDate(from);
  const [a, b] = [shortDate(from), shortDate(to)];
  const [ad, am] = a.split(' ');
  const [bd, bm] = b.split(' ');
  return am === bm ? `${ad}–${bd} ${bm}` : `${a} – ${b}`;
}

// What fills the blanks, for one member (or a sample, for the preview).
// Dates are always written out ("Thu 5 Nov"), never "Tomorrow": the email
// may be read a day later, and "on Tomorrow" doesn't read.
export function noticeValues(batch, change, member, hostName) {
  const written = (date) => classDay(date, null);
  // The next class after this one, as if it were already cancelled
  const pretend = { ...batch, cancelled: [...(batch.cancelled ?? []), { date: change.date }] };
  const next = nextClassDayAfter(pretend, change.date);
  const at = (date) => classTime({ start: toInstant(date, batch.startTime, batch.timeZone) }, batch);
  return {
    first_name: String(member?.name ?? 'Priya').trim().split(/\s+/)[0] || 'there',
    batch_title: batch.title,
    date: written(change.date),
    time: at(change.date),
    next_class: next ? `${written(next)}, ${at(next)}` : 'a date I’ll share soon',
    your_name: String(hostName ?? '').trim() || 'Your coach',
  };
}

// The WhatsApp message, and its blanks for one member
export const noticeWhatsApp = () => MESSAGES.batch.find((m) => m.id === 'batch-cancel');

export function whatsappValues(batch, change, member, hostName) {
  const v = noticeValues(batch, change, member, hostName);
  return { first_name: v.first_name, batch: batch.title, host: v.your_name, date: v.date, next: v.next_class };
}

// The email for one member, filled in (what the real product would send)
export const filledEmail = (draft, values) => ({
  subject: fillIn(draft.subject, values),
  body: fillIn(draft.body, values, { html: true }),
});

// ---------- For the bell ----------
// Every cancellation in the last 30 days, as records (the coach did
// these, so they're never "new"):
//   (✕) Class cancelled · 18 members told           Just now
//       Morning Yoga, Thu 13 Nov
// → [{ key, kind: 'batch-off', at, batchId, title, when, what, told, today }]
export function noticeRecords(batches, zone, now = Date.now()) {
  const since = now - 30 * 86_400_000;
  const today = todayIn(zone, now);
  const out = [];
  for (const b of batches) {
    for (const c of b.cancelled ?? []) {
      if (!(c.at >= since)) continue;
      out.push({
        key: `batch-off:${b.id}:${c.date}`,
        kind: 'batch-off',
        at: c.at,
        batchId: b.id,
        title: b.title,
        when: classDay(c.date, null),
        what: 'Class cancelled',
        told: c.told?.email ?? 0,
        today: todayIn(zone, c.at) === today,
      });
    }
  }
  return out.sort((a, b) => b.at - a.at);
}