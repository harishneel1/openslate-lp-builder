import { todayIn, zoned } from '../utils/slots';
import { coachZone } from './buildBookingsJson';
import { agoLabel } from './bookingUpdates';
import { loadBatches, scheduleLine } from './batches';
import { allMembers } from './batchMembers';

// ------------------------------------------------------------
// People joining a batch, for the bell in the top bar, next to webinar
// sign-ups (signupUpdates.js) and in the same shape. Built from the
// members themselves (batchMembers.js), so nothing new is stored.
//
// Everyone who joined the same batch on the same day is one line, led
// by the newest of them:
//
//   (RK) Ravi joined                             12 min ago
//   (RK) Ravi and Priya joined
//   (RK) Ravi and 3 others joined
//        Morning Yoga, Mon–Sat · 6:30–7:30 am
//
// Clicking it opens the batch on its Members tab (onOpenBatch).
// ------------------------------------------------------------

const DAYS_SHOWN = 30; // as the other updates
const MIN = 60_000;

const firstName = (name) => String(name ?? '').trim().split(/\s+/)[0] || 'Someone';

// { key, kind: 'batch-joins', at, batchId, name, first, second, others,
//   title, when, today, unread, ago }
export function buildJoinUpdates({ lastSeen = 0, now = Date.now() }) {
  const zone = coachZone();
  const today = todayIn(zone, now);
  const since = now - DAYS_SHOWN * 1440 * MIN;
  const batches = loadBatches();
  const groups = new Map();

  for (const m of allMembers()) {
    if (!Number.isFinite(m.joinedAt) || m.joinedAt < since || m.joinedAt > now + MIN) continue;
    const batch = batches.find((b) => b.id === m.batchId);
    if (!batch) continue;
    const day = zoned(m.joinedAt, zone).date;
    const key = `batch-joins:${batch.id}:${day}`;
    if (!groups.has(key)) groups.set(key, { batch, day, people: [] });
    groups.get(key).people.push(m); // newest first, as allMembers is
  }

  return [...groups.entries()]
    .map(([key, { batch, day, people }]) => {
      const [newest, next] = people;
      return {
        key,
        kind: 'batch-joins',
        at: newest.joinedAt,
        batchId: batch.id,
        name: newest.name || 'Someone',
        first: firstName(newest.name),
        second: people.length === 2 ? firstName(next.name) : null,
        others: people.length > 2 ? people.length - 1 : 0,
        title: batch.title,
        when: scheduleLine(batch),
        today: day === today,
      };
    })
    .sort((a, b) => b.at - a.at)
    .map((u) => ({ ...u, unread: u.at > lastSeen, ago: agoLabel(u.at, now, zone) }));
}