import { getService } from './mockServices';
import { contractSignupsOf } from './contractSignupsStore';

// ------------------------------------------------------------
// Courses. A course doesn't own a contract: it keeps a list of the
// contracts that give access to it, and only reads them. Linking never
// changes a contract. Any contract can be linked (one made on the
// Contracts page, a webinar session's, a 1:1 call's), and a deleted
// contract simply stops showing on the course.
//
// The one exception is its price (Pricing, CoursePricing.jsx): setting a
// price there makes a contract for the course (createContract in
// mockServices.js) and links it, and the course's Buy button sells it.
// That contract is buyContractId; buyContractMade says the course made
// it (so its price is changed on the course), or false when the coach
// picked one of the linked contracts for the Buy button instead (its
// price is changed wherever that contract is managed). The Buy button's
// contract is always one of contractIds.
//
// Who can open a course (with publishing, later): anyone whose email has
// a sign-up on a linked contract that wasn't refunded.
//
// A course's content: sections, each with its lessons, in order.
// A lesson has one main type of content, as on TagMango (resources, the
// extra files and links, come later):
//   null                          nothing yet
//   { kind: 'text', html }        an article, written in the lesson's
//                                 text editor (TextEditor.jsx)
//   { kind: 'embed', url, provider: 'youtube' | 'vimeo' }
//                                 a YouTube or Vimeo video, played in the
//                                 lesson (readVideoLink)
//   { kind: 'video' | 'pdf', fileId ('file:f-…'), name, ext, bytes }
//                                 a video or PDF in their Cloud Storage,
//                                 uploaded from the lesson or picked
//                                 there. The name and size are kept with
//                                 the lesson too, so a file deleted from
//                                 Cloud Storage can still be named
//                                 (cloudStorage.js, fileById).
//   { kind: 'link', url }         a link saved before embedded videos
//                                 (any web page); still shown, not offered
//
// Under its main content, a lesson can also have, as on TagMango:
//   description  html, written in the text editor (not for a Text lesson,
//                whose content is already text); '' for none
//   resources    files for students to download, any kind, from their
//                Cloud Storage (uploaded from the lesson or picked there):
//                [{ id: 'res-…', fileId, name, ext, type, bytes }]
//
// One course:
//   { id: 'course-…', title, contractIds: [...], status: 'draft',
//     cover: null | { fileId ('file:f-…'), name, ext, bytes }: an image in
//            their Cloud Storage, shown on the course's card in the academy
//            (set on the course's Landing page),
//     subtitle: one line under the title on the landing page ('' for none),
//     description: html, written in the text editor ('' for none),
//     outcomes: ['…']      What students will learn (Intended learners)
//     requirements: ['…']  Requirements or prerequisites
//     audience: ['…']      Who this course is for
//     testimonials: [{ id, name, text }]   what past students said, added
//                          by hand (from WhatsApp, emails, reviews
//                          elsewhere); shown as testimonials, never as
//                          ratings
//     buyContractId: null | the contract the Buy button sells (above),
//     buyContractMade: true when the course made that contract,
//     sections: [{ id: 'sec-…', title, lessons: [
//       { id: 'les-…', title, content, description, resources,
//         createdAt, updatedAt } ] }],
//     createdAt, updatedAt }
// Courses made before these fields read as empty ('' and []).
// A new course starts with one empty section, "Untitled". Courses made
// before sections existed have none; they read as an empty list.
// Lessons made before content types kept plain `text`; they read as a
// text lesson (each blank-line paragraph a <p>), and are saved that way
// the next time their course changes.
// status: 'draft' (only the coach sees it, and Preview as student) or
// 'published' (in the academy; publishedAt is when). Publishing needs
// (publishCheck): at least one lesson with something in it, a price (or
// Free), a subtitle, and at least 3 things students will learn. Once
// published, changes go live as they're made: there's no separate draft
// to publish again.
//
// Kept in this browser for the mock; the real product keeps them on the
// server, which must clean a lesson's html before showing it to anyone.
//
// academyCoursesPath → the academy's Courses page (students sign in first)
// academyCoursesUrl() → the same, as the coach's View as student (?preview=1)
// academyHome(preview) → the Courses page, keeping ?preview=1 while previewing
// coursePlayerPath(courseId, lessonId?, preview?) / coursePlayerUrl(…) → a
//   course in the student's player: /web/courses/<course>/learn?lesson=<lesson>,
//   with &preview=1 for the coach's Preview as student (drafts open too)
// courseLandingPath(courseId, preview?) / courseLandingUrl(…) → its public
//   landing page, /web/course/<course> (with ?preview=1 for the coach's
//   Preview, drafts too); readCourseLandingPath(pathname) → the id, or null
// courseSoldBy(contractId) → the published course whose Buy button sells it
// isPublished(course)
// publishCheck(course) → what publishing would do, and what stops it:
//   { lessons, hidden (empty lessons left out), contracts, cover, priced,
//     subtitle, outcomes (how many),
//     problems: ['lessons' | 'price' | 'subtitle' | 'outcomes', …] }
// publishCourse(id) → the published course, or null (checks not met)
// unpublishCourse(id) → the course, back to a draft, or null
// studentSections(course) → the course as students see it: only lessons
//   with something in them, and only sections with such lessons
// studentLessons(course) → those lessons in order, each with its section
// loadCourses() → every course, newest first
// getCourse(id) → one course, or null
// createCourse({ title, contractIds }) → the new course, or null if it couldn't save
// updateCourse(id, { title?, contractIds?, cover?, subtitle?, description?,
//   outcomes?, requirements?, audience?, buyContractId?, buyContractMade? })
//   → the changed course, or null
// deleteCourse(id) → true if it's gone
// linkedContracts(course) → its contracts that still exist, in the order linked
// buyContractOf(course) → the contract its Buy button sells, or null (none
//   set yet, or it was deleted)
// listOf(course, 'outcomes' | 'requirements' | 'audience') → that list
// testimonialsOf(course) → its testimonials, whole ones only
// instructorStats() → { students, courses }: the coach's published
//   courses, and the people (one each, by email) signed up on any of
//   their contracts. Ratings come once reviews are collected.
// onCoursesChange(fn) → runs fn when courses change (here or in another tab);
//   returns the function that stops it
//
// Content (each returns the changed course, or null if it couldn't save,
// unless it says otherwise):
// sectionsOf(course) → its sections, each with lessons (never missing)
// lessonCount(course) → how many lessons it has
// findLesson(course, lessonId) → { lesson, section } or null
// addSection(courseId) → { course, section }, called "Untitled" until renamed
// renameSection(courseId, sectionId, title)   empty keeps the old title
// deleteSection(courseId, sectionId)          and its lessons
// addLesson(courseId, sectionId, title) → { course, lesson }   a title is needed
// updateLesson(courseId, lessonId, { title?, content?, description? })
//                                             content null empties it; description '' removes it
// addResource(courseId, lessonId, asset) → { course, resource }   a Cloud Storage file
// removeResource(courseId, lessonId, resourceId)                  it stays in Cloud Storage
// deleteLesson(courseId, lessonId)
// moveSectionBefore(courseId, sectionId, beforeSectionId | null)
//                                             dragged: before another, or to the end
// moveLessonBefore(courseId, lessonId, toSectionId, beforeLessonId | null)
//                                             dragged: into a section, before another
//                                             lesson there, or to its end
// moveSection / moveLesson / moveLessonTo     one step (kept; not shown now)
// readLink(text) → the link as a full https address, or null if it isn't one
// readVideoLink(text) → { provider, id, url, embedUrl } for a YouTube or
//   Vimeo video link, or null
// lessonKindOfFile(asset) → 'video' or 'pdf' for a Cloud Storage file, else null
// ------------------------------------------------------------

const KEY = 'pagebuilder:courses';
const CHANGED = 'courses-changed';
export const COURSE_TITLE_MAX = 100;
export const SECTION_TITLE_MAX = 100;
export const LESSON_TITLE_MAX = 120;
export const LESSON_HTML_MAX = 200000; // a long article, with room for its markup
export const LINK_MAX = 2000;

// The landing page and Intended learners, as Udemy's
export const SUBTITLE_MAX = 120;
export const DESCRIPTION_HTML_MAX = 50000;
export const LIST_ITEM_MAX = 160; // one thing students will learn, one requirement…
export const LIST_MAX = 10; // how many of each
export const OUTCOMES_MIN = 3; // needed to publish
export const LISTS = ['outcomes', 'requirements', 'audience'];
export const TESTIMONIALS_MAX = 6;
export const TESTIMONIAL_NAME_MAX = 60;
export const TESTIMONIAL_TEXT_MAX = 400;

// What a new section is called, until it's renamed
export const NEW_SECTION_TITLE = 'Untitled';

// The academy's Courses page, what students see (AcademyCoursesPage.jsx).
// "View as student" on the coach's Courses page opens it in a new tab.
export const academyCoursesPath = '/web/courses';
// The coach's View as student: every published course, no sign-in
export const academyCoursesUrl = () => `${window.location.origin}${academyCoursesPath}?preview=1`;
// Where the academy's Courses links go: the preview's own, while previewing
export const academyHome = (preview = false) => (preview ? `${academyCoursesPath}?preview=1` : academyCoursesPath);

// One course in the student's player (CoursePlayerPage.jsx), at a lesson
// or (without one) where they left off. preview: the coach's Preview as
// student, which opens drafts too.
export function coursePlayerPath(courseId, lessonId = null, preview = false) {
  const query = new URLSearchParams();
  if (lessonId) query.set('lesson', lessonId);
  if (preview) query.set('preview', '1');
  const q = query.toString();
  return `${academyCoursesPath}/${encodeURIComponent(courseId)}/learn${q ? `?${q}` : ''}`;
}
export const coursePlayerUrl = (courseId, lessonId = null, preview = false) =>
  `${window.location.origin}${coursePlayerPath(courseId, lessonId, preview)}`;

// A course's landing page (CourseLandingPage.jsx), the link a coach
// shares to sell it: /web/course/<course>. Public, no sign-in. Only a
// published course shows; preview: the coach's Preview ▾ Landing page,
// which shows drafts too. Built from the course's id, so renaming it never
// breaks a link that's been sent.
export const courseLandingPath = (courseId, preview = false) =>
  `/web/course/${encodeURIComponent(courseId)}${preview ? '?preview=1' : ''}`;
export const courseLandingUrl = (courseId, preview = false) =>
  `${window.location.origin}${courseLandingPath(courseId, preview)}`;
// The course id in /web/course/<course>, or null
export function readCourseLandingPath(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  return parts[0] === 'web' && parts[1] === 'course' && parts[2] ? decodeURIComponent(parts[2]) : null;
}

function read() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((c) => c && typeof c.id === 'string') : [];
  } catch {
    return [];
  }
}

function write(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    return false;
  }
  window.dispatchEvent(new Event(CHANGED));
  return true;
}

const now = () => new Date().toISOString();
const newId = (prefix) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const clean = (text, max) => String(text ?? '').trim().slice(0, max);
const cleanIds = (ids) => [...new Set((Array.isArray(ids) ? ids : []).filter((id) => typeof id === 'string' && id))];
// A list as saved: only lines with words in them, each kept short, at most LIST_MAX
const cleanList = (list) =>
  (Array.isArray(list) ? list : [])
    .map((item) => clean(item, LIST_ITEM_MAX))
    .filter(Boolean)
    .slice(0, LIST_MAX);
// Testimonials as saved: only ones with words in them; a name is optional
const cleanTestimonials = (list) =>
  (Array.isArray(list) ? list : [])
    .map((t) => ({
      id: typeof t?.id === 'string' && t.id ? t.id : newId('tst'),
      name: clean(t?.name, TESTIMONIAL_NAME_MAX),
      text: clean(t?.text, TESTIMONIAL_TEXT_MAX),
    }))
    .filter((t) => t.text)
    .slice(0, TESTIMONIALS_MAX);

export const loadCourses = () => read().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

export const getCourse = (id) => (id ? read().find((c) => c.id === id) ?? null : null);

export function createCourse({ title, contractIds = [] }) {
  const name = clean(title, COURSE_TITLE_MAX);
  if (!name) return null;
  const at = now();
  const course = {
    id: newId('course'),
    title: name,
    contractIds: cleanIds(contractIds),
    status: 'draft',
    sections: [{ id: newId('sec'), title: NEW_SECTION_TITLE, lessons: [] }],
    createdAt: at,
    updatedAt: at,
  };
  return write([...read(), course]) ? course : null;
}

// Changes one course with change(course) → the new course (or null to
// leave it). Returns the saved course, or null.
function change(id, fn) {
  const list = read();
  const i = list.findIndex((c) => c.id === id);
  if (i === -1) return null;
  const next = fn({ ...list[i], sections: sectionsOf(list[i]) });
  if (!next) return null;
  list[i] = { ...next, updatedAt: now() };
  return write(list) ? list[i] : null;
}

export function updateCourse(id, edits) {
  return change(id, (c) => {
    const next = { ...c };
    if ('title' in edits) {
      const name = clean(edits.title, COURSE_TITLE_MAX);
      if (!name) return null;
      next.title = name;
    }
    if ('contractIds' in edits) next.contractIds = cleanIds(edits.contractIds);
    if ('cover' in edits) {
      const c = edits.cover;
      if (c === null) next.cover = null;
      else if (c && typeof c.fileId === 'string' && c.fileId) {
        next.cover = { fileId: c.fileId, name: String(c.name ?? 'Cover'), ext: c.ext ?? null, bytes: Number(c.bytes) || 0 };
      } else return null;
    }
    if ('subtitle' in edits) next.subtitle = clean(edits.subtitle, SUBTITLE_MAX);
    if ('description' in edits) {
      const html = String(edits.description ?? '');
      if (html.length > DESCRIPTION_HTML_MAX) return null;
      next.description = html === '<p></p>' ? '' : html;
    }
    LISTS.forEach((key) => {
      if (key in edits) next[key] = cleanList(edits[key]);
    });
    if ('testimonials' in edits) next.testimonials = cleanTestimonials(edits.testimonials);
    if ('buyContractId' in edits) {
      const buy = edits.buyContractId;
      next.buyContractId = typeof buy === 'string' && buy ? buy : null;
    }
    if ('buyContractMade' in edits) next.buyContractMade = Boolean(edits.buyContractMade);
    // The Buy button's contract is always a linked one
    if (next.buyContractId && !(next.contractIds ?? []).includes(next.buyContractId)) {
      next.contractIds = [next.buyContractId, ...(next.contractIds ?? [])];
    }
    return next;
  });
}

export function deleteCourse(id) {
  const list = read();
  const left = list.filter((c) => c.id !== id);
  return left.length === list.length || write(left);
}

export const linkedContracts = (course) => (course?.contractIds ?? []).map(getService).filter(Boolean);

export function buyContractOf(course) {
  const id = course?.buyContractId;
  if (!id || !(course.contractIds ?? []).includes(id)) return null;
  return getService(id);
}

export const listOf = (course, key) => cleanList(course?.[key]);

export const testimonialsOf = (course) => cleanTestimonials(course?.testimonials);

export function instructorStats() {
  const published = read().filter((c) => c.status === 'published');
  const ids = new Set(published.flatMap((c) => c.contractIds ?? []));
  const people = new Set(
    [...ids].flatMap((id) => contractSignupsOf(id)).map((r) => String(r.email ?? '').trim().toLowerCase() || r.id),
  );
  return { students: people.size, courses: published.length };
}

// The published course whose Buy button sells this contract, or null: the
// thank-you page after checkout uses it for Start learning
export const courseSoldBy = (contractId) =>
  contractId ? read().find((c) => c.buyContractId === contractId && isPublished(c)) ?? null : null;

export function onCoursesChange(fn) {
  const fromOtherTab = (e) => {
    if (e.key === KEY || e.key === null) fn();
  };
  window.addEventListener(CHANGED, fn);
  window.addEventListener('storage', fromOtherTab);
  return () => {
    window.removeEventListener(CHANGED, fn);
    window.removeEventListener('storage', fromOtherTab);
  };
}

// ---------- A lesson's content ----------

// A link typed or pasted in: "youtube.com/watch?v=…" becomes
// "https://youtube.com/watch?v=…". Only http and https, with a real-looking
// address (a dot in it). null if it isn't a link.
export function readLink(text) {
  const raw = String(text ?? '').trim();
  if (!raw || raw.length > LINK_MAX || /\s/.test(raw)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (!url.hostname.includes('.')) return null;
    return url.href;
  } catch {
    return null;
  }
}

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Plain text from before content types: each blank-line block a paragraph,
// single line breaks kept
function textToHtml(text) {
  return String(text)
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

// ---------- YouTube and Vimeo ----------
// A video link as pasted: youtube.com/watch?v=…, youtu.be/…, /shorts/…,
// /live/…, /embed/…; vimeo.com/123456 (and /123456/abcdef for an
// unlisted one), player.vimeo.com/video/123456. Returns
// { provider: 'youtube' | 'vimeo', id, url (tidied), embedUrl (for the
// player) }, or null when it isn't one of these.
export function readVideoLink(text) {
  const href = readLink(text);
  if (!href) return null;
  const url = new URL(href);
  const host = url.hostname.replace(/^(www\.|m\.)/, '');
  const path = url.pathname.split('/').filter(Boolean);

  if (host === 'youtube.com' || host === 'youtube-nocookie.com' || host === 'youtu.be') {
    let id = null;
    if (host === 'youtu.be') id = path[0];
    else if (path[0] === 'watch') id = url.searchParams.get('v');
    else if (['shorts', 'live', 'embed', 'v'].includes(path[0])) id = path[1];
    if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
    return {
      provider: 'youtube',
      id,
      url: `https://www.youtube.com/watch?v=${id}`,
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0`,
    };
  }

  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const nums = host === 'player.vimeo.com' ? path.slice(1) : path;
    const i = nums.findIndex((p) => /^\d{5,}$/.test(p));
    if (i === -1) return null;
    const id = nums[i];
    const hash = url.searchParams.get('h') || (/^[a-f0-9]{6,}$/i.test(nums[i + 1] ?? '') ? nums[i + 1] : null);
    return {
      provider: 'vimeo',
      id,
      url: hash ? `https://vimeo.com/${id}/${hash}` : `https://vimeo.com/${id}`,
      embedUrl: `https://player.vimeo.com/video/${id}${hash ? `?h=${hash}` : ''}`,
    };
  }

  return null;
}

// ---------- Files from Cloud Storage ----------
export const FILE_KINDS = ['video', 'pdf'];

// A Cloud Storage file's lesson kind: a video, or a PDF. Anything else
// (images, other documents) can't be a lesson's content.
export function lessonKindOfFile(asset) {
  if (!asset) return null;
  if (asset.type === 'video') return 'video';
  if (asset.type === 'document' && asset.ext === 'PDF') return 'pdf';
  return null;
}

// A file's content, from what's saved; null if something's missing
function fileContent(c) {
  if (!FILE_KINDS.includes(c?.kind) || typeof c.fileId !== 'string' || !c.fileId) return null;
  return {
    kind: c.kind,
    fileId: c.fileId,
    name: String(c.name ?? 'File'),
    ext: typeof c.ext === 'string' ? c.ext : null,
    bytes: Number.isFinite(c.bytes) ? c.bytes : 0,
  };
}

// A lesson's content as saved, or null if it's missing or not one we know.
// A link saved before embedded videos that is a YouTube or Vimeo video
// reads as one.
function contentOf(lesson) {
  const c = lesson?.content;
  if (c && c.kind === 'text' && typeof c.html === 'string' && c.html) return { kind: 'text', html: c.html };
  if (c && (c.kind === 'embed' || c.kind === 'link')) {
    const video = readVideoLink(c.url);
    if (video) return { kind: 'embed', url: video.url, provider: video.provider };
    if (c.kind === 'link' && readLink(c.url)) return { kind: 'link', url: readLink(c.url) };
    return null;
  }
  if (c) return fileContent(c);
  if (typeof lesson?.text === 'string' && lesson.text.trim()) return { kind: 'text', html: textToHtml(lesson.text) };
  return null;
}

// What a lesson has, for its icon: a kind above, or null (nothing yet)
export const lessonKind = (lesson) => lesson?.content?.kind ?? null;

// A lesson's resources as saved: only whole ones
function resourcesOf(l) {
  return (Array.isArray(l?.resources) ? l.resources : [])
    .filter((r) => r && typeof r.id === 'string' && typeof r.fileId === 'string')
    .map((r) => ({
      id: r.id,
      fileId: r.fileId,
      name: String(r.name ?? 'File'),
      ext: typeof r.ext === 'string' ? r.ext : null,
      type: typeof r.type === 'string' ? r.type : 'other',
      bytes: Number.isFinite(r.bytes) ? r.bytes : 0,
    }));
}

// A lesson as the pages use it: always with `content` (null when empty),
// `description` ('' when none) and `resources` ([] when none)
function lessonOf(l) {
  const { text, ...rest } = l; // eslint-disable-line no-unused-vars
  return {
    ...rest,
    title: String(l.title ?? ''),
    content: contentOf(l),
    description: typeof l.description === 'string' ? l.description : '',
    resources: resourcesOf(l),
  };
}

// ---------- Content: sections and lessons ----------

export function sectionsOf(course) {
  const sections = Array.isArray(course?.sections) ? course.sections : [];
  return sections
    .filter((s) => s && typeof s.id === 'string')
    .map((s) => ({
      ...s,
      title: String(s.title ?? ''),
      lessons: (Array.isArray(s.lessons) ? s.lessons : []).filter((l) => l && typeof l.id === 'string').map(lessonOf),
    }));
}

// What students see: empty lessons are left out, and so are sections
// left with none
export const studentSections = (course) =>
  sectionsOf(course)
    .map((s) => ({ ...s, lessons: s.lessons.filter((l) => l.content) }))
    .filter((s) => s.lessons.length > 0);

export const studentLessons = (course) =>
  studentSections(course).flatMap((section) => section.lessons.map((lesson) => ({ lesson, section })));

export const lessonCount = (course) => sectionsOf(course).reduce((n, s) => n + s.lessons.length, 0);

export function findLesson(course, lessonId) {
  for (const section of sectionsOf(course)) {
    const lesson = section.lessons.find((l) => l.id === lessonId);
    if (lesson) return { lesson, section };
  }
  return null;
}

// Swaps item i with its neighbour (dir -1 up, 1 down); the same list when it can't move
function nudge(list, i, dir) {
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return list;
  const copy = [...list];
  [copy[i], copy[j]] = [copy[j], copy[i]];
  return copy;
}

export function addSection(courseId) {
  let section = null;
  const course = change(courseId, (c) => {
    section = { id: newId('sec'), title: NEW_SECTION_TITLE, lessons: [] };
    return { ...c, sections: [...c.sections, section] };
  });
  return course ? { course, section } : null;
}

export function renameSection(courseId, sectionId, title) {
  const name = clean(title, SECTION_TITLE_MAX);
  if (!name) return null;
  return change(courseId, (c) => ({
    ...c,
    sections: c.sections.map((s) => (s.id === sectionId ? { ...s, title: name } : s)),
  }));
}

export function deleteSection(courseId, sectionId) {
  return change(courseId, (c) => ({ ...c, sections: c.sections.filter((s) => s.id !== sectionId) }));
}

export function moveSection(courseId, sectionId, dir) {
  return change(courseId, (c) => ({
    ...c,
    sections: nudge(c.sections, c.sections.findIndex((s) => s.id === sectionId), dir),
  }));
}

export function addLesson(courseId, sectionId, title) {
  const name = clean(title, LESSON_TITLE_MAX);
  if (!name) return null;
  const at = now();
  const lesson = { id: newId('les'), title: name, content: null, createdAt: at, updatedAt: at };
  const course = change(courseId, (c) => {
    if (!c.sections.some((s) => s.id === sectionId)) return null;
    return {
      ...c,
      sections: c.sections.map((s) => (s.id === sectionId ? { ...s, lessons: [...s.lessons, lesson] } : s)),
    };
  });
  return course ? { course, lesson } : null;
}

// Changes one lesson, wherever it is, with fn(lesson) → the new lesson
function changeLesson(courseId, lessonId, fn) {
  return change(courseId, (c) => {
    let found = false;
    const sections = c.sections.map((s) => ({
      ...s,
      lessons: s.lessons.map((l) => {
        if (l.id !== lessonId) return l;
        found = true;
        return fn(l);
      }),
    }));
    return found ? { ...c, sections } : null;
  });
}

// content: null (empty it), or one of the kinds at the top. Text that's
// too long, a link that isn't YouTube or Vimeo, or a file without its id
// doesn't save.
export function updateLesson(courseId, lessonId, edits) {
  const next = {};
  if ('title' in edits) {
    next.title = clean(edits.title, LESSON_TITLE_MAX);
    if (!next.title) return null;
  }
  if ('content' in edits) {
    const c = edits.content;
    if (c === null) next.content = null;
    else if (c?.kind === 'text' && typeof c.html === 'string' && c.html && c.html.length <= LESSON_HTML_MAX) {
      next.content = { kind: 'text', html: c.html };
    } else if (c?.kind === 'embed' && readVideoLink(c.url)) {
      const video = readVideoLink(c.url);
      next.content = { kind: 'embed', url: video.url, provider: video.provider };
    } else if (fileContent(c)) next.content = fileContent(c);
    else return null;
  }
  if ('description' in edits) {
    const html = String(edits.description ?? '');
    if (html.length > LESSON_HTML_MAX) return null;
    next.description = html === '<p></p>' ? '' : html;
  }
  return changeLesson(courseId, lessonId, (l) => ({ ...l, ...next, updatedAt: now() }));
}

export function addResource(courseId, lessonId, asset) {
  if (!asset || typeof asset.id !== 'string') return null;
  const resource = {
    id: newId('res'),
    fileId: asset.id,
    name: String(asset.name ?? 'File'),
    ext: asset.ext ?? null,
    type: asset.type ?? 'other',
    bytes: Number(asset.bytes) || 0,
  };
  const course = changeLesson(courseId, lessonId, (l) => ({ ...l, resources: [...resourcesOf(l), resource], updatedAt: now() }));
  return course ? { course, resource } : null;
}

export function removeResource(courseId, lessonId, resourceId) {
  return changeLesson(courseId, lessonId, (l) => ({
    ...l,
    resources: resourcesOf(l).filter((r) => r.id !== resourceId),
    updatedAt: now(),
  }));
}

export function deleteLesson(courseId, lessonId) {
  return change(courseId, (c) => ({
    ...c,
    sections: c.sections.map((s) => ({ ...s, lessons: s.lessons.filter((l) => l.id !== lessonId) })),
  }));
}

export function moveLesson(courseId, lessonId, dir) {
  return change(courseId, (c) => ({
    ...c,
    sections: c.sections.map((s) => ({
      ...s,
      lessons: nudge(s.lessons, s.lessons.findIndex((l) => l.id === lessonId), dir),
    })),
  }));
}

export function moveLessonTo(courseId, lessonId, sectionId) {
  return change(courseId, (c) => {
    const from = findLesson(c, lessonId);
    if (!from || from.section.id === sectionId || !c.sections.some((s) => s.id === sectionId)) return null;
    return {
      ...c,
      sections: c.sections.map((s) => {
        if (s.id === from.section.id) return { ...s, lessons: s.lessons.filter((l) => l.id !== lessonId) };
        if (s.id === sectionId) return { ...s, lessons: [...s.lessons, from.lesson] };
        return s;
      }),
    };
  });
}

// Dragging a section: put it before another (or at the end, with null)
export function moveSectionBefore(courseId, sectionId, beforeSectionId) {
  if (sectionId === beforeSectionId) return null;
  return change(courseId, (c) => {
    const moving = c.sections.find((s) => s.id === sectionId);
    if (!moving) return null;
    const rest = c.sections.filter((s) => s.id !== sectionId);
    const at = beforeSectionId ? rest.findIndex((s) => s.id === beforeSectionId) : rest.length;
    if (at === -1) return null;
    return { ...c, sections: [...rest.slice(0, at), moving, ...rest.slice(at)] };
  });
}

// Dragging a lesson: into a section, before one of its lessons (or at its
// end, with null)
export function moveLessonBefore(courseId, lessonId, toSectionId, beforeLessonId) {
  if (lessonId === beforeLessonId) return null;
  return change(courseId, (c) => {
    const from = findLesson(c, lessonId);
    if (!from || !c.sections.some((s) => s.id === toSectionId)) return null;
    const sections = c.sections.map((s) => ({ ...s, lessons: s.lessons.filter((l) => l.id !== lessonId) }));
    const target = sections.find((s) => s.id === toSectionId);
    const at = beforeLessonId ? target.lessons.findIndex((l) => l.id === beforeLessonId) : target.lessons.length;
    if (at === -1) return null;
    target.lessons = [...target.lessons.slice(0, at), from.lesson, ...target.lessons.slice(at)];
    return { ...c, sections };
  });
}

// ---------- Publishing ----------

export const isPublished = (course) => course?.status === 'published';

export function publishCheck(course) {
  const all = sectionsOf(course).flatMap((sec) => sec.lessons);
  const lessons = all.filter((l) => l.content).length;
  const contracts = linkedContracts(course).length;
  const priced = Boolean(buyContractOf(course));
  const subtitle = clean(course?.subtitle, SUBTITLE_MAX);
  const outcomes = listOf(course, 'outcomes').length;
  const problems = [];
  if (lessons === 0) problems.push('lessons');
  if (!priced) problems.push('price');
  if (!subtitle) problems.push('subtitle');
  if (outcomes < OUTCOMES_MIN) problems.push('outcomes');
  return {
    lessons,
    hidden: all.length - lessons,
    contracts,
    cover: Boolean(course?.cover),
    priced,
    subtitle: Boolean(subtitle),
    outcomes,
    problems,
  };
}

export function publishCourse(id) {
  const course = getCourse(id);
  if (!course || publishCheck(course).problems.length > 0) return null;
  return change(id, (c) => ({ ...c, status: 'published', publishedAt: now() }));
}

export function unpublishCourse(id) {
  return change(id, (c) => ({ ...c, status: 'draft' }));
}