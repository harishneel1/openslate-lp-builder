import { readLink, readVideoLink } from './courses';

// ------------------------------------------------------------
// The parts of a course added in Round 3, kept here so courses.js only
// needs a few lines to save them (updateCourse):
//
//   coverVideo   the cover as a video instead of an image:
//                  null
//                  { kind: 'embed', url, provider: 'youtube' | 'vimeo' }
//                  { kind: 'video', fileId ('file:f-…'), name, ext, bytes }
//                With a video, the course's image cover (course.cover) is
//                its thumbnail: shown on cards and before it plays.
//   duration     how long it takes: null | { amount, unit: 'hours' | 'days' | 'weeks' }
//   trackRecord  the coach's own numbers, from any platform:
//                  { students, rating, source, on }
//                Shown on the landing page only once `on` is true (the
//                coach turns it on). Until it's saved, the fields start
//                from TRACK_DEFAULTS, which the coach can change.
//
// coverVideoOf(course) → its cover video, or null
// videoThumbOf(course) → a picture for its cover video (YouTube's own
//   thumbnail), or null (Vimeo and uploaded videos: none without a server)
// durationOf(course) → { amount, unit } or null; durationText(d) → "6 hours"
// trackRecordOf(course) → { students, rating, source, on }, defaults filled in
// cleanCoverVideo(v) → the video as saved, null, or undefined (not a video: don't save)
// cleanDuration(d), cleanTrackRecord(t) → as saved
//
// Testimonials (courses.js, cleanTestimonials), as the webinar's reviews:
//   { id, name, from (who they are), text, photo, source, linkedin }
//   photo   their picture, kept with the testimonial itself (a data URL
//           in the prototype; the real product stores it in the database,
//           not Cloud Storage), or ''
//   source  'google' when the coach chose the Google icon, else ''
//   linkedin  their LinkedIn profile link, or ''
// readLinkedIn(text) → a LinkedIn profile link (linkedin.com/in/…), tidied
//   to https://www.linkedin.com/in/…, or null
// cleanPhoto(value) → a picture we can show (data:image/… or http(s)), or ''
// ------------------------------------------------------------

export const DURATION_UNITS = ['hours', 'days', 'weeks'];
export const DURATION_MAX = 9999;

export const TRACK_DEFAULTS = { students: 125, rating: 4.7, source: '', reviews: 12 };
export const TRACK_STUDENTS_MAX = 10000000;
export const TRACK_SOURCE_MAX = 40;

const isWhole = (n) => Number.isFinite(n) && n > 0;

export function cleanCoverVideo(v) {
  if (v === null) return null;
  if (v?.kind === 'embed') {
    const video = readVideoLink(v.url);
    return video ? { kind: 'embed', url: video.url, provider: video.provider } : undefined;
  }
  if (v?.kind === 'video' && typeof v.fileId === 'string' && v.fileId) {
    return {
      kind: 'video',
      fileId: v.fileId,
      name: String(v.name ?? 'Video'),
      ext: typeof v.ext === 'string' ? v.ext : null,
      bytes: Number.isFinite(v.bytes) ? v.bytes : 0,
    };
  }
  return undefined;
}

export const coverVideoOf = (course) => {
  const v = cleanCoverVideo(course?.coverVideo ?? null);
  return v ?? null;
};

export function videoThumbOf(course) {
  const v = coverVideoOf(course);
  if (v?.kind !== 'embed' || v.provider !== 'youtube') return null;
  const video = readVideoLink(v.url);
  return video ? `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg` : null;
}

export function cleanDuration(d) {
  const amount = Math.round(Number(d?.amount));
  if (!isWhole(amount) || !DURATION_UNITS.includes(d?.unit)) return null;
  return { amount: Math.min(DURATION_MAX, amount), unit: d.unit };
}

export const durationOf = (course) => cleanDuration(course?.duration);

// "1 hour", "6 hours", "4 weeks"
export const durationText = (d) => (d ? `${d.amount.toLocaleString('en-IN')} ${d.amount === 1 ? d.unit.slice(0, -1) : d.unit}` : '');

export function cleanTrackRecord(t) {
  const students = Math.round(Number(t?.students));
  const rating = Math.round(Number(t?.rating) * 10) / 10;
  const reviews = Math.round(Number(t?.reviews)); // asked on a coach's profile only (TrustInput.jsx)
  return {
    reviews: Number.isFinite(reviews) && reviews >= 0 ? Math.min(TRACK_STUDENTS_MAX, reviews) : TRACK_DEFAULTS.reviews,
    students: Number.isFinite(students) && students >= 0 ? Math.min(TRACK_STUDENTS_MAX, students) : TRACK_DEFAULTS.students,
    rating: Number.isFinite(rating) && rating >= 1 && rating <= 5 ? rating : TRACK_DEFAULTS.rating,
    source: String(t?.source ?? '').trim().slice(0, TRACK_SOURCE_MAX),
    on: t?.on === true,
  };
}

export const trackRecordOf = (course) =>
  course?.trackRecord ? cleanTrackRecord(course.trackRecord) : { ...TRACK_DEFAULTS, on: false };

// ---------- Testimonials: who they are, their picture, LinkedIn ----------
export const TESTIMONIAL_FROM_MAX = 60;
export const LINKEDIN_MAX = 200;

export function readLinkedIn(text) {
  const href = readLink(text);
  if (!href || href.length > LINKEDIN_MAX) return null;
  const url = new URL(href);
  const host = url.hostname.replace(/^(www\.|[a-z]{2}\.)/, '');
  const path = url.pathname.split('/').filter(Boolean);
  if (host !== 'linkedin.com' || path[0] !== 'in' || !path[1]) return null;
  return `https://www.linkedin.com/in/${path[1]}`;
}

export const cleanPhoto = (value) =>
  typeof value === 'string' && /^(data:image\/|https?:\/\/)/.test(value) ? value : '';