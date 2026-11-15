import { previewOf } from '../data/imagePreviews';
import './CoverArt.css';

// ------------------------------------------------------------
// A course's cover, 16:9: the image set in its Settings, or, until there
// is one (or while the prototype has no picture of it), our orange with
// the course's title on it. Shown on the course's card in the academy
// (AcademyCoursesPage.jsx) and in its Settings (CourseSettings.jsx).
//
// course: { title, cover }
// children: anything laid over it (the Draft corner)
// ------------------------------------------------------------
export default function CoverArt({ course, children }) {
  const src = course.cover ? previewOf(course.cover.fileId) : null;
  return (
    <div className={`cvr ${src ? 'cvr--image' : ''}`} aria-hidden="true">
      {src ? <img className="cvr__img" src={src} alt="" /> : <span className="cvr__title">{course.title}</span>}
      {children}
    </div>
  );
}