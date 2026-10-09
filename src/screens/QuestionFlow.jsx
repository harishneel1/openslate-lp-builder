import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import QuestionInput from '../components/QuestionInput';
import './QuestionFlow.css';

// Grows as we build each input type
const SUPPORTED_TYPES = ['text', 'textarea', 'choice', 'sentence', 'group', 'items', 'number'];

const isFilled = (v) => String(v ?? '').trim() !== '';

// Items only count once their main field (title, quote...) is filled
const filledCount = (list, key) =>
  Array.isArray(list) ? list.filter((item) => isFilled(item?.[key])).length : 0;

export default function QuestionFlow({
  pageName,
  questions,
  answers,
  onAnswer,
  onExit,
  onComplete,
  startAtEnd = false,     // Back from the checkpoint lands on the last screen
  startAt = null,         // Optional: question id to open on (their saved screen)
  startFurthest = null,   // Optional: question id of the furthest screen they'd reached
  onPositionChange,       // Optional: ({ at, furthest }) as question ids, whenever either changes
  finishLabel = 'Finish', // Label of the button on the last screen
  hideProgress = false,   // Edit mode shows a single screen, no progress bar
  renderProgress,         // Optional: replaces the default progress bar
  renderAside,            // Optional: right-hand column (the page preview)
  asideWidth = 'narrow',  // 'narrow' (phone preview) or 'wide' (desktop preview)
  backAtTop = false,      // Back sits above the progress; Next appears once answered
}) {
  // Hide questions whose showIf condition isn't met (e.g. price when Free)
  const visible = questions.filter(
    (q) => !q.showIf || answers[q.showIf.field] === q.showIf.equals
  );

  // -1 if there's no id, or that question isn't on screen any more
  const indexOf = (id) => (id ? visible.findIndex((q) => q.id === id) : -1);

  // Where to open: their saved screen → the last screen (Back from checkpoint) → the first
  const savedIndex = indexOf(startAt);
  const startIndex = savedIndex !== -1 ? savedIndex : startAtEnd ? visible.length - 1 : 0;

  const [index, setIndex] = useState(startIndex);
  // Lets them jump back and forward again (kept across refreshes)
  const [furthest, setFurthest] = useState(() => Math.max(startIndex, indexOf(startFurthest)));

  // Tell the app where they are, so it can be saved
  useEffect(() => {
    if (!onPositionChange) return;
    const current = visible[index];
    const far = visible[Math.min(furthest, visible.length - 1)];
    onPositionChange({ at: current?.id ?? null, furthest: far?.id ?? null });
  }, [index, furthest]); // eslint-disable-line react-hooks/exhaustive-deps

  const question = visible[index];
  // Defaults (e.g. IST, Live) show as already selected
  const value = answers[question.id] ?? question.default ?? '';
  const isLast = index === visible.length - 1;
  const progress = ((index + 1) / visible.length) * 100;

  // Sentence questions need every blank filled; groups need every required field
  const canContinue =
    !question.required ||
    !SUPPORTED_TYPES.includes(question.type) ||
    (question.type === 'items'
      ? filledCount(answers[question.id], question.mainField) >= (question.minItems ?? 0)
      : question.fields
        ? question.fields.every((f) => !f.required || isFilled(answers[f.id] ?? f.default))
        : question.parts
          ? question.parts.every((p) => isFilled(answers[p.id]))
          : isFilled(value));

  // Moves to any screen and remembers the furthest one reached
  const goTo = (i) => {
    setIndex(i);
    setFurthest((f) => Math.max(f, i));
  };

  const goNext = () => {
    if (!canContinue) return;
    // Save a preselected default the user accepted without tapping
    if (answers[question.id] === undefined && question.default !== undefined) {
      onAnswer(question.id, question.default);
    }
    isLast ? onComplete() : goTo(index + 1);
  };

  const goBack = () => {
    index === 0 ? onExit() : setIndex(index - 1);
  };

  const defaultProgress = (
    <div className="flow__progress">
      <div className="flow__progress-label">
        <span>{pageName}</span>
        <span>{index + 1} of {visible.length}</span>
      </div>
      <div className="flow__progress-track">
        <div className="flow__progress-fill" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );

  const backButton = (
    <button
      type="button"
      className={`flow__back ${backAtTop ? 'flow__back--top' : ''}`}
      onClick={goBack}
    >
      <ArrowLeft size={16} /> Back
    </button>
  );

  // Shown on hover while Next is disabled. A question can set its own with `nextHint`.
  const nextHint =
    question.nextHint ??
    (question.type === 'items'
      ? `Add at least ${question.minItems} to continue`
      : question.fields || question.parts
        ? 'Fill in everything to continue'
        : 'Answer this to continue');

  // Optional screens left empty say "Skip" instead of "Next"
  const isEmptyAnswer =
    question.type === 'items'
      ? filledCount(answers[question.id], question.mainField) === 0
      : !isFilled(value);
  const nextLabel = isLast
    ? finishLabel
    : !question.required && isEmptyAnswer
      ? 'Skip'
      : 'Next';

  const nextButton = (
    <span className="flow__next-wrap" data-tip={canContinue ? undefined : nextHint}>
      <button
        type="button"
        className="flow__next"
        onClick={goNext}
        aria-disabled={!canContinue}
      >
        {nextLabel} <ArrowRight size={18} />
      </button>
    </span>
  );

  return (
    <div className={`flow ${renderAside ? `flow--split flow--aside-${asideWidth}` : ''}`}>
      <div className="flow__main">
        {backAtTop && backButton}

        {!hideProgress &&
          (renderProgress
            ? renderProgress({ question, index, visible, furthest, goTo })
            : defaultProgress)}

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

        {backAtTop ? (
          <div className="flow__nav flow__nav--after">{nextButton}</div>
        ) : (
          <div className="flow__nav">
            {backButton}
            {nextButton}
          </div>
        )}
      </div>

      {renderAside && <aside className="flow__aside">{renderAside({ question })}</aside>}
    </div>
  );
}