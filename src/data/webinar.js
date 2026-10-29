import { getService } from './mockServices';

// ------------------------------------------------------------
// A webinar, read from its saved record. The record is the one the
// Webinars tab keeps (App.jsx, utils/storage.js): its answers hold the
// date, time and price, so they're the one place those live. The
// landing page, the sign-up page (its contract), the list and, later,
// the schedule all read them from here.
// ------------------------------------------------------------

// The time zones the event details offer, as minutes ahead of UTC.
// Fixed offsets for now (no summer time); the real product will store
// an IANA zone instead.
const ZONE_OFFSETS = {
  IST: 330,
  'GST (Dubai)': 240,
  'GMT (London)': 0,
  'EST (New York)': -300,
};

// '30 min' → 30, '2 hours' → 120
export function durationMins(answers) {
  const raw = String(answers.duration ?? '').trim();
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return 60;
  return /hour/i.test(raw) ? n * 60 : n;
}

// When it starts, as a moment in time (ms), or null before a date is set
export function webinarStart(answers) {
  const date = String(answers.date ?? '');
  const time = String(answers.time ?? '19:00');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const offset = ZONE_OFFSETS[answers.timeZone] ?? ZONE_OFFSETS.IST;
  const utc = Date.parse(`${date}T${time}:00Z`);
  return Number.isFinite(utc) ? utc - offset * 60_000 : null;
}

export function webinarEnd(answers) {
  const start = webinarStart(answers);
  return start === null ? null : start + durationMins(answers) * 60_000;
}

// '19:00' → '7:00 pm'
function clock(time) {
  const [h, m] = String(time).split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return '';
  const suffix = h >= 12 ? 'pm' : 'am';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${suffix}`;
}

const zoneShort = (zone) => String(zone ?? 'IST').split(' ')[0];

// The date as the coach entered it, in their own time zone:
// { weekday: 'Sat', day: '7', month: 'Nov', line: 'Sat 7 Nov, 7:00 pm IST' }, or null
export function webinarWhen(answers) {
  const date = String(answers.date ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const weekday = d.toLocaleDateString('en-GB', { weekday: 'short' });
  const day = String(d.getDate());
  const month = d.toLocaleDateString('en-GB', { month: 'short' });
  const time = clock(answers.time ?? '19:00');
  return { weekday, day, month, line: `${weekday} ${day} ${month}, ${time} ${zoneShort(answers.timeZone)}` };
}

// '60 min', '2 hours': the coach's own words
export const lengthLabel = (answers) => String(answers.duration ?? '').trim() || null;

const rupees = (n) => `₹${Math.round(Number(n)).toLocaleString('en-IN')}`;

// { isFree, label: '₹499', was: '₹999' | null }
export function webinarPrice(answers) {
  if (answers.pricing !== 'Paid') return { isFree: true, label: 'Free', was: null };
  const price = Number(answers.price);
  if (!Number.isFinite(price) || price <= 0) return { isFree: false, label: 'Price not set', was: null };
  const old = Number(answers.oldPrice);
  return { isFree: false, label: rupees(price), was: Number.isFinite(old) && old > price ? rupees(old) : null };
}

// ------------------------------------------------------------
// Cancelling a session. A cancelled session stays as a record (its people,
// what was emailed, what was refunded) but it's over: it counts as 'past'
// everywhere (webinarStatus), so the link skips it, sign-ups and reminders
// stop, shared edits pass it by, and its Zoom meeting is closed.
//   cancelled: {
//     at:        when (ms)
//     emailedTo: how many people were sent the cancellation email
//     email:     { subject, body } as the coach sent it, or null
//     refund:    { count, total } refunded (rupees), or null (free, or not refunded)
//   }
// Only a session that hasn't started can be cancelled (canCancel): a live
// one is ended in Zoom instead. There's no undo.
// ------------------------------------------------------------

export const isCancelled = (webinar) => Number.isFinite(webinar?.cancelled?.at);

// Published, not cancelled, and not started yet (so never while it's live)
export function canCancel(webinar, now = Date.now()) {
  if (!webinar?.publishedAt || isCancelled(webinar)) return false;
  const start = webinarStart(webinar.answers ?? {});
  return start === null || now < start;
}

// 'draft'    not published yet
// 'upcoming' published and not over (includes happening right now)
// 'past'     published and over, or cancelled
export function webinarStatus(webinar, now = Date.now()) {
  if (!webinar.publishedAt) return 'draft';
  if (isCancelled(webinar)) return 'past';
  const end = webinarEnd(webinar.answers ?? {});
  return end !== null && end <= now ? 'past' : 'upcoming';
}

export function isOnNow(answers, now = Date.now()) {
  const start = webinarStart(answers);
  const end = webinarEnd(answers);
  return start !== null && start <= now && now < end;
}

// 'Starts today', 'Starts tomorrow', 'Starts in 5 days', 'Happening now'
export function startsIn(answers, now = Date.now()) {
  const start = webinarStart(answers);
  if (start === null) return null;
  if (isOnNow(answers, now)) return 'Happening now';
  const mins = Math.ceil((start - now) / 60_000);
  if (mins <= 60) return `Starts in ${mins} min`;
  const dayOf = (ms) => Math.floor(new Date(ms).setHours(0, 0, 0, 0) / 86_400_000);
  const days = dayOf(start) - dayOf(now);
  if (days <= 0) return 'Starts today';
  if (days === 1) return 'Starts tomorrow';
  return `Starts in ${days} days`;
}

// The contract a webinar made for itself (its sign-up page). Contracts
// picked by hand before sign-up pages were automatic aren't the webinar's
// own, so they're never changed from here.
export function ownContract(webinar) {
  const contract = getService(webinar.serviceId);
  return contract && contract.webinarId === webinar.id ? contract : null;
}

// What the webinar's own contract says, from its answers.
// The landing page's discounted price is what people pay; its regular
// price shows crossed out (in a contract: price, with discount = what they pay).
export function webinarContractFields(answers) {
  const title = String(answers.headline ?? '').trim() || 'Webinar';
  const description = String(answers.subheadline ?? '').trim();
  if (answers.pricing !== 'Paid') return { title, description, type: 'free', prices: [] };
  const pay = Math.max(0, Math.round(Number(answers.price) || 0));
  const old = Math.round(Number(answers.oldPrice) || 0);
  const prices = [old > pay ? { currency: 'INR', price: old, discount: pay } : { currency: 'INR', price: pay, discount: null }];
  return { title, description, type: pay > 0 ? 'onetime' : 'free', prices: pay > 0 ? prices : [] };
}

// The answers its contract is made from, as one string: when it changes,
// the contract needs saving again
export const contractKey = (answers) =>
  JSON.stringify([answers.headline, answers.subheadline, answers.pricing, answers.price, answers.oldPrice, answers.date]);

// ------------------------------------------------------------
// Running it again. Every run is its own webinar: "Run again on a new
// date" makes a full copy (App.jsx) with its own pages, sign-up page
// (contract), Zoom meeting and people, so changing one never touches
// another.
//
// All the runs of one webinar share a series (seriesId: the first run's
// id) and one link. The link (liveHref, utils/publish.js) names the
// series, not a run, and opens whichever run is current (currentRun):
// the one on right now, else the soonest still to come, else the latest
// that's over. So the link a coach posted on Instagram or in a WhatsApp
// group keeps working, run after run.
//
// copiedFrom (the run it was copied from) is kept as history only;
// nothing depends on it, so deleting a run in the middle breaks nothing.
// ------------------------------------------------------------

const isRecord = (w) => w && typeof w === 'object' && typeof w.id === 'string';

// The series a webinar belongs to. Saves from before series existed have
// no seriesId: the first run up its copiedFrom chain stands in (or, when
// that one was deleted, the id it was copied from).
export function seriesIdOf(webinar, all = []) {
  if (typeof webinar?.seriesId === 'string' && webinar.seriesId) return webinar.seriesId;
  const byId = new Map(all.filter(isRecord).map((w) => [w.id, w]));
  const seen = new Set();
  let cur = webinar;
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    if (typeof cur.seriesId === 'string' && cur.seriesId) return cur.seriesId;
    if (typeof cur.copiedFrom !== 'string' || !cur.copiedFrom) return cur.id;
    const parent = byId.get(cur.copiedFrom);
    if (!parent) return cur.copiedFrom;
    cur = parent;
  }
  return webinar.id;
}

// The same list with every seriesId filled in (for older saves)
export const withSeriesIds = (all) =>
  all.map((w) => (isRecord(w) && !w.seriesId ? { ...w, seriesId: seriesIdOf(w, all) } : w));

// Every published run in this webinar's series, this one included
function publishedRuns(webinar, all) {
  const series = seriesIdOf(webinar, all);
  return all.filter((w) => isRecord(w) && w.publishedAt && seriesIdOf(w, all) === series);
}

// Start times, with a run that has no date yet sorting last
const startOf = (w) => webinarStart(w.answers ?? {}) ?? Infinity;

// The run a link opens. linkId is a seriesId, or any run's id (older
// links, and places that only know a run). Picks, among its published runs:
//   1. the one on right now
//   2. else the soonest one still to come
//   3. else the latest one that's over (its page says it has ended)
// Cancelled runs are skipped: they're never on now or to come, and an
// ended run is shown before a cancelled one. Only when every run was
// cancelled does the link open the latest of them (its page says so).
// With nothing published yet, the run itself (the coach previewing).
// null when there's no such webinar any more.
export function currentRun(linkId, all, now = Date.now()) {
  const list = all.filter(isRecord);
  const anchor = list.find((w) => w.id === linkId) ?? list.find((w) => seriesIdOf(w, list) === linkId);
  if (!anchor) return null;
  const runs = publishedRuns(anchor, list);
  if (runs.length === 0) return anchor;
  const live = runs.find((w) => !isCancelled(w) && isOnNow(w.answers ?? {}, now));
  if (live) return live;
  const toCome = runs.filter((w) => webinarStatus(w, now) === 'upcoming').sort((a, b) => startOf(a) - startOf(b));
  if (toCome.length > 0) return toCome[0];
  const held = runs.filter((w) => !isCancelled(w));
  return [...(held.length > 0 ? held : runs)].sort((a, b) => startOf(b) - startOf(a))[0];
}

// Where the main landing page link would go if this run were cancelled:
// the run it would open without this one, when that's still to come;
// null when there's none (the link then says the webinar has ended)
export function linkAfterCancel(webinar, all, now = Date.now()) {
  const list = all.filter(isRecord);
  const others = list.filter((w) => w.id !== webinar.id);
  const run = currentRun(seriesIdOf(webinar, list), others, now);
  return run && webinarStatus(run, now) === 'upcoming' ? run : null;
}

// The other runs in this webinar's series that start after it, published
// ones only, latest date first
export function laterRuns(webinar, all, now = Date.now()) {
  const mine = startOf(webinar);
  return publishedRuns(webinar, all)
    .filter((w) => w.id !== webinar.id && startOf(w) > mine)
    .sort((a, b) => startOf(b) - startOf(a))
    .map((w) => ({ webinar: w, upcoming: webinarStatus(w, now) === 'upcoming' }));
}

// The run people should go to instead of this one: the soonest later run
// that's still to come (the same one its link opens), or null
export function nextOpenRun(webinar, all, now = Date.now()) {
  const open = laterRuns(webinar, all, now).filter((r) => r.upcoming);
  return open.length > 0 ? open[open.length - 1].webinar : null;
}

// The series a webinar's address opens (localhost:5173/<slug>), or null.
// Every session of a webinar shares its slug, so any of them will do.
export function seriesBySlug(slug, all) {
  const want = String(slug ?? '').toLowerCase();
  if (!want) return null;
  const list = all.filter(isRecord);
  const found = list.find((w) => w.publishedAt && typeof w.slug === 'string' && w.slug.toLowerCase() === want);
  return found ? seriesIdOf(found, list) : null;
}

// Every published run of this webinar (its dates), earliest first. Used
// for the Webinars list (one row per webinar) and the Dates on its page.
export function runsOf(webinar, all) {
  return publishedRuns(webinar, all).sort((a, b) => startOf(a) - startOf(b));
}

// ------------------------------------------------------------
// One set of pages, price and emails. Each session keeps its own copy
// (so a past session stays a true record of what people saw and got),
// but a change made on one goes to every session still to come: the
// coach edits once. What stays each session's own: its date, time and
// time zone (SESSION_KEYS), its Zoom meeting, its people and its sign-up
// page record (contract), which App re-saves from the shared answers.
// ------------------------------------------------------------

export const SESSION_KEYS = ['date', 'time', 'timeZone'];

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// What changed between two versions of one session that the others share,
// or null when nothing did:
//   { set: { headline: '…' }, unset: ['oldPrice'], themeId?, donePages?, reminders? }
export function sharedChanges(before, after) {
  const a = before.answers ?? {};
  const b = after.answers ?? {};
  const set = {};
  const unset = [];
  new Set([...Object.keys(a), ...Object.keys(b)]).forEach((key) => {
    if (SESSION_KEYS.includes(key) || same(a[key], b[key])) return;
    if (key in b) set[key] = b[key];
    else unset.push(key);
  });
  const out = { set, unset };
  ['themeId', 'donePages', 'reminders'].forEach((key) => {
    if (!same(before[key], after[key])) out[key] = after[key];
  });
  const any = Object.keys(set).length > 0 || unset.length > 0 || Object.keys(out).length > 2;
  return any ? out : null;
}

// The list with `after` (a new version of one session) in place, and what
// changed in it copied to every other session of its webinar that's
// still to come. Drafts and cancelled sessions pass nothing on; past and
// cancelled sessions take nothing in.
export function withSharedChanges(list, before, after, now = Date.now()) {
  const placed = list.map((f) => (f.id === after.id ? after : f));
  if (!after.publishedAt || isCancelled(after)) return placed;
  const change = sharedChanges(before, after);
  if (!change) return placed;
  const series = seriesIdOf(after, placed);
  return placed.map((f) => {
    if (f.id === after.id || !isRecord(f) || !f.publishedAt) return f;
    if (seriesIdOf(f, placed) !== series || webinarStatus(f, now) === 'past') return f;
    const answers = { ...(f.answers ?? {}), ...change.set };
    change.unset.forEach((key) => delete answers[key]);
    const next = { ...f, answers, updatedAt: after.updatedAt ?? f.updatedAt };
    ['themeId', 'donePages', 'reminders'].forEach((key) => {
      if (key in change) next[key] = change[key];
    });
    return next;
  });
}

// The other sessions of this webinar still to come (they get its changes)
export const upcomingSiblings = (webinar, all, now = Date.now()) =>
  publishedRuns(webinar, all).filter((w) => w.id !== webinar.id && webinarStatus(w, now) !== 'past');

// Other published runs share this one's link: deleting it leaves the link working
export const sharesLink = (webinar, all) => publishedRuns(webinar, all).some((w) => w.id !== webinar.id);

// From 15 minutes before it starts until it ends, the coach can start it from here
export function canStart(answers, now = Date.now()) {
  const start = webinarStart(answers);
  const end = webinarEnd(answers);
  return start !== null && start - 15 * 60_000 <= now && now < end;
}

// The new session's suggested date: a week after this one, moved on a
// week at a time until it's in the future (same weekday, same time)
export function nextDateFor(answers, now = Date.now()) {
  const start = webinarStart(answers);
  const pad = (n) => String(n).padStart(2, '0');
  const asDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (start === null) {
    const d = new Date(now + 7 * 86_400_000);
    return asDate(d);
  }
  const base = new Date(`${answers.date}T00:00:00`);
  let weeks = 1;
  while (start + weeks * 7 * 86_400_000 <= now) weeks += 1;
  base.setDate(base.getDate() + weeks * 7);
  return asDate(base);
}

// Would a session on this date and time (in the webinar's own time zone) still be to come?
export function isFuture(answers, date, time, now = Date.now()) {
  const start = webinarStart({ ...answers, date, time });
  return start !== null && start > now;
}

// ------------------------------------------------------------
// The meeting. Zoom comes built in: every webinar gets its own Zoom
// meeting when it's made (a copy made with Run again gets its own), so there's
// always a link and the coach never pastes one. For now that meeting is
// a mock room in this app (?mock=zoom&webinar=<id>, ZoomMeetingPage).
// ------------------------------------------------------------

// The webinar's Zoom meeting ID, made from its id so it never changes:
// '845 2193 0761'
export function zoomMeetingId(webinarId) {
  let h = 2166136261;
  for (const ch of String(webinarId)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const digits = `8${String(h).padStart(10, '0')}`.slice(0, 11);
  return `${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7)}`;
}

// Where the coach's meeting button goes (opens in a new tab)
export const meetingHref = (webinarId) => `?mock=zoom&webinar=${encodeURIComponent(webinarId)}`;

// What the meeting button says, for a webinar that's coming up:
//   'join'  more than 15 minutes away: "Join meeting" (check the room early)
//   'start' from 15 minutes before: "Start webinar"
//   'live'  while it's on: "Live now"
export function meetingState(answers, now = Date.now()) {
  if (isOnNow(answers, now)) return 'live';
  if (canStart(answers, now)) return 'start';
  return 'join';
}