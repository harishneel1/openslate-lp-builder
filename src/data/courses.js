import { getService } from './mockServices';

// ------------------------------------------------------------
// Courses. A course doesn't own a contract: it keeps a list of the
// contracts that give access to it, and only reads them. Linking never
// changes a contract. Any contract can be linked (one made on the
// Contracts page, a webinar session's, a 1:1 call's), and a deleted
// contract simply stops showing on the course.
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
// One course:
//   { id: 'course-…', title, contractIds: [...], status: 'draft',
//     sections: [{ id: 'sec-…', title, lessons: [
//       { id: 'les-…', title, content, createdAt, updatedAt } ] }],
//     createdAt, updatedAt }
// A new course starts with one empty section, "Untitled". Courses made
// before sections existed have none; they read as an empty list.
// Lessons made before content types kept plain `text`; they read as a
// text lesson (each blank-line paragraph a <p>), and are saved that way
// the next time their course changes.
// Every course is a draft for now; publishing comes later.
//
// Kept in this browser for the mock; the real product keeps them on the
// server, which must clean a lesson's html before showing it to anyone.
//
// academyCoursesPath / academyCoursesUrl() → the academy's Courses page
// loadCourses() → every course, newest first
// getCourse(id) → one course, or null
// createCourse({ title, contractIds }) → the new course, or null if it couldn't save
// updateCourse(id, { title?, contractIds? }) → the changed course, or null
// deleteCourse(id) → true if it's gone
// linkedContracts(course) → its contracts that still exist, in the order linked
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
// updateLesson(courseId, lessonId, { title?, content? })   content null empties it
// deleteLesson(courseId, lessonId)
// moveSection / moveLesson / moveLessonTo     kept for ordering later (not shown now)
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

// What a new section is called, until it's renamed
export const NEW_SECTION_TITLE = 'Untitled';

// The academy's Courses page, what students see (AcademyCoursesPage.jsx).
// "View as student" on the coach's Courses page opens it in a new tab.
export const academyCoursesPath = '/web/courses';
export const academyCoursesUrl = () => `${window.location.origin}${academyCoursesPath}`;

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
    return next;
  });
}

export function deleteCourse(id) {
  const list = read();
  const left = list.filter((c) => c.id !== id);
  return left.length === list.length || write(left);
}

export const linkedContracts = (course) => (course?.contractIds ?? []).map(getService).filter(Boolean);

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

// A lesson as the pages use it: always with `content` (null when empty)
function lessonOf(l) {
  const { text, ...rest } = l; // eslint-disable-line no-unused-vars
  return { ...rest, title: String(l.title ?? ''), content: contentOf(l) };
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
  return changeLesson(courseId, lessonId, (l) => ({ ...l, ...next, updatedAt: now() }));
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