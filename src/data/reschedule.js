import { activeBookings } from './bookingsStore';
import { funnelTypes } from './funnelTypes';
import { funnelName } from '../utils/funnelName';
import {
  canCancel,
  currentRun,
  durationMins,
  isCancelled,
  isFuture,
  seriesIdOf,
  webinarEnd,
  webinarStart,
  webinarStatus,
  webinarWhen,
} from './webinar';

// ------------------------------------------------------------
// Rescheduling a session: moving it to a new date and time. The only way
// a session's date changes once it's published (Edit session no longer
// has the date). The session stays the same session: its people, its
// payments, its Zoom meeting and join links, its pages. Its reminders
// follow the new date by themselves (they're worked out from it).
//
// Saved on the session (App.jsx rescheduleSession):
//   rescheduled: {
//     at:        when it was moved (ms)
//     from:      { date, time } where it was before this move
//     emailedTo: how many people were emailed the new date
//     email:     { subject, body } as sent, or null (nobody signed up)
//   }
//   moves: every move, oldest first, for the session's Activity tab:
//     [{ at, from: { date, time }, to: { date, time }, emailedTo }]
// `rescheduled` is the latest move (what the drawer's "Moved from" line
// and the bell show); `moves` keeps them all. Sessions moved before moves
// existed have only `rescheduled`: movesOf turns it into a one-move list.
// Each move emails from where people last heard it was.
//
// What stops a move (moveProblem) and what's only worth knowing first
// (moveWarnings) are worked out here, so the pop-up and App agree.
// ------------------------------------------------------------

const TYPE = funnelTypes.find((t) => t.id === 'webinar');
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? ''));
const isTime = (v) => /^\d{2}:\d{2}$/.test(String(v ?? ''));

// The session's start and end (ms) if it were at this date and time
function spanAt(webinar, date, time) {
  const answers = { ...(webinar.answers ?? {}), date, time };
  return { start: webinarStart(answers), end: webinarEnd(answers) };
}

const overlaps = (a, b) => a.start < b.end && b.start < a.end;

// Every move of a session, oldest first (see `moves` above)
export function movesOf(webinar) {
  if (Array.isArray(webinar?.moves) && webinar.moves.length > 0) return webinar.moves;
  const r = webinar?.rescheduled;
  if (!r || !Number.isFinite(r.at)) return [];
  const answers = webinar.answers ?? {};
  return [{ at: r.at, from: r.from, to: { date: answers.date, time: answers.time ?? '19:00' }, emailedTo: r.emailedTo ?? 0 }];
}

// Can it be moved at all? The same as cancelling: published, not
// cancelled, and not started (so never while it's live)
export const canReschedule = (webinar, now = Date.now()) => canCancel(webinar, now);

// 'Sat 14 Nov', for messages
const dayOf = (answers) => {
  const w = webinarWhen(answers ?? {});
  return w ? `${w.weekday} ${w.day} ${w.month}` : 'that day';
};

// What stops moving it to this date and time, as a sentence, or null:
//   not filled in, in the past, where it already is, or at the same time
//   as another session of this webinar (two at once can't work)
export function moveProblem(webinar, all, date, time, now = Date.now()) {
  if (!isDate(date) || !isTime(time)) return 'Pick a date and a start time.';
  const answers = webinar.answers ?? {};
  if (date === answers.date && time === (answers.time ?? '19:00')) return 'Pick a new date or time.';
  if (!isFuture(answers, date, time, now)) return 'Pick a date and time in the future.';
  const mine = spanAt(webinar, date, time);
  const series = seriesIdOf(webinar, all);
  const clash = all.find(
    (w) =>
      w?.id !== webinar.id &&
      w.publishedAt &&
      !isCancelled(w) &&
      seriesIdOf(w, all) === series &&
      webinarStart(w.answers ?? {}) !== null &&
      overlaps(mine, { start: webinarStart(w.answers ?? {}), end: webinarEnd(w.answers ?? {}) }),
  );
  if (clash) return `Another session of this webinar is on at that time (${dayOf(clash.answers)}).`;
  return null;
}

// '7:30 pm', on the coach's clock
const clockOf = (ms) => new Date(ms).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }).toLowerCase();

// Worth knowing before moving it, but not stopping it: the coach may have
// planned for it. A list of sentences:
//   - it overlaps a 1:1 call, or a session of another webinar
//   - the main landing page link will point to a different session after
//     the move (this one now comes after another, or before it)
export function moveWarnings(webinar, all, date, time, now = Date.now()) {
  if (moveProblem(webinar, all, date, time, now)) return [];
  const out = [];
  const mine = spanAt(webinar, date, time);
  const series = seriesIdOf(webinar, all);

  activeBookings()
    .map((b) => ({ b, span: { start: Date.parse(b.start), end: Date.parse(b.end) } }))
    .filter(({ span }) => Number.isFinite(span.start) && Number.isFinite(span.end) && overlaps(mine, span))
    .forEach(({ b, span }) => {
      const first = String(b.guest?.name ?? '').trim().split(/\s+/)[0];
      out.push(`You have a 1:1 call${first ? ` with ${first}` : ''} at ${clockOf(span.start)} that day.`);
    });

  all
    .filter(
      (w) =>
        w?.id !== webinar.id &&
        w.type === 'webinar' &&
        w.publishedAt &&
        !isCancelled(w) &&
        seriesIdOf(w, all) !== series &&
        webinarStatus(w, now) === 'upcoming',
    )
    .forEach((w) => {
      const start = webinarStart(w.answers ?? {});
      if (start !== null && overlaps(mine, { start, end: webinarEnd(w.answers ?? {}) })) {
        out.push(`Your webinar “${funnelName(w, TYPE)}” is on at ${clockOf(start)} that day.`);
      }
    });

  // Which session the main landing page link opens, before and after
  const before = currentRun(series, all, now);
  const moved = all.map((w) => (w?.id === webinar.id ? { ...w, answers: { ...w.answers, date, time } } : w));
  const after = currentRun(series, moved, now);
  if (before && after && before.id !== after.id && webinarStatus(after, now) === 'upcoming') {
    out.push(`Your main landing page link will point to your next upcoming session, ${dayOf(after.answers)}.`);
  }
  return out;
}