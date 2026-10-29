// ------------------------------------------------------------
// Zoom recordings of webinar sessions. Recording is on by default:
// it starts when the coach joins the meeting from OpenSlate (the mock
// Zoom room, ZoomMeetingPage) and stops when they end it. Only the
// coach sees a recording; nothing here is shown to the people who
// signed up.
//
// Kept in this browser for now (localStorage), like the sign-ups
// (webinarSignups.js). In the real product Zoom records in the cloud
// (the meeting is made with auto-recording on), tells the server when
// the file is ready (its "recording completed" webhook), and the server
// copies it to our own storage.
//
// One record per session (webinar id):
//   { segments: [{ start, end }], lastSeenAt }
//   segments:   one per time in the room. End then Rejoin adds another;
//               Zoom keeps them as parts of one recording.
//               end is null while the coach is still in the room.
//   lastSeenAt: the room's last heartbeat (ms). A tab closed without
//               End leaves its segment open; it counts as ended here.
//
// Where a recording is (recordingOf) is worked out from that and the
// clock, never stored:
//   'recording'   the coach is in the room now
//   'processing'  the meeting ended less than PROCESSING_MS ago
//   'ready'       it can be watched
//   'none'        nobody joined from OpenSlate, so nothing was recorded
// ------------------------------------------------------------

import { webinarEnd, webinarStart } from './webinar';

const KEY = 'pagebuilder:webinar-recordings';
const CHANGED_EVENT = 'webinar-recordings-changed';
const SEEDED_KEY = 'pagebuilder:webinar-recordings-seeded';

// How long Zoom takes to process a recording after the meeting ends.
// Short in the prototype so the whole cycle can be seen; in the real
// product the webhook decides.
export const PROCESSING_MS = 2 * 60_000;

// How often the open room says it's still there
export const HEARTBEAT_MS = 20_000;

// An open segment with no heartbeat for this long: the tab was closed
const STALE_MS = 60_000;

// End then Rejoin within this long continues the same segment (and
// covers React running effects twice in development)
const MERGE_MS = 5_000;

const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v);

function cleanRecord(r) {
  if (!isObject(r) || !Array.isArray(r.segments)) return null;
  const segments = r.segments
    .filter((s) => isObject(s) && Number.isFinite(s.start))
    .map((s) => ({ start: s.start, end: Number.isFinite(s.end) ? s.end : null }));
  if (segments.length === 0) return null;
  return { segments, lastSeenAt: Number.isFinite(r.lastSeenAt) ? r.lastSeenAt : segments[segments.length - 1].start };
}

function loadAll() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    if (!isObject(raw)) return {};
    const out = {};
    Object.entries(raw).forEach(([id, r]) => {
      const clean = cleanRecord(r);
      if (clean) out[id] = clean;
    });
    return out;
  } catch {
    return {};
  }
}

// quiet: a heartbeat, which changes nothing anyone sees here, so this tab
// isn't told (other tabs still hear it through the storage event)
function saveAll(all, { quiet = false } = {}) {
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
    if (!quiet) window.dispatchEvent(new Event(CHANGED_EVENT));
    return true;
  } catch {
    return false;
  }
}

// A segment's end, counting a closed tab (no heartbeat) as its last heartbeat
function endOf(segment, record, now) {
  if (segment.end !== null) return segment.end;
  return now - record.lastSeenAt > STALE_MS ? record.lastSeenAt : null;
}

// ---------- The Zoom room ----------

// The coach joined: recording starts (or carries on, after a quick Rejoin)
export function startSegment(webinarId, now = Date.now()) {
  const all = loadAll();
  const record = all[webinarId] ?? { segments: [], lastSeenAt: now };
  // Close a segment a closed tab left open
  const segments = record.segments.map((s) => ({ ...s, end: endOf(s, record, now) ?? s.end }));
  const last = segments[segments.length - 1];
  if (last && last.end === null) {
    // Already recording (another tab of the same room): nothing to start
  } else if (last && now - last.end <= MERGE_MS) {
    last.end = null; // back within moments: the same segment
  } else {
    segments.push({ start: now, end: null });
  }
  all[webinarId] = { segments, lastSeenAt: now };
  saveAll(all);
}

// Still in the room
export function heartbeat(webinarId, now = Date.now()) {
  const all = loadAll();
  if (!all[webinarId]) return;
  all[webinarId].lastSeenAt = now;
  saveAll(all, { quiet: true });
}

// The coach pressed End (or closed the tab): recording stops
export function endSegment(webinarId, now = Date.now()) {
  const all = loadAll();
  const record = all[webinarId];
  if (!record) return;
  const open = record.segments.find((s) => s.end === null);
  if (!open) return;
  open.end = Math.max(open.start, now);
  record.lastSeenAt = now;
  saveAll(all);
}

// ---------- Where a recording is ----------
// {
//   status:     'recording' | 'processing' | 'ready' | 'none'
//   startedAt:  when the first segment started (ms)
//   finishedAt: when the last one ended (ms), or null while recording
//   readyAt:    when it can be watched (ms), or null while recording
//   duration:   how long it is in all (ms); while recording, so far
//   parts:      how many times they were in the room
// }
export function recordingOf(webinarId, now = Date.now()) {
  const record = loadAll()[webinarId];
  if (!record) return { status: 'none' };

  const spans = record.segments.map((s) => ({ start: s.start, end: endOf(s, record, now) }));
  const startedAt = Math.min(...spans.map((s) => s.start));
  const duration = spans.reduce((sum, s) => sum + Math.max(0, (s.end ?? now) - s.start), 0);
  const parts = spans.length;

  if (spans.some((s) => s.end === null)) {
    return { status: 'recording', startedAt, finishedAt: null, readyAt: null, duration, parts };
  }

  const finishedAt = Math.max(...spans.map((s) => s.end));
  const readyAt = finishedAt + PROCESSING_MS;
  return { status: now < readyAt ? 'processing' : 'ready', startedAt, finishedAt, readyAt, duration, parts };
}

// A deleted session takes its recording with it
export function deleteRecordingsOf(webinarId) {
  const all = loadAll();
  if (!all[webinarId]) return;
  delete all[webinarId];
  saveAll(all);
}

// Calls back when recordings change, here or in another tab (the Zoom
// room is a tab of its own)
export function onRecordingsChange(callback) {
  const fromOtherTab = (e) => {
    if (e.key === KEY || e.key === null) callback();
  };
  window.addEventListener(CHANGED_EVENT, callback);
  window.addEventListener('storage', fromOtherTab);
  return () => {
    window.removeEventListener(CHANGED_EVENT, callback);
    window.removeEventListener('storage', fromOtherTab);
  };
}

// ---------- Demo only ----------
// So the Recording tab can be seen without sitting through a meeting:
// once, the latest session that has ended (and has no recording) gets a
// ready one, as if the coach ran it from OpenSlate. Every other ended
// session stays unrecorded, which shows that state too.
// Remove the call in App.jsx when this goes to production.
export function seedDemoRecordings(webinars = [], now = Date.now()) {
  try {
    if (localStorage.getItem(SEEDED_KEY)) return;
  } catch {
    return;
  }
  const latestEnded = webinars
    .filter((w) => w.publishedAt)
    .map((w) => ({ w, start: webinarStart(w.answers ?? {}), end: webinarEnd(w.answers ?? {}) }))
    .filter(({ start, end }) => start !== null && end !== null && end <= now)
    .sort((a, b) => b.start - a.start)[0];
  if (!latestEnded) return; // nothing has ended yet: try again next time

  const all = loadAll();
  if (!all[latestEnded.w.id]) {
    const start = latestEnded.start + 2 * 60_000; // joined two minutes late
    const end = start + 58 * 60_000 + 30_000;
    all[latestEnded.w.id] = { segments: [{ start, end }], lastSeenAt: end };
    saveAll(all);
  }
  try {
    localStorage.setItem(SEEDED_KEY, '1');
  } catch {
    // fine: it seeds once more next time
  }
}