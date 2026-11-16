import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, ChevronDown, ExternalLink, Link2, Rocket, Trash2, X } from 'lucide-react';
import {
  buyContractOf,
  courseLandingUrl,
  coursePlayerUrl,
  deleteCourse,
  getCourse,
  isPublished,
  linkedContracts,
  onCoursesChange,
  publishCheck,
  publishCourse,
  unpublishCourse,
  updateCourse,
} from '../data/courses';
import { STEPS, courseSteps, missingToPublish } from '../data/courseSteps';
import { signupCounts } from '../data/contractSignups';
import { servicePrice } from '../data/mockServices';
import { copyText } from '../utils/copyText';
import { COURSE_EXAMPLE_PAGE, courseAnnotations } from '../data/courseAnnotations';
import ContractPicker from '../components/ContractPicker';
import ConfirmDialog from '../components/ConfirmDialog';
import ProfileExample from '../components/ProfileExample';
import CourseContent from './CourseContent';
import CourseLanding from './CourseLanding';
import CoursePricing, { syncContractTitle } from './CoursePricing';
import './CoursesPage.css';
import './CoursePage.css';

// ------------------------------------------------------------
// One course's page: where Create course's Continue and Edit course land.
// In focus mode, as an open 1:1 call: the app's sidebar and top nav step
// aside, and its focus bar (AppLayout.jsx) is the way back, with the
// course's name in the middle and "Saved" on the right. Under it, one row:
// the three steps, and the course's actions. On each screen, only the next
// thing to do.
//
// Two modes:
//
// Setting up (a course never published yet): a guided path, one step at
// a time, as a new 1:1 call's flow is. Steps ahead are greyed and can't be
// opened until the ones before them are done; done ones can be opened
// again. The steps row carries the step's way forward on its right
// (SetupActions), pinned at the top as the page scrolls, with Delete course
// (red) set apart before it. It works once that step's minimum is done:
//   ① Curriculum ✓  ② Landing page  ③ Pricing
//             [🗑 Delete course] │ [← Back]  Preview landing page ↗  [Continue to Pricing →]
//   Curriculum     See it as a student ↗ (once a lesson has something in
//                  it), Continue to Landing page →
//   Landing page   ← Back, Preview landing page ↗, Continue to Pricing →,
//                  once it has a subtitle and 3 things students will learn
//   Pricing        ← Back, Preview landing page ↗, Publish course, once it
//                  has a price (or Free): the only Publish while setting
//                  up. It asks once.
// While Continue can't be pressed, hovering or focusing it says what's left.
// The steps have no foot of their own: the bottom of the screen belongs to
// what's being worked on (the open lesson's Done / Add next lesson).
// Coming back to a draft opens its first step that isn't done.
//
// Editing (published, or published before and unpublished since): every
// step open, any time, as below, with the actions in the top row.
//   ← All courses          AI Engineering Accelerator              ✓ Saved   (focus bar)
//   ① Curriculum ✓  ② Landing page ✓  ③ Pricing ✓   [🗑 Delete course] │ [Copy link] [View landing page ↗] [● Published ▾]
//   ┌────────────────────────────────────────────────────────────────────┐
//   │ the open step                                                      │
//   └────────────────────────────────────────────────────────────────────┘
//
// The steps (data/courseSteps.js says which are done):
//   Curriculum     a workspace (ced--workspace): on screens 1100px wide
//                  and 640px tall or more, the page fits the screen and
//                  never scrolls. The step's card runs from the steps row
//                  to the bottom of the window. Inside it,
//                  the outline (CourseContent.jsx), and, once a lesson is
//                  clicked, that lesson beside it (LessonPane.jsx): a
//                  split view, one line between them, each column
//                  scrolling on its own. While the lesson's open the page
//                  widens to make room (ced--split), as it does for the
//                  guide. Smaller screens: the page scrolls as the other
//                  steps do. While editing, "See it as a student ↗" sits
//                  in the steps row: the lessons in the player
//   Landing page   the title, subtitle, what students will learn, cover,
//                  and, behind "+ Add", description, requirements, who
//                  it's for (CourseLanding.jsx)
//   Pricing        the price, and other contracts that give access
//                  (CoursePricing.jsx)
// A done step has a green tick in place of its number. Opens on the first
// step that isn't done, or Curriculum once they all are. Moving between
// steps, or leaving, asks first if something isn't saved ("Leave without
// saving?": an open lesson, the description).
//
// The actions, while editing:
//   Copy link            once published: the landing page link to share
//   View landing page ↗  what buyers see (CourseLandingPage.jsx)
//   Publish              only on a course unpublished since: with something
//                        missing it doesn't publish: it opens the first
//                        step that needs work, puts the cursor in the
//                        field, and says in one line at the top of that
//                        step what's left there. Else it asks once.
//   ● Published ▾        once live, in Publish's place: Unpublish (asks
//                        first; progress is kept)
//   🗑                    Delete course (asks first), in both modes
// Changes go live as they're made once it's published.
//
// The guide: on the Landing page and Pricing steps, the step's fields sit
// on the left and Meera's example course on the right (ProfileExample.jsx
// with courseAnnotations.js), in a browser frame that stays in view. The
// part of the example for the field they're in is boxed, named and
// explained, and moves as they go from field to field (each field's
// data-guide). It opens on the title (Landing page) or the price
// (Pricing). Only on screens wide enough for both columns (1100px and
// up); narrower, the fields have the width to themselves.
//
// The title is the Landing page's first field, and renames the course's
// own contract too (syncContractTitle).
//
// The Buy button's contract (Pricing) stays linked: Link contracts and
// Remove only change the other ones. On a published course, removing one
// asks first, as students on it lose the course.
//
// courseId, onBack()
// onFocus(focus | null): sets the focus bar (App.jsx → AppLayout's
//   FocusBar), as 1:1 calls do. Without it (an App that doesn't pass it
//   yet), the page shows its own "← All courses" instead.
// ------------------------------------------------------------

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Where the cursor goes for each missing field
const FIELD_TARGET = {
  subtitle: '#lnd-subtitle-input',
  outcomes: '.lrn--outcomes .lrn__input',
  price: '#prc-amount',
};

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

// Wide enough for the fields and the guide side by side
const GUIDE_MEDIA = '(min-width: 1100px)';
function useWide() {
  const [wide, setWide] = useState(() => window.matchMedia?.(GUIDE_MEDIA).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(GUIDE_MEDIA);
    if (!mq) return undefined;
    const on = () => setWide(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return wide;
}

// Where the guide opens on each step that has it
const GUIDE_START = { landing: 'title', pricing: 'price' };

const firstStepOf = (course) => {
  if (!course) return 'curriculum';
  const steps = courseSteps(course);
  return STEPS.find(({ id }) => !steps[id].done)?.id ?? 'curriculum';
};

export default function CoursePage({ courseId, onBack, onFocus }) {
  const course = useCourse(courseId);
  const contracts = useMemo(() => (course ? linkedContracts(course) : []), [course]);
  const counts = useMemo(() => signupCounts(contracts), [contracts]);
  const [step, setStep] = useState(() => firstStepOf(course));
  const [needs, setNeeds] = useState(false); // Publish was pressed with something missing
  const [focusField, setFocusField] = useState(null); // { field, n }: put the cursor there
  const [linking, setLinking] = useState(false);
  const [dirty, setDirty] = useState(false); // something open isn't saved yet
  const [pending, setPending] = useState(null); // what to do once they agree to leave it
  const [saveFailed, setSaveFailed] = useState(false); // the focus bar says "Not saved"
  const [notice, setNotice] = useState(null); // { text, tone }, at the foot of the screen
  const [publishing, setPublishing] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [unlinking, setUnlinking] = useState(null); // a contract on a published course, while asking
  const [deleting, setDeleting] = useState(false);
  const [paneOpen, setPaneOpen] = useState(false); // Curriculum: a lesson is open in its panel
  const noticeTimer = useRef(null);
  const exit = useRef(null); // the focus bar's way back, kept current
  const wide = useWide();
  const [guide, setGuide] = useState(() => GUIDE_START[step] ?? null); // the example's highlighted part
  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  // A new step: its guide starts on its first part
  useEffect(() => setGuide(GUIDE_START[step] ?? null), [step]);

  // The field they're in (focused or pressed) picks the guide's part
  const pickGuide = (e) => {
    const key = e.target.closest?.('[data-guide]')?.dataset.guide;
    if (key && courseAnnotations[key]) setGuide(key);
  };

  // Runs fn now, or after "Leave without saving?" when something isn't saved
  const guard = (fn) => (dirty ? setPending(() => fn) : fn());
  exit.current = () => guard(onBack);

  useEffect(() => {
    if (course) document.title = course.title;
  }, [course]);

  // Focus mode: the focus bar names the course, and its exit comes back here
  const title = course?.title ?? 'Course';
  useEffect(() => {
    onFocus?.({ title, exitLabel: 'All courses', saveFailed, onExit: () => exit.current() });
  }, [title, saveFailed, onFocus]);
  useEffect(() => () => onFocus?.(null), [onFocus]);

  // After Publish with something missing: the cursor in the field that needs it
  useEffect(() => {
    if (!focusField) return undefined;
    const id = requestAnimationFrame(() => {
      const selector = FIELD_TARGET[focusField.field];
      const fields = selector ? [...document.querySelectorAll(selector)] : [];
      const target = fields.find((el) => !el.value) ?? fields[0] ?? document.getElementById('ced-step-title');
      target?.focus();
      target?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(id);
  }, [focusField]);

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

  if (!course) {
    return (
      <div className="crs">
        {!onFocus && (
          <button type="button" className="crs__back" onClick={onBack}>
            <ArrowLeft size={16} aria-hidden="true" /> All courses
          </button>
        )}
        <section className="crs__panel crs__empty">
          <h1 className="crs__empty-title">This course isn’t here</h1>
          <p className="crs__empty-text">It may have been deleted. Go back to see your courses.</p>
        </section>
      </div>
    );
  }

  const live = isPublished(course);
  const steps = courseSteps(course);
  const missing = missingToPublish(course);
  const missingHere = missing.filter((m) => m.step === step);
  // Setting up: never published. A step opens once every step before it is done.
  const setup = !live && !course.publishedAt;
  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const reachable = (i) => !setup || STEPS.slice(0, i).every((s) => steps[s.id].done);
  const hasLesson = publishCheck(course).lessons > 0;

  // A change: the focus bar says "Not saved" when it didn't work
  const showSaved = (ok) => {
    setSaveFailed(!ok);
    return ok;
  };
  const save = (change) => showSaved(Boolean(updateCourse(course.id, change)));
  const saveTitle = (next) => {
    const ok = save({ title: next });
    if (ok) syncContractTitle(course, next);
    return ok;
  };

  const tell = (text, tone = 'ok') => {
    clearTimeout(noticeTimer.current);
    setNotice({ text, tone });
    noticeTimer.current = setTimeout(() => setNotice(null), 3600);
  };

  const go = (next) => next !== step && guard(() => setStep(next));

  // Publish: what's missing first, else ask once and publish
  const askPublish = () =>
    guard(() => {
      if (missing.length === 0) {
        setPublishing(true);
        return;
      }
      const first = missing[0];
      setNeeds(true);
      setStep(first.step);
      setFocusField({ field: first.field, n: Date.now() });
    });

  const removeContract = (id) => save({ contractIds: course.contractIds.filter((c) => c !== id) });
  // On a published course, removing a contract asks first
  const unlink = (id) =>
    live ? setUnlinking(contracts.find((c) => c.id === id) ?? { id, title: 'this contract' }) : removeContract(id);

  const publish = () => {
    setPublishing(false);
    if (publishCourse(course.id)) {
      setNeeds(false);
      tell('Published. Copy its link to share it.');
    } else tell('We couldn’t publish it just now. Try again.', 'error');
  };
  const unpublish = () => {
    setUnpublishing(false);
    if (unpublishCourse(course.id)) tell('Unpublished. It’s a draft again.');
    else tell('We couldn’t unpublish it just now. Try again.', 'error');
  };
  const remove = () => {
    setDeleting(false);
    if (deleteCourse(course.id)) onBack();
    else tell('We couldn’t delete it just now. Try again.', 'error');
  };
  const copyLink = async () => {
    const ok = await copyText(courseLandingUrl(course.id));
    if (ok) tell('Link copied. Anyone with it can see the course and buy it.');
    else tell('We couldn’t copy it. Open View landing page and copy its address instead.', 'error');
  };

  const stepNumber = STEPS.findIndex((s) => s.id === step) + 1;
  const stepLabel = STEPS.find((s) => s.id === step)?.label;
  const guided = wide && Boolean(GUIDE_START[step]);
  const split = step === 'curriculum' && paneOpen;
  // Curriculum is a workspace: the page fits the screen and each column
  // scrolls on its own (CoursePage.css, on screens big enough for it)
  const workspace = step === 'curriculum';

  const landingFields = (
    <CourseLanding key={course.id} course={course} onSave={save} onSaveTitle={saveTitle} onDirtyChange={setDirty} />
  );
  const pricingFields = (
    <CoursePricing
      course={course}
      contracts={contracts}
      counts={counts}
      onSave={save}
      onSaved={showSaved}
      onLink={() => setLinking(true)}
      onUnlink={unlink}
    />
  );

  return (
    <div
      className={['crs', 'ced', guided && 'ced--guided', split && 'ced--split', workspace && 'ced--workspace']
        .filter(Boolean)
        .join(' ')}
    >
      {!onFocus && (
        <button type="button" className="crs__back ced__back" onClick={() => guard(onBack)}>
          <ArrowLeft size={16} aria-hidden="true" /> All courses
        </button>
      )}

      {/* ---------- One row: the steps, and the course's actions ---------- */}
      <header className="ced__bar">
        <nav className="ced__stepper" aria-label="Course steps">
          <ol>
            {STEPS.map((s, i) => {
              const done = steps[s.id].done;
              const on = s.id === step;
              const open = on || reachable(i);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    className={`ced__step ${on ? 'ced__step--on' : ''} ${open ? '' : 'ced__step--locked'}`}
                    aria-current={on ? 'step' : undefined}
                    disabled={!open}
                    onClick={() => go(s.id)}
                  >
                    <span className={`ced__num ${done ? 'ced__num--done' : ''}`} aria-hidden="true">
                      {done ? <Check size={13} strokeWidth={3} /> : i + 1}
                    </span>
                    {s.label}
                    <span className="sr-only">
                      {done ? ', done' : open ? ', not done yet' : ', opens once the step before it is done'}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="ced__actions">
          {/* Delete course first, in red, set apart by a line, so it's never
              right beside the main button */}
          <button type="button" className="crs-btn crs-btn--small ced__delete" onClick={() => guard(() => setDeleting(true))}>
            <Trash2 size={16} aria-hidden="true" />
            Delete course
          </button>
          <span className="ced__actions-sep" aria-hidden="true" />

          {/* Setting up: the step's way forward, here at the top right */}
          {setup && (
            <SetupActions
              index={stepIndex}
              done={steps[step].done}
              missing={missingHere}
              courseId={course.id}
              hasLesson={hasLesson}
              onBack={() => go(STEPS[stepIndex - 1].id)}
              onNext={() =>
                guard(() => {
                  setStep(STEPS[stepIndex + 1].id);
                  window.scrollTo?.({ top: 0 });
                })
              }
              onPublish={() => guard(() => setPublishing(true))}
            />
          )}

          {!setup && step === 'curriculum' && (
            <a className="ced__bar-link" href={coursePlayerUrl(course.id, null, true)} target="_blank" rel="noopener">
              See it as a student
              <ExternalLink size={14} aria-hidden="true" />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          )}
          {!setup && live && (
            <button type="button" className="crs-btn crs-btn--quiet crs-btn--small" onClick={copyLink}>
              <Link2 size={16} aria-hidden="true" />
              Copy link
            </button>
          )}
          {!setup && (
            <a
              className="crs-btn crs-btn--quiet crs-btn--small"
              href={courseLandingUrl(course.id, true)}
              target="_blank"
              rel="noopener"
            >
              View landing page
              <ExternalLink size={15} aria-hidden="true" />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          )}
          {!setup &&
            (live ? (
              <PublishedMenu onUnpublish={() => setUnpublishing(true)} />
            ) : (
              <button type="button" className="crs-btn crs-btn--primary crs-btn--small" onClick={askPublish}>
                <Rocket size={16} aria-hidden="true" />
                Publish
              </button>
            ))}
        </div>
      </header>

      {/* ---------- The open step ---------- */}
      <section className="crs__panel ced__panel" aria-labelledby="ced-step-title">
        <h2 className="sr-only" id="ced-step-title" tabIndex={-1}>
          Step {stepNumber} of {STEPS.length}: {stepLabel}
        </h2>

        {needs && !live && missingHere.length > 0 && (
          <p className="ced__needs" role="status">
            <AlertTriangle size={16} aria-hidden="true" />
            <span>Before you publish: {missingHere.map((m) => m.text).join(', and ')}.</span>
          </p>
        )}

        <div className="ced__panel-body">
          {step === 'curriculum' && (
            <CourseContent
              course={course}
              onSaved={showSaved}
              guard={guard}
              onDirtyChange={setDirty}
              onPaneChange={setPaneOpen}
            />
          )}

          {GUIDE_START[step] &&
            (guided ? (
              <div className="ced__guided" onFocusCapture={pickGuide} onPointerDownCapture={pickGuide}>
                <div className="ced__guided-main">{step === 'landing' ? landingFields : pricingFields}</div>
                <aside className="ced__guide" aria-label="Example of a finished course page">
                  <ProfileExample page={COURSE_EXAMPLE_PAGE} questionId={guide} />
                </aside>
              </div>
            ) : step === 'landing' ? (
              landingFields
            ) : (
              pricingFields
            ))}
        </div>
      </section>

      {/* ---------- Pop-ups ---------- */}
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
          <p>What you’ve changed here and not saved will be lost.</p>
        </ConfirmDialog>
      )}

      {publishing && <PublishDialog course={course} onCancel={() => setPublishing(false)} onPublish={publish} />}

      {unpublishing && (
        <ConfirmDialog
          title="Unpublish this course?"
          confirmLabel="Unpublish"
          danger
          onCancel={() => setUnpublishing(false)}
          onConfirm={unpublish}
        >
          <p>
            <strong>{course.title}</strong> goes back to being a draft. Students won’t see it, and its link stops working,
            until you publish it again. Their progress is kept.
          </p>
        </ConfirmDialog>
      )}

      {deleting && (
        <ConfirmDialog
          title={live ? 'Delete this published course?' : 'Delete this course?'}
          confirmLabel="Delete course"
          danger
          onCancel={() => setDeleting(false)}
          onConfirm={remove}
        >
          <p>
            <strong>{course.title}</strong> will be deleted.{' '}
            {live && 'It’s published, so students lose it straight away, and their progress with it. '}
            Its contracts stay as they are. This can’t be undone.
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
            if (removeContract(id) && last && unpublishCourse(course.id)) tell('Unpublished. It’s a draft again.');
          }}
        >
          <p>
            {contracts.length <= 1 ? (
              <>
                A published course needs at least one contract, so removing <strong>{unlinking.title}</strong> unpublishes
                the course too. Students won’t see it until you set a price and publish again.
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
          value={course.contractIds.filter((id) => id !== course.buyContractId)}
          onCancel={() => setLinking(false)}
          onSave={(ids) => {
            // The Buy button's contract stays linked, first
            const buy = buyContractOf(course);
            const next = buy ? [buy.id, ...ids.filter((id) => id !== buy.id)] : ids;
            if (save({ contractIds: next })) setLinking(false);
          }}
        />
      )}

      <div className="crs__notice-wrap" aria-live="polite">
        {notice && (
          <p className={`crs__notice ${notice.tone === 'error' ? 'crs__notice--error' : ''}`}>
            {notice.tone === 'error' ? (
              <X size={16} aria-hidden="true" />
            ) : (
              <Check size={16} strokeWidth={3} aria-hidden="true" />
            )}
            {notice.text}
          </p>
        )}
      </div>
    </div>
  );
}

// While setting up, the step's way forward, at the right of the steps row
// (beside the steps it moves through, and pinned with them as the page
// scrolls): ← Back (after the first step), a preview where there's
// something to see, and the one main button: Continue to the next step,
// or Publish course on the last. It works once this step's minimum is
// done; until then it says what's left as a hint on hover or focus (and
// to screen readers).
//   Curriculum     See it as a student ↗ (once a lesson has something in it)
//                  · Continue to Landing page →
//   Landing page   ← Back · Preview landing page ↗ · Continue to Pricing →
//   Pricing        ← Back · Preview landing page ↗ · Publish course
// The main button is always solid orange: the way forward stays obvious,
// even while a lesson's own Add next lesson is on screen (far apart, each
// for its own area).
function SetupActions({ index, done, missing, courseId, hasLesson, onBack, onNext, onPublish }) {
  const last = index === STEPS.length - 1;
  const next = STEPS[index + 1];
  const preview =
    index === 0
      ? hasLesson && { href: coursePlayerUrl(courseId, null, true), label: 'See it as a student' }
      : { href: courseLandingUrl(courseId, true), label: 'Preview landing page' };
  const hint = done ? null : `To ${last ? 'publish' : 'continue'}, ${missing.map((m) => m.text).join(' and ')}.`;

  return (
    <>
      {index > 0 && (
        <button type="button" className="crs-btn crs-btn--quiet crs-btn--small" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" />
          Back
        </button>
      )}
      {preview && (
        <a className="ced__bar-link" href={preview.href} target="_blank" rel="noopener">
          {preview.label}
          <ExternalLink size={14} aria-hidden="true" />
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      )}
      <span className="ced__next-wrap" data-tip={hint ?? undefined} data-tip-align="end">
        <button
          type="button"
          className="crs-btn crs-btn--primary crs-btn--small ced__next"
          aria-disabled={!done || undefined}
          aria-describedby={hint ? 'ced-next-hint' : undefined}
          onClick={() => done && (last ? onPublish() : onNext())}
        >
          {last ? (
            <>
              <Rocket size={16} aria-hidden="true" />
              Publish course
            </>
          ) : (
            <>
              Continue to {next.label}
              <ArrowRight size={16} aria-hidden="true" />
            </>
          )}
        </button>
        {hint && (
          <span className="sr-only" id="ced-next-hint">
            {hint}
          </span>
        )}
      </span>
    </>
  );
}

// ● Published ▾, in Publish's place once it's live: Unpublish. Closes on a
// click outside or Escape.
function PublishedMenu({ onUnpublish }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);
  const button = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!wrap.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
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
  }, [open]);

  return (
    <div className={`crs-menu ced__menu ${open ? 'crs-menu--open' : ''}`} ref={wrap}>
      <button
        ref={button}
        type="button"
        className="ced__live"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="ced__live-dot" aria-hidden="true" />
        Published
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {open && (
        <div className="crs-menu__list" role="menu" aria-label="Published">
          <button
            type="button"
            role="menuitem"
            className="crs-menu__item"
            onClick={() => {
              setOpen(false);
              onUnpublish();
            }}
          >
            Unpublish
          </button>
        </div>
      )}
    </div>
  );
}

// "Link contracts": the contract picker, open, with the linked ones
// ticked (not the Buy button's, which always stays). Save keeps the
// change; Cancel or Escape doesn't.
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
        <p className="crs-field__help">People who sign up on any of these get the course too.</p>
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

// Publish, once nothing's missing: what goes live, and a note if there's
// no cover
function PublishDialog({ course, onCancel, onPublish }) {
  const check = publishCheck(course);
  const buy = buyContractOf(course);
  const others = check.contracts - (buy ? 1 : 0);
  return (
    <ConfirmDialog
      title={`Publish “${course.title}”?`}
      confirmLabel="Publish course"
      onCancel={onCancel}
      onConfirm={onPublish}
    >
      <ul className="pub">
        <li className="pub__row pub__row--ok">
          <Check size={17} strokeWidth={3} aria-hidden="true" />
          <span>
            {plural(check.lessons, 'lesson')} will go live
            {check.hidden > 0 && <span className="pub__note"> ({plural(check.hidden, 'empty lesson')} stay hidden)</span>}
          </span>
        </li>
        {buy && (
          <li className="pub__row pub__row--ok">
            <Check size={17} strokeWidth={3} aria-hidden="true" />
            <span>
              {servicePrice(buy) === 'Free' ? 'Free: people sign up to get it' : `Sold for ${servicePrice(buy)}`}
              {others > 0 && <span className="pub__note"> (and given through {plural(others, 'other contract')})</span>}
            </span>
          </li>
        )}
        {!check.cover && (
          <li className="pub__row pub__row--note">
            <AlertTriangle size={17} aria-hidden="true" />
            <span>No cover image yet: its card shows the title on our orange. You can add one on the Landing page.</span>
          </li>
        )}
      </ul>
      <p className="pub__after">Once it’s published, the changes you make go live straight away. You can unpublish any time.</p>
    </ConfirmDialog>
  );
}