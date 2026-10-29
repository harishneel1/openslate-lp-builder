import { todayIn, zoned } from '../utils/slots';
import { coachZone } from './buildBookingsJson';
import { agoLabel } from './bookingUpdates';
import { funnelTypes } from './funnelTypes';
import { funnelName } from '../utils/funnelName';
import { recordingOf } from './recordings';
import { webinarWhen } from './webinar';

// ------------------------------------------------------------
// Recordings that are ready, for the bell in the top bar, next to the
// calls' updates and the webinar sign-ups (signupUpdates.js). Zoom
// finishes processing a recording a while after the meeting, when the
// coach has usually moved on, so the bell is where they hear about it.
//
//   (▶) Your recording is ready                       12 min ago
//       Webinar name, Sat 7 Nov, 7:00 pm IST
//
// One line per session, dated when the recording became ready. Built
// from the recordings themselves (recordings.js), so nothing new is
// stored. A click opens that session on its Recording tab.
// ------------------------------------------------------------

const DAYS_SHOWN = 30; // as the other updates
const MIN = 60_000;
const TYPE = funnelTypes.find((t) => t.id === 'webinar');

// ------------------------------------------------------------
// Every ready recording in the last 30 days, newest first, in the same
// shape as the other updates so the bell can mix them:
//   { key, kind: 'recording', at (ms, when it became ready), webinarId,
//     title (the webinar's name), when ('Sat 7 Nov, 7:00 pm IST'),
//     today (bool), unread (bool, against lastSeen), ago }
// ------------------------------------------------------------
export function buildRecordingUpdates({ webinars = [], lastSeen = 0, now = Date.now() }) {
  const zone = coachZone();
  const today = todayIn(zone, now);
  const since = now - DAYS_SHOWN * 1440 * MIN;
  const out = [];

  for (const w of webinars) {
    if (!w.publishedAt) continue;
    const rec = recordingOf(w.id, now);
    if (rec.status !== 'ready' || rec.readyAt < since) continue;
    out.push({
      key: `recording:${w.id}`,
      kind: 'recording',
      at: rec.readyAt,
      webinarId: w.id,
      title: funnelName(w, TYPE),
      when: webinarWhen(w.answers ?? {})?.line ?? '',
      today: zoned(rec.readyAt, zone).date === today,
    });
  }

  return out
    .sort((a, b) => b.at - a.at)
    .map((u) => ({ ...u, unread: u.at > lastSeen, ago: agoLabel(u.at, now, zone) }));
}