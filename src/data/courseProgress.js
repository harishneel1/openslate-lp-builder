// ------------------------------------------------------------
// A student's progress through courses: which lessons they've finished,
// and the last one they opened (so a course opens where they left off).
//
// Kept in this browser for the prototype, one record per course:
//   { [courseId]: { done: [lessonId, …], last: lessonId | null } }
// In the real product it's kept per student, on the server, once students
// sign in.
//
// A lesson counts as done when they press Next, or Mark as complete
// (CoursePlayerPage.jsx). Mark as complete can be undone.
//
// progressOf(courseId) → { done: Set of lesson ids, last }
// setDone(courseId, lessonId, done = true)
// setLast(courseId, lessonId)
// onProgressChange(fn) → runs fn when progress changes (here or in
//   another tab); returns the function that stops it
// ------------------------------------------------------------

const KEY = 'pagebuilder:course-progress';
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

export function progressOf(courseId) {
  const one = readAll()[courseId];
  const done = Array.isArray(one?.done) ? one.done.filter((id) => typeof id === 'string') : [];
  return { done: new Set(done), last: typeof one?.last === 'string' ? one.last : null };
}

function change(courseId, fn) {
  const all = readAll();
  const { done, last } = progressOf(courseId);
  const next = fn({ done: new Set(done), last });
  all[courseId] = { done: [...next.done], last: next.last };
  return writeAll(all);
}

export const setDone = (courseId, lessonId, isDone = true) =>
  change(courseId, (p) => {
    if (isDone) p.done.add(lessonId);
    else p.done.delete(lessonId);
    return p;
  });

export const setLast = (courseId, lessonId) => change(courseId, (p) => ({ ...p, last: lessonId }));

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