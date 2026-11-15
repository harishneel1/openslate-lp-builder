import { useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { academyCoursesPath, loadCourses, onCoursesChange } from '../data/courses';
import { mockAccount } from '../data/myPage';
import { initials } from '../utils/initials';
import CourseCard from '../components/CourseCard';
import './AcademyCoursesPage.css';

// ------------------------------------------------------------
// The academy's Courses page: /web/courses. What students see, and what
// "View as student" on the coach's Courses page opens. Its own top bar,
// like TagMango's academy: the coach's logo on the left and the academy's
// tabs in the middle (only Courses for now; more as they're built).
// No avatar yet: it'll be the signed-in student's, with student sign-in.
//
//   [HN]                  📖
//                       COURSES
//   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//   Courses
//   ┌────────┐ ┌────────┐ ┌────────┐
//   │ cover  │ │ cover  │ │ cover  │   CourseCard.jsx, no buttons
//   └────────┘ └────────┘ └────────┘
//
// For now every course shows, drafts too (marked Draft), so the coach can
// see the layout. With publishing and student sign-in, a student sees only
// the published courses they have access to. Cards don't open yet: the
// course player comes with lessons.
// ------------------------------------------------------------

export default function AcademyCoursesPage() {
  const [courses, setCourses] = useState(loadCourses);
  useEffect(() => onCoursesChange(() => setCourses(loadCourses())), []);
  useEffect(() => {
    document.title = `${mockAccount.name} - Courses`;
  }, []);

  return (
    <div className="acd">
      <header className="acd__top">
        <span className="acd__logo" role="img" aria-label={mockAccount.name}>
          {initials(mockAccount.name)}
        </span>
        <nav className="acd__nav" aria-label="Academy">
          <a className="acd__tab acd__tab--on" href={academyCoursesPath} aria-current="page">
            <BookOpen size={22} aria-hidden="true" />
            <span className="acd__tab-label">Courses</span>
          </a>
        </nav>
      </header>

      <main className="acd__main">
        <h1 className="acd__title">Courses</h1>

        {courses.length === 0 ? (
          <section className="acd__empty">
            <span className="acd__empty-icon" aria-hidden="true">
              <BookOpen size={28} />
            </span>
            <h2 className="acd__empty-title">No courses yet</h2>
            <p className="acd__empty-text">Courses from {mockAccount.name} will show up here.</p>
          </section>
        ) : (
          <ul className="acd__grid" aria-label="Courses">
            {courses.map((c) => (
              <li key={c.id}>
                <CourseCard course={c} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}