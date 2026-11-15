import { useEffect, useRef, useState } from 'react';
import { Camera, ChevronRight, KeyRound, LogOut } from 'lucide-react';
import { academyCoursesPath } from '../data/courses';
import { mockAccount } from '../data/myPage';
import { contactPath, showPhone, signOut, updateStudent } from '../data/students';
import AcademyTop, { StudentPhoto, whoIs } from '../components/AcademyTop';
import './AccountPage.css';

// ------------------------------------------------------------
// My account: /web/account. A student's own page, from the name at the
// top of their menu. TagMango's, cut down to what we have, in Cloud
// Storage's look (white panels, hairline rows, tinted tiles):
//
//   My account
//   Your photo, and the number and email you sign in with.
//   ┌──────────────────────────────────────────────────────┐
//   │ Hello,                                    (  photo  ) │
//   │ Priya (first name)                           📷 on hover
//   │ [Change photo] [Remove]                                │
//   └──────────────────────────────────────────────────────┘
//   ┌──────────────────────────────────────────────────────┐
//   │ [🔑] Update number/email                            › │
//   │      +91 98765 43210 · priya@example.com              │
//   └──────────────────────────────────────────────────────┘
//                    [ ⏻ Logout ]
//
// The photo: click it (a camera shows on hover) or Change photo. A JPG,
// PNG or WEBP up to 5 MB, cut to a square from the middle and kept small.
// Remove goes back to their initials. No delete account.
//
// student: who's signed in (AcademyCoursesPage.jsx only opens this for one)
// ------------------------------------------------------------

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const PHOTO_MAX = 5 * 1024 * 1024;
const PHOTO_SIZE = 256;

// The picked photo as a small square JPEG, cut from its middle
function squarePhoto(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const canvas = document.createElement('canvas');
      canvas.width = PHOTO_SIZE;
      canvas.height = PHOTO_SIZE;
      canvas
        .getContext('2d')
        .drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.86));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('unreadable'));
    };
    img.src = url;
  });
}

export default function AccountPage({ student }) {
  const picker = useRef(null);
  const [said, setSaid] = useState(null); // { text, error }
  const [busy, setBusy] = useState(false);
  const { name } = whoIs(student);
  // "Hello, Priya": their first name, as TagMango's; their number or email
  // when we don't know their name
  const hello = student.name ? student.name.trim().split(/\s+/)[0] : name;
  const phone = showPhone(student.phone);

  useEffect(() => {
    document.title = `My account - ${mockAccount.name}`;
  }, []);

  const pick = () => picker.current?.click();

  const onPicked = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type)) {
      setSaid({ text: 'Choose a JPG, PNG or WEBP photo.', error: true });
      return;
    }
    if (file.size > PHOTO_MAX) {
      setSaid({ text: 'That photo is over 5 MB. Choose a smaller one.', error: true });
      return;
    }
    setBusy(true);
    try {
      const photo = await squarePhoto(file);
      const { error } = updateStudent(student.id, { photo });
      setSaid(error ? { text: error, error: true } : { text: 'Photo updated.' });
    } catch {
      setSaid({ text: 'Couldn’t open that photo. Try another.', error: true });
    }
    setBusy(false);
  };

  const remove = () => {
    const { error } = updateStudent(student.id, { photo: null });
    setSaid(error ? { text: error, error: true } : { text: 'Photo removed.' });
  };

  return (
    <div className="acd acc">
      <AcademyTop student={student} home={academyCoursesPath} onCourses={false} />

      <main className="acc__main">
        <h1 className="acc__title">My account</h1>
        <p className="acc__sub">Your photo, and the number and email you sign in with.</p>

        <section className="acc-panel acc-hello" aria-label="Your profile">
          <div className="acc-hello__text">
            <p className="acc-hello__hi">Hello,</p>
            <p className="acc-hello__name">{hello}</p>
            <div className="acc-hello__actions">
              <button type="button" className="acc-btn" onClick={pick} disabled={busy}>
                <Camera size={16} aria-hidden="true" />
                {busy ? 'Saving…' : student.photo ? 'Change photo' : 'Add photo'}
              </button>
              {student.photo && (
                <button type="button" className="acc-btn acc-btn--quiet" onClick={remove} disabled={busy}>
                  Remove
                </button>
              )}
            </div>
            <p className={`acc-hello__said ${said?.error ? 'acc-hello__said--error' : ''}`} role="status">
              {said?.text ?? ''}
            </p>
          </div>

          <button
            type="button"
            className="acc-photo"
            onClick={pick}
            disabled={busy}
            aria-label={student.photo ? 'Change photo' : 'Add photo'}
          >
            <StudentPhoto student={student} size={112} />
            <span className="acc-photo__camera" aria-hidden="true">
              <Camera size={26} />
            </span>
          </button>

          <input
            ref={picker}
            type="file"
            accept={PHOTO_TYPES.join(',')}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={onPicked}
          />
        </section>

        <nav className="acc-panel" aria-label="Account settings">
          <a className="acc-row" href={contactPath}>
            <span className="acc-tile" aria-hidden="true">
              <KeyRound size={20} />
            </span>
            <span className="acc-row__text">
              <span className="acc-row__name">Update number/email</span>
              <span className="acc-row__detail">{[phone, student.email].filter(Boolean).join(' · ')}</span>
            </span>
            <ChevronRight size={18} className="acc-row__go" aria-hidden="true" />
          </a>
        </nav>

        <div className="acc__out">
          <button type="button" className="acc-logout" onClick={signOut}>
            <LogOut size={17} aria-hidden="true" />
            Logout
          </button>
        </div>
      </main>
    </div>
  );
}