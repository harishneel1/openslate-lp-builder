import { useState } from 'react';
import { previewOf } from '../data/imagePreviews';
import './CoverArt.css';

// ------------------------------------------------------------
// A course's cover, 16:9: the image set on its Landing page, or, until
// there is one (or while the prototype has no picture of it), our orange
// with the course's title on it. Shown on the course's cards (the coach's
// Courses page, the academy), its landing page, and its Landing page step.
//
// course: { title, cover }. cover.src is an image's own address (the
//   example course's photo, exampleCourse.js); otherwise cover.fileId is
//   a Cloud Storage file, shown when the prototype kept a picture of it
//   (imagePreviews.js). An image that doesn't load shows the orange.
// children: anything laid over it (the Draft corner)
// ------------------------------------------------------------
export default function CoverArt({ course, children }) {
  const wanted = course.cover?.src ?? (course.cover ? previewOf(course.cover.fileId) : null);
  const [broken, setBroken] = useState(null); // the address that didn't load
  const src = wanted && wanted !== broken ? wanted : null;
  return (
    <div className={`cvr ${src ? 'cvr--image' : ''}`} aria-hidden="true">
      {src ? (
        <img className="cvr__img" src={src} alt="" onError={() => setBroken(src)} />
      ) : (
        <span className="cvr__title">{course.title}</span>
      )}
      {children}
    </div>
  );
}