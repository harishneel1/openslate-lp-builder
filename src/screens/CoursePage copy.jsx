import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, Check, FileText, Link2, X } from 'lucide-react';
import { COURSE_TITLE_MAX, getCourse, linkedContracts, onCoursesChange, updateCourse } from '../data/courses';
import { servicePrice } from '../data/mockServices';
import { signupCounts } from '../data/contractSignups';
import ContractPicker from '../components/ContractPicker';
import InlineTitle from '../components/InlineTitle';
import CourseContent from './CourseContent';
import ConfirmDialog from '../components/ConfirmDialog';
import './CoursesPage.css';

// ------------------------------------------------------------
// One course's page: where Create course's Continue and Edit course land.
//
//   ← Courses
//   DRAFT
//   AI Engineering Accelerator ✎             (InlineTitle.jsx)
//   ✓ Saved
//
//   ┌────────────────────────────────────────────────────────────┐
//   │  Content   Access 2              (Access •  when none linked)│
//   ├━━━━━━━━━───────────────────────────────────────────────────┤
//   │ Sections and their lessons, in the order…   [+ Add section] │
//   │ sections and their lessons (CourseContent.jsx)              │
//   └────────────────────────────────────────────────────────────┘
//
// The title, the Draft badge and "Saved" belong to the whole course, so
// they sit above the card. The tabs are in the card's head, drawn as on a
// 1:1 call's page (CallOverview.css, .cov__tabs): grey names, the open
// one dark with an orange underline on the head's bottom line. Each tab
// starts with a line saying what it is and its button on the right.
// Two tabs:
//   Content (opens first): sections and lessons (CourseContent.jsx).
//   Access: who gets this course, the linked contracts. Its tab shows how
//     many are linked, or an orange dot when none are (no one can get the
//     course yet), so that's never hidden even on the Content tab.
// The tabs work with the arrow keys, Home and End, as tabs do.
//
// The title (with a pencil after it) saves when they leave it or press Enter ("Saved" for a
// moment). Empty, or Escape, puts the saved one back.
// Link contracts opens the same picker as Create course, with the linked
// ones ticked; Save keeps the change. Remove unlinks one straight away
// (the course is a draft, so no student has it yet).
// A linked contract that's been deleted just doesn't show.
//
// Lessons open in place on the Content tab (CourseContent.jsx), never on
// another page. While an open lesson has unsaved changes, anything that
// would lose them (another lesson, the Access tab, ← Courses) asks first:
// "Leave without saving?" (guard). Closing the browser tab asks too.
//
// courseId, onBack()
// ------------------------------------------------------------

function useCourse(id) {
  const [course, setCourse] = useState(() => getCourse(id));
  useEffect(() => {
    const refresh = () => setCourse(getCourse(id));
    const stop = onCoursesChange(refresh);
    window.addEventListener('focus', refresh); // contracts made or deleted in another tab
    return () => {
      stop();
      window.removeEventListener('focus', refresh);
    };
  }, [id]);
  return course;
}

const plural = (n, word) => `${n.toLocaleString('en-IN')} ${word}${n === 1 ? '' : 's'}`;

const TABS = ['content', 'access'];

export default function CoursePage({ courseId, onBack }) {
  const course = useCourse(courseId);
  const contracts = useMemo(() => (course ? linkedContracts(course) : []), [course]);
  const counts = useMemo(() => signupCounts(contracts), [contracts]);
  const [tab, setTab] = useState('content');
  const [linking, setLinking] = useState(false);
  const [dirty, setDirty] = useState(false); // an open lesson has unsaved changes
  const [pending, setPending] = useState(null); // what to do once they agree to leave them
  const [status, setStatus] = useState(null); // 'saved' | 'failed' | null
  const statusTimer = useRef(null);
  useEffect(() => () => clearTimeout(statusTimer.current), []);

  useEffect(() => {
    if (course) document.title = course.title;
  }, [course]);

  // Closing the browser tab with unsaved changes: the browser asks first
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // Runs fn now, or after "Leave without saving?" when there are unsaved changes
  const guard = (fn) => (dirty ? setPending(() => fn) : fn());

  if (!course) {
    return (
      <div className="crs">
        <button type="button" className="crs__back" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" /> Courses
        </button>
        <section className="crs__panel crs__empty">
          <h1 className="crs__empty-title">This course isn’t here</h1>
          <p className="crs__empty-text">It may have been deleted. Go back to see your courses.</p>
        </section>
      </div>
    );
  }

  // Saves a change; says "Saved" for a moment, or that it didn't work
  const save = (change) => {
    const ok = Boolean(updateCourse(course.id, change));
    setStatus(ok ? 'saved' : 'failed');
    clearTimeout(statusTimer.current);
    if (ok) statusTimer.current = setTimeout(() => setStatus(null), 2000);
    return ok;
  };
  const unlink = (id) => save({ contractIds: course.contractIds.filter((c) => c !== id) });

  return (
    <div className="crs">
      <button type="button" className="crs__back" onClick={() => guard(onBack)}>
        <ArrowLeft size={16} aria-hidden="true" /> Courses
      </button>

      <header className="cpg__head">
        <span className="cpg__badge">Draft</span>
        <InlineTitle
          id="cpg-title"
          label="Course title"
          value={course.title}
          maxLength={COURSE_TITLE_MAX}
          onSave={(title) => save({ title })}
        />
      </header>
      <p className={`cpg__status ${status === 'failed' ? 'cpg__status--error' : ''}`} aria-live="polite">
        {status === 'saved' && (
          <>
            <Check size={14} strokeWidth={3} aria-hidden="true" /> Saved
          </>
        )}
        {status === 'failed' && (
          <>
            <AlertTriangle size={14} aria-hidden="true" /> We couldn’t save that just now. Try again.
          </>
        )}
      </p>

      <section className="crs__panel cpg__card">
        <div className="cpg__card-head">
          <Tabs tab={tab} onChange={(next) => next !== tab && guard(() => setTab(next))} linked={contracts.length} />
        </div>

        {/* ---------- Content: sections and lessons ---------- */}
        {tab === 'content' && (
          <div className="cpg__body" role="tabpanel" id="cpg-panel-content" aria-labelledby="cpg-tab-content">
            <CourseContent
              course={course}
              onSaved={(ok) => {
                setStatus(ok ? 'saved' : 'failed');
                clearTimeout(statusTimer.current);
                if (ok) statusTimer.current = setTimeout(() => setStatus(null), 2000);
              }}
              guard={guard}
              onDirtyChange={setDirty}
            />
          </div>
        )}

        {/* ---------- Access: who gets it ---------- */}
        {tab === 'access' && (
          <div className="cpg__body" role="tabpanel" id="cpg-panel-access" aria-labelledby="cpg-tab-access">
            <div className="cpg__bar">
              <p className="cpg__bar-text">
                People who sign up on any of these contracts get the course, including everyone who already has.
              </p>
              <button type="button" className="crs-btn crs-btn--quiet crs-btn--small" onClick={() => setLinking(true)}>
                <Link2 size={16} aria-hidden="true" />
                Link contracts
              </button>
            </div>

            {contracts.length === 0 ? (
              <p className="cpg__nothing">No contracts linked yet, so no one can get this course.</p>
            ) : (
              <ul className="cpg__contracts">
                {contracts.map((c) => {
                  const n = counts[c.id] ?? 0;
                  return (
                    <li key={c.id} className="cpg__contract">
                      <span className="cpg__contract-icon" aria-hidden="true">
                        <FileText size={18} />
                      </span>
                      <span className="cpg__contract-text">
                        <span className="cpg__contract-title">{c.title}</span>
                        <span className="cpg__contract-meta">
                          {servicePrice(c)} · {n === 0 ? 'No sign-ups yet' : plural(n, 'sign-up')}
                        </span>
                      </span>
                      <button type="button" className="crs-btn crs-btn--quiet crs-btn--small" onClick={() => unlink(c.id)}>
                        Remove<span className="sr-only"> {c.title}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </section>

      {pending && (
        <ConfirmDialog
          title="Leave without saving?"
          confirmLabel="Leave without saving"
          cancelLabel="Keep editing"
          danger
          onCancel={() => setPending(null)}
          onConfirm={() => {
            const then = pending;
            setPending(null);
            setDirty(false);
            then();
          }}
        >
          <p>Your changes to this lesson will be lost.</p>
        </ConfirmDialog>
      )}

      {linking && (
        <LinkDialog
          value={course.contractIds}
          onCancel={() => setLinking(false)}
          onSave={(ids) => {
            if (save({ contractIds: ids })) setLinking(false);
          }}
        />
      )}
    </div>
  );
}

// Content | Access. The one they're on is underlined. Arrow keys move
// between them (and open the one they land on), Home and End go to the
// first and last.
function Tabs({ tab, onChange, linked }) {
  const refs = useRef({});

  const go = (id) => {
    onChange(id);
    refs.current[id]?.focus();
  };

  const onKeyDown = (e) => {
    const i = TABS.indexOf(tab);
    if (e.key === 'ArrowRight') go(TABS[(i + 1) % TABS.length]);
    else if (e.key === 'ArrowLeft') go(TABS[(i - 1 + TABS.length) % TABS.length]);
    else if (e.key === 'Home') go(TABS[0]);
    else if (e.key === 'End') go(TABS[TABS.length - 1]);
    else return;
    e.preventDefault();
  };

  const tabProps = (id) => ({
    ref: (el) => {
      refs.current[id] = el;
    },
    type: 'button',
    role: 'tab',
    id: `cpg-tab-${id}`,
    'aria-selected': tab === id,
    'aria-controls': `cpg-panel-${id}`,
    tabIndex: tab === id ? 0 : -1,
    className: `cpg__tab ${tab === id ? 'cpg__tab--on' : ''}`,
    onClick: () => onChange(id),
  });

  return (
    <div className="cpg__tabs" role="tablist" aria-label="Course" onKeyDown={onKeyDown}>
      <button {...tabProps('content')}>Content</button>
      <button {...tabProps('access')}>
        Access
        {linked > 0 ? (
          <span className="cpg__tab-count">
            {linked}
            <span className="sr-only"> {linked === 1 ? 'contract' : 'contracts'} linked</span>
          </span>
        ) : (
          <span className="cpg__tab-dot">
            <span className="sr-only">: no contracts linked yet</span>
          </span>
        )}
      </button>
    </div>
  );
}

// "Link contracts": the same picker as Create course, open, with the
// linked ones ticked. Save keeps the change; Cancel or Escape doesn't.
function LinkDialog({ value, onCancel, onSave }) {
  const ref = useRef(null);
  const [ids, setIds] = useState(value);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.open && dialog.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className="crs-dialog"
      aria-labelledby="cpg-link-title"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      <div className="crs-dialog__top">
        <h2 className="crs-dialog__title" id="cpg-link-title">
          Link contracts
        </h2>
        <button type="button" className="crs-dialog__close" onClick={onCancel} aria-label="Close">
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <div className="crs-dialog__body">
        <p className="crs-field__help">People who sign up on any of these get the course.</p>
        <ContractPicker value={ids} onChange={setIds} startOpen />
      </div>
      <div className="crs-dialog__foot crs-dialog__foot--row">
        <button type="button" className="crs-btn crs-btn--quiet" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="crs-btn crs-btn--primary" onClick={() => onSave(ids)}>
          Save
        </button>
      </div>
    </dialog>
  );
}
