import { toInstant, todayIn, zoned } from '../utils/slots';
import { appNow } from '../utils/testClock';
import { coachZone } from './buildBookingsJson';
import { agoLabel } from './bookingUpdates';
import { loadBatches, scheduleLine } from './batches';
import { allMembers, membersOf, pendingLine } from './batchMembers';

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

  for (const m of allMembers(zone, now)) {
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

// ------------------------------------------------------------
// Fees that need the coach today, one line per batch, for the bell:
//
//   (₹) 2 payments pending (1 for over 5 days)            Today
//       Morning Yoga
//
// Counts members who haven't paid yet: due today or late, and how many
// of those are over 5 days late (batchMembers.js). Nothing is sent by
// the product, so this is the coach's nudge to remind or remove. It's new once a day (dated
// the start of today), and clicking it opens the batch's Members tab.
// The date is appNow(), so ?today= shows it too.
//
// → [{ key, kind: 'batch-dues', at, batchId, title, line, today: true, unread, ago }]
// ------------------------------------------------------------
export function buildDueUpdates({ lastSeen = 0 }) {
  const now = appNow();
  const zone = coachZone();
  const at = toInstant(todayIn(zone, now), '00:00', zone);
  return loadBatches()
    .map((batch) => {
      const members = membersOf(batch, now);
      const pending = members.filter((m) => ['today', 'overdue', 'past-grace'].includes(m.status)).length;
      const late = members.filter((m) => m.status === 'past-grace').length;
      return { batch, pending, late };
    })
    .filter(({ pending }) => pending > 0)
    .map(({ batch, pending, late }) => ({
      key: `batch-dues:${batch.id}:${at}`,
      kind: 'batch-dues',
      at,
      batchId: batch.id,
      title: batch.title,
      when: '',
      line: pendingLine({ pending, late }),
      today: true,
      unread: at > lastSeen,
      ago: 'Today',
    }));
}

// ------------------------------------------------------------
// Someone removed who paid their payment link (or joined again) and is
// back in the batch, for the bell. One line each:
//
//   (MK) Meena rejoined                                   12 min ago
//        Morning Yoga, Mon–Sat · 6:30–7:30 am
//
// Coming back by the coach's own Restore isn't here: they did that.
// → [{ key, kind: 'batch-rejoins', at, batchId, name, first, title, when, today, unread, ago }]
// ------------------------------------------------------------
export function buildRejoinUpdates({ lastSeen = 0, now = Date.now() }) {
  const zone = coachZone();
  const today = todayIn(zone, now);
  const since = now - DAYS_SHOWN * 1440 * MIN;
  const batches = loadBatches();
  const out = [];
  for (const m of allMembers(zone, now)) {
    const batch = batches.find((b) => b.id === m.batchId);
    if (!batch) continue;
    for (const p of m.payments) {
      if (p.method !== 'rejoin' || p.at < since || p.at > now + MIN) continue;
      out.push({
        key: `batch-rejoins:${m.id}:${p.at}`,
        kind: 'batch-rejoins',
        at: p.at,
        batchId: batch.id,
        name: m.name || 'Someone',
        first: firstName(m.name),
        second: null,
        others: 0,
        title: batch.title,
        when: scheduleLine(batch),
        today: zoned(p.at, zone).date === today,
      });
    }
  }
  return out.sort((a, b) => b.at - a.at).map((u) => ({ ...u, unread: u.at > lastSeen, ago: agoLabel(u.at, now, zone) }));
}