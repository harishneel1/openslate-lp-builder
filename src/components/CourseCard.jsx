import { BookOpen } from 'lucide-react';
import { mockAccount } from '../data/myPage';
import { lessonCount } from '../data/courses';
import './CourseCard.css';

// ------------------------------------------------------------
// One course as a card: a cover, then its title and who it's by. Until
// courses have cover images, the cover is a dark panel with the title
// written large on it (as TagMango's own placeholder covers look).
//
//   ┌──────────────────────┐
//   │  AI ENGINEERING      │  cover
//   │  ACCELERATOR         │
//   ├──────────────────────┤
//   │ DRAFT                │
//   │ AI Engineering Acc…  │  title, two lines at most
//   │ By Harish Neel       │
//   │ 3 lessons            │  "No lessons yet" until it has one
//   │ [actions]            │  children: the coach's buttons, if any
//   └──────────────────────┘
//
// course: { title, status }
// children: what goes at the foot (Edit course and ⋯ on the Courses page)
// ------------------------------------------------------------
export default function CourseCard({ course, children }) {
  const lessons = lessonCount(course);
  return (
    <article className="crd">
      <div className="crd__cover" aria-hidden="true">
        <BookOpen size={20} className="crd__cover-icon" />
        <span className="crd__cover-title">{course.title}</span>
      </div>
      <div className="crd__body">
        {course.status !== 'published' && <span className="crd__badge">Draft</span>}
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