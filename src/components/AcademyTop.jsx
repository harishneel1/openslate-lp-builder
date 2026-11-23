import { useEffect, useRef, useState } from 'react';
import { BookOpen, ChevronRight, KeyRound, LogOut, User, Users } from 'lucide-react';
import { academyCoursesPath } from '../data/courses';
import { communityPath } from '../data/studentClasses';
import { mockAccount } from '../data/myPage';
import { accountPath, contactPath, showPhone, signOut } from '../data/students';
import { initials } from '../utils/initials';

// ------------------------------------------------------------
// The academy's own top bar, on every page students see (Courses,
// Community, My account): a slim 56px bar, quiet so the page's own orange
// buttons (Continue, Join) stand out.
//
//   (HN) Harish Neel       (👥 Community)  📖 Courses                (AR)
//
// The coach's logo and name on the left; the tabs in the middle as
// compact pills, as TagMango's: the one you're on in our orange tint, the
// others a soft grey on hover; the student's picture on the right. Community (CommunityPage.jsx) first, then Courses.
//
// The picture opens their menu, as TagMango's (without Appearance and the
// other links), in Cloud Storage's look: a white panel, rows split by
// hairlines, each with a tinted tile.
//   ┌──────────────────────────────┐
//   │ (PS) Priya Sharma          › │  → My account
//   │      priya@example.com       │
//   ├──────────────────────────────┤
//   │ [🔑] Update number/email      │  → Update number/email
//   ├──────────────────────────────┤
//   │ [⏻] Logout                   │  red
//   └──────────────────────────────┘
// Their name, else their number or email when we don't know it; under it,
// their email, else their number. Closes on Escape or a click outside.
//
// student: the signed-in student (students.js), or null for the coach's
// preview, which has no picture
// home: where the logo and Courses go (academyHome in courses.js)
// onCourses: false on pages that aren't Courses (My account), so the tab
//   isn't filled
// on: the tab that's filled, 'courses' or 'community' (else from onCourses)
// preview: the coach's preview (?preview=1), kept on Community's link
// Its look is in AcademyCoursesPage.css (.acd__top, .acd-me, .acd-photo).
// ------------------------------------------------------------
export default function AcademyTop({ student = null, home = academyCoursesPath, onCourses = true, on = null, preview = false }) {
  const active = on ?? (onCourses ? 'courses' : null);
  const community = preview ? `${communityPath}?preview=1` : communityPath;
  return (
    <header className="acd__top">
      <a className="acd__brand" href={home} aria-label={`${mockAccount.name}, Courses`}>
        <span className="acd__logo" aria-hidden="true">
          {initials(mockAccount.name)}
        </span>
        <span className="acd__name">{mockAccount.name}</span>
      </a>
      <nav className="acd__nav" aria-label="Academy">
        <a
          className={`acd__tab ${active === 'community' ? 'acd__tab--on' : ''}`}
          href={community}
          aria-current={active === 'community' ? 'page' : undefined}
        >
          <Users size={19} aria-hidden="true" />
          Community
        </a>
        <a
          className={`acd__tab ${active === 'courses' ? 'acd__tab--on' : ''}`}
          href={home}
          aria-current={active === 'courses' ? 'page' : undefined}
        >
          <BookOpen size={19} aria-hidden="true" />
          Courses
        </a>
      </nav>
      <div className="acd__right">{student && <StudentMenu student={student} />}</div>
    </header>
  );
}

// Their picture; until they add one, their initials on our orange tint
// (or a person, when we don't know their name)
export function StudentPhoto({ student, size = 40 }) {
  return (
    <span
      className="acd-photo"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
      aria-hidden="true"
    >
      {student.photo ? (
        <img src={student.photo} alt="" />
      ) : student.name ? (
        initials(student.name)
      ) : (
        <User size={Math.round(size * 0.48)} strokeWidth={2} />
      )}
    </span>
  );
}

// What to call them, and the line under it
export function whoIs(student) {
  const phone = showPhone(student.phone);
  const name = student.name || phone || student.email;
  const contact = student.name ? student.email || phone : phone ? student.email : '';
  return { name, contact };
}

function StudentMenu({ student }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);
  const button = useRef(null);
  const { name, contact } = whoIs(student);

  useEffect(() => {
    if (!open) return undefined;
    const outside = (e) => {
      if (!wrap.current?.contains(e.target)) setOpen(false);
    };
    const esc = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', esc);
    // The menu itself takes focus; Down reaches the first item
    wrap.current?.querySelector('[role="menu"]')?.focus();
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  // Up and Down move between the items
  const onKey = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = [...wrap.current.querySelectorAll('[role="menuitem"]')];
    const at = items.indexOf(document.activeElement);
    const step = e.key === 'ArrowDown' ? 1 : -1;
    const next = at === -1 ? (step === 1 ? 0 : items.length - 1) : (at + step + items.length) % items.length;
    items[next]?.focus();
  };

  return (
    <div className="acd-me" ref={wrap}>
      <button
        ref={button}
        type="button"
        className="acd-me__button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Your account: ${name}`}
        onClick={() => setOpen((o) => !o)}
      >
        <StudentPhoto student={student} size={32} />
      </button>

      {open && (
        <div className="acd-me__menu" role="menu" aria-label="Your account" tabIndex={-1} onKeyDown={onKey}>
          <a role="menuitem" className="acd-me__who" href={accountPath}>
            <StudentPhoto student={student} size={44} />
            <span className="acd-me__who-text">
              <span className="acd-me__name">{name}</span>
              {contact && <span className="acd-me__contact">{contact}</span>}
            </span>
            <ChevronRight size={18} aria-hidden="true" />
          </a>

          <a role="menuitem" className="acd-me__item" href={contactPath}>
            <span className="acd-me__tile" aria-hidden="true">
              <KeyRound size={16} />
            </span>
            Update number/email
          </a>

          <button type="button" role="menuitem" className="acd-me__item acd-me__item--out" onClick={signOut}>
            <span className="acd-me__tile" aria-hidden="true">
              <LogOut size={16} />
            </span>
            Logout
          </button>
        </div>
      )}
    </div>
  );
}