import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, Copy, ExternalLink } from 'lucide-react';
import QuestionFlow from './QuestionFlow';
import ProfileExample from '../components/ProfileExample';
import { useCopy } from './OfferingsHome';
import { myPageQuestions } from '../data/myPageQuestions';
import { addedCallsOf, hasSetupCall, loadAnswers, myCallIds, newCallId } from '../data/myProfile';
import { offeringUrl } from '../data/myPage';
import { DEFAULT_HOURS, loadCallHours, saveCallHours } from '../data/availabilityStore';
import { isCalendarConnected, loadCalendar } from '../data/calendarStore';
import { cleanQuestions, questionsOf } from '../data/callQuestions';
import { TITLE_SUGGESTIONS, callAboutOf, callDescriptionOf } from '../data/callDetails';
import { clearCallDraft, saveCallDraft } from '../data/callDraft';
import { contractPreviewSrc } from '../components/ServiceSummaryInput';
import './QuestionFlow.css'; // flow-in, shared with the rest of the flow
import './CreateCallFlow.css';

// ------------------------------------------------------------
// "Create a 1:1 call": the call part of setup, one question per screen,
// for every new call made in the 1:1 calls tab.
//
//   1 Set up your 1:1 call        name, length, price (no short description:
//                                  that's the offerings card's line; we save
//                                  the one suggested from the name)
//   2 Connect your Google Calendar  only if it isn't connected
//   3 Set your working hours      starts from their newest call's hours
//   4 Describe your call
//   5 Ask additional questions during checkout  starts with the default
//                                  question; beside it, an example checkout
//                                  (fixed questions), not their own
//   6 We've set up the contract for your call  beside it, their own
//                                  contract (its checkout, as a preview)
//   then: a short "setting it up" checklist, and "… is ready to book"
//         (its link with Copy link, Preview, Go to my 1:1 calls)
//
// Beside the screens: Meera Joshi's example pages, fixed, the same for
// every call, with the part each screen sets highlighted. Her booking page
// for the call's name, hours and description; her checkout, with example
// questions, for the questions screen (profileAnnotations.js). Nothing on
// them changes as they type. Same frame and marks as setup's (ProfileExample.jsx).
// The contract screen is the exception: beside it is their own contract,
// read from the draft (callDraft.js), since seeing it is what explains it.
// Their own booking page opens from Preview on the ready screen.
//
// The call only exists once they finish. Leaving before that keeps
// nothing, except hours saved under an id no call uses and, if they got
// to the last screen, its contract.
//
// hasLinks: they've picked their page link, so the call has a link of its own
// handle: their page link (for the call's link), or null
// onExit(): Back on the first screen, nothing made
// onCreate(call): the new call's answers (with its id), to add it
// onDone(callId): the button on the ready screen
// doneLabel: its words, for where they started ("Go to my 1:1 calls", or
//   "Back to your offerings page" when they started from there)
// ------------------------------------------------------------

const STEP_IDS = ['callDetails', 'calendar', 'availability', 'callAbout', 'callQuestions', 'service'];
const ALL_STEPS = STEP_IDS.map((id) => myPageQuestions.find((q) => q.id === id)).map((q) =>
  q.id === 'callDetails'
    ? { ...q, showDescription: false }
    : q.id === 'service'
      ? { ...q, contractAside: true } // their contract is beside it, so its card's Preview steps back
      : q,
);

// What each screen fills in, pointed out on Meera's booking page (see
// profileAnnotations.js for the shape). The calendar and contract screens
// have no preview; the questions screen uses setup's note (her checkout).
// The name and description pills sit in the empty space under the page
// (labelAt 'under'), so they never cover the details around what they point at
const UNDER_THE_PAGE = '.bk__details, .bk__picker-card';

const CALL_PAGE_NOTES = {
  callDetails: {
    page: 'book',
    target: '.cd__title',
    label: 'Title of your 1:1 call event',
    labelAt: 'under',
    under: UNDER_THE_PAGE,
  },
  availability: {
    page: 'book',
    target: '.bk__picker-card',
    label: 'This is where people pick a time',
    tip: 'The times they see come from the hours you set here.',
  },
  callAbout: {
    page: 'book',
    target: '.cd__about',
    label: 'This is your 1:1 call event’s description',
    labelAt: 'under',
    under: UNDER_THE_PAGE,
  },
};

const strip = ({ saved, ...rest }) => rest; // eslint-disable-line no-unused-vars

// The name it starts with: the first suggestion none of their calls has
// (so a second call doesn't open as another "Discovery call"), or empty
function startingTitle() {
  const answers = loadAnswers();
  const taken = [...addedCallsOf(answers), ...(hasSetupCall(answers) ? [answers] : [])].map((c) =>
    String(c.callTitle ?? '').trim().toLowerCase(),
  );
  return TITLE_SUGGESTIONS.find((t) => !taken.includes(t.toLowerCase())) ?? '';
}

export default function CreateCallFlow({
  handle = null,
  hasLinks = false,
  onExit,
  onCreate,
  onDone,
  doneLabel = 'Go to my 1:1 calls',
}) {
  // The id it will have, from the start, so its hours and preview use it
  const [callId] = useState(newCallId);
  const [draft, setDraft] = useState(() => ({ callId, callTitle: startingTitle() }));
  const [ready, setReady] = useState(false);

  // Their contract, for the panel beside the contract screen: the checkout
  // preview of the call being made. The page follows the draft as it changes.
  const contractPage = useMemo(() => {
    const link = hasLinks ? `${offeringUrl(handle, callId).replace(/^https?:\/\//, '')}/checkout` : 'Your contract';
    return {
      src: contractPreviewSrc({ callId }),
      link,
      caption: 'Your contract',
      byline: '',
      // Labelled by a tag stuck on the frame, since it's about the whole page.
      // Nothing on the page itself: it's just held still at its top.
      tag: 'This is your contract page',
      annotations: {
        service: {
          page: 'checkout',
          target: '.co__layout',
          noBox: true,
          noLabel: true,
          stayAtTop: true,
        },
      },
    };
  }, [hasLinks, handle, callId]);

  // The calendar screen only for someone who hasn't connected one.
  // Decided once, so connecting on that screen doesn't make it vanish.
  const [steps] = useState(() =>
    isCalendarConnected(loadCalendar()) ? ALL_STEPS.filter((q) => q.id !== 'calendar') : ALL_STEPS,
  );

  // Its hours start as a copy of their newest call's, or the usual weekdays
  useEffect(() => {
    const newest = myCallIds(loadAnswers())[0];
    saveCallHours(callId, newest ? strip(loadCallHours(newest)) : structuredClone(DEFAULT_HOURS));
  }, [callId]);

  // Kept in this browser as they go, so their contract beside the contract
  // screen (another page, in a frame) can show the call before it exists.
  // Cleared once the call is made, or when they leave.
  useEffect(() => {
    saveCallDraft(draft);
  }, [draft]);
  useEffect(() => () => clearCallDraft(), []);

  const handleAnswer = (id, value) => setDraft((prev) => ({ ...prev, [id]: value }));

  const finish = () => {
    onCreate({
      id: callId,
      createdAt: new Date().toISOString(),
      callTitle: String(draft.callTitle ?? '').trim(),
      callDuration: draft.callDuration,
      callFormat: draft.callFormat,
      callPricing: draft.callPricing,
      callPrice: draft.callPrice,
      callComparePrice: draft.callComparePrice,
      // Not asked here: the line suggested from the name, for its card if it
      // goes on the offerings page. Fixed now, so it no longer follows the name.
      callDescription: callDescriptionOf(draft),
      callAbout: callAboutOf(draft),
      callQuestions: cleanQuestions(questionsOf(draft)), // what they set on the questions step
      serviceId: draft.serviceId,
    });
    clearCallDraft();
    setReady(true);
  };

  if (ready) {
    return (
      <CallReady
        callId={callId}
        title={String(draft.callTitle ?? '').trim()}
        url={hasLinks ? offeringUrl(handle, callId) : null}
        doneLabel={doneLabel}
        onDone={() => onDone(callId)}
      />
    );
  }

  return (
    <QuestionFlow
      key="create-call"
      backAtTop
      pageName="New 1:1 call"
      questions={steps}
      answers={draft}
      onAnswer={handleAnswer}
      onExit={onExit}
      finishLabel="Create call"
      onComplete={finish}
      asideWidth="half"
      renderAside={({ question }) =>
        question.id === 'service' ? (
          // Their own contract, as people will see it, still, with a pill on it.
          // Its own key, so it starts fresh rather than reusing the questions
          // screen's frame, whose highlight would otherwise carry over
          <ProfileExample key="contract" questionId="service" page={contractPage} />
        ) : question.preview === false ? null : question.id === 'callQuestions' ? (
          // Her checkout, with example questions (profileAnnotations.js)
          <ProfileExample questionId="callQuestions" />
        ) : (
          // Her booking page, with this screen's part highlighted
          <ProfileExample questionId={question.id} notes={CALL_PAGE_NOTES} />
        )
      }
    />
  );
}

// ---------- The call, made ----------
// One job: the call is live, here's its link. First a short "setting it up"
// checklist ticks off, in the same style as the webinar funnel's building
// step (BuildingStep.jsx), then the finished screen rises in and the link
// writes itself into its field. Plays once; with reduced motion it starts
// finished.
//
//        ✓
//   "1:1 session" is ready to book
//   Anyone with this link can pick a time and book you.
//   ┌──────────────────────────────────────────┬────────────┐
//   │ openslate.app/harishneel/my-call-…       │ Copy link  │
//   └──────────────────────────────────────────┴────────────┘
//   [↗ Preview]
//   Go to my 1:1 calls →
//
// url: its own link, or null when there isn't one yet (Preview only)
const READY_STEPS = [
  'Saving your call details',
  'Setting up your booking times',
  'Connecting your contract',
  'Creating your booking link',
];
const READY_STEP_MS = 700; // one tick every 0.7s, as in the webinar funnel
const READY_PAUSE = 400;   // a beat after the last tick, then the reveal

const prefersLessMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function CallReady({ callId, title, url, doneLabel, onDone }) {
  const [copy, copyLink] = useCopy();
  const bookingSrc = `${window.location.pathname}?mock=book&service=${encodeURIComponent(callId)}`;
  const shown = url ? url.replace(/^https?:\/\//, '') : null;
  const name = title || 'Your 1:1 call';

  // Decided once, so it never replays
  const [skip] = useState(prefersLessMotion);
  const [done, setDone] = useState(skip ? READY_STEPS.length : 0); // steps ticked
  const [ready, setReady] = useState(skip);

  useEffect(() => {
    if (skip) return undefined;
    const timers = READY_STEPS.map((_, i) => setTimeout(() => setDone(i + 1), READY_STEP_MS * (i + 1)));
    timers.push(setTimeout(() => setReady(true), READY_STEP_MS * READY_STEPS.length + READY_PAUSE));
    return () => timers.forEach(clearTimeout);
  }, [skip]);

  if (!ready) {
    return (
      <div className="ready ready--building">
        <h1 className="ready__title">Setting up your 1:1 call…</h1>
        <ul className="ready__steps" aria-live="polite">
          {READY_STEPS.map((step, i) => {
            const state = i < done ? 'done' : i === done ? 'current' : 'todo';
            return (
              <li key={step} className={`ready__step ready__step--${state}`}>
                <span className="ready__mark" aria-hidden="true">
                  {state === 'done' && <Check size={14} strokeWidth={3} />}
                </span>
                {step}
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <div className={`ready ${skip ? 'ready--still' : ''}`}>
      <span className="ready__tick" aria-hidden="true">
        <Check size={26} strokeWidth={3} />
      </span>
      <h1 className="ready__title ready__in">“{name}” is ready to book</h1>
      <p className="ready__text ready__in">
        {url
          ? 'Anyone with this link can pick a time and book you.'
          : 'It gets its own link to share once you pick your page link.'}
      </p>

      {url && (
        // The link: something to copy, not to read. Copy link is the one
        // orange button here.
        <div className="ready__link">
          <span className="ready__url" title={shown}>
            {shown}
          </span>
          <button type="button" className="ready__copy" onClick={() => copyLink(url)}>
            {copy === 'copied' ? <Check size={15} strokeWidth={3} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
            {copy === 'copied' ? 'Copied' : 'Copy link'}
          </button>
        </div>
      )}
      <span className="sr-only" aria-live="polite">
        {copy === 'copied' && 'Link copied'}
      </span>
      {copy === 'failed' && (
        <p className="qinput__error ready__error" role="alert">
          Couldn’t copy. Select the link and copy it yourself.
        </p>
      )}

      {/* A real link, so cmd/middle-click and popup blockers behave normally */}
      <a
        className="ready__preview ready__later"
        href={url ?? bookingSrc}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Preview the booking page (opens in a new tab)"
      >
        <ExternalLink size={15} aria-hidden="true" />
        Preview
      </a>

      <button type="button" className="ready__done ready__later" onClick={onDone}>
        {doneLabel}
        <ArrowRight size={16} aria-hidden="true" />
      </button>
    </div>
  );
}