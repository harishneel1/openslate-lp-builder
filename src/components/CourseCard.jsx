import { mockAccount } from '../data/myPage';
import { isPublished, lessonCount } from '../data/courses';
import CoverArt from './CoverArt';
import './CourseCard.css';

// ------------------------------------------------------------
// One course as a card on the coach's Courses page: its cover, then
// whether it's live, its title and who it's by. The cover is the one set
// on the course's Landing page, or, until there is one, our orange with
// the title on it (CoverArt.jsx), the same as students see in the academy.
//
//   ┌──────────────────────┐
//   │  cover               │
//   ├──────────────────────┤
//   │ PUBLISHED            │  or DRAFT (grey)
//   │ AI Engineering Acc…  │  title, two lines at most
//   │ By Harish Neel       │
//   │ 3 lessons            │  "No lessons yet" until it has one
//   │ [actions]            │  children: the coach's buttons, if any
//   └──────────────────────┘
//
// course: { title, status, sections, cover }
// children: what goes at the foot (Edit course and ⋯ on the Courses page)
// ------------------------------------------------------------
export default function CourseCard({ course, children }) {
  const lessons = lessonCount(course);
  const live = isPublished(course);
  return (
    <article className="crd">
      <div className="crd__cover">
        <CoverArt course={course} />
      </div>
      <div className="crd__body">
        <span className={`crd__badge ${live ? 'crd__badge--live' : ''}`}>{live ? 'Published' : 'Draft'}</span>
        <h3 className="crd__title">{course.title}</h3>
        <p className="crd__by">By {mockAccount.name}</p>
        <p className="crd__meta">
          {lessons === 0 ? 'No lessons yet' : `${lessons} ${lessons === 1 ? 'lesson' : 'lessons'}`}
        </p>
        {children && <div className="crd__actions">{children}</div>}
      </div>
    </article>
  );
}