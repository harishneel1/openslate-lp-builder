import { todayIn, zoned } from '../utils/slots';
import { coachZone } from './buildBookingsJson';
import { agoLabel } from './bookingUpdates';
import { FREE_BYTES, assetsOf, formatBytes, pretendStorageSince, usageOf } from './cloudStorage';

// ------------------------------------------------------------
// Cloud Storage running out, for the bell (UpdatesBell.jsx): one line
// while they're almost full or full, so they hear about it in time.
//
//   (!) Your storage is almost full                    2 hr ago
//       17 GB of 20 GB used
//   (!) Your storage is full                           12 min ago
//       21 GB of 20 GB used
//
// Just how full: storage is shared by everything they keep with us
// (recordings, uploads, courses later), so it doesn't single any out.
//
// Worked out from what's stored now (data/cloudStorage.js), so nothing
// new is saved, and the line goes as soon as they free up space. It's
// dated when the newest thing stored was added, which is what took them
// there (or, while pretending, when the pretend amount was set), so it
// counts as new once, like the other lines. A click opens Cloud Storage.
// ------------------------------------------------------------

// webinars: every webinar session (their recordings count)
export function buildStorageUpdates({ webinars = [], lastSeen = 0, now = Date.now() }) {
  const assets = assetsOf({ webinars, now });
  const usage = usageOf(assets);
  if (usage.level === 'ok') return [];

  const newest = assets.reduce((latest, a) => Math.max(latest, a.at), 0);
  const at = Math.min(now, usage.pretend !== null ? (pretendStorageSince() ?? now) : newest || now);
  const zone = coachZone();
  const full = usage.level === 'full';

  return [
    {
      key: `storage:${usage.level}`,
      kind: 'storage',
      at,
      level: usage.level,
      line: full ? 'Your storage is full' : 'Your storage is almost full',
      detail: `${formatBytes(usage.used)} of ${formatBytes(FREE_BYTES)} used`,
      today: zoned(at, zone).date === todayIn(zone, now),
      unread: at > lastSeen,
      ago: agoLabel(at, now, zone),
    },
  ];
}