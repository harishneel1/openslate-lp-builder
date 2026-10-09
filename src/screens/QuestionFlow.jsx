import { useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import QuestionInput from '../components/QuestionInput';
import './QuestionFlow.css';

// Grows as we build each input type
const SUPPORTED_TYPES = ['text', 'choice', 'sentence'];

const isFilled = (v) => String(v ?? '').trim() !== '';

export default function QuestionFlow({
  pageName,
  questions,
  answers,
  onAnswer,
  onExit,
  onComplete,
  startAtEnd = false,     // Back from the checkpoint lands on the last screen
  finishLabel = 'Finish', // Label of the button on the last screen
  hideProgress = false,   // Edit mode shows a single screen, no progress bar
}) {
  // Hide questions whose showIf condition isn't met (e.g. price when Free)
  const visible = questions.filter(
    (q) => !q.showIf || answers[q.showIf.field] === q.showIf.equals
  );

  const [index, setIndex] = useState(startAtEnd ? visible.length - 1 : 0);

  const question = visible[index];
  // Defaults (e.g. IST, Live) show as already selected
  const value = answers[question.id] ?? question.default ?? '';
  const isLast = index === visible.length - 1;
  const progress = ((index + 1) / visible.length) * 100;

  // Sentence questions need every blank filled
  const canContinue =
    !question.required ||
    !SUPPORTED_TYPES.includes(question.type) ||
    (question.parts
      ? question.parts.every((p) => isFilled(answers[p.id]))
      : isFilled(value));

  const goNext = () => {
    if (!canContinue) return;
    // Save a preselected default the user accepted without tapping
    if (answers[question.id] === undefined && question.default !== undefined) {
      onAnswer(question.id, question.default);
    }
    isLast ? onComplete() : setIndex(index + 1);
  };

  const goBack = () => {
    index === 0 ? onExit() : setIndex(index - 1);
  };

  return (
    <div className="flow">
      {!hideProgress && (
        <div className="flow__progress">
          <div className="flow__progress-label">
            <span>{pageName}</span>
            <span>{index + 1} of {visible.length}</span>
          </div>
          <div className="flow__progress-track">
            <div className="flow__progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <div className="flow__question" key={question.id}>
        <h1 className="flow__title">{question.question}</h1>
        {question.helper && <p className="flow__helper">{question.helper}</p>}
        <QuestionInput
          question={question}
          value={value}
          answers={answers}
          onChange={(v, id = question.id) => onAnswer(id, v)}
          onSubmit={goNext}
        />
      </div>

      <div className="flow__nav">
        <button type="button" className="flow__back" onClick={goBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <button type="button" className="flow__next" onClick={goNext} disabled={!canContinue}>
          {isLast ? finishLabel : 'Next'} <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}