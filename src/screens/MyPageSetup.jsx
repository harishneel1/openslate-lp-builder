import { useMemo, useState } from 'react';
import QuestionFlow from './QuestionFlow';
import ProfileExample from '../components/ProfileExample';
import MyPageIntro from './MyPageIntro';
import MyPageReveal from './MyPageReveal';
import OfferingsHome from './OfferingsHome';
import EditService from './EditService';
import CreateCallFlow from './CreateCallFlow';
import EditProfile from './EditProfile';
import { myPageQuestions } from '../data/myPageQuestions';
import { SHARED_CALL_KEYS, addedCallsOf, withAddedCall, withCallChanges, withHiddenOnPage, withOnPage, withoutSetupCall } from '../data/myProfile';
import { isCalendarConnected, loadCalendar } from '../data/calendarStore';
import { PAGE_DOMAIN } from '../data/myPage';
import { useSetupAnswers } from '../utils/useSetupAnswers';

// Answers the 1:1 calls tab saves (its calls, which are on the page, and
// the meeting link they share). Having only these doesn't mean they've
// started setting up their page, so they still get the intro.
const CALLS_TAB_KEYS = ['addedCalls', 'offPage', 'hiddenOnPage', ...SHARED_CALL_KEYS];
const hasStartedSetup = (answers) => Object.keys(answers).some((key) => !CALLS_TAB_KEYS.includes(key));

// Setup's screens for this creator, decided once when it opens:
// "Which of your 1:1 calls…" only if they've made calls already, and the
// calendar screen only if it isn't connected (so connecting on it
// doesn't make it vanish mid-setup).
// With calls to pick from, the call questions wait until they choose
// "Create a new 1:1 call", so the progress doesn't count screens they
// may never see.
function questionsFor(answers) {
  const hasCalls = addedCallsOf(answers).length > 0;
  const calendarDone = isCalendarConnected(loadCalendar());
  return myPageQuestions
    .filter((q) => (q.onlyWithCalls ? hasCalls : q.id === 'calendar' ? !calendarDone : true))
    .map((q) => (hasCalls && q.showIf?.field === 'callSource' ? { ...q, showIf: { field: 'callSource', equals: 'new' } } : q));
}

// Finishing setup with calls they'd already made: those go on the page.
// The picking answers aren't kept, and nor is a setup call they'd started
// (gone into "Create a new 1:1 call", then come back and ticked calls).
function withPickedCalls(answers) {
  const { pickedCalls = [], pickedLines, ...rest } = answers; // eslint-disable-line no-unused-vars
  return pickedCalls.reduce((acc, id) => withOnPage(acc, id, true), withoutSetupCall(rest));
}

// Beside "Which calls go on your page?": their own page, not Meera's,
// showing just the calls they've ticked as they tick them (?live=1)
const ownPagePreview = (handle) => ({
  src: `${window.location.pathname}?mock=profile&source=mine&live=1`,
  link: `${PAGE_DOMAIN}/${handle ?? ''}`,
  caption: 'Your storefront',
  byline: 'Your calls show up as you pick them',
});

// ------------------------------------------------------------
// The offerings page, the first time: an intro to what a page is, then
// questions on the left with a popular creator's page on the right,
// the part each answer fills in highlighted, then their page, live.
// After that, the offerings home: no more questions, just their page and
// the calls on it. Calls are made in the 1:1 calls tab; here they're put
// on the page (or a new one is made with the same guided flow, and lands
// on the page). Edit opens the same call editor as 1:1 calls.
// Answers are kept in this browser for now.
// ------------------------------------------------------------
export default function MyPageSetup() {
  const [answers, setAnswers] = useSetupAnswers();
  // Setup: 'intro' → 'questions' → 'done' (the page, live, shown once).
  // Then: 'home' (the offerings home) ↔ 'editService' (one offering)
  //                                    ↔ 'createCall' (a new 1:1 call, guided)
  //                                    ↔ 'editProfile' (photo, name, bio, link).
  // Finished before? The home. Started before? Straight to the questions.
  const [step, setStep] = useState(() =>
    answers.publishedAt ? 'home' : hasStartedSetup(answers) ? 'questions' : 'intro'
  );
  const [editingId, setEditingId] = useState(null); // the offering open in 'editService'
  const [justAddedIds, setJustAddedIds] = useState([]); // marked on the home after adding them
  const [questions] = useState(() => questionsFor(answers));
  const ownPage = useMemo(() => ownPagePreview(answers.handle), [answers.handle]);

  const handleAnswer = (id, value) => setAnswers((prev) => ({ ...prev, [id]: value }));

  if (step === 'intro') {
    return <MyPageIntro onStart={() => setStep('questions')} />;
  }

  // Done: the page is live. "Done" goes to the home, not back to the questions.
  if (step === 'done') {
    return <MyPageReveal handle={answers.handle} onDone={() => setStep('home')} />;
  }

  if (step === 'home') {
    return (
      <OfferingsHome
        answers={answers}
        onEditProfile={() => setStep('editProfile')}
        justAddedIds={justAddedIds}
        onEditOffering={(id) => {
          setEditingId(id);
          setJustAddedIds([]);
          setStep('editService');
        }}
        // Picked in "Add to your page": on the page, with any card lines they changed
        onAddCalls={({ ids, descriptions }) => {
          setAnswers((prev) => {
            const withLines = Object.entries(descriptions).reduce(
              (acc, [id, text]) => withCallChanges(acc, id, { callDescription: text }),
              prev,
            );
            return ids.reduce((acc, id) => withOnPage(acc, id, true), withLines);
          });
          setJustAddedIds(ids);
        }}
        onCreateCall={() => {
          setJustAddedIds([]);
          setStep('createCall');
        }}
        onSetOnPage={(id, on) => {
          setAnswers((prev) => withOnPage(prev, id, on));
          setJustAddedIds([]);
        }}
        // Visible / Hidden: stays on the list either way
        onSetHidden={(id, hidden) => setAnswers((prev) => withHiddenOnPage(prev, id, hidden))}
      />
    );
  }

  // A new 1:1 call, made the same way as in 1:1 calls. Started from here,
  // it goes on the page as soon as it's made.
  if (step === 'createCall') {
    return (
      <CreateCallFlow
        handle={answers.handle ?? null}
        hasLinks={Boolean(answers.handle)}
        onExit={() => setStep('home')}
        onCreate={(call) => setAnswers((prev) => withAddedCall(prev, call))}
        doneLabel="Back to your storefront"
        onDone={(id) => {
          setJustAddedIds([id]);
          setStep('home');
        }}
      />
    );
  }

  if (step === 'editProfile') {
    return (
      <EditProfile
        answers={answers}
        onBack={() => setStep('home')}
        // A new link is saved like any answer: the sidebar card and the live address follow it
        onSave={(changes) => setAnswers((prev) => ({ ...prev, ...changes }))}
      />
    );
  }

  if (step === 'editService') {
    return (
      <EditService
        key={editingId}
        answers={answers}
        serviceId={editingId}
        kind="call"
        onBack={() => setStep('home')}
        // Saved changes go straight onto the live page (and into this browser)
        onSave={(changes) => setAnswers((prev) => withCallChanges(prev, editingId, changes))}
      />
    );
  }

  return (
    <QuestionFlow
      key="my-page"
      backAtTop
      questions={questions}
      answers={answers}
      onAnswer={handleAnswer}
      finishLabel={answers.publishedAt ? 'Save changes' : 'Continue'}
      onExit={() => setStep('intro')}
      // Finishing puts the page live straight away: no separate publish step
      // Picked calls they'd already made: those go on it (no setup call is made)
      onComplete={() => {
        setAnswers((prev) => {
          const live = { ...prev, publishedAt: prev.publishedAt ?? new Date().toISOString() };
          if (prev.callSource === 'existing') return withPickedCalls(live);
          const { pickedCalls, pickedLines, ...rest } = live; // eslint-disable-line no-unused-vars
          return rest;
        });
        setStep('done');
      }}
      asideWidth="half"
      // Counts the screens actually showing: picking existing calls skips the call questions
      renderProgress={({ index, visible }) => (
        <div className="flow__progress">
          <div className="flow__progress-label">
            <span>Setting up your storefront</span>
            <span>{index + 1} of {visible.length}</span>
          </div>
          <div className="flow__progress-track">
            <div
              className="flow__progress-fill"
              style={{ width: `${((index + 1) / visible.length) * 100}%` }}
            />
          </div>
        </div>
      )}
      renderAside={({ question }) =>
        question.preview === false ? null : question.id === 'callSource' ? (
          <ProfileExample questionId="callSource" page={ownPage} />
        ) : (
          <ProfileExample questionId={question.id} answer={answers[question.id] ?? question.default} />
        )
      }
    />
  );
}