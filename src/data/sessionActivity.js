import { formatTime, todayIn, zoned } from '../utils/slots';
import { coachZone, shortDay } from './buildBookingsJson';
import { emailOf, timeline } from './reminders';
import { recordingOf } from './recordings';
import { movesOf } from './reschedule';
import { isCancelled, webinarEnd, webinarWhen } from './webinar';

// ------------------------------------------------------------
// Everything that happened to one session, for the Activity tab of its
// side panel (WebinarDetails.jsx). Nothing new is stored for it: each line
// is put together from what's already saved (the session, its people,
// its recording), so it's there for older sessions too.
//
//   Today
//   ↻  Rescheduled from Fri 13 Nov to Fri 20 Nov        By you     4:10 pm
//      3 people emailed
//   ✉  24-hour reminder sent to 3 people                 Automatic  7:00 pm
//   Yesterday
//   👥 Priya, Ravi and 1 other signed up                 Automatic  9:12 pm
//      Confirmation emails sent
//   Wed 28 Oct
//   ＋ Session added                                     By you     3:02 pm
//
// In the prototype no email is really sent, so the reminder lines are
// worked out from the session's date now: after a move, a reminder that
// went out for the old date doesn't show. The real product records each
// email as it goes out. Every other line is exact.
// ------------------------------------------------------------

const REMINDER_NAMES = {
  h48: '48-hour reminder',
  h36: '36-hour reminder',
  day: '24-hour reminder',
  hour: '1-hour reminder',
  five: '5-minute reminder',
  after: 'Thank-you email',
};

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const people = (n) => `${n} ${n === 1 ? 'person' : 'people'}`;
const rupees = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const first = (name) => String(name ?? '').trim().split(/\s+/)[0] || 'Someone';

// 'Fri 13 Nov' for a { date, time } in this session's time zone
const dayOfMove = (place, timeZone) => {
  const w = webinarWhen({ date: place?.date, time: place?.time, timeZone });
  return w ? `${w.weekday} ${w.day} ${w.month}` : 'another date';
};

// Who signed up, in a few words: 'Priya signed up', 'Priya and Ravi
// signed up', 'Priya, Ravi and 3 others signed up' (newest first)
function signedUp(list) {
  const names = list.map((p) => first(p.name));
  if (names.length === 1) return `${names[0]} signed up`;
  if (names.length === 2) return `${names[0]} and ${names[1]} signed up`;
  return `${names[0]}, ${names[1]} and ${plural(names.length - 2, 'other')} signed up`;
}

// ------------------------------------------------------------
// One session's lines, newest first:
//   { key, kind, at (ms), title, detail (or null), by: 'auto' | 'you',
//     open: 'recording' | null (the tab a click opens: only the
//     recording's line opens anything; every other line is just a record) }
// kind: 'added' | 'signups' | 'reminder' | 'ended' | 'moved' |
//       'cancelled' | 'removed' | 'recording'
// Refunds are part of the line that made them: the cancelled line (everyone
// at once) or a removed line (one person, by hand)
// run: the session; signups: its people (peopleOf); now
// ------------------------------------------------------------
export function sessionActivity(run, signups = [], now = Date.now()) {
  const out = [];
  const answers = run.answers ?? {};
  const zone = coachZone();
  const cancelled = isCancelled(run);

  // Added: the first session of a webinar is when it was published
  const addedAt = Number.isFinite(run.publishedAt) ? run.publishedAt : run.createdAt;
  if (Number.isFinite(addedAt)) {
    out.push({
      key: 'added',
      kind: 'added',
      at: addedAt,
      title: run.copiedFrom ? 'Session added' : 'Webinar published',
      detail: null,
      by: 'you',
      open: null,
    });
  }

  // Sign-ups: one line per day (on the coach's clock), with the
  // confirmation emails they were sent
  const confirmations = emailOf(run, 'registered').on;
  const byDay = new Map();
  signups.forEach((p) => {
    if (!Number.isFinite(p.registeredAt)) return;
    const day = zoned(p.registeredAt, zone).date;
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(p);
  });
  byDay.forEach((list, day) => {
    const sorted = [...list].sort((a, b) => b.registeredAt - a.registeredAt);
    out.push({
      key: `signups:${day}`,
      kind: 'signups',
      at: sorted[0].registeredAt,
      title: signedUp(sorted),
      detail: confirmations ? (sorted.length === 1 ? 'Confirmation email sent' : 'Confirmation emails sent') : null,
      by: 'auto',
      open: null,
    });
  });

  // Reminders that went out to someone (off, skipped, stopped or sent to
  // nobody: left out, they'd only be noise)
  timeline(run, signups, now)
    .filter((row) => row.at !== null && row.past && row.on && !row.skipped && !row.stopped && row.sentTo > 0)
    .forEach((row) => {
      out.push({
        key: `reminder:${row.id}`,
        kind: 'reminder',
        at: row.at,
        title: `${REMINDER_NAMES[row.id] ?? 'Email'} sent to ${people(row.sentTo)}`,
        detail: null,
        by: 'auto',
        open: null,
      });
    });

  // Ended: the session ran (a cancelled one never did)
  const end = webinarEnd(answers);
  if (!cancelled && end !== null && end <= now && Number.isFinite(run.publishedAt)) {
    out.push({ key: 'ended', kind: 'ended', at: end, title: 'Session ended', detail: null, by: 'auto', open: null });
  }

  // Every move
  movesOf(run).forEach((m) => {
    out.push({
      key: `moved:${m.at}`,
      kind: 'moved',
      at: m.at,
      title: `Rescheduled from ${dayOfMove(m.from, answers.timeZone)} to ${dayOfMove(m.to, answers.timeZone)}`,
      detail: m.emailedTo > 0 ? `${people(m.emailedTo)} emailed` : null,
      by: 'you',
      open: null,
    });
  });

  // Cancelled, with the refunds it made (they share its time)
  const cancelAt = cancelled ? run.cancelled.at : null;
  if (cancelled) {
    const n = run.cancelled.emailedTo ?? 0;
    const r = run.cancelled.refund;
    out.push({
      key: 'cancelled',
      kind: 'cancelled',
      at: cancelAt,
      title: 'Session cancelled',
      detail:
        [n > 0 ? `${people(n)} emailed` : null, r ? `${rupees(r.total)} refunded to ${people(r.count)}${r.each ? `, ${rupees(r.each)} each` : ''}` : null]
          .filter(Boolean)
          .join(' · ') || null,
      by: 'you',
      open: null,
    });
  }

  // People the coach removed, each with their refund (if they paid)
  signups
    .filter((p) => Number.isFinite(p.removedAt))
    .forEach((p) => {
      const back = p.refundedAt === p.removedAt ? p.refunded ?? p.amount : null;
      out.push({
        key: `removed:${p.id}`,
        kind: 'removed',
        at: p.removedAt,
        title: back ? `Removed ${p.name} and refunded ${rupees(back)}` : `Removed ${p.name}`,
        detail: null,
        by: 'you',
        open: null,
      });
    });

  // The recording, once it's ready
  const rec = recordingOf(run.id, now);
  if (rec.status === 'ready') {
    out.push({ key: 'recording', kind: 'recording', at: rec.readyAt, title: 'Recording ready', detail: null, by: 'auto', open: 'recording' });
  }

  return out.filter((e) => e.at <= now + 60_000).sort((a, b) => b.at - a.at);
}

// The lines in days, newest first, for headings: [{ day, label, items }]
//   label: 'Today', 'Yesterday' or 'Wed 28 Oct'; each item also gets
//   time: '7:42 pm' (on the coach's clock)
export function activityByDay(items, now = Date.now()) {
  const zone = coachZone();
  const today = todayIn(zone, now);
  const groups = [];
  items.forEach((item) => {
    const day = zoned(item.at, zone).date;
    let group = groups[groups.length - 1];
    if (!group || group.day !== day) {
      group = { day, label: shortDay(day, today), items: [] };
      groups.push(group);
    }
    group.items.push({ ...item, time: formatTime(item.at, zone) });
  });
  return groups;
}