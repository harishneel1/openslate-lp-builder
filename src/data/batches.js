import { addDays, formatTime, todayIn, toInstant, weekdayOf, zoned } from '../utils/slots';

// ------------------------------------------------------------
// Live classes: a coach's classes, made the way TagMango makes a
// workshop. A class is the group: its title, the contracts people buy to
// join, its students and its reminders. Its sessions ("classes") are
// scheduled one at a time, on the fly, from the Classes tab of its page:
// tomorrow at 6 pm, Friday at 7:30 am, each with its own length. There's
// no repeat on the class itself: Schedule a class can make a run of them
// at once (Repeat weekly, on picked days, until a date), and each is saved
// as its own class, to change or cancel on its own.
//
// Who's in a class comes from its linked contracts (contractIds), as a
// TagMango workshop's "linked service": anyone who signed any of them.
// The class doesn't make, own or change a contract. Contracts are made
// and priced on the Contracts page, however the coach charges (monthly,
// 6 months up front…), and can be linked to more than one class.
//
// A class, as saved:
//   { id, title, thumbnail: { previewId, name } | null,
//     meeting: { kind: 'zoom' } (always a Zoom meeting, made for the coach),
//     sessions: [{ id, date: 'YYYY-MM-DD', startTime: '18:00', durationMins: 60 }],
//     timeZone: 'Asia/Kolkata', description, contractIds: ['…'],
//     cancelled: [{ sessionId, date, at (ms), told: { email, whatsapp, at } }],
//     createdAt, updatedAt (ms) }
//
// Sessions are on the class's own clock (timeZone). A cancelled session
// stays in sessions, marked by its entry in cancelled, so the Classes tab
// can show it and the bell can say who was told.
//
// Saves from before (a schedule: startDate, startTime, durationMins,
// repeats, days, daysOff) become sessions the first time they're read
// (migrate below): a one-off its own class, a weekly class its classes
// for the next 4 weeks, skipping its days off. Older still (Round 1), a
// batch's own price and contract (price, contractId, questions) are kept,
// unused by new screens.
//
// Kept in this browser for now (localStorage); in the real product the
// server keeps batches, and the class meeting comes from the Zoom
// connection.
//
// A cancelled class doesn't block 1:1 calls and isn't counted on the
// "Your calendar" card (allClassesBetween leaves it out); the Classes tab
// shows it, marked.
// ------------------------------------------------------------

const KEY = 'pagebuilder:batches';
export const BATCHES_CHANGED_EVENT = 'batches-changed';

const MIN = 60_000;

export const DEFAULT_START = '18:00';
export const DEFAULT_LENGTH = 60;
// Length, as two dropdowns (hours and minutes), like TagMango's
// Length: one list, every 15 minutes from 15 min to 5 hr
export const LENGTHS = Array.from({ length: 20 }, (_, i) => (i + 1) * 15);
export const TITLE_MAX = 100;
export const DESCRIPTION_MAX = 1000;
// How far ahead a weekly class from before is turned into classes
const MIGRATE_WEEKS = 4;

// For Repeat weekly in Schedule a class: the day chips, Monday first
export const WEEKDAYS = [
  ['mon', 'Mon'],
  ['tue', 'Tue'],
  ['wed', 'Wed'],
  ['thu', 'Thu'],
  ['fri', 'Fri'],
  ['sat', 'Sat'],
  ['sun', 'Sun'],
];
// The most classes one Repeat weekly can make, so a far-off end date can't make hundreds
export const REPEAT_MAX = 60;
// The end date Repeat weekly starts with: 4 weeks after the first class
export const REPEAT_WEEKS = 4;

// Examples under the title box, from different kinds of classes, so it
// works for any coach. Shown, not offered to tap.
export const NAME_EXAMPLES = ['Bharatanatyam for Beginners', 'Weekend Kathak', 'Watercolour Basics', 'Evening Yoga'];

// ---------- Saving ----------

const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

function readAll() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((b) => isObject(b) && typeof b.id === 'string') : [];
  } catch {
    return [];
  }
}

function writeAll(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    window.dispatchEvent(new Event(BATCHES_CHANGED_EVENT));
    return true;
  } catch {
    return false;
  }
}

export const newSessionId = () => `s-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// ---------- From before: a schedule → sessions ----------

// Days off as dates, from either save shape (dates, or { from, to } ranges)
function oldDaysOff(b) {
  const days = new Set(Array.isArray(b.daysOff) ? b.daysOff.filter((d) => DATE.test(d)) : []);
  for (const x of Array.isArray(b.breaks) ? b.breaks : []) {
    if (!x || !DATE.test(x.from) || !DATE.test(x.to)) continue;
    for (let d = x.from, guard = 0; d <= x.to && guard < 400; d = addDays(d, 1), guard += 1) days.add(d);
  }
  return days;
}

// A batch saved with a schedule → the same batch with sessions. Returns
// null when it already has sessions.
function migrate(b, now = Date.now()) {
  if (Array.isArray(b.sessions)) return null;
  const zone = typeof b.timeZone === 'string' && b.timeZone ? b.timeZone : 'Asia/Kolkata';
  const startTime = TIME.test(b.startTime) ? b.startTime : DEFAULT_START;
  const durationMins = Math.max(15, Number(b.durationMins) || DEFAULT_LENGTH);
  const startDate = DATE.test(b.startDate) ? b.startDate : null;
  const repeats = b.repeats !== false;
  const days = Array.isArray(b.days) ? b.days : [];
  const off = oldDaysOff(b);
  const cancelledOn = new Map((Array.isArray(b.cancelled) ? b.cancelled : []).filter((c) => c && DATE.test(c.date)).map((c) => [c.date, c]));

  const dates = [];
  if (!repeats && startDate) dates.push(startDate);
  else {
    const today = todayIn(zone, now);
    let d = startDate && startDate > today ? startDate : today;
    const last = addDays(d, MIGRATE_WEEKS * 7 - 1);
    for (let guard = 0; d <= last && guard < 60; d = addDays(d, 1), guard += 1) {
      if (days.includes(weekdayOf(d)) && !off.has(d)) dates.push(d);
    }
    // Cancelled classes still to come stay listed, marked
    for (const date of cancelledOn.keys()) if (date >= today && !dates.includes(date)) dates.push(date);
    dates.sort();
  }

  const sessions = dates.map((date) => ({ id: newSessionId(), date, startTime, durationMins }));
  const cancelled = sessions.filter((s) => cancelledOn.has(s.date)).map((s) => ({ ...cancelledOn.get(s.date), sessionId: s.id }));
  // Drop the schedule fields: sessions hold the times now
  const { startDate: _a, startTime: _b, durationMins: _c, repeats: _d, days: _e, daysOff: _f, breaks: _g, ...rest } = b; // eslint-disable-line no-unused-vars
  return { ...rest, timeZone: zone, sessions, cancelled };
}

// How it meets: always a Zoom meeting, made for the coach (the real
// product makes it from their Zoom connection). Kept as an object so
// more can be added later.
export const tidyMeeting = () => ({ kind: 'zoom' });

const tidySession = (s) =>
  isObject(s) && typeof s.id === 'string' && DATE.test(s.date)
    ? {
        id: s.id,
        date: s.date,
        startTime: TIME.test(s.startTime) ? s.startTime : DEFAULT_START,
        durationMins: Math.max(15, Number(s.durationMins) || DEFAULT_LENGTH),
      }
    : null;

// A saved batch → safe values (older or hand-edited saves)
function tidy(b) {
  const timeZone = typeof b.timeZone === 'string' && b.timeZone ? b.timeZone : 'Asia/Kolkata';
  const sessions = (Array.isArray(b.sessions) ? b.sessions : [])
    .map(tidySession)
    .filter(Boolean)
    .sort((x, y) => toInstant(x.date, x.startTime, timeZone) - toInstant(y.date, y.startTime, timeZone));
  return {
    ...b,
    title: String(b.title ?? '').trim() || 'Untitled class',
    thumbnail: b.thumbnail && typeof b.thumbnail.previewId === 'string' ? b.thumbnail : null,
    meeting: tidyMeeting(b.meeting),
    sessions,
    timeZone,
    description: String(b.description ?? ''),
    contractIds: Array.isArray(b.contractIds) ? [...new Set(b.contractIds.filter((id) => typeof id === 'string' && id))] : [],
    // From before the rework, kept for the screens not reworked yet
    price: Math.max(0, Math.round(Number(b.price) || 0)),
    questions: Array.isArray(b.questions) ? b.questions : [],
    contractId: typeof b.contractId === 'string' ? b.contractId : null,
    cancelled: Array.isArray(b.cancelled) ? b.cancelled.filter((c) => c && typeof c.sessionId === 'string') : [],
  };
}

// Every batch, oldest first, so Morning stays above Evening as they made
// them. Batches saved with a schedule are turned into sessions, and saved
// that way, the first time they're read.
export function loadBatches() {
  const raw = readAll();
  let changed = false;
  const list = raw.map((b) => {
    const moved = migrate(b);
    if (!moved) return b;
    changed = true;
    return moved;
  });
  if (changed) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch {
      // Not saved: they're turned into sessions again next time
    }
  }
  return list.map(tidy).sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
}

export const getBatch = (id) => loadBatches().find((b) => b.id === id) ?? null;

// Class ids start with 'batch-' (kept from before the rework, so saved classes carry on)
export const newBatchId = () => `batch-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

// Adds or replaces one batch. Returns true if it saved.
export function saveBatch(batch) {
  const list = readAll();
  const now = Date.now();
  const i = list.findIndex((b) => b.id === batch.id);
  const next = { ...batch, sessions: batch.sessions ?? [], createdAt: batch.createdAt ?? now, updatedAt: now };
  if (i === -1) list.push(next);
  else list[i] = next;
  return writeAll(list);
}

export function deleteBatch(id) {
  return writeAll(readAll().filter((b) => b.id !== id));
}

// Calls fn when batches change, here or in another tab. Returns a stop function.
export function onBatchesChange(fn) {
  const onStorage = (e) => (e.key === null || e.key === KEY) && fn();
  window.addEventListener(BATCHES_CHANGED_EVENT, fn);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(BATCHES_CHANGED_EVENT, fn);
    window.removeEventListener('storage', onStorage);
  };
}

// ---------- Reading it out ----------

// '06:30' → '6:30 am'
export function timeLine(time) {
  const [h, m] = String(time).split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

// What sits after the schedule on a class's row: its linked contracts
// ('2 contracts'). Classes don't have a fee: their contracts do.
export function feeLine(batch) {
  const n = batch.contractIds?.length ?? 0;
  if (n === 0) return 'No contracts linked';
  return n === 1 ? '1 contract' : `${n} contracts`;
}

// 75 → '1 hr 15 min'; 60 → '1 hr'; 45 → '45 min'
export function lengthLine(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

// ---------- Its classes ----------
// A class (one session), as the screens use it:
//   { id, start, end (ms), date, startTime, durationMins, off }
// off: { kind: 'cancelled', at, told } or null

// Why a session isn't happening, or null
export function offOn(batch, sessionId) {
  const cancelled = (batch.cancelled ?? []).find((c) => c.sessionId === sessionId);
  return cancelled ? { kind: 'cancelled', ...cancelled } : null;
}

function asClass(batch, s) {
  const start = toInstant(s.date, s.startTime, batch.timeZone);
  return { id: s.id, start, end: start + s.durationMins * MIN, date: s.date, startTime: s.startTime, durationMins: s.durationMins, off: offOn(batch, s.id) };
}

// Every class of the batch, oldest first
export const allClassesOf = (batch) => (batch.sessions ?? []).map((s) => asClass(batch, s)).sort((a, b) => a.start - b.start);

// One class by its session id, or null
export const classById = (batch, id) => allClassesOf(batch).find((c) => c.id === id) ?? null;

// Every class between two instants (ms), oldest first. A class counts if
// any of it falls in the window, so one that's on now is in.
export const classesBetween = (batch, fromMs, toMs) => allClassesOf(batch).filter((c) => c.end > fromMs && c.start < toMs);

// The next classes from now (one on now comes first), up to count.
// includeOff: true to keep cancelled ones (the Classes tab); otherwise
// only classes that happen (the join page, the Zoom room).
export function nextClasses(batch, now = Date.now(), count = 6, { includeOff = false } = {}) {
  return allClassesOf(batch)
    .filter((c) => c.end > now && (includeOff || !c.off))
    .slice(0, count);
}

// Classes that are over, the latest first (cancelled ones included)
export const pastClasses = (batch, now = Date.now()) =>
  allClassesOf(batch)
    .filter((c) => c.end <= now)
    .reverse();

// Every class that happens, of every batch, in a window: for the 1:1
// calls' booking times (one calendar: nobody can book a call during a
// class, but a cancelled class frees the time) and the "Your calendar"
// card: [{ start, end, batchId }]
export function allClassesBetween(fromMs, toMs, batches = loadBatches()) {
  return batches
    .flatMap((b) =>
      classesBetween(b, fromMs, toMs)
        .filter((c) => !c.off)
        .map((c) => ({ ...c, batchId: b.id })),
    )
    .sort((a, b) => a.start - b.start);
}

// ---------- Upcoming or completed (the Live classes list) ----------

// The next class that happens, on now or to come, or null
export const nextClassOf = (batch, now = Date.now()) => nextClasses(batch, now, 1)[0] ?? null;

// The latest class that happened, or null
export const lastClassOf = (batch, now = Date.now()) => pastClasses(batch, now).find((c) => !c.off) ?? null;

// 'upcoming' while a class is on now or to come, or nothing has been
// scheduled yet (so a new class is easy to find); 'completed' once every
// class it had is over. Scheduling another moves it back to Upcoming.
export function classStatus(batch, now = Date.now()) {
  if ((batch.sessions ?? []).length === 0) return 'upcoming';
  return nextClassOf(batch, now) ? 'upcoming' : 'completed';
}

// ---------- Scheduling, changing and cancelling a class ----------
// Each saves the batch and returns true if it saved.

// session: { date, startTime, durationMins }. Returns the new session's id, or null.
export function scheduleClass(batch, { date, startTime, durationMins }) {
  const id = newSessionId();
  const ok = saveBatch({ ...batch, sessions: [...(batch.sessions ?? []), { id, date, startTime, durationMins }] });
  return ok ? id : null;
}

// Every date from `from` to `until` (both 'YYYY-MM-DD', inclusive) that
// falls on one of `days` (['mon', 'wed', …]), up to REPEAT_MAX
export function repeatDates(from, days, until) {
  const out = [];
  if (!from || !until || days.length === 0) return out;
  for (let d = from, guard = 0; d <= until && guard < 800 && out.length < REPEAT_MAX; d = addDays(d, 1), guard += 1) {
    if (days.includes(weekdayOf(d))) out.push(d);
  }
  return out;
}

// Many classes at once (Repeat weekly), all at one time and length. A date
// that already has a class at that time is skipped. Returns how many were
// added, or null if it couldn't save.
export function scheduleClasses(batch, dates, { startTime, durationMins }) {
  const taken = new Set((batch.sessions ?? []).map((s) => `${s.date} ${s.startTime}`));
  const added = dates
    .filter((date) => !taken.has(`${date} ${startTime}`))
    .map((date) => ({ id: newSessionId(), date, startTime, durationMins }));
  if (added.length === 0) return 0;
  return saveBatch({ ...batch, sessions: [...(batch.sessions ?? []), ...added] }) ? added.length : null;
}

// A class's new date, time or length. Students aren't messaged; reminders follow the new time.
export function updateClass(batch, id, { date, startTime, durationMins }) {
  return saveBatch({
    ...batch,
    sessions: (batch.sessions ?? []).map((s) => (s.id === id ? { ...s, date, startTime, durationMins } : s)),
  });
}

// told: { email, whatsapp } counts, from the announcement (BatchAnnounce.jsx)
export function cancelClass(batch, sessionId, told, now = Date.now()) {
  const c = classById(batch, sessionId);
  if (!c || c.off) return false;
  return saveBatch({ ...batch, cancelled: [...(batch.cancelled ?? []), { sessionId, date: c.date, at: now, told: { ...told, at: now } }] });
}

// The first class after this one that happens: "Your next class is on …"
export function nextClassAfter(batch, sessionId) {
  const c = classById(batch, sessionId);
  if (!c) return null;
  return allClassesOf(batch).find((x) => x.start > c.start && x.id !== sessionId && !x.off) ?? null;
}

// Where a class is, for its row and the Start button:
//   'live'  on now     'soon'  starts within 15 minutes     'later'
export function classState(c, now = Date.now()) {
  if (now >= c.start && now < c.end) return 'live';
  if (c.start - now <= 15 * MIN) return 'soon';
  return 'later';
}

// '2026-11-14' → 'Sat 14 Nov'; today and tomorrow in words
// today: null to always write the date out
export function classDay(date, today) {
  if (today && date === today) return 'Today';
  if (today && date === addDays(today, 1)) return 'Tomorrow';
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

// A class's start time on the batch's clock: '6:30 am'
export const classTime = (c, batch) => formatTime(c.start, batch.timeZone);

// '6:00–7:00 pm' or '11:30 am – 12:30 pm', on the batch's clock
export function classTimeRange(c, batch) {
  const from = formatTime(c.start, batch.timeZone);
  const to = formatTime(c.end, batch.timeZone);
  const [fromTime, fromHalf] = from.split(' ');
  const [toTime, toHalf] = to.split(' ');
  return fromHalf && fromHalf === toHalf ? `${fromTime}–${toTime} ${toHalf}` : `${from} – ${to}`;
}

// The batch's own day for an instant, for comparing with classes' dates
export const dayOn = (ms, batch) => zoned(ms, batch.timeZone).date;

// What a class's next class is, in a line: 'Next class Tue 24 Nov, 6:00 pm',
// or 'No class scheduled'. For its page, and the {{schedule}} fill-in of
// emails written before classes were scheduled one by one.
export function scheduleLine(batch, now = Date.now()) {
  const next = nextClassOf(batch, now);
  return next ? `Next class ${classDay(next.date, dayOn(now, batch))}, ${classTimeRange(next, batch)}` : 'No class scheduled';
}

// ---------- Links ----------

// The coach's class meeting (the mock Zoom room), in a new tab
export const classMeetingHref = (id) => `${window.location.pathname}?mock=zoom&batch=${encodeURIComponent(id)}`;
