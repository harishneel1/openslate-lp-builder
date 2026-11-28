import { useMemo, useState } from 'react';
import QuestionFlow from './QuestionFlow';
import ProfileExample from '../components/ProfileExample';
import MyPageIntro from './MyPageIntro';
import MyPageReveal from './MyPageReveal';
import OfferingsHome from './OfferingsHome';
import EditService from './EditService';
import EditProfile from './EditProfile';
import { STOREFRONT_SETUP_IDS, myPageQuestions } from '../data/myPageQuestions';
import { SHARED_CALL_KEYS, withCallChanges, withoutSetupCall } from '../data/myProfile';
import { STOREFRONT_SOURCES, withItemOn } from '../data/storefrontItems';
import { useSetupAnswers } from '../utils/useSetupAnswers';

// Answers the 1:1 calls tab saves (its calls, which are on the page, and
// the meeting link they share). Having only these doesn't mean they've
// started setting up their page, so they still get the intro.
const CALLS_TAB_KEYS = ['addedCalls', 'offPage', 'hiddenOnPage', ...SHARED_CALL_KEYS];
const hasStartedSetup = (answers) => Object.keys(answers).some((key) => !CALLS_TAB_KEYS.includes(key));

// Setup's screens (STOREFRONT_SETUP_IDS): the link, about you, track
// record, testimonials. What goes on the storefront is switched on
// afterwards, on the storefront page itself (OfferingsHome.jsx).
// The testimonials screen reports which field is focused, for the example
// page beside it to highlight.
const setupQuestions = (onFocusField) =>
  STOREFRONT_SETUP_IDS.map((id) => myPageQuestions.find((q) => q.id === id)).map((q) =>
    q.id === 'testimonials' ? { ...q, onFocusField } : q,
  );

// Answers from earlier versions of setup, dropped once it's done, with a
// half-made call from the old setup flow if there is one
const OLD_SETUP_KEYS = ['offerType', 'pickedCalls', 'pickedLines', 'setupAt', 'callSource'];
const withoutOldSetup = (answers) =>
  Object.fromEntries(Object.entries(withoutSetupCall(answers)).filter(([key]) => !OLD_SETUP_KEYS.includes(key)));

// Anything switched on already (from before this version of setup)
const anythingOn = (answers) =>
  STOREFRONT_SOURCES.some((source) => source.items(answers).some((item) => source.isOn(answers, item.id)));

// ------------------------------------------------------------
// The storefront, the first time: an intro to what a page is, then two
// questions (link, about you) with a popular creator's page on the right,
// the part each answer fills in highlighted, then their page, live.
// After that, the storefront page: their profile and link, and everything
// they've made, each switched on or off, with the short description on its
// card. Nothing is made here: calls are made in the 1:1 calls tab.
// Edit opens the same call editor as 1:1 calls.
// onGoToTab(tab): opens a sidebar tab ('calls'), from the storefront page
// Answers are kept in this browser for now.
// ------------------------------------------------------------
export default function MyPageSetup({ onGoToTab }) {
  const [answers, setAnswers] = useSetupAnswers();
  // Setup: 'intro' → 'questions' → 'done' (the page, live, shown once).
  // Then: 'home' (the storefront page) ↔ 'editService' (one offering)
  //                                    ↔ 'editProfile' (photo, name, bio, link).
  // Finished before? The home. Started before? Straight to the questions.
  const [step, setStep] = useState(() =>
    answers.publishedAt ? 'home' : hasStartedSetup(answers) ? 'questions' : 'intro'
  );
  const [editingId, setEditingId] = useState(null); // the offering open in 'editService'
  const [focusField, setFocusField] = useState(null); // the testimonial field focused in setup
  const questions = useMemo(() => setupQuestions(setFocusField), []);

  const handleAnswer = (id, value) => setAnswers((prev) => ({ ...prev, [id]: value }));

  if (step === 'intro') {
    return <MyPageIntro onStart={() => setStep('questions')} />;
  }

  // Done: the page is live. "Done" goes to the storefront page, to switch things on.
  if (step === 'done') {
    return <MyPageReveal handle={answers.handle} hasCalls={anythingOn(answers)} onDone={() => setStep('home')} />;
  }

  if (step === 'home') {
    return (
      <OfferingsHome
        answers={answers}
        onEditProfile={() => setStep('editProfile')}
        onEditOffering={(id) => {
          setEditingId(id);
          setStep('editService');
        }}
        onSetOn={(source, item, on) => setAnswers((prev) => withItemOn(prev, source, item, on))}
        onSetLine={(source, id, text) => setAnswers((prev) => source.withLine(prev, id, text))}
        onGoToTab={onGoToTab}
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
      // Finishing puts the page live straight away: no separate publish step.
      // It starts with just their profile; they switch things on next.
      onComplete={() => {
        setAnswers((prev) => withoutOldSetup({ ...prev, publishedAt: prev.publishedAt ?? new Date().toISOString() }));
        setStep('done');
      }}
      asideWidth="half"
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
        question.preview === false ? null : question.id === 'testimonials' ? (
          // The part of a testimonial the focused field fills in
          <ProfileExample questionId="testimonials" answer={focusField} />
        ) : (
          <ProfileExample questionId={question.id} answer={answers[question.id] ?? question.default} />
        )
      }
    />
  );
}
