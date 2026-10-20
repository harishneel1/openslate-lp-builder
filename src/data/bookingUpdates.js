import { formatTime, todayIn, zoned, addDays } from '../utils/slots';
import { coachZone, exactDay } from './buildBookingsJson';

// ------------------------------------------------------------
// What students did with the creator's calls, for the bell in the
// top bar: booked, rescheduled, cancelled. Built from the bookings
// themselves (bookingsStore.js), which already record when each
// change happened and who made it, so nothing new is stored except
// when the creator last opened the bell.
//
// The creator's own changes are left out: they know what they did.
// A booking can give up to three updates (booked, rescheduled,
// cancelled); a call moved twice shows its latest move.
//
// Times are on the creator's clock, like the Bookings page.
// ------------------------------------------------------------

const SEEN_KEY = 'pagebuilder:updates-seen-at';
const DAYS_SHOWN = 30;
const MIN = 60_000;

// When the creator last opened the bell (ms), or 0 if never
export function loadLastSeen() {
  try {
    return Number(localStorage.getItem(SEEN_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function saveLastSeen(ms = Date.now()) {
  try {
    localStorage.setItem(SEEN_KEY, String(ms));
  } catch {
    // Not saved: the dot comes back on reload, nothing worse
  }
}

const firstName = (name) => String(name ?? '').trim().split(/\s+/)[0] || 'A student';

// An instant on the creator's clock: 'Wed 21 Oct, 10:00 am'
const at = (ms, zone) => `${exactDay(zoned(ms, zone).date)}, ${formatTime(ms, zone)}`;

// How long ago, short: 'Just now', '12 min ago', '3 hr ago', 'Yesterday', 'Mon 19 Oct'
export function agoLabel(ms, now, zone) {
  const mins = Math.floor((now - ms) / MIN);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const date = zoned(ms, zone).date;
  const today = todayIn(zone, now);
  if (date === today) return `${Math.floor(mins / 60)} hr ago`;
  if (date === addDays(today, -1)) return 'Yesterday';
  return exactDay(date);
}

// ------------------------------------------------------------
// Every update in the last 30 days, newest first:
//   { key, kind: 'booked' | 'rescheduled' | 'cancelled', at (ms), bookingId,
//     name (their full name), first, title, when ('Wed 21 Oct, 10:00 am'),
//     was (rescheduled: the old time), reason (cancelled: their words or ''),
//     today (bool), unread (bool, against lastSeen) }
// ------------------------------------------------------------
export function buildUpdates({ bookings, lastSeen = 0, now = Date.now() }) {
  const zone = coachZone();
  const today = todayIn(zone, now);
  const since = now - DAYS_SHOWN * 1440 * MIN;
  const out = [];

  for (const b of bookings) {
    const name = b.guest?.name || 'A student';
    const common = { bookingId: b.id, name, first: firstName(name), title: b.title || 'Call' };
    const startMs = Date.parse(b.start);
    const push = (kind, iso, extra) => {
      const ms = Date.parse(iso);
      if (!Number.isFinite(ms) || ms < since || ms > now + MIN) return;
      out.push({ key: `${b.id}:${kind}`, kind, at: ms, ...common, ...extra });
    };

    // Booked: always the student. Shows the time they first picked.
    push('booked', b.createdAt, { when: at(Date.parse(b.previousStart ?? b.start), zone) });

    if (b.previousStart && b.rescheduledBy === 'guest') {
      push('rescheduled', b.rescheduledAt, { when: at(startMs, zone), was: at(Date.parse(b.previousStart), zone) });
    }

    if (b.status === 'cancelled' && b.cancelledBy === 'guest') {
      push('cancelled', b.cancelledAt, { when: at(startMs, zone), reason: b.cancelMessage ?? '' });
    }
  }

  return out
    .sort((a, b) => b.at - a.at)
    .map((u) => ({ ...u, today: zoned(u.at, zone).date === today, unread: u.at > lastSeen, ago: agoLabel(u.at, now, zone) }));
}