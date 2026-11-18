import { useState } from 'react';
import { Play } from 'lucide-react';
import { previewOf } from '../data/imagePreviews';
import { coverVideoOf, videoThumbOf } from '../data/courseExtras';
import './CoverArt.css';

// ------------------------------------------------------------
// A course's cover, 16:9, as a picture. Shown on the course's cards (the
// coach's Courses page, the academy), its landing page, and its Landing
// page step.
//
// Which picture:
//   the image set on its Landing page (course.cover): the cover itself,
//     or, when the cover is a video, that video's thumbnail
//   else, for a YouTube cover video, YouTube's own thumbnail
//   else our orange with the course's title on it
// With a cover video (and play), a ▶ sits in the middle: the landing
// page plays it on a click (CourseLandingPage.jsx); cards don't show the ▶.
//
// course: { title, cover, coverVideo }. cover.src is an image's own
//   address (the example course's photo, exampleCourse.js); otherwise
//   cover.fileId is a Cloud Storage file, shown when the prototype kept a
//   picture of it (imagePreviews.js). An image that doesn't load shows the
//   next choice down.
// play: show the ▶ when the cover is a video
// children: anything laid over it (the Draft corner)
// ------------------------------------------------------------
export default function CoverArt({ course, play = false, children }) {
  const image = course.cover?.src ?? (course.cover ? previewOf(course.cover.fileId) : null);
  const thumb = videoThumbOf(course);
  const [broken, setBroken] = useState(() => new Set()); // addresses that didn't load
  const src = [image, thumb].find((s) => s && !broken.has(s)) ?? null;
  const video = Boolean(coverVideoOf(course));

  return (
    <div className={`cvr ${src ? 'cvr--image' : ''}`} aria-hidden="true">
      {src ? (
        <img className="cvr__img" src={src} alt="" onError={() => setBroken((prev) => new Set([...prev, src]))} />
      ) : (
        <span className="cvr__title">{course.title}</span>
      )}
      {play && video && (
        <span className="cvr__play">
          <Play size={26} fill="currentColor" />
        </span>
      )}
      {children}
    </div>
  );
}