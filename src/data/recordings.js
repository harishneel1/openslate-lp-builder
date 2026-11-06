// ------------------------------------------------------------
// Zoom recordings of webinar sessions. Before the coach goes into the
// meeting (the mock Zoom room, ZoomMeetingPage), a "Ready to join?"
// screen asks whether to record, ticked by default. Ticked, recording
// starts when they're in and stops when they end it; unticked, nothing
// is recorded. The choice is asked every time they join, starting from
// what they chose last time for that session (recordChoiceOf). Only the
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
//   deletedAt:  when the coach deleted it (ms); missing until then
//   pausedAt:   while they've paused it in the room: when (ms). Pausing
//               closes the segment and Resume opens a new one, so paused
//               time is never part of the recording (or its size).
//               Cleared on Resume, End and Rejoin.
//
// Where a recording is (recordingOf) is worked out from that and the
// clock, never stored:
//   'recording'   the coach is in the room now
//   'paused'      the coach is in the room, with the recording paused
//   'processing'  the meeting ended less than PROCESSING_MS ago
//   'ready'       it can be watched
//   'none'        nobody joined from OpenSlate, so nothing was recorded
//   'off'         they joined with recording turned off, and nothing was
//                 recorded (offAt: when they chose that); full: true when
//                 it was off because their storage was full
//   'deleted'     the coach deleted it (from Cloud Storage), at deletedAt
//
// Deleting keeps the record, marked with deletedAt, so the session can
// say its recording was deleted (and when) rather than that nothing was
// recorded. Its space comes back at once (data/cloudStorage.js only
// counts ready recordings).
// ------------------------------------------------------------

import { webinarEnd, webinarStart } from './webinar';

const KEY = 'pagebuilder:webinar-recordings';
const CHANGED_EVENT = 'webinar-recordings-changed';
const SEEDED_KEY = 'pagebuilder:webinar-recordings-seeded';

// What the coach last chose on "Ready to join?", per session:
//   { [webinarId]: { record: true | false, at (ms), full?: true } }
//   full: they wanted to record, but their storage was full, so it
//         couldn't. Not their choice: the box starts ticked next time.
// Kept apart from the recordings, since a choice can exist with nothing
// recorded (they turned it off).
const CHOICE_KEY = 'pagebuilder:webinar-record-choices';

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
  return {
    segments,
    lastSeenAt: Number.isFinite(r.lastSeenAt) ? r.lastSeenAt : segments[segments.length - 1].start,
    ...(Number.isFinite(r.deletedAt) ? { deletedAt: r.deletedAt } : {}),
    ...(Number.isFinite(r.pausedAt) ? { pausedAt: r.pausedAt } : {}),
  };
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

// The coach joined: recording starts (or carries on, after a quick Rejoin).
// merge: false for Resume, so even a pause of a few seconds is left out
export function startSegment(webinarId, now = Date.now(), { merge = true } = {}) {
  const all = loadAll();
  // Its recording was deleted and they've joined again: a new recording
  const record = all[webinarId] && !all[webinarId].deletedAt ? all[webinarId] : { segments: [], lastSeenAt: now };
  // Close a segment a closed tab left open
  const segments = record.segments.map((s) => ({ ...s, end: endOf(s, record, now) ?? s.end }));
  const last = segments[segments.length - 1];
  if (last && last.end === null) {
    // Already recording (another tab of the same room): nothing to start
  } else if (merge && last && now - last.end <= MERGE_MS) {
    last.end = null; // back within moments: the same segment
  } else {
    segments.push({ start: now, end: null });
  }
  all[webinarId] = { segments, lastSeenAt: now }; // no pausedAt: they're recording
  saveAll(all);
}

// Still in the room
export function heartbeat(webinarId, now = Date.now()) {
  const all = loadAll();
  if (!all[webinarId]) return;
  all[webinarId].lastSeenAt = now;
  saveAll(all, { quiet: true });
}

// The coach pressed End (or closed the tab): recording stops. Leaving
// while paused just ends the pause; the recording is already stopped.
export function endSegment(webinarId, now = Date.now()) {
  const all = loadAll();
  const record = all[webinarId];
  if (!record) return;
  const open = record.segments.find((s) => s.end === null);
  if (!open && !record.pausedAt) return;
  if (open) open.end = Math.max(open.start, now);
  delete record.pausedAt;
  record.lastSeenAt = now;
  saveAll(all);
}

// Pause recording, in the room: the segment so far is kept, and nothing
// is recorded until Resume
export function pauseRecording(webinarId, now = Date.now()) {
  const all = loadAll();
  const record = all[webinarId];
  const open = record?.segments.find((s) => s.end === null);
  if (!open) return;
  open.end = Math.max(open.start, now);
  record.pausedAt = now;
  record.lastSeenAt = now;
  saveAll(all);
}

// Resume recording: a new segment, part of the same recording
export function resumeRecording(webinarId, now = Date.now()) {
  startSegment(webinarId, now, { merge: false });
}

// ---------- Where a recording is ----------
// {
//   status:     'recording' | 'processing' | 'ready' | 'none'
//   startedAt:  when the first segment started (ms)
//   finishedAt: when the last one ended (ms), or null while recording
//   readyAt:    when it can be watched (ms), or null while recording
//   duration:   how long it is in all (ms), paused time left out; while
//               recording, so far
//   pausedAt:   when it was paused (ms), for 'paused' only
//   parts:      how many times they were in the room
//   deletedAt:  when it was deleted (ms), for 'deleted' only
// }
// or, with nothing recorded: { status: 'none' }, or
// { status: 'off', offAt } when they joined with recording turned off.
// Something recorded always wins: record, leave, then rejoin with it
// off, and the part that was recorded is still the recording.
export function recordingOf(webinarId, now = Date.now()) {
  const record = loadAll()[webinarId];
  if (!record) {
    const choice = loadChoices()[webinarId];
    return choice?.record === false
      ? { status: 'off', offAt: choice.at, full: choice.full === true }
      : { status: 'none' };
  }

  const spans = record.segments.map((s) => ({ start: s.start, end: endOf(s, record, now) }));
  const startedAt = Math.min(...spans.map((s) => s.start));
  const duration = spans.reduce((sum, s) => sum + Math.max(0, (s.end ?? now) - s.start), 0);
  const parts = spans.length;

  if (spans.some((s) => s.end === null)) {
    return { status: 'recording', startedAt, finishedAt: null, readyAt: null, duration, parts };
  }

  // Paused, and still in the room (a closed tab stops sending heartbeats,
  // so it counts as left: the recording then finishes as it stood)
  if (record.pausedAt && now - record.lastSeenAt <= STALE_MS) {
    return { status: 'paused', startedAt, finishedAt: null, readyAt: null, duration, parts, pausedAt: record.pausedAt };
  }

  const finishedAt = Math.max(...spans.map((s) => s.end));
  const readyAt = finishedAt + PROCESSING_MS;
  if (record.deletedAt) {
    return { status: 'deleted', startedAt, finishedAt, readyAt, duration, parts, deletedAt: record.deletedAt };
  }
  return { status: now < readyAt ? 'processing' : 'ready', startedAt, finishedAt, readyAt, duration, parts };
}

// The coach deleted the recording (Cloud Storage). Only a ready one can
// be: one still recording or processing isn't stored with us yet.
// Returns true once it's marked deleted.
export function deleteRecording(webinarId, now = Date.now()) {
  const all = loadAll();
  const record = all[webinarId];
  if (!record || record.deletedAt) return false;
  if (recordingOf(webinarId, now).status !== 'ready') return false;
  all[webinarId] = { ...record, deletedAt: now };
  return saveAll(all);
}

// A deleted session takes its recording with it
export function deleteRecordingsOf(webinarId) {
  const choices = loadChoices();
  if (choices[webinarId]) {
    delete choices[webinarId];
    try {
      localStorage.setItem(CHOICE_KEY, JSON.stringify(choices));
    } catch {
      // A leftover choice for a deleted session does no harm
    }
  }
  const all = loadAll();
  if (!all[webinarId]) return;
  delete all[webinarId];
  saveAll(all);
}

// ---------- Record or not ----------

function loadChoices() {
  try {
    const raw = JSON.parse(localStorage.getItem(CHOICE_KEY) ?? '{}');
    if (!isObject(raw)) return {};
    const out = {};
    Object.entries(raw).forEach(([id, c]) => {
      if (isObject(c) && typeof c.record === 'boolean' && Number.isFinite(c.at)) {
        out[id] = { record: c.record, at: c.at, ...(c.full === true ? { full: true } : {}) };
      }
    });
    return out;
  } catch {
    return {};
  }
}

// What they chose last time for this session: true, false, or null if
// they've never joined it, or it was only off because storage was full
// (the screen then starts ticked)
export function recordChoiceOf(webinarId) {
  const choice = loadChoices()[webinarId];
  if (!choice || choice.full) return null;
  return choice.record;
}

// Saved when they press Join meeting on "Ready to join?".
// full: they had it ticked, but storage was full, so it isn't recording
export function setRecordChoice(webinarId, record, now = Date.now(), { full = false } = {}) {
  const all = loadChoices();
  all[webinarId] = { record: Boolean(record), at: now, ...(full ? { full: true } : {}) };
  try {
    localStorage.setItem(CHOICE_KEY, JSON.stringify(all));
    window.dispatchEvent(new Event(CHANGED_EVENT));
    return true;
  } catch {
    return false;
  }
}

// Calls back when recordings (or the choice to record) change, here or
// in another tab (the Zoom room is a tab of its own)
export function onRecordingsChange(callback) {
  const fromOtherTab = (e) => {
    if (e.key === KEY || e.key === CHOICE_KEY || e.key === null) callback();
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