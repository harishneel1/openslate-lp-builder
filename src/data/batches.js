import { formatMoney } from './contractPricing';
import { addDays, formatTime, todayIn, toInstant, weekdayOf, zoned } from '../utils/slots';

// ------------------------------------------------------------
// Live classes: a coach's batches. A batch is a class that meets on
// the same days at the same time, every week, with no end date
// ("Morning Yoga, Mon–Sat, 6:30–7:30 am"). People join it by buying its
// contract, a monthly subscription, and stay in it for as long as they
// hold that contract (batchMembers.js).
//
// One contract per batch. The batch owns it, like a webinar owns its
// sign-up page: the batch's name, description, fee and health questions
// are written into the contract whenever the batch is saved
// (saveBatchContract in mockServices.js), so the contract is changed
// here and not on the Contracts page (ownerOf in tiedProducts.js).
//
// A batch, as saved:
//   { id, title, days: ['mon', ...], startTime: '06:30', durationMins: 60,
//     timeZone: 'Asia/Kolkata', price: 2000 (rupees a month),
//     description, questions (callQuestions.js shape), contractId,
//     createdAt, updatedAt (ms) }
//
// Kept in this browser for now (localStorage); in the real product the
// server keeps batches, and the class meeting comes from the Zoom
// connection.
//
// Classes that don't happen (round 3), kept on the batch:
//   cancelled: [{ date: 'YYYY-MM-DD', at (ms), told }]   one class, on its date;
//              told: { email, whatsapp } how many members were told, and at (ms)
//   daysOff:   ['YYYY-MM-DD', …]   breaks: days the coach is away, picked on
//              the same calendar as the 1:1 calls' Days off. Members aren't
//              messaged about these: the coach tells them in class.
// A class that's off doesn't block 1:1 calls and isn't counted on the
// "Your calendar" card (allClassesBetween leaves it out); the Classes tab
// shows it, marked. Fees don't change: a break never moves a payment.
// ------------------------------------------------------------

const KEY = 'pagebuilder:batches';
export const BATCHES_CHANGED_EVENT = 'batches-changed';

const MIN = 60_000;

export const WEEKDAYS = [
  ['mon', 'Mon'],
  ['tue', 'Tue'],
  ['wed', 'Wed'],
  ['thu', 'Thu'],
  ['fri', 'Fri'],
  ['sat', 'Sat'],
  ['sun', 'Sun'],
];
const DAY_ORDER = WEEKDAYS.map(([id]) => id);

export const DEFAULT_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
export const DEFAULT_START = '06:30';
export const LENGTHS = [45, 60, 75, 90]; // minutes, as tiles
export const DEFAULT_LENGTH = 60;
export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 1000;
export const PRICE_MAX = 999999;

// Examples under the name box, from different kinds of classes (a batch
// can be any class that meets every week: dance, art, yoga, music…), the
// way Cult names its sessions. Shown, not offered to tap.
export const NAME_EXAMPLES = ['Bharatanatyam for Beginners', 'Weekend Kathak', 'Watercolour Basics', 'Evening Yoga'];

// Starting description, from the schedule (no kind of class assumed)
export const descriptionFor = (batch) =>
  `Live classes on Zoom, ${daysLine(batch.days)} at ${timeLine(batch.startTime)}. Join from home, every week.`;

// ---------- Saving ----------

const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v);

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

// Days off as dates. Saves from before (breaks as { from, to } ranges)
// become their dates.
const DATE = /^\d{4}-\d{2}-\d{2}$/;
function daysOffOf(b) {
  const days = new Set(Array.isArray(b.daysOff) ? b.daysOff.filter((d) => DATE.test(d)) : []);
  for (const x of Array.isArray(b.breaks) ? b.breaks : []) {
    if (!x || !DATE.test(x.from) || !DATE.test(x.to)) continue;
    for (let d = x.from, guard = 0; d <= x.to && guard < 400; d = addDays(d, 1), guard += 1) days.add(d);
  }
  return [...days].sort();
}

// A saved batch → safe values (older or hand-edited saves)
function tidy(b) {
  const days = Array.isArray(b.days) ? DAY_ORDER.filter((d) => b.days.includes(d)) : DEFAULT_DAYS;
  return {
    ...b,
    title: String(b.title ?? '').trim() || 'Untitled batch',
    days,
    startTime: /^\d{2}:\d{2}$/.test(b.startTime) ? b.startTime : DEFAULT_START,
    durationMins: Math.max(15, Number(b.durationMins) || DEFAULT_LENGTH),
    timeZone: typeof b.timeZone === 'string' && b.timeZone ? b.timeZone : 'Asia/Kolkata',
    price: Math.max(0, Math.round(Number(b.price) || 0)),
    description: String(b.description ?? ''),
    questions: Array.isArray(b.questions) ? b.questions : [],
    contractId: typeof b.contractId === 'string' ? b.contractId : null,
    cancelled: Array.isArray(b.cancelled) ? b.cancelled.filter((c) => c && typeof c.date === 'string') : [],
    daysOff: daysOffOf(b),
  };
}

// Every batch, oldest first, so Morning stays above Evening as they made them
export const loadBatches = () => readAll().map(tidy).sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));

export const getBatch = (id) => loadBatches().find((b) => b.id === id) ?? null;

// Batch ids start with 'batch-', so a link like /harishneel/batch-… is a batch's
export const isBatchId = (id) => typeof id === 'string' && id.startsWith('batch-');
export const newBatchId = () => `batch-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

// Adds or replaces one batch. Returns true if it saved.
export function saveBatch(batch) {
  const list = readAll();
  const now = Date.now();
  const i = list.findIndex((b) => b.id === batch.id);
  const next = { ...batch, createdAt: batch.createdAt ?? now, updatedAt: now };
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

const toMinutes = (time) => {
  const [h, m] = String(time).split(':').map(Number);
  return h * 60 + m;
};
const fromMinutes = (mins) => {
  const t = ((mins % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

// '06:30', 60 → '6:30–7:30 am'; '11:30', 60 → '11:30 am – 12:30 pm'
export function timeRange(start, mins) {
  const from = timeLine(start);
  const to = timeLine(fromMinutes(toMinutes(start) + mins));
  const [fromTime, fromHalf] = from.split(' ');
  const [toTime, toHalf] = to.split(' ');
  return fromHalf === toHalf ? `${fromTime}–${toTime} ${toHalf}` : `${from} – ${to}`;
}

// ['mon'..'sat'] → 'Mon–Sat'; ['mon','wed','fri'] → 'Mon, Wed, Fri'; all → 'Every day'
export function daysLine(days = []) {
  const picked = DAY_ORDER.filter((d) => days.includes(d));
  if (picked.length === 0) return 'No days';
  if (picked.length === 7) return 'Every day';
  const label = (d) => WEEKDAYS.find(([id]) => id === d)[1];
  const first = DAY_ORDER.indexOf(picked[0]);
  const inARow = picked.every((d, i) => DAY_ORDER.indexOf(d) === first + i);
  if (inARow && picked.length >= 3) return `${label(picked[0])}–${label(picked[picked.length - 1])}`;
  return picked.map(label).join(', ');
}

// 'Mon–Sat · 6:30–7:30 am'
export const scheduleLine = (batch) => `${daysLine(batch.days)} · ${timeRange(batch.startTime, batch.durationMins)}`;

// '₹2,000/month'
export const feeLine = (batch) => `${formatMoney(batch.price, 'INR')}/month`;

// Classes in a month, about: for "₹2,000 a month, about 26 classes"
export const classesPerMonth = (batch) => Math.round((batch.days.length * 52) / 12);

// ---------- Its classes ----------

// Why a class on this date isn't happening, or null:
//   { kind: 'cancelled', at, told } or { kind: 'break' }
export function offOn(batch, date) {
  const cancelled = (batch.cancelled ?? []).find((c) => c.date === date);
  if (cancelled) return { kind: 'cancelled', ...cancelled };
  return (batch.daysOff ?? []).includes(date) ? { kind: 'break' } : null;
}

// Every class between two instants (ms), oldest first: [{ start, end, date, off }]
// start, end: ms. date: the class's day on the batch's own clock.
// off: why it isn't happening (offOn), or null.
// A class counts if any of it falls in the window, so one that's on now is in.
export function classesBetween(batch, fromMs, toMs) {
  const zone = batch.timeZone;
  const out = [];
  let date = addDays(todayIn(zone, fromMs), -1); // the day before, for a class that runs past midnight
  const last = todayIn(zone, toMs);
  for (let guard = 0; guard < 400 && date <= last; guard += 1) {
    if (batch.days.includes(weekdayOf(date))) {
      const start = toInstant(date, batch.startTime, zone);
      const end = start + batch.durationMins * MIN;
      if (end > fromMs && start < toMs) out.push({ start, end, date, off: offOn(batch, date) });
    }
    date = addDays(date, 1);
  }
  return out;
}

// The next classes from now (one on now comes first), up to count.
// includeOff: true to keep cancelled ones and breaks (the Classes tab);
// otherwise only classes that happen (the join page, the Zoom room).
export function nextClasses(batch, now = Date.now(), count = 6, { includeOff = false } = {}) {
  if (batch.days.length === 0) return [];
  // Look far enough ahead to get past a long break
  const weeks = Math.ceil(count / batch.days.length + 1) + (includeOff ? 0 : 14);
  return classesBetween(batch, now, now + weeks * 7 * 1440 * MIN)
    .filter((c) => includeOff || !c.off)
    .slice(0, count);
}

// Every class that happens, of every batch, in a window: for the 1:1
// calls' booking times (one calendar: nobody can book a call during a
// class, but a cancelled class or a break frees the time) and the
// "Your calendar" card: [{ start, end, batchId }]
export function allClassesBetween(fromMs, toMs, batches = loadBatches()) {
  return batches
    .flatMap((b) =>
      classesBetween(b, fromMs, toMs)
        .filter((c) => !c.off)
        .map((c) => ({ ...c, batchId: b.id })),
    )
    .sort((a, b) => a.start - b.start);
}

// ---------- Cancelling a class, and breaks ----------
// Cancelling saves the batch. told: { email, whatsapp } counts, from the
// announcement (BatchAnnounce.jsx). Returns true if it saved.

export function cancelClass(batch, date, told, now = Date.now()) {
  if (offOn(batch, date)) return false;
  return saveBatch({ ...batch, cancelled: [...(batch.cancelled ?? []), { date, at: now, told: { ...told, at: now } }] });
}

// The batch's days off, replaced (from the Breaks calendar). Returns true if saved.
export function saveBatchDaysOff(batch, dates) {
  const { breaks, ...rest } = batch; // eslint-disable-line no-unused-vars
  return saveBatch({ ...rest, daysOff: [...new Set(dates)].sort() });
}

// Days off from today on, as runs of days: [{ from, to }], soonest first
export function upcomingBreaks(batch, today) {
  const days = (batch.daysOff ?? []).filter((d) => d >= today).sort();
  const runs = [];
  for (const d of days) {
    const last = runs.at(-1);
    if (last && addDays(last.to, 1) === d) last.to = d;
    else runs.push({ from: d, to: d });
  }
  return runs;
}

// The classes a break would take out (dates the batch meets on), for "6 classes"
export function classesInRange(batch, from, to) {
  const out = [];
  for (let d = from, guard = 0; d <= to && guard < 400; d = addDays(d, 1), guard += 1) {
    if (batch.days.includes(weekdayOf(d))) out.push(d);
  }
  return out;
}

// The first day after `date` that has a class happening: "Classes start again on …"
export function nextClassDayAfter(batch, date) {
  for (let d = addDays(date, 1), guard = 0; guard < 400; d = addDays(d, 1), guard += 1) {
    if (batch.days.includes(weekdayOf(d)) && !offOn(batch, d)) return d;
  }
  return null;
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

// The batch's own day for an instant, for comparing with classes' dates
export const dayOn = (ms, batch) => zoned(ms, batch.timeZone).date;

// ---------- Links ----------

// The batch's public page in this prototype (its "View live page")
export const batchPageHref = (id) => `${window.location.pathname}?mock=batch&batch=${encodeURIComponent(id)}`;

// The coach's class meeting (the mock Zoom room), in a new tab
export const classMeetingHref = (id) => `${window.location.pathname}?mock=zoom&batch=${encodeURIComponent(id)}`;