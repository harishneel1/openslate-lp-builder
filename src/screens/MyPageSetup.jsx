import { useEffect, useState } from 'react';
import QuestionFlow from './QuestionFlow';
import ProfileExample from '../components/ProfileExample';
import MyPageIntro from './MyPageIntro';
import MyPageReveal from './MyPageReveal';
import { MY_PAGE_STEPS, myPageQuestions } from '../data/myPageQuestions';
import { SETUP_CHANGED_EVENT, SETUP_STORAGE_KEY } from '../data/myPage';

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
// Answers are kept in this browser for now.
// ------------------------------------------------------------
export default function MyPageSetup() {
  const [answers, setAnswers] = useState(loadAnswers);
  // 'intro' → 'questions' → 'done' (the page, live).
  // Finished before? Their page. Started before? Straight to the questions.
  const [step, setStep] = useState(() =>
    answers.publishedAt ? 'done' : Object.keys(answers).length > 0 ? 'questions' : 'intro'
  );

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

  // Done: the page is live. Back to the questions to change anything.
  if (step === 'done') {
    return <MyPageReveal handle={answers.handle} onEdit={() => setStep('questions')} />;
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