import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, Check, CircleAlert, ExternalLink, Rocket, X } from 'lucide-react';
import {
  COURSE_TITLE_MAX,
  coursePlayerUrl,
  getCourse,
  isPublished,
  linkedContracts,
  onCoursesChange,
  publishCheck,
  publishCourse,
  unpublishCourse,
  updateCourse,
} from '../data/courses';
import { signupCounts } from '../data/contractSignups';
import ContractPicker from '../components/ContractPicker';
import InlineTitle from '../components/InlineTitle';
import CourseContent from './CourseContent';
import CourseSettings, { CourseAccess } from './CourseSettings';
import ConfirmDialog from '../components/ConfirmDialog';
import './CoursesPage.css';

// ------------------------------------------------------------
// One course's page: where Create course's Continue and Edit course land.
//
//   ← Courses                      [Preview as student ↗] [🚀 Publish]
//   DRAFT                                  (PUBLISHED, and Unpublish, once live)
//   AI Engineering Accelerator ✎             (InlineTitle.jsx)
//   ✓ Saved
//
//   ┌────────────────────────────────────────────────────────────┐
//   │  Content   Access •   Settings   (• while no contract is linked)│
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
// Three tabs:
//   Content (opens first): sections and lessons (CourseContent.jsx).
//   Access: who gets this course, the linked contracts (CourseAccess, in
//     CourseSettings.jsx). While none is linked, an orange dot on the tab
//     says so (no one can get the course yet), so that's never hidden even
//     on the other tabs.
//   Settings: the course's settings (CourseSettings.jsx): its cover image
//     for now.
// The tabs work with the arrow keys, Home and End, as tabs do.
//
// The title (with a pencil after it) saves when they leave it or press Enter ("Saved" for a
// moment). Empty, or Escape, puts the saved one back.
// Link contracts opens the same picker as Create course, with the linked
// ones ticked; Save keeps the change. Remove unlinks one straight away
// (the course is a draft, so no student has it yet).
// A linked contract that's been deleted just doesn't show.
//
// Publish: a pop-up first, checking what's needed (publishCheck):
//   ✓ 4 lessons go live (2 empty ones stay hidden)    ✕ no lesson with content
//   ✓ Linked to 2 contracts                           ✕ no contract linked
//   ⚠ No cover image (the card shows the orange)      (a note, not a block)
// Each ✕ has a button to fix it (Content, or Access), and Publish course
// waits until there are none. Once published, the badge says PUBLISHED,
// the course is in the academy, and every change goes live as it's made.
// Unpublish asks first (students stop seeing it; their progress is kept).
// A published course always keeps at least one contract: removing the last
// one asks, and unpublishes it too; Link contracts won't save with none
// ticked. Removing any other contract asks first, as students on it lose
// the course.
//
// Preview as student opens this course in the student's player
// (CoursePlayerPage.jsx) in a new tab: what students see, drafts too.
//
// Lessons open in place on the Content tab (CourseContent.jsx), never on
// another page. While an open lesson has unsaved changes, anything that
// would lose them (another lesson, another tab, ← Courses) asks first:
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

const TABS = ['content', 'access', 'settings'];

export default function CoursePage({ courseId, onBack }) {
  const course = useCourse(courseId);
  const contracts = useMemo(() => (course ? linkedContracts(course) : []), [course]);
  const counts = useMemo(() => signupCounts(contracts), [contracts]);
  const [tab, setTab] = useState('content');
  const [linking, setLinking] = useState(false);
  const [dirty, setDirty] = useState(false); // an open lesson has unsaved changes
  const [pending, setPending] = useState(null); // what to do once they agree to leave them
  const [status, setStatus] = useState(null); // 'saved' | 'failed' | 'published' | 'unpublished' | null
  const [publishing, setPublishing] = useState(false); // the Publish pop-up
  const [unpublishing, setUnpublishing] = useState(false);
  const [unlinking, setUnlinking] = useState(null); // a contract on a published course, while asking
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
  const live = isPublished(course);
  const say = (what) => {
    setStatus(what);
    clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => setStatus(null), 4000);
  };
  const removeContract = (id) => save({ contractIds: course.contractIds.filter((c) => c !== id) });
  // On a published course, removing a contract asks first
  const unlink = (id) => (live ? setUnlinking(contracts.find((c) => c.id === id) ?? { id, title: 'this contract' }) : removeContract(id));

  const publish = () => {
    setPublishing(false);
    if (publishCourse(course.id)) say('published');
    else setStatus('failed');
  };
  const unpublish = () => {
    setUnpublishing(false);
    if (unpublishCourse(course.id)) say('unpublished');
    else setStatus('failed');
  };

  return (
    <div className="crs">
      <div className="cpg__top">
        <button type="button" className="crs__back" onClick={() => guard(onBack)}>
          <ArrowLeft size={16} aria-hidden="true" /> Courses
        </button>
        <div className="cpg__top-actions">
          <a className="crs-btn crs-btn--quiet crs-btn--small" href={coursePlayerUrl(course.id, null, true)} target="_blank" rel="noopener">
            Preview as student
            <ExternalLink size={15} aria-hidden="true" />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          {live ? (
            <button type="button" className="crs-btn crs-btn--quiet crs-btn--small" onClick={() => setUnpublishing(true)}>
              Unpublish
            </button>
          ) : (
            <button type="button" className="crs-btn crs-btn--primary crs-btn--small" onClick={() => guard(() => setPublishing(true))}>
              <Rocket size={16} aria-hidden="true" />
              Publish
            </button>
          )}
        </div>
      </div>

      <header className="cpg__head">
        <span className={`cpg__badge ${live ? 'cpg__badge--live' : ''}`}>{live ? 'Published' : 'Draft'}</span>
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
        {status === 'published' && (
          <>
            <Check size={14} strokeWidth={3} aria-hidden="true" /> Published. Students can see it in your academy now.
          </>
        )}
        {status === 'unpublished' && (
          <>
            <Check size={14} strokeWidth={3} aria-hidden="true" /> Unpublished. It’s a draft again.
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
            <CourseAccess contracts={contracts} counts={counts} onLink={() => setLinking(true)} onUnlink={unlink} />
          </div>
        )}

        {/* ---------- Settings: the cover ---------- */}
        {tab === 'settings' && (
          <div className="cpg__body" role="tabpanel" id="cpg-panel-settings" aria-labelledby="cpg-tab-settings">
            <CourseSettings course={course} onSave={save} />
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

      {publishing && (
        <PublishDialog
          course={course}
          onCancel={() => setPublishing(false)}
          onPublish={publish}
          onFix={(where) => {
            setPublishing(false);
            setTab(where);
          }}
        />
      )}

      {unpublishing && (
        <ConfirmDialog
          title="Unpublish this course?"
          confirmLabel="Unpublish"
          danger
          onCancel={() => setUnpublishing(false)}
          onConfirm={unpublish}
        >
          <p>
            <strong>{course.title}</strong> goes back to being a draft. Students won’t see it in your academy until you
            publish it again. Their progress is kept.
          </p>
        </ConfirmDialog>
      )}

      {unlinking && (
        <ConfirmDialog
          title={contracts.length <= 1 ? 'Remove the last contract?' : 'Remove this contract?'}
          confirmLabel={contracts.length <= 1 ? 'Remove and unpublish' : 'Remove contract'}
          danger
          onCancel={() => setUnlinking(null)}
          onConfirm={() => {
            const last = contracts.length <= 1;
            const id = unlinking.id;
            setUnlinking(null);
            if (removeContract(id) && last) {
              if (unpublishCourse(course.id)) say('unpublished');
            }
          }}
        >
          <p>
            {contracts.length <= 1 ? (
              <>
                A published course needs at least one contract, so removing <strong>{unlinking.title}</strong> unpublishes
                the course too. Students won’t see it until you link a contract and publish again.
              </>
            ) : (
              <>
                People who got this course through <strong>{unlinking.title}</strong> will lose it. Everyone on the other
                contracts keeps it.
              </>
            )}
          </p>
        </ConfirmDialog>
      )}

      {linking && (
        <LinkDialog
          needOne={live}
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

// Content | Access | Settings. The one they're on is underlined. Arrow keys move
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
        {linked === 0 && (
          <span className="cpg__tab-dot">
            <span className="sr-only">: no contracts linked yet, so no one can get this course</span>
          </span>
        )}
      </button>
      <button {...tabProps('settings')}>Settings</button>
    </div>
  );
}

// "Link contracts": the same picker as Create course, open, with the
// linked ones ticked. Save keeps the change; Cancel or Escape doesn't.
// needOne: the course is published, so at least one has to stay ticked
function LinkDialog({ value, needOne, onCancel, onSave }) {
  const ref = useRef(null);
  const [ids, setIds] = useState(value);
  const [tried, setTried] = useState(false);
  const blocked = needOne && ids.length === 0;

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
        {blocked && tried && (
          <p className="crs-dialog__error" role="alert">
            This course is published, so it needs at least one contract. Tick one, or unpublish the course first.
          </p>
        )}
      </div>
      <div className="crs-dialog__foot crs-dialog__foot--row">
        <button type="button" className="crs-btn crs-btn--quiet" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="crs-btn crs-btn--primary"
          onClick={() => {
            setTried(true);
            if (!blocked) onSave(ids);
          }}
        >
          Save
        </button>
      </div>
    </dialog>
  );
}

// Publish: what goes live, what's missing (each with a button to fix it),
// and a note if there's no cover. Publish course waits for nothing missing.
function PublishDialog({ course, onCancel, onPublish, onFix }) {
  const check = publishCheck(course);
  const blocked = check.problems.length > 0;
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

  return (
    <ConfirmDialog
      title={`Publish “${course.title}”?`}
      confirmLabel="Publish course"
      confirmDisabled={blocked}
      onCancel={onCancel}
      onConfirm={onPublish}
    >
      <ul className="pub">
        {check.lessons > 0 ? (
          <li className="pub__row pub__row--ok">
            <Check size={17} strokeWidth={3} aria-hidden="true" />
            <span>
              {plural(check.lessons, 'lesson')} will go live
              {check.hidden > 0 && <span className="pub__note"> ({plural(check.hidden, 'empty lesson')} stay hidden)</span>}
            </span>
          </li>
        ) : (
          <li className="pub__row pub__row--no">
            <X size={17} strokeWidth={3} aria-hidden="true" />
            <span>
              No lesson has anything in it yet. Add a video, PDF or text to at least one.
              <button type="button" className="pub__fix" onClick={() => onFix('content')}>
                Go to Content
              </button>
            </span>
          </li>
        )}

        {check.contracts > 0 ? (
          <li className="pub__row pub__row--ok">
            <Check size={17} strokeWidth={3} aria-hidden="true" />
            <span>Linked to {plural(check.contracts, 'contract')}, so people who sign up get it</span>
          </li>
        ) : (
          <li className="pub__row pub__row--no">
            <X size={17} strokeWidth={3} aria-hidden="true" />
            <span>
              No contract linked yet, so no one could get it. Link at least one.
              <button type="button" className="pub__fix" onClick={() => onFix('access')}>
                Go to Access
              </button>
            </span>
          </li>
        )}

        {!check.cover && (
          <li className="pub__row pub__row--note">
            <CircleAlert size={17} aria-hidden="true" />
            <span>
              No cover image yet: its card shows the title on our orange. You can add one in Settings, now or later.
            </span>
          </li>
        )}
      </ul>
      <p className="pub__after">
        {blocked
          ? 'Fix what’s marked to publish.'
          : 'Once it’s published, the changes you make go live straight away. You can unpublish any time.'}
      </p>
    </ConfirmDialog>
  );
}