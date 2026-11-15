import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Check, ExternalLink, MoreHorizontal, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import {
  COURSE_TITLE_MAX,
  academyCoursesUrl,
  createCourse,
  deleteCourse,
  isPublished,
  loadCourses,
  onCoursesChange,
} from '../data/courses';
import CourseCard from '../components/CourseCard';
import ContractPicker from '../components/ContractPicker';
import ConfirmDialog from '../components/ConfirmDialog';
import CoursePage from './CoursePage';
import './CoursesPage.css';

// ------------------------------------------------------------
// Courses (the sidebar's Courses): where the coach makes and manages
// courses. Same frame as Contracts (ContractsPage.css): a heading with
// its main button on the right, then the content.
//
//   Courses                   [View as student ↗] [+ Create course]
//   Students get a course when they sign up on a contract linked to it.
//   [🔍 Search courses        ]  [All 3] [Published 1] [Drafts 2]
//   ┌────────┐ ┌────────┐ ┌────────┐
//   │ cover  │ │ cover  │ │ cover  │   CourseCard.jsx
//   │PUBLISHED│ │ DRAFT  │ │        │
//   │ Title  │ │        │ │        │
//   │[Edit course][⋯]    │ │        │
//   └────────┘ └────────┘ └────────┘
//
// No courses yet: one card in the middle saying "Your courses will appear
// here", with Create course.
//
// All / Published / Drafts narrows the list, with how many of each (of
// what matches the search). A course is published from its page.
//
// Create course opens "Create new course": a working title (required, up
// to 100 characters) and the contracts that give access (optional,
// ContractPicker). Continue makes a draft course and opens its page
// (CoursePage.jsx) here, with "← Courses" back to the list. Edit course
// opens the same page. ⋯ → Delete asks first; the course goes, and its
// contracts stay as they are. Deleting a published one says students
// lose it too.
//
// View as student opens the academy's Courses page (/web/courses,
// AcademyCoursesPage.jsx) in a new tab: what students see (published
// courses only).
// ------------------------------------------------------------

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'published', label: 'Published' },
  { id: 'draft', label: 'Drafts' },
];

function useCourses() {
  const [list, setList] = useState(loadCourses);
  useEffect(() => onCoursesChange(() => setList(loadCourses())), []);
  return list;
}

export default function CoursesPage() {
  const courses = useCourses();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState(null); // the course whose page is open
  const [menuFor, setMenuFor] = useState(null); // the card whose ⋯ menu is open
  const [deleting, setDeleting] = useState(null); // the course the delete pop-up is about
  const [notice, setNotice] = useState(null); // { text, tone }

  const noticeTimer = useRef(null);
  const tell = (text, tone = 'ok') => {
    clearTimeout(noticeTimer.current);
    setNotice({ text, tone });
    noticeTimer.current = setTimeout(() => setNotice(null), 3200);
  };
  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  useEffect(() => {
    if (!openId) document.title = 'Courses';
  }, [openId]);

  // What matches the search, then the filter
  const matching = useMemo(() => {
    const words = query.trim().toLowerCase();
    return words ? courses.filter((c) => c.title.toLowerCase().includes(words)) : courses;
  }, [courses, query]);
  const counts = {
    all: matching.length,
    published: matching.filter(isPublished).length,
    draft: matching.filter((c) => !isPublished(c)).length,
  };
  const shown = matching.filter((c) => filter === 'all' || (filter === 'published') === isPublished(c));

  const confirmDelete = () => {
    const course = deleting;
    setDeleting(null);
    if (!deleteCourse(course.id)) {
      tell('We couldn’t delete it just now. Try again.', 'error');
      return;
    }
    tell(`“${course.title}” deleted`);
  };

  if (openId) {
    return <CoursePage courseId={openId} onBack={() => setOpenId(null)} />;
  }

  const createButton = (
    <button type="button" className="crs-btn crs-btn--primary" onClick={() => setCreating(true)}>
      <Plus size={18} aria-hidden="true" />
      Create course
    </button>
  );

  return (
    <div className="crs">
      <header className="crs__head">
        <div className="crs__head-text">
          <h1 className="crs__title">Courses</h1>
          <p className="crs__sub">Students get a course when they sign up on a contract linked to it.</p>
        </div>
        <div className="crs__head-actions">
          <a className="crs-btn crs-btn--quiet" href={academyCoursesUrl()} target="_blank" rel="noopener">
            View as student
            <ExternalLink size={16} aria-hidden="true" />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          {courses.length > 0 && createButton}
        </div>
      </header>

      {courses.length === 0 ? (
        <section className="crs__panel crs__empty">
          <span className="crs__empty-icon" aria-hidden="true">
            <BookOpen size={28} />
          </span>
          <h2 className="crs__empty-title">Your courses will appear here</h2>
          <p className="crs__empty-text">Give your first course a working title, and link the contracts that give access to it.</p>
          {createButton}
        </section>
      ) : (
        <>
          <div className="crs__tools">
            <label className="crs__search">
              <Search size={18} aria-hidden="true" />
              <span className="sr-only">Search courses</span>
              <input type="search" value={query} placeholder="Search courses" onChange={(e) => setQuery(e.target.value)} />
            </label>
            <div className="crs__filters" role="group" aria-label="Show">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className="crs__chip"
                  aria-pressed={filter === f.id}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label} <span className="crs__chip-count">{counts[f.id]}</span>
                </button>
              ))}
            </div>
          </div>

          {shown.length === 0 ? (
            <section className="crs__panel crs__none">
              {query.trim() ? (
                <p>No {filter === 'all' ? '' : `${filter === 'draft' ? 'draft' : 'published'} `}courses match “{query.trim()}”.</p>
              ) : (
                <p>{filter === 'published' ? 'No courses published yet. Publish one from its page.' : 'No drafts: every course is published.'}</p>
              )}
              <button
                type="button"
                className="crs-btn crs-btn--quiet"
                onClick={() => {
                  setQuery('');
                  setFilter('all');
                }}
              >
                Show all courses
              </button>
            </section>
          ) : (
            <ul className="crs__grid" aria-label="Your courses">
              {shown.map((c) => (
                <li key={c.id} className={menuFor === c.id ? 'crs__grid-item--menu' : undefined}>
                  <CourseCard course={c}>
                    <button type="button" className="crs-btn crs-btn--quiet crs-btn--small crs-btn--grow" onClick={() => setOpenId(c.id)}>
                      <Pencil size={15} aria-hidden="true" />
                      Edit course
                      <span className="sr-only">: {c.title}</span>
                    </button>
                    <CardMenu
                      title={c.title}
                      open={menuFor === c.id}
                      onOpenChange={(open) => setMenuFor(open ? c.id : null)}
                      onEdit={() => {
                        setMenuFor(null);
                        setOpenId(c.id);
                      }}
                      onDelete={() => {
                        setMenuFor(null);
                        setDeleting(c);
                      }}
                    />
                  </CourseCard>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {creating && (
        <CreateCourseDialog
          onCancel={() => setCreating(false)}
          onCreated={(course) => {
            setCreating(false);
            setOpenId(course.id);
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title={isPublished(deleting) ? 'Delete this published course?' : 'Delete this course?'}
          confirmLabel="Delete course"
          danger
          onCancel={() => setDeleting(null)}
          onConfirm={confirmDelete}
        >
          <p>
            <strong>{deleting.title}</strong> will be deleted.{' '}
            {isPublished(deleting) && 'It’s published, so students lose it straight away, and their progress with it. '}
            Its contracts stay as they are. This can’t be undone.
          </p>
        </ConfirmDialog>
      )}

      <div className="crs__notice-wrap" aria-live="polite">
        {notice && (
          <p className={`crs__notice ${notice.tone === 'error' ? 'crs__notice--error' : ''}`}>
            {notice.tone === 'error' ? <X size={16} aria-hidden="true" /> : <Check size={16} strokeWidth={3} aria-hidden="true" />}
            {notice.text}
          </p>
        )}
      </div>
    </div>
  );
}

// ⋯ on a card: Edit course, then Delete. Closes on a click outside or Escape.
function CardMenu({ title, open, onOpenChange, onEdit, onDelete }) {
  const wrap = useRef(null);
  const button = useRef(null);
  const menuId = useRef(`crs-menu-${Math.random().toString(36).slice(2)}`).current;

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!wrap.current?.contains(e.target)) onOpenChange(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
        button.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    wrap.current?.querySelector('[role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const onMenuKey = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = [...wrap.current.querySelectorAll('[role="menuitem"]')];
    const at = items.indexOf(document.activeElement);
    items[(at + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
  };

  return (
    <div className="crs-menu" ref={wrap}>
      <button
        ref={button}
        type="button"
        className="crs-icon-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => onOpenChange(!open)}
      >
        <MoreHorizontal size={18} aria-hidden="true" />
        <span className="sr-only">More for {title}</span>
      </button>
      {open && (
        <div className="crs-menu__list" id={menuId} role="menu" aria-label={`More for ${title}`} onKeyDown={onMenuKey}>
          <button type="button" role="menuitem" className="crs-menu__item" onClick={onEdit}>
            <Pencil size={16} aria-hidden="true" />
            Edit course
          </button>
          <div className="crs-menu__divider" role="separator" />
          <button type="button" role="menuitem" className="crs-menu__item crs-menu__item--danger" onClick={onDelete}>
            <Trash2 size={16} aria-hidden="true" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

// "Create new course": a working title (required) and the contracts that
// give access (optional; they can be linked later on the course's page
// too). The browser's own <dialog>: dims the page, keeps the keyboard
// inside, Escape closes. A click outside doesn't close it, so nothing
// typed is lost by a stray click.
function CreateCourseDialog({ onCancel, onCreated }) {
  const ref = useRef(null);
  const [title, setTitle] = useState('');
  const [contractIds, setContractIds] = useState([]);
  const [failed, setFailed] = useState(false);
  const ready = title.trim().length > 0;

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.open && dialog.close();
  }, []);

  const submit = (e) => {
    e.preventDefault();
    if (!ready) return;
    const course = createCourse({ title, contractIds });
    if (!course) {
      setFailed(true);
      return;
    }
    onCreated(course);
  };

  return (
    <dialog
      ref={ref}
      className="crs-dialog"
      aria-labelledby="crs-create-title"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      <form className="crs-dialog__form" onSubmit={submit} noValidate>
        <div className="crs-dialog__top">
          <h2 className="crs-dialog__title" id="crs-create-title">
            Create new course
          </h2>
          <button type="button" className="crs-dialog__close" onClick={onCancel} aria-label="Close">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="crs-dialog__body">
          <div className="crs-dialog__intro">
            <span className="crs-dialog__icon" aria-hidden="true">
              <BookOpen size={26} />
            </span>
            <p className="crs-dialog__ask">How about a working title?</p>
            <p className="crs-dialog__help">It’s fine if you can’t think of a good one now. You can change it later.</p>
          </div>

          <div className="crs-field">
            <span className="crs-field__row">
              <label className="crs-field__label" htmlFor="crs-create-name">
                Title
              </label>
              <span className="crs-field__count">
                {title.length}/{COURSE_TITLE_MAX}
              </span>
            </span>
            <input
              id="crs-create-name"
              className="crs-input"
              value={title}
              maxLength={COURSE_TITLE_MAX}
              placeholder="e.g. AI Engineering Accelerator"
              autoComplete="off"
              onChange={(e) => {
                setTitle(e.target.value);
                setFailed(false);
              }}
              autoFocus // eslint-disable-line jsx-a11y/no-autofocus
            />
          </div>

          <div className="crs-field">
            <span className="crs-field__label">
              Link contracts to this course <span className="crs-field__optional">· Optional</span>
            </span>
            <p className="crs-field__help">People who sign up on any of these get the course.</p>
            <ContractPicker value={contractIds} onChange={setContractIds} />
          </div>

          {failed && (
            <p className="crs-dialog__error" role="alert">
              We couldn’t create the course just now. Try again.
            </p>
          )}
        </div>

        <div className="crs-dialog__foot">
          <button type="submit" className="crs-btn crs-btn--primary crs-btn--wide" disabled={!ready}>
            Continue
          </button>
          {!ready && <p className="crs-dialog__hint">Add a title to continue</p>}
        </div>
      </form>
    </dialog>
  );
}