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
// Not in this round: holidays and cancelling one class (round 3),
// renewals and dues (round 2). Every class in the schedule happens.
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

// Starting names: the first one none of their batches has
export const TITLE_SUGGESTIONS = ['Morning Yoga', 'Evening Yoga', 'Weekend Yoga', 'Beginners Yoga'];

// Starting description, from the name and schedule
export const descriptionFor = (batch) =>
  `Live ${String(batch.title || 'yoga').trim()} classes on Zoom, ${daysLine(batch.days)} at ` +
  `${timeLine(batch.startTime)}. Join from home, at your own pace, with corrections as we go.`;

// The question every new batch starts with: what a yoga teacher needs
// to know before someone's first class
export const HEALTH_QUESTIONS = [
  {
    id: 'q-health',
    text: 'Any injuries, surgeries or health conditions I should know about?',
    type: 'long',
    required: true,
    options: [],
  },
];

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

// Every class between two instants (ms), oldest first: [{ start, end, date }]
// start, end: ms. date: the class's day on the batch's own clock.
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
      if (end > fromMs && start < toMs) out.push({ start, end, date });
    }
    date = addDays(date, 1);
  }
  return out;
}

// The next classes from now (one on now comes first), up to count
export function nextClasses(batch, now = Date.now(), count = 6) {
  if (batch.days.length === 0) return [];
  // A week holds at least one class, so count weeks always hold count classes
  return classesBetween(batch, now, now + Math.ceil(count / batch.days.length + 1) * 7 * 1440 * MIN).slice(0, count);
}

// Every class of every batch in a window, for the 1:1 calls' booking
// times (one calendar: nobody can book a call during a class) and the
// "Your calendar" card: [{ start, end, batchId }]
export function allClassesBetween(fromMs, toMs, batches = loadBatches()) {
  return batches
    .flatMap((b) => classesBetween(b, fromMs, toMs).map((c) => ({ ...c, batchId: b.id })))
    .sort((a, b) => a.start - b.start);
}

// Where a class is, for its row and the Start button:
//   'live'  on now     'soon'  starts within 15 minutes     'later'
export function classState(c, now = Date.now()) {
  if (now >= c.start && now < c.end) return 'live';
  if (c.start - now <= 15 * MIN) return 'soon';
  return 'later';
}

// '2026-11-14' → 'Sat 14 Nov'; today and tomorrow in words
export function classDay(date, today) {
  if (date === today) return 'Today';
  if (date === addDays(today, 1)) return 'Tomorrow';
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