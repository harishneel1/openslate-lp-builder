import { meetingLinkMissing } from './thankYouQuestions';
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

// 'draft'    not published yet
// 'upcoming' published and not over (includes happening right now)
// 'past'     published and over
export function webinarStatus(webinar, now = Date.now()) {
  if (!webinar.publishedAt) return 'draft';
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

// What still needs doing before the session, for the list and overview
export function needsMeetingLink(webinar) {
  return (webinar.donePages ?? []).includes('thank-you') && meetingLinkMissing(webinar.answers ?? {});
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
// Sessions. A webinar keeps one landing page, one sign-up page and one
// link, and can run many times ("Run it again"). Its answers always
// hold the current session (date, time, meeting link); each earlier
// one is kept in `sessions`, newest first:
//   { id, date, time, timeZone, duration, meetingLink, pricing, price }
// Ads keep pointing at the same link, which always shows the next date.
// ------------------------------------------------------------

// The current session's details, frozen, for when it's run again
export function sessionOf(answers) {
  return {
    id: `session-${Date.now().toString(36)}`,
    date: answers.date ?? null,
    time: answers.time ?? null,
    timeZone: answers.timeZone ?? null,
    duration: answers.duration ?? null,
    meetingLink: answers.meetingLink ?? '',
    pricing: answers.pricing ?? null,
    price: answers.price ?? null,
  };
}

export const earlierSessions = (webinar) => (Array.isArray(webinar.sessions) ? webinar.sessions : []);

// Its current session is over and it hasn't been run again yet
export const hasEnded = (webinar, now = Date.now()) => webinarStatus(webinar, now) === 'past';

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