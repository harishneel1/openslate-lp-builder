import { useEffect, useState } from 'react';
import QuestionFlow from './QuestionFlow';
import ProfileExample from '../components/ProfileExample';
import MyPageIntro from './MyPageIntro';
import MyPageReveal from './MyPageReveal';
import OfferingsHome from './OfferingsHome';
import EditService from './EditService';
import EditProfile from './EditProfile';
import { MY_PAGE_STEPS, myPageQuestions } from '../data/myPageQuestions';
import { SETUP_CHANGED_EVENT, SETUP_STORAGE_KEY } from '../data/myPage';
import { withAddedCall, withCallChanges } from '../data/myProfile';

function loadAnswers() {
  try {
    return JSON.parse(localStorage.getItem(SETUP_STORAGE_KEY)) ?? {};
  } catch {
    return {};
  }
}

// ------------------------------------------------------------
// The offerings page, the first time: an intro to what a page is, then
// questions on the left with a popular creator's page on the right,
// the part each answer fills in highlighted, then their page, live.
// After that, the offerings home: no more questions, just their page
// and services to change directly.
// Answers are kept in this browser for now.
// ------------------------------------------------------------
export default function MyPageSetup() {
  const [answers, setAnswers] = useState(loadAnswers);
  // Setup: 'intro' → 'questions' → 'done' (the page, live, shown once).
  // Then: 'home' (the offerings home) ↔ 'editService' (one offering, or a new one
  //                                      of the kind picked on the home)
  //                                    ↔ 'editProfile' (photo, name, bio, link).
  // Finished before? The home. Started before? Straight to the questions.
  const [step, setStep] = useState(() =>
    answers.publishedAt ? 'home' : Object.keys(answers).length > 0 ? 'questions' : 'intro'
  );
  const [editingId, setEditingId] = useState(null); // the offering open in 'editService'; null = a new one
  const [addingKind, setAddingKind] = useState(null); // a new one's kind ('call', ...), picked on the home
  const [justAddedId, setJustAddedId] = useState(null); // marked on the home after adding it

  useEffect(() => {
    try {
      localStorage.setItem(SETUP_STORAGE_KEY, JSON.stringify(answers));
      window.dispatchEvent(new Event(SETUP_CHANGED_EVENT));
    } catch {
      // Storage full or blocked: answers still work for this visit
    }
  }, [answers]);

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
        justAddedId={justAddedId}
        onEditOffering={(id) => {
          setEditingId(id);
          setJustAddedId(null);
          setStep('editService');
        }}
        onAddOffering={(kind) => {
          setEditingId(null);
          setAddingKind(kind);
          setJustAddedId(null);
          setStep('editService');
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
        key={editingId ?? `new-${addingKind}`}
        answers={answers}
        serviceId={editingId}
        kind={addingKind}
        onBack={() => setStep('home')}
        // Saved changes go straight onto the live page (and into this browser)
        onSave={(changes) => setAnswers((prev) => withCallChanges(prev, editingId, changes))}
        // A new one goes on the page straight away, and the home marks it
        onCreate={(call) => {
          setAnswers((prev) => withAddedCall(prev, call));
          setJustAddedId(call.id);
          setStep('home');
        }}
      />
    );
  }

  return (
    <QuestionFlow
      key="my-page"
      backAtTop
      questions={myPageQuestions}
      answers={answers}
      onAnswer={handleAnswer}
      finishLabel={answers.publishedAt ? 'Save changes' : 'Continue'}
      onExit={() => setStep('intro')}
      // Finishing puts the page live straight away: no separate publish step
      onComplete={() => {
        setAnswers((prev) => ({ ...prev, publishedAt: prev.publishedAt ?? new Date().toISOString() }));
        setStep('done');
      }}
      asideWidth="half"
      renderProgress={({ index }) => (
        <div className="flow__progress">
          <div className="flow__progress-label">
            <span>Setting up your offerings page</span>
            <span>{index + 1} of {MY_PAGE_STEPS}</span>
          </div>
          <div className="flow__progress-track">
            <div
              className="flow__progress-fill"
              style={{ width: `${((index + 1) / MY_PAGE_STEPS) * 100}%` }}
            />
          </div>
        </div>
      )}
      renderAside={({ question }) =>
        question.preview === false ? null : (
          <ProfileExample questionId={question.id} answer={answers[question.id] ?? question.default} />
        )
      }
    />
  );
}