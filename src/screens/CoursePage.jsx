import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ExternalLink,
  Eye,
  Link2,
  Loader2,
  Rocket,
  X,
} from 'lucide-react';
import {
  COURSE_TITLE_MAX,
  buyContractOf,
  courseLandingUrl,
  coursePlayerUrl,
  getCourse,
  isPublished,
  onCoursesChange,
  publishCheck,
  publishCourse,
  unpublishCourse,
  updateCourse,
} from '../data/courses';
import { STEPS, courseSteps, missingToPublish } from '../data/courseSteps';
import { coverVideoOf, trackRecordOf } from '../data/courseExtras';
import { copyText } from '../utils/copyText';
import { COURSE_EXAMPLE_PAGE, courseAnnotations } from '../data/courseAnnotations';
import ConfirmDialog from '../components/ConfirmDialog';
import ProfileExample from '../components/ProfileExample';
import CourseContent from './CourseContent';
import CourseLanding from './CourseLanding';
import CoursePricing, { priceOf, syncContractDescription, syncContractTitle } from './CoursePricing';
import CoursePublished from './CoursePublished';
import CourseStudents from './CourseStudents';
import './CoursesPage.css';
import './CoursePage.css';

// ------------------------------------------------------------
// One course's page: where Create course's Continue and Edit course land.
// In focus mode, as an open 1:1 call: the app's sidebar and top nav step
// aside, and its focus bar (AppLayout.jsx) is the way back, with the
// course's name in the middle, renamed right there (✎, always shown).
// Under it, one row: the steps (or tabs), then the save status and the
// course's actions. On each screen, only the next thing to do.
//
// Deleting a course is on the Courses list only (the card's ⋯ menu,
// CoursesPage.jsx), not here.
//
// Two modes:
//
// Setting up (a course never published yet): a guided path, one step at
// a time, as a new 1:1 call's flow is. Steps ahead are greyed and can't be
// opened until the ones before them are done; done ones can be opened
// again. The steps row carries the step's way forward on its right
// (SetupActions), pinned at the top as the page scrolls, after the save
// status. It works once that step's minimum is done:
//   ① Curriculum ✓  ② Landing page  ③ Pricing
//             ✓ Saved as draft │ [👁 Preview landing page ↗]  [← Back]  [Continue to Pricing →]
//   Curriculum     See it as a student ↗ (once a lesson has something in
//                  it), Continue to Landing page →
//   Landing page   ← Back, Preview landing page ↗, Continue to Pricing →,
//                  once it has a subtitle, a description (50 characters
//                  or more) and 3 things students will learn
//   Pricing        ← Back, Preview landing page ↗, Publish course, once it
//                  has a price (or Free): the only Publish while setting
//                  up. It asks once.
// While Continue can't be pressed, hovering or focusing it says what's left.
// The steps have no foot of their own: the bottom of the screen belongs to
// what's being worked on (the open lesson's Done / Add next lesson).
// Coming back to a draft opens its first step that isn't done.
//
// Editing (published, or published before and unpublished since): the
// steps are plain tabs (no numbers, no ticks: it's managing the course
// now, not making it), every one open, any time.
//   ← All courses     AI Engineering ✎     [Copy link] [View landing page ↗] [● Published ▾]   (focus bar)
//   Curriculum  Landing page  Price & access  Students        [👁 See it as a student ↗] ✓ Saved · live for students
//   ┌────────────────────────────────────────────────────────────────────┐
//   │ the open tab                                                       │
//   └────────────────────────────────────────────────────────────────────┘
//
// The save status (SaveStatus), the one place that says whether changes
// are saved (not the focus bar, not the lesson panel):
//   ● Unsaved changes            something's typed and not saved yet (a
//                                field still being typed in, a lesson's
//                                text not saved, an upload under way)
//   ⟳ Saving…                    for a moment after each change
//   ✓ Saved as draft             (green; a short highlight, then it stays)
//   ✓ Saved · live for students  the same, once published: changes are live
//   ⚠ Couldn't save · Retry      Retry runs the change again, when this
//                                page knows what it was (the landing page's
//                                fields, the title); otherwise it asks them
//                                to make the change again
// On narrower screens only its icon shows, with the words on hover.
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
//   Landing page   the title, subtitle, description, what students will
//                  learn, cover, and, behind "+ Add", requirements, who
//                  it's for, testimonials (CourseLanding.jsx)
//   Pricing        the price, with an optional discounted price
//                  (CoursePricing.jsx). Called Price & access while
//                  editing, where it also has Also included with: the
//                  other contracts whose people get the course too
//                  (CourseAlsoIncluded.jsx)
//   Students       editing only (published, or published before): the
//                  course's sales, students and refunds, everyone who
//                  bought it, and each student's details in a side panel
//                  (CourseStudents.jsx). Not a step: nothing to finish
//                  there, so publishing never sends them to it.
// Setting up: a done step has a green tick in place of its number. Opens
// on the first step that isn't done, or Curriculum once they all are.
// Moving between steps, or leaving, asks first if something isn't saved
// ("Leave without saving?": an open lesson, a description too long to save).
//
// The actions, while editing, in the focus bar on the right (CourseBarActions):
//   Copy link            once published: the landing page link to share
//   View landing page ↗  what buyers see (CourseLandingPage.jsx)
//   Publish              only on a course unpublished since: with something
//                        missing it doesn't publish: it opens the first
//                        tab that needs work, puts the cursor in the
//                        field, and says in one line at the top of that
//                        tab what's left there. Else it asks once.
//   ● Published ▾        once live, in Publish's place: Unpublish (asks
//                        first; progress is kept)
// Changes go live as they're made once it's published. The tabs row keeps
// only what belongs to the open tab: See it as a student on Curriculum, and
// the save status on every tab but Students (nothing there is edited).
//
// The title: renamed in the focus bar (here), on the Landing page step's
// Title field, or from the Courses list (⋯ → Rename). All the same name:
// it renames the course's own contract too (syncContractTitle). Renaming
// a published course says, while editing, that students and the landing
// page show the new name straight away. The link never changes.
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
// The description is the contract's description too, as plain text
// (syncContractDescription): it's what the checkout page says. A contract
// picked for the Buy button is never changed.
//
// A published course that's missing something publishing needs (one
// published before the description was needed, say) stays published: a
// line at the top of the tab says what to add. The tabs themselves show
// nothing.
//
// Publishing (Publish course while setting up, or Publish later): once
// they confirm, the course is published straight away and the step is
// replaced by the publish screen (CoursePublished.jsx). The first time, a
// short build (lessons, price, landing page, live) as a webinar's sign-up
// page has, then "Your course is live" with its link to share; published
// again after unpublishing, straight to the link. Go to your course comes
// back here, editing, on the Curriculum tab.
//
// courseId, onBack()
// onFocus(focus | null): sets the focus bar (App.jsx → AppLayout's
//   FocusBar), as 1:1 calls do. Without it (an App that doesn't pass it
//   yet), the page shows its own "← All courses" instead.
// ------------------------------------------------------------

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
// "a, b and c": what's missing, as one sentence
const inWords = (parts) =>
  parts.length < 2 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;

// Where the cursor goes for each missing field
const FIELD_TARGET = {
  subtitle: '#lnd-subtitle-input',
  description: '.lnd__desc .tte__content',
  outcomes: '.lrn--outcomes .lrn__input',
  price: '.prc__prices input',
};

// The save status: how long "Saving…" shows, then how long "Saved" stays lit
const SAVING_MS = 450;
const FRESH_MS = 1800;
// After leaving a field they typed in: if nothing saved by then, nothing changed
const TYPING_SETTLE_MS = 600;

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

// Editing only: the tab after the steps
const STUDENTS_TAB = { id: 'students', label: 'Students' };
// Editing: the Pricing step's tab name (its price, and Also included with)
const PRICING_TAB_LABEL = 'Price & access';

// Where the guide opens on each step that has it
const GUIDE_START = { landing: 'title', pricing: 'price' };

const firstStepOf = (course) => {
  if (!course) return 'curriculum';
  // Once it's been published, the tabs open on Curriculum
  if (isPublished(course) || course.publishedAt) return 'curriculum';
  const steps = courseSteps(course);
  return STEPS.find(({ id }) => !steps[id].done)?.id ?? 'curriculum';
};

export default function CoursePage({ courseId, onBack, onFocus }) {
  const course = useCourse(courseId);
  const [step, setStep] = useState(() => firstStepOf(course));
  const [needs, setNeeds] = useState(false); // Publish was pressed with something missing
  const [focusField, setFocusField] = useState(null); // { field, n }: put the cursor there
  const [dirty, setDirty] = useState(false); // something open isn't saved yet
  const [pending, setPending] = useState(null); // what to do once they agree to leave it
  const [saveState, setSaveState] = useState({ kind: 'saved', fresh: false }); // 'saving' | 'saved' | 'failed'
  const [typing, setTyping] = useState(false); // typed in a field that saves when they leave it
  const [notice, setNotice] = useState(null); // { text, tone }, at the foot of the screen
  const [publishing, setPublishing] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [published, setPublished] = useState(null); // { first }: the publish screen is up
  const [paneOpen, setPaneOpen] = useState(false); // Curriculum: a lesson is open in its panel
  const noticeTimer = useRef(null);
  const saveTimers = useRef([]);
  const typingTimer = useRef(null);
  const retry = useRef(null); // the change that couldn't be saved, to run again
  const exit = useRef(null); // the focus bar's way back, kept current
  const rename = useRef(null); // the focus bar's rename, kept current
  const bar = useRef({}); // the focus bar's buttons' actions, kept current
  const wide = useWide();
  const [guide, setGuide] = useState(() => GUIDE_START[step] ?? null); // the example's highlighted part

  const clearSaveTimers = () => {
    saveTimers.current.forEach(clearTimeout);
    saveTimers.current = [];
  };
  useEffect(
    () => () => {
      clearTimeout(noticeTimer.current);
      clearTimeout(typingTimer.current);
      clearSaveTimers();
    },
    [],
  );

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

  // Focus mode: the focus bar names the course (renamed right there), and
  // its exit comes back here. Its own "Saved" is off: the save status is in
  // the steps row.
  const title = course?.title ?? 'Course';
  const liveNow = isPublished(course);
  const setupNow = !course || (!liveNow && !course.publishedAt);
  useEffect(() => {
    onFocus?.({
      title,
      exitLabel: 'All courses',
      status: false,
      saveFailed: false,
      onExit: () => exit.current(),
      onRename: course ? (next) => rename.current?.(next) : null,
      titleMax: COURSE_TITLE_MAX,
      renameHint: liveNow ? 'Students and your landing page will show the new name straight away.' : null,
      // Editing: the course's own buttons, on the right of the bar
      actions: setupNow ? null : (
        <CourseBarActions
          live={liveNow}
          courseId={course.id}
          onCopy={() => bar.current.copyLink?.()}
          onPublish={() => bar.current.askPublish?.()}
          onUnpublish={() => setUnpublishing(true)}
        />
      ),
    });
  }, [title, liveNow, setupNow, course?.id, onFocus]); // eslint-disable-line react-hooks/exhaustive-deps
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
  // Editing: the steps as tabs, and Students after them
  // (Pricing is Price & access once it's published: it holds Also included with too)
  const tabs = setup
    ? STEPS
    : [...STEPS.map((s) => (s.id === 'pricing' ? { ...s, label: PRICING_TAB_LABEL } : s)), STUDENTS_TAB];
  const onStudents = !setup && step === 'students';
  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const reachable = (i) => !setup || STEPS.slice(0, i).every((s) => steps[s.id].done);
  const hasLesson = publishCheck(course).lessons > 0;

  // ---------- Saving ----------
  // After every change: "Saving…" for a moment, then "Saved" lit up, then
  // "Saved" settles. Or "Couldn't save", with what to run again if known.
  const showSaved = (ok, again = null) => {
    clearSaveTimers();
    clearTimeout(typingTimer.current);
    setTyping(false);
    if (!ok) {
      retry.current = again;
      setSaveState({ kind: 'failed' });
      return false;
    }
    retry.current = null;
    setSaveState({ kind: 'saving' });
    saveTimers.current.push(setTimeout(() => setSaveState({ kind: 'saved', fresh: true }), SAVING_MS));
    saveTimers.current.push(setTimeout(() => setSaveState({ kind: 'saved', fresh: false }), SAVING_MS + FRESH_MS));
    return true;
  };
  // What the steps' own parts report (lessons, the price): ok or not
  const onSaved = (ok) => showSaved(ok);

  const save = (change, again) => {
    const ok = Boolean(updateCourse(course.id, change));
    showSaved(ok, again ?? (() => save(change)));
    if (ok && 'description' in change) syncContractDescription(course, change.description);
    return ok;
  };
  const saveTitle = (next) => {
    const ok = save({ title: next }, () => saveTitle(next));
    if (ok) syncContractTitle(course, next);
    return ok;
  };
  rename.current = saveTitle;

  // Typing in a field that saves when they leave it: "Unsaved changes"
  // until it saves. Left without a change, nothing saves: it settles back.
  const onTyped = () => {
    clearTimeout(typingTimer.current);
    setTyping(true);
  };
  const onLeftField = () => {
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setTyping(false), TYPING_SETTLE_MS);
  };

  const status = saveState.kind === 'failed' ? 'failed' : dirty || typing ? 'unsaved' : saveState.kind;

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

  const publish = () => {
    setPublishing(false);
    if (publishCourse(course.id)) {
      setNeeds(false);
      setPublished({ first: !course.publishedAt });
    } else tell('We couldn’t publish it just now. Try again.', 'error');
  };
  const unpublish = () => {
    setUnpublishing(false);
    if (unpublishCourse(course.id)) tell('Unpublished. It’s a draft again.');
    else tell('We couldn’t unpublish it just now. Try again.', 'error');
  };
  const copyLink = async () => {
    const ok = await copyText(courseLandingUrl(course.id));
    if (ok) tell('Link copied. Anyone with it can see the course and buy it.');
    else tell('We couldn’t copy it. Open View landing page and copy its address instead.', 'error');
  };

  bar.current = { copyLink, askPublish };

  const stepNumber = STEPS.findIndex((s) => s.id === step) + 1;
  const stepLabel = tabs.find((s) => s.id === step)?.label;
  const guided = wide && Boolean(GUIDE_START[step]);
  const split = step === 'curriculum' && paneOpen;
  // Curriculum is a workspace: the page fits the screen and each column
  // scrolls on its own (CoursePage.css, on screens big enough for it)
  const workspace = step === 'curriculum';

  const landingFields = (
    <CourseLanding key={course.id} course={course} onSave={save} onSaveTitle={saveTitle} onDirtyChange={setDirty} />
  );
  const pricingFields = <CoursePricing course={course} onSave={save} onSaved={onSaved} showAccess={!setup} />;

  // Just published: the publish screen, in place of the steps. Go to your
  // course comes back on the Curriculum tab.
  if (published) {
    return (
      <div className="crs ced ced--published">
        <CoursePublished
          course={course}
          animate={published.first}
          onDone={() => {
            setPublished(null);
            setStep('curriculum');
          }}
        />
      </div>
    );
  }

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

      {/* ---------- One row: the steps (or tabs), the save status, the actions ---------- */}
      <header className="ced__bar">
        <nav
          className={`ced__stepper ${setup ? '' : 'ced__stepper--tabs'}`}
          aria-label={setup ? 'Course steps' : 'Course'}
        >
          <ol>
            {tabs.map((s, i) => {
              const done = steps[s.id]?.done ?? false;
              const on = s.id === step;
              const open = on || reachable(i);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    className={`ced__step ${on ? 'ced__step--on' : ''} ${open ? '' : 'ced__step--locked'}`}
                    aria-current={on ? (setup ? 'step' : 'page') : undefined}
                    disabled={!open}
                    // A click doesn't leave the keyboard's focus ring on it
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => go(s.id)}
                  >
                    {/* Setting up only: the number, or a tick once done. Tabs show just the name. */}
                    {setup && (
                      <span className={`ced__num ${done ? 'ced__num--done' : ''}`} aria-hidden="true">
                        {done ? <Check size={13} strokeWidth={3} /> : i + 1}
                      </span>
                    )}
                    {s.label}
                    {setup && (
                      <span className="sr-only">
                        {done ? ', done' : open ? ', not done yet' : ', opens once the step before it is done'}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="ced__actions">
          {setup ? (
            <>
              {/* Whether changes are saved: the one place that says so */}
              <SaveStatus
                status={status}
                fresh={saveState.kind === 'saved' && saveState.fresh}
                live={live}
                canRetry={Boolean(retry.current)}
                onRetry={() => retry.current?.()}
              />
              <span className="ced__actions-sep" aria-hidden="true" />

              {/* Setting up: the step's way forward, here at the top right */}
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
            </>
          ) : (
            <>
              {/* Editing: only what belongs to the open tab. The course's own
                  buttons are in the focus bar (CourseBarActions). */}
              {step === 'curriculum' && (
                <a
                  className="crs-btn crs-btn--small ced__preview"
                  href={coursePlayerUrl(course.id, null, true)}
                  target="_blank"
                  rel="noopener"
                >
                  <Eye size={16} aria-hidden="true" />
                  See it as a student
                  <ExternalLink size={14} aria-hidden="true" />
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              )}
              {/* Nothing to edit on Students, so nothing to say about saving */}
              {!onStudents && (
                <SaveStatus
                  status={status}
                  fresh={saveState.kind === 'saved' && saveState.fresh}
                  live={live}
                  canRetry={Boolean(retry.current)}
                  onRetry={() => retry.current?.()}
                />
              )}
            </>
          )}
        </div>
      </header>

      {/* ---------- The open step ---------- */}
      {/* Students: its own panels, straight on the page */}
      {onStudents && (
        <section className="ced__students" aria-labelledby="ced-step-title">
          <h2 className="sr-only" id="ced-step-title" tabIndex={-1}>
            Students
          </h2>
          <CourseStudents course={course} />
        </section>
      )}

      {/* Typing in a field shows "Unsaved changes" until it saves */}
      {!onStudents && (
        <section
          className="crs__panel ced__panel"
          aria-labelledby="ced-step-title"
          onInputCapture={onTyped}
          onBlurCapture={onLeftField}
        >
          <h2 className="sr-only" id="ced-step-title" tabIndex={-1}>
            {setup ? `Step ${stepNumber} of ${STEPS.length}: ${stepLabel}` : stepLabel}
          </h2>

          {needs && !live && missingHere.length > 0 && (
            <p className="ced__needs" role="status">
              <AlertTriangle size={16} aria-hidden="true" />
              <span>Before you publish: {inWords(missingHere.map((m) => m.text))}.</span>
            </p>
          )}
          {live && missingHere.length > 0 && (
            <p className="ced__needs" role="status">
              <AlertTriangle size={16} aria-hidden="true" />
              <span>
                Your course stays live, but this tab isn’t finished: {inWords(missingHere.map((m) => m.text))}.
              </span>
            </p>
          )}

          <div className="ced__panel-body">
            {step === 'curriculum' && (
              <CourseContent
                course={course}
                onSaved={onSaved}
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
      )}

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
            <strong>{course.title}</strong> goes back to being a draft. Students won’t see it, and its link stops
            working, until you publish it again. Their progress is kept.
          </p>
        </ConfirmDialog>
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

// Whether changes are saved, in the steps row, before the actions:
//   ● Unsaved changes · ⟳ Saving… · ✓ Saved as draft (✓ Saved · live for
//   students) · ⚠ Couldn't save · Retry
// "Saved" lights up green for a moment after each save (fresh), then
// stays, quieter. On narrower screens only the icon shows (CoursePage.css);
// the words are in its tooltip and still read out.
// status: 'unsaved' | 'saving' | 'saved' | 'failed'; live: published;
// canRetry: Retry can run the change again; onRetry()
function SaveStatus({ status, fresh, live, canRetry, onRetry }) {
  const text = {
    unsaved: 'Unsaved changes',
    saving: 'Saving…',
    saved: live ? 'Saved · live for students' : 'Saved as draft',
    failed: canRetry ? 'Couldn’t save' : 'Couldn’t save your last change. Make it again.',
  }[status];
  const icon = {
    unsaved: <span className="ced__status-dot" />,
    saving: <Loader2 size={15} className="ced__status-spin" />,
    saved: <Check size={15} strokeWidth={2.75} />,
    failed: <AlertTriangle size={15} />,
  }[status];

  return (
    <div className={`ced__status ced__status--${status} ${fresh ? 'ced__status--fresh' : ''}`} title={text}>
      <span className="ced__status-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="ced__status-text" role="status" aria-live="polite">
        {text}
      </span>
      {status === 'failed' && canRetry && (
        <button type="button" className="ced__status-retry" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

// While setting up, the step's way forward, at the right of the steps row
// (beside the steps it moves through, and pinned with them as the page
// scrolls): a preview where there's something to see (a soft orange
// button with an eye: "look at it"), then ← Back right beside the one
// main button, so the two that move between steps sit together:
// Continue to the next step, or Publish course on the last. Left to
// right, each look means one thing: soft orange (look), white (go back),
// solid orange (go forward). It works once this step's minimum is
// done; until then it says what's left as a hint on hover or focus (and
// to screen readers).
//   Curriculum     👁 See it as a student ↗ (once a lesson has something
//                  in it) · Continue to Landing page →
//   Landing page   👁 Preview landing page ↗ · ← Back · Continue to Pricing →
//   Pricing        👁 Preview landing page ↗ · ← Back · Publish course
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
  const hint = done ? null : `To ${last ? 'publish' : 'continue'}, ${inWords(missing.map((m) => m.text))}.`;

  return (
    <>
      {preview && (
        <a className="crs-btn crs-btn--small ced__preview" href={preview.href} target="_blank" rel="noopener">
          <Eye size={16} aria-hidden="true" />
          {preview.label}
          <ExternalLink size={14} aria-hidden="true" />
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      )}
      {index > 0 && (
        <button type="button" className="crs-btn crs-btn--quiet crs-btn--small" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" />
          Back
        </button>
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

// The course's own buttons, while editing: in the app's focus bar, on the
// right (AppLayout.jsx, focus.actions), so the tabs row under it holds only
// the tabs and what belongs to the open tab.
//   [🔗 Copy link] [View landing page ↗] [● Published ▾]
//   Copy link            once published: the landing page link to share
//   View landing page ↗  what buyers see (CourseLandingPage.jsx)
//   Publish              only on a course unpublished since (askPublish)
//   ● Published ▾        once live, in Publish's place: Unpublish
// Where the bar gets tight (CoursePage.css), Copy link and View landing
// page shrink to their icons, with the words in their hint.
function CourseBarActions({ live, courseId, onCopy, onPublish, onUnpublish }) {
  return (
    <div className="focusbar__actions">
      {live && (
        <button
          type="button"
          className="crs-btn crs-btn--quiet crs-btn--small"
          onClick={onCopy}
          data-tip="Copy link"
          data-tip-align="end"
        >
          <Link2 size={16} aria-hidden="true" />
          <span className="focusbar__act-label">Copy link</span>
        </button>
      )}
      <a
        className="crs-btn crs-btn--quiet crs-btn--small"
        href={courseLandingUrl(courseId, true)}
        target="_blank"
        rel="noopener"
        data-tip="View landing page"
        data-tip-align="end"
      >
        <span className="focusbar__act-label">View landing page</span>
        <ExternalLink size={15} aria-hidden="true" />
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
      {live ? (
        <PublishedMenu onUnpublish={onUnpublish} />
      ) : (
        <button type="button" className="crs-btn crs-btn--primary crs-btn--small" onClick={onPublish}>
          <Rocket size={16} aria-hidden="true" />
          Publish
        </button>
      )}
    </div>
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

// Publish, once nothing's missing: what goes live, and notes (they don't
// stop it): no cover (neither an image nor a video), and the track record
// not turned on (it's recommended)
function PublishDialog({ course, onCancel, onPublish }) {
  const check = publishCheck(course);
  const buy = buyContractOf(course);
  const others = check.contracts - (buy ? 1 : 0);
  const price = priceOf(buy);
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
            {check.hidden > 0 && (
              <span className="pub__note"> ({plural(check.hidden, 'empty lesson')} stay hidden)</span>
            )}
          </span>
        </li>
        {buy && (
          <li className="pub__row pub__row--ok">
            <Check size={17} strokeWidth={3} aria-hidden="true" />
            <span>
              {price.free ? (
                'Free: people sign up to get it'
              ) : (
                <>
                  Sold for {price.now}
                  {price.was && (
                    <>
                      {' '}
                      <span className="sr-only">, was </span>
                      <s className="pub__was">{price.was}</s> ({price.off}% off)
                    </>
                  )}
                </>
              )}
              {others > 0 && <span className="pub__note"> · also included with {plural(others, 'contract')}</span>}
            </span>
          </li>
        )}
        {!check.cover && !coverVideoOf(course) && (
          <li className="pub__row pub__row--note">
            <AlertTriangle size={17} aria-hidden="true" />
            <span>
              No cover yet: its card shows the title on our orange. You can add an image or a video on the Landing page.
            </span>
          </li>
        )}
        {!trackRecordOf(course).on && (
          <li className="pub__row pub__row--note">
            <AlertTriangle size={17} aria-hidden="true" />
            <span>
              Your track record isn’t shown. It’s recommended: it helps buyers trust your course. You can turn it on in
              Landing page.
            </span>
          </li>
        )}
      </ul>
      <p className="pub__after">
        Once it’s published, the changes you make go live straight away. You can unpublish any time.
      </p>
    </ConfirmDialog>
  );
}