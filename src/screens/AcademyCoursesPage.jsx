import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Search } from 'lucide-react';
import { coursePlayerPath, isPublished, loadCourses, onCoursesChange, studentLessons, studentSections } from '../data/courses';
import { onProgressChange, progressOf } from '../data/courseProgress';
import { mockAccount } from '../data/myPage';
import AcademyTop from '../components/AcademyTop';
import CoverArt from '../components/CoverArt';
import CoursePlayerPage from './CoursePlayerPage';
import './AcademyCoursesPage.css';

// ------------------------------------------------------------
// The academy: what students see, laid out as TagMango's, in our colours.
//
//   /web/courses                         the Courses page (below)
//   /web/courses/<course>/learn?lesson=  one course in the player
//                                        (CoursePlayerPage.jsx)
// Both are opened here, so main.jsx only needs to send /web/courses… to
// this page. "View as student" (the coach's Courses page) and "Preview as
// student" (a course's page) open them.
//
//   [HN]              [📖 Courses]
//   ─────────────────────────────────────────────────────────────
//   Courses
//   3 courses · 1 in progress · 0 completed
//   [🔍 Search by course, section or lesson title              ]
//   ┌──────────┐ ┌──────────┐ ┌──────────┐
//   │  cover   │ │  cover   │ │  cover   │
//   │ Title    │ │          │ │          │
//   │ By Harish│ │          │ │          │
//   │ 2 sections • 5 lessons │ │          │
//   │[Start learning]│       │ │          │
//   └──────────┘ └──────────┘ └──────────┘
//
// The top bar (components/AcademyTop.jsx) is shared with the player: the
// coach's logo, and the academy's tabs in the middle as icon-and-name
// pills, the one you're on filled. Only Courses for now.
//
// A card's button: Start learning (not started), Continue (part way), or
// Review course (all done); it opens the player where they left off.
// A course with no lessons to show yet says "Lessons coming soon" instead.
// Counts are of what students see: lessons with something in them.
// Only published courses are here: a draft opens only through the coach's
// Preview as student (CoursePlayerPage.jsx, &preview=1). With student
// sign-in (next), a student sees only the published courses their
// contracts give them.
// The cover (CoverArt.jsx) is the one set in the course's Settings; until
// there is one, our orange with the course's title on it.
// ------------------------------------------------------------

// Which page: the player, for /web/courses/<course>/learn
function playerCourseId() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  return parts[0] === 'web' && parts[1] === 'courses' && parts[2] ? decodeURIComponent(parts[2]) : null;
}

export default function AcademyCoursesPage() {
  const courseId = playerCourseId();
  if (courseId) return <CoursePlayerPage courseId={courseId} />;
  return <CourseList />;
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Where a student is with a course
function stateOf(course, progress) {
  const lessons = studentLessons(course);
  const done = lessons.filter(({ lesson }) => progress.done.has(lesson.id)).length;
  if (lessons.length === 0) return { lessons, done, state: 'empty' };
  if (done === lessons.length) return { lessons, done, state: 'done' };
  return { lessons, done, state: done > 0 || progress.last ? 'started' : 'new' };
}

function CourseList() {
  const published = () => loadCourses().filter(isPublished);
  const [courses, setCourses] = useState(published);
  const [tick, setTick] = useState(0);
  const [query, setQuery] = useState('');
  useEffect(() => onCoursesChange(() => setCourses(published())), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => onProgressChange(() => setTick((n) => n + 1)), []);
  useEffect(() => {
    document.title = `${mockAccount.name} - Courses`;
  }, []);

  const rows = useMemo(
    () => courses.map((course) => ({ course, ...stateOf(course, progressOf(course.id)) })),
    [courses, tick],
  );
  const started = rows.filter((r) => r.state === 'started').length;
  const finished = rows.filter((r) => r.state === 'done').length;

  // Search: the course's title, or any of its sections' or lessons' names
  const needle = query.trim().toLowerCase();
  const shown = needle
    ? rows.filter(({ course }) => {
        const names = [course.title, ...studentSections(course).flatMap((s) => [s.title, ...s.lessons.map((l) => l.title)])];
        return names.some((n) => n.toLowerCase().includes(needle));
      })
    : rows;

  return (
    <div className="acd">
      <AcademyTop />

      <main className="acd__main">
        <h1 className="acd__title">Courses</h1>
        <p className="acd__sub">
          {plural(courses.length, 'course')} · {started} in progress · {finished} completed
        </p>

        {courses.length === 0 ? (
          <section className="acd__empty">
            <span className="acd__empty-icon" aria-hidden="true">
              <BookOpen size={28} />
            </span>
            <h2 className="acd__empty-title">No courses yet</h2>
            <p className="acd__empty-text">Courses from {mockAccount.name} will show up here.</p>
          </section>
        ) : (
          <>
            <label className="acd__search">
              <Search size={18} aria-hidden="true" />
              <span className="sr-only">Search courses</span>
              <input
                type="search"
                value={query}
                placeholder="Search by course, section or lesson title"
                autoComplete="off"
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>

            {shown.length === 0 ? (
              <p className="acd__none">
                Nothing matches “{query.trim()}”.{' '}
                <button type="button" className="acd__link" onClick={() => setQuery('')}>
                  Show all courses
                </button>
              </p>
            ) : (
              <ul className="acd__grid" aria-label="Courses">
                {shown.map((row) => (
                  <li key={row.course.id}>
                    <StudentCard {...row} />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// One course: its cover, title, who it's by, its size, and the button
function StudentCard({ course, lessons, done, state }) {
  const sections = studentSections(course).length;
  const button = { new: 'Start learning', started: 'Continue', done: 'Review course' }[state];

  return (
    <article className="acd-card">
      <CoverArt course={course} />
      <div className="acd-card__body">
        <h2 className="acd-card__title">{course.title}</h2>
        <p className="acd-card__by">{mockAccount.name}</p>
        <p className="acd-card__meta">
          {state === 'empty'
            ? 'No lessons yet'
            : `${plural(sections, 'section')} • ${plural(lessons.length, 'lesson')}${
                state === 'started' ? ` • ${done} done` : ''
              }`}
        </p>
        {state === 'empty' ? (
          <span className="acd-card__btn acd-card__btn--off">Lessons coming soon</span>
        ) : (
          <a className="acd-card__btn" href={coursePlayerPath(course.id)}>
            {button}
            <span className="sr-only">: {course.title}</span>
          </a>
        )}
      </div>
    </article>
  );
}