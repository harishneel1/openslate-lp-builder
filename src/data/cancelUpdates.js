import { todayIn, zoned } from '../utils/slots';
import { coachZone } from './buildBookingsJson';
import { agoLabel } from './bookingUpdates';
import { funnelTypes } from './funnelTypes';
import { funnelName } from '../utils/funnelName';
import { isCancelled, webinarWhen } from './webinar';

// ------------------------------------------------------------
// Cancelled sessions, for the bell in the top bar, next to the calls'
// updates, sign-ups and recordings. A record of what was done:
//
//   (✕) Session cancelled · 23 people emailed            Just now
//       Webinar name, Wed 11 Nov, 7:00 pm IST
//
// The coach cancelled it themselves, so it never counts as new: it
// doesn't add to the bell's count or make it ring. A click opens the
// session in its side panel.
// ------------------------------------------------------------

const DAYS_SHOWN = 30; // as the other updates
const MIN = 60_000;
const TYPE = funnelTypes.find((t) => t.id === 'webinar');

// ------------------------------------------------------------
// Every cancellation in the last 30 days, newest first, in the same shape
// as the other updates:
//   { key, kind: 'cancelled-session', at (ms), webinarId, title, when,
//     emailedTo, today (bool), unread: false, ago }
// ------------------------------------------------------------
export function buildCancelUpdates({ webinars = [], now = Date.now() }) {
  const zone = coachZone();
  const today = todayIn(zone, now);
  const since = now - DAYS_SHOWN * 1440 * MIN;

  return webinars
    .filter((w) => w.publishedAt && isCancelled(w) && w.cancelled.at >= since)
    .map((w) => ({
      key: `cancelled:${w.id}`,
      kind: 'cancelled-session',
      at: w.cancelled.at,
      webinarId: w.id,
      title: funnelName(w, TYPE),
      when: webinarWhen(w.answers ?? {})?.line ?? '',
      emailedTo: w.cancelled.emailedTo ?? 0,
      today: zoned(w.cancelled.at, zone).date === today,
      unread: false,
      ago: agoLabel(w.cancelled.at, now, zone),
    }))
    .sort((a, b) => b.at - a.at);
}