import { todayIn, zoned } from '../utils/slots';
import { coachZone } from './buildBookingsJson';
import { agoLabel } from './bookingUpdates';
import { funnelTypes } from './funnelTypes';
import { funnelName } from '../utils/funnelName';
import { peopleOf } from './webinarSignups';
import { webinarWhen } from './webinar';

// ------------------------------------------------------------
// Webinar sign-ups, for the bell in the top bar, next to the calls'
// updates (bookingUpdates.js). Built from the sign-ups themselves
// (webinarSignups.js), which record when each person registered, so
// nothing new is stored.
//
// Everyone who signed up for the same session on the same day (on the
// creator's clock) is one line, led by the newest of them:
//
//   (PR) Priya signed up                         12 min ago
//   (PR) Priya and Rahul signed up
//   (PR) Priya and 11 others signed up
//        Webinar name, Mon 9 Nov, 7:00 pm IST
//
// One line counts once in the bell's badge, however many people are in
// it. A line is new while its newest sign-up came after the creator last
// opened the bell, so one more person makes it new again.
//
// Only published sessions: drafts have nobody, and a deleted session
// takes its people with it (deleteSignupsOf).
// ------------------------------------------------------------

const DAYS_SHOWN = 30; // as the calls' updates
const MIN = 60_000;
const TYPE = funnelTypes.find((t) => t.id === 'webinar');

const firstName = (name) => String(name ?? '').trim().split(/\s+/)[0] || 'Someone';

// ------------------------------------------------------------
// Every sign-up line in the last 30 days, newest first, in the same
// shape as the calls' updates so the bell can mix them:
//   { key, kind: 'signups', at (ms, the newest sign-up), webinarId,
//     name (the newest person's full name, for the initials), first,
//     second (the other person's first name when there are exactly two),
//     others (how many besides the first, when there are three or more),
//     title (the webinar's name), when ('Mon 9 Nov, 7:00 pm IST'),
//     today (bool), unread (bool, against lastSeen), ago }
// ------------------------------------------------------------
export function buildSignupUpdates({ webinars = [], lastSeen = 0, now = Date.now() }) {
  const zone = coachZone();
  const today = todayIn(zone, now);
  const since = now - DAYS_SHOWN * 1440 * MIN;
  const out = [];

  for (const w of webinars) {
    if (!w.publishedAt) continue;
    const title = funnelName(w, TYPE);
    const when = webinarWhen(w.answers ?? {})?.line ?? '';

    // This session's people by the day they signed up; peopleOf is newest first,
    // so each day's list is too
    const byDay = new Map();
    for (const p of peopleOf(w.id)) {
      const ms = Number(p.registeredAt);
      if (!Number.isFinite(ms) || ms < since || ms > now + MIN) continue;
      const day = zoned(ms, zone).date;
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day).push(p);
    }

    for (const [day, people] of byDay) {
      const [newest, next] = people;
      out.push({
        key: `signups:${w.id}:${day}`,
        kind: 'signups',
        at: Number(newest.registeredAt),
        webinarId: w.id,
        name: newest.name || 'Someone',
        first: firstName(newest.name),
        second: people.length === 2 ? firstName(next.name) : null,
        others: people.length > 2 ? people.length - 1 : 0,
        title,
        when,
        today: day === today,
      });
    }
  }

  return out
    .sort((a, b) => b.at - a.at)
    .map((u) => ({ ...u, unread: u.at > lastSeen, ago: agoLabel(u.at, now, zone) }));
}