import { deleteRecording, onRecordingsChange, recordingOf } from './recordings';
import { funnelTypes } from './funnelTypes';
import { webinarWhen } from './webinar';
import { funnelName } from '../utils/funnelName';
import { coachZone, exactDay } from './buildBookingsJson';
import { zoned } from '../utils/slots';
import { deleteBlob, saveBlob } from './fileBlobs';

// ------------------------------------------------------------
// Cloud Storage: everything a coach keeps with us, and how much of their
// free space it uses. Every coach gets 20 GB free (FREE_BYTES).
//
// Two kinds of thing take up space:
//   recordings  their webinar sessions' Zoom recordings, once ready
//               (recordings.js). Counted from the moment one is ready to
//               watch: until then it's still with Zoom, not with us.
//   files       what they upload themselves: any file. Videos, documents
//               and images are known by their extension (FORMATS);
//               anything else (a ZIP, a Figma file…) is an "other" file.
//               Uploaded on Cloud
//               Storage or from a course's lesson (a lesson's upload is
//               stored here too, and counts like any file). Nothing about
//               storage is specific to webinars or courses.
//
// One asset, as the Cloud Storage tab lists it (assetsOf):
//   { id, kind: 'recording' | 'file' (where it came from),
//     type: 'video' | 'document' | 'image' | 'other' (what it is: a
//           recording is a video, listed and counted with the videos they
//           upload),
//     ext ('PDF', 'MP4'), name, bytes, at (ms, when it was added),
//     day ('Sat 7 Nov', when it was added),
//     webinarId, when ('Sat 7 Nov, 7:00 pm IST'), duration (ms)   recordings only }
//
// A recording's size is worked out from its length (sizeOfRecording),
// since the prototype has no video files: about 500 MB an hour, which is
// roughly what a 720p speaker-view recording comes to. In the real
// product the server stores each file's real size, and the coach's total,
// when it saves the file.
//
// Deleting frees the space at once. A deleted recording stays known to
// its session (recordings.js keeps when it was deleted), so the session's
// Recording tab can say it was deleted rather than that it never existed.
// A deleted file that a lesson used: the lesson says so (fileById → null).
//
// How full it is (levelOf):
//   'ok'      under 80%
//   'almost'  80% or more: warned on Cloud Storage, on "Ready to join?"
//             and once in the bell
//   'full'    20 GB or more: nothing new can be added. Uploads are
//             refused, and the box on "Ready to join?" is unticked and
//             locked. A recording already under way is always
//             kept, even if it takes them over: losing a session is worse
//             than going over. So `used` can be more than 20 GB, and
//             `over` says by how much.
//
// Prototype only: Pretend storage used (Prototype controls, at the bottom
// of Cloud Storage) makes everything act as if a share of the 20 GB is
// used, so the almost-full and full states can be seen. Saved in this
// browser so the meeting tab sees it too, until set back to Real.
//
// Sizes are shown in binary units (1 GB = 1024 MB), as phones and
// computers show them, so a file's size here matches what they see there.
// ------------------------------------------------------------

const KB = 1024;
const MB = 1024 * KB;
const GB = 1024 * MB;
const TB = 1024 * GB;

export const FREE_BYTES = 20 * GB;

// Roughly what an hour of 720p speaker-view recording takes
export const RECORDING_BYTES_PER_HOUR = 500 * MB;

// How big a recording of this length is (ms → bytes)
export const sizeOfRecording = (durationMs) =>
  Math.round((Math.max(0, durationMs) / 3_600_000) * RECORDING_BYTES_PER_HOUR);

// 512 → '512 bytes', 2_516_582 → '2.4 MB', 1_717_986_918 → '1.6 GB', 1024 GB → '1 TB'.
// GB always keep one decimal place (15.6 GB left, not 16), since a tenth
// of a GB is a good-sized file. MB and KB keep one under 10 and none
// above (12 MB, 480 MB), so the numbers stay short. Whole numbers drop
// the '.0' (20 GB, not 20.0 GB).
export function formatBytes(bytes) {
  const n = Math.max(0, Number(bytes) || 0);
  const [value, unit] =
    n >= TB ? [n / TB, 'TB'] : n >= GB ? [n / GB, 'GB'] : n >= MB ? [n / MB, 'MB'] : n >= KB ? [n / KB, 'KB'] : [n, 'bytes'];
  if (unit === 'bytes') return `${Math.round(value)} bytes`;
  const rounded = unit === 'GB' || unit === 'TB' || value < 10 ? Math.round(value * 10) / 10 : Math.round(value);
  // Rounding up to 1024 of a unit is one of the next: '1 MB', not '1024 KB'
  const next = { KB: 'MB', MB: 'GB', GB: 'TB' }[unit];
  if (rounded >= 1024 && next) return `1 ${next}`;
  return `${rounded} ${unit}`;
}

// The kinds a coach can filter by, in the order the filters and the
// meter show them. Each kind has one colour (CloudStoragePage.css), the
// same on its file icons, its filter and its part of the meter.
// label: the filter's words; one: how one of them reads ('Video')
export const ASSET_TYPES = [
  { id: 'video', label: 'Videos', one: 'Video' },
  { id: 'document', label: 'Documents', one: 'Document' },
  { id: 'image', label: 'Images', one: 'Image' },
  { id: 'other', label: 'Other files', one: 'File' },
];

export const typeOf = (id) => ASSET_TYPES.find((t) => t.id === id) ?? ASSET_TYPES[1];

// ---------- Files they keep with us ----------
// Kept in this browser for now: only each file's name, type and size,
// never the file itself (a browser can't hold gigabytes). In the real
// product the server keeps the file in storage and this list in the
// database.
//   { id, name, type: 'document' | 'image' | 'video' | 'other', ext, bytes, at (ms) }

const FILES_KEY = 'pagebuilder:cloud-files';
const PRETEND_KEY = 'pagebuilder:pretend-storage';
const SEEDED_KEY = 'pagebuilder:cloud-files-seeded';
const CHANGED_EVENT = 'cloud-storage-changed';

const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v);
const FILE_TYPES = ['document', 'image', 'video', 'other'];

function loadFiles() {
  try {
    const list = JSON.parse(localStorage.getItem(FILES_KEY) ?? '[]');
    return Array.isArray(list)
      ? list.filter(
          (f) =>
            isObject(f) &&
            typeof f.id === 'string' &&
            typeof f.name === 'string' &&
            FILE_TYPES.includes(f.type) &&
            Number.isFinite(f.bytes) &&
            Number.isFinite(f.at),
        )
      : [];
  } catch {
    return [];
  }
}

function saveFiles(list) {
  try {
    localStorage.setItem(FILES_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event(CHANGED_EVENT));
    return true;
  } catch {
    return false;
  }
}

// ---------- Everything stored ----------

const WEBINAR = funnelTypes.find((t) => t.id === 'webinar');

// 'Sat 7 Nov', on the coach's clock
const dayOf = (ms, zone) => exactDay(zoned(ms, zone).date);

// A stored file as an asset (as the tab lists it)
const fileAsset = (f, zone) => ({
  id: `file:${f.id}`,
  kind: 'file',
  type: f.type,
  name: f.name,
  ext: f.ext ?? null,
  bytes: f.bytes,
  at: f.at,
  day: dayOf(f.at, zone),
});

// Every asset, in no particular order (the tab sorts them).
// webinars: every webinar session (App's funnels of type 'webinar')
export function assetsOf({ webinars = [], now = Date.now() } = {}) {
  const zone = coachZone();

  const recordings = webinars
    .filter((w) => w?.publishedAt)
    .map((w) => ({ w, rec: recordingOf(w.id, now) }))
    .filter(({ rec }) => rec.status === 'ready')
    .map(({ w, rec }) => ({
      id: `recording:${w.id}`,
      kind: 'recording',
      type: 'video',
      ext: 'MP4', // what Zoom gives us
      name: funnelName(w, WEBINAR),
      bytes: sizeOfRecording(rec.duration),
      at: rec.readyAt,
      day: dayOf(rec.readyAt, zone),
      webinarId: w.id,
      when: webinarWhen(w.answers ?? {})?.line ?? null,
      duration: rec.duration,
    }));

  const files = loadFiles().map((f) => fileAsset(f, zone));

  return [...recordings, ...files];
}

// One uploaded file by its asset id ('file:f-…'), or null if it's gone
export function fileById(assetId) {
  const id = String(assetId ?? '').replace(/^file:/, '');
  const f = loadFiles().find((x) => x.id === id);
  return f ? fileAsset(f, coachZone()) : null;
}

// The share at which they're warned
export const ALMOST_FULL = 0.8;

// Where Upgrade plan goes, in a new tab: the plans page, a placeholder
// until plans are decided (PlansPage.jsx)
export const PLANS_HREF = '/?mock=plans';

// How full their storage is:
//   { used, free (FREE_BYTES), left, over (bytes past 20 GB, or 0),
//     share (0–1, of the free space), level: 'ok' | 'almost' | 'full',
//     byType: { video, document, image, other } (bytes; recordings are videos),
//     pretend: the pretend percent while one is on (Prototype controls),
//     else null }
// With a pretend percent, `used` is that share of 20 GB. The extra counts
// as video (what fills storage in real life), so the other kinds keep
// their real totals and still match the list.
export function usageOf(assets) {
  const byType = { video: 0, document: 0, image: 0, other: 0 };
  assets.forEach((a) => {
    byType[a.type] = (byType[a.type] ?? 0) + a.bytes;
  });
  const real = Object.values(byType).reduce((sum, n) => sum + n, 0);

  const pretend = pretendStorage();
  let used = real;
  if (pretend !== null) {
    used = Math.round((FREE_BYTES * pretend) / 100);
    if (used >= real) {
      byType.video += used - real;
    } else {
      // Pretending less than they really have: scale every kind down
      const scale = real > 0 ? used / real : 0;
      Object.keys(byType).forEach((k) => {
        byType[k] = Math.round(byType[k] * scale);
      });
    }
  }

  const share = Math.min(1, used / FREE_BYTES);
  return {
    used,
    free: FREE_BYTES,
    left: Math.max(0, FREE_BYTES - used),
    over: Math.max(0, used - FREE_BYTES),
    share,
    level: used >= FREE_BYTES ? 'full' : share >= ALMOST_FULL ? 'almost' : 'ok',
    byType,
    pretend,
  };
}

// ---------- Prototype only: pretend storage used ----------
// A percent of the 20 GB (85, 100, 105), or null for the real amount.
// at: when it was set (ms), for the bell's line

function loadPretend() {
  try {
    const raw = JSON.parse(localStorage.getItem(PRETEND_KEY) ?? 'null');
    return isObject(raw) && Number.isFinite(raw.percent) && Number.isFinite(raw.at) ? raw : null;
  } catch {
    return null;
  }
}

export const pretendStorage = () => loadPretend()?.percent ?? null;
export const pretendStorageSince = () => loadPretend()?.at ?? null;

export function setPretendStorage(percent, now = Date.now()) {
  try {
    if (percent === null) localStorage.removeItem(PRETEND_KEY);
    else localStorage.setItem(PRETEND_KEY, JSON.stringify({ percent, at: now }));
    window.dispatchEvent(new Event(CHANGED_EVENT));
  } catch {
    // Blocked storage: the pretend amount just doesn't apply
  }
}

// Deletes one asset for good. Returns true once it's gone.
export function deleteAsset(asset) {
  if (asset.kind === 'recording') return deleteRecording(asset.webinarId);
  const fileId = asset.id.replace(/^file:/, '');
  const gone = saveFiles(loadFiles().filter((f) => f.id !== fileId));
  if (gone) deleteBlob(fileId);
  return gone;
}

// Calls back when anything stored changes: a file deleted (here or in
// another tab), or a recording that started, stopped or was deleted
export function onStorageChange(callback) {
  const fromOtherTab = (e) => {
    if (e.key === FILES_KEY || e.key === PRETEND_KEY || e.key === null) callback();
  };
  window.addEventListener(CHANGED_EVENT, callback);
  window.addEventListener('storage', fromOtherTab);
  const stopRecordings = onRecordingsChange(callback);
  return () => {
    window.removeEventListener(CHANGED_EVENT, callback);
    window.removeEventListener('storage', fromOtherTab);
    stopRecordings();
  };
}

// ---------- Uploading ----------
// Any file can be uploaded. These extensions are known kinds (with the
// label their tile shows); anything else is an 'other' file, its tile
// labelled with its own extension (ZIP) or FILE when it has none.
export const FORMATS = {
  mp4: { type: 'video', ext: 'MP4' },
  mov: { type: 'video', ext: 'MOV' },
  pdf: { type: 'document', ext: 'PDF' },
  doc: { type: 'document', ext: 'DOC' },
  docx: { type: 'document', ext: 'DOCX' },
  ppt: { type: 'document', ext: 'PPT' },
  pptx: { type: 'document', ext: 'PPTX' },
  xls: { type: 'document', ext: 'XLS' },
  xlsx: { type: 'document', ext: 'XLSX' },
  jpg: { type: 'image', ext: 'JPG' },
  jpeg: { type: 'image', ext: 'JPG' },
  png: { type: 'image', ext: 'PNG' },
  webp: { type: 'image', ext: 'WEBP' },
  gif: { type: 'image', ext: 'GIF' },
};

// For the file picker: anything ('' lets the picker offer every file)
export const ACCEPT = '';

// 'Notes.PDF' → 'pdf'; 'README' → ''
export const extensionOf = (name) => {
  const m = String(name ?? '').match(/\.([^.]+)$/);
  return m ? m[1].toLowerCase() : '';
};

// A file's kind and tile label: a known one, else 'other' with its
// extension. Never null: any file can be uploaded.
export function formatOf(name) {
  const ext = extensionOf(name);
  return FORMATS[ext] ?? { type: 'other', ext: ext ? ext.toUpperCase().slice(0, 5) : 'FILE' };
}

// A name nothing stored has yet: 'checklist.pdf', then 'checklist (2).pdf'.
// taken: names also in use (files still uploading)
export function uniqueName(name, taken = []) {
  const used = new Set([...loadFiles().map((f) => f.name.toLowerCase()), ...taken.map((t) => t.toLowerCase())]);
  if (!used.has(name.toLowerCase())) return name;
  const dot = name.lastIndexOf('.');
  const [stem, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ''];
  for (let n = 2; ; n += 1) {
    const candidate = `${stem} (${n})${ext}`;
    if (!used.has(candidate.toLowerCase())) return candidate;
  }
}

// An upload finished: it's stored. Returns the stored file as an asset
// (as fileById gives it), or null if it couldn't be saved.
// blob: the file itself (a File from the picker). A PDF's is kept
// (fileBlobs.js), so a PDF lesson can be read in the player.
export function addFile({ name, bytes, blob = null }, now = Date.now()) {
  const format = formatOf(name);
  if (!format) return null;
  const file = {
    id: `f-${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name,
    type: format.type,
    ext: format.ext,
    bytes: Math.max(0, Math.round(bytes)),
    at: now,
  };
  if (!saveFiles([...loadFiles(), file])) return null;
  if (blob && file.ext === 'PDF') saveBlob(file.id, blob);
  return fileAsset(file, coachZone());
}

// ---------- Demo only ----------
// So the tab shows a realistic mix from the start, a coach's first visit
// adds these files, dated over the last few weeks. Deleting them works
// like any file. Remove the call in App.jsx for production.
const DAY = 86_400_000;
const DEMO_FILES = [
  { name: 'Course intro, week 1.mp4', type: 'video', ext: 'MP4', bytes: 2.3 * GB, daysAgo: 26 },
  { name: 'Welcome video for new clients.mp4', type: 'video', ext: 'MP4', bytes: 1.6 * GB, daysAgo: 19 },
  { name: 'Workshop slides, Fix the Vasthu mistakes.pdf', type: 'document', ext: 'PDF', bytes: 18.6 * MB, daysAgo: 12 },
  { name: 'Living room, before and after.jpg', type: 'image', ext: 'JPG', bytes: 4.1 * MB, daysAgo: 9 },
  { name: 'Vasthu home checklist.pdf', type: 'document', ext: 'PDF', bytes: 2.4 * MB, daysAgo: 6 },
  { name: 'Main door directions.png', type: 'image', ext: 'PNG', bytes: 1.2 * MB, daysAgo: 4 },
  { name: 'Client intake form.docx', type: 'document', ext: 'DOCX', bytes: 310 * KB, daysAgo: 2 },
];

export function seedDemoFiles(now = Date.now()) {
  try {
    if (localStorage.getItem(SEEDED_KEY)) return;
  } catch {
    return;
  }
  if (loadFiles().length === 0) {
    saveFiles(
      DEMO_FILES.map(({ daysAgo, bytes, ...f }, i) => ({
        ...f,
        id: `demo-${i + 1}`,
        bytes: Math.round(bytes),
        at: now - daysAgo * DAY,
      })),
    );
  }
  try {
    localStorage.setItem(SEEDED_KEY, '1');
  } catch {
    // fine: it seeds once more next time
  }
}