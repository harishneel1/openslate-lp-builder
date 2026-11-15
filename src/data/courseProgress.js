// ------------------------------------------------------------
// Each student's progress through courses: which lessons they've finished,
// and the last one they opened (so a course opens where they left off).
//
// Kept per student, so two people on one computer don't share ticks. The
// coach's Preview as student keeps its own, under 'preview'. In the real
// product it's kept on the server.
//   { [who]: { [courseId]: { done: [lessonId, …], last: lessonId | null } } }
//
// A lesson counts as done when they press Next, or Mark as complete
// (CoursePlayerPage.jsx). Mark as complete can be undone.
//
// who: the student's id (students.js), or 'preview'
// progressOf(who, courseId) → { done: Set of lesson ids, last }
// setDone(who, courseId, lessonId, done = true)
// setLast(who, courseId, lessonId)
// onProgressChange(fn) → runs fn when progress changes (here or in
//   another tab); returns the function that stops it
// ------------------------------------------------------------

const KEY = 'pagebuilder:student-progress';
const CHANGED = 'course-progress-changed';

function readAll() {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return all && typeof all === 'object' && !Array.isArray(all) ? all : {};
  } catch {
    return {};
  }
}

function writeAll(all) {
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    return false;
  }
  window.dispatchEvent(new Event(CHANGED));
  return true;
}

const mine = (all, who) => (all[who] && typeof all[who] === 'object' && !Array.isArray(all[who]) ? all[who] : {});

export function progressOf(who, courseId) {
  const one = mine(readAll(), who)[courseId];
  const done = Array.isArray(one?.done) ? one.done.filter((id) => typeof id === 'string') : [];
  return { done: new Set(done), last: typeof one?.last === 'string' ? one.last : null };
}

function change(who, courseId, fn) {
  const all = readAll();
  const { done, last } = progressOf(who, courseId);
  const next = fn({ done: new Set(done), last });
  all[who] = { ...mine(all, who), [courseId]: { done: [...next.done], last: next.last } };
  return writeAll(all);
}

export const setDone = (who, courseId, lessonId, isDone = true) =>
  change(who, courseId, (p) => {
    if (isDone) p.done.add(lessonId);
    else p.done.delete(lessonId);
    return p;
  });

export const setLast = (who, courseId, lessonId) => change(who, courseId, (p) => ({ ...p, last: lessonId }));

export function onProgressChange(fn) {
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