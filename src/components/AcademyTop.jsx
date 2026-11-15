import { BookOpen } from 'lucide-react';
import { academyCoursesPath } from '../data/courses';
import { mockAccount } from '../data/myPage';
import { initials } from '../utils/initials';

// ------------------------------------------------------------
// The academy's own top bar, on every page students see (the Courses page
// and the course player), laid out as TagMango's: the coach's logo on the
// left, the academy's tabs in the middle as icon-and-name pills, the one
// you're on filled. Only Courses for now; more as they're built.
// Its look is in AcademyCoursesPage.css (.acd__top).
// ------------------------------------------------------------
export default function AcademyTop() {
  return (
    <header className="acd__top">
      <a className="acd__logo" href={academyCoursesPath} aria-label={`${mockAccount.name}, Courses`}>
        {initials(mockAccount.name)}
      </a>
      <nav className="acd__nav" aria-label="Academy">
        <a className="acd__tab acd__tab--on" href={academyCoursesPath} aria-current="page">
          <BookOpen size={19} aria-hidden="true" />
          Courses
        </a>
      </nav>
      <span aria-hidden="true" />
    </header>
  );
}