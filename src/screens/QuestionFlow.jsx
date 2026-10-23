import { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Info } from 'lucide-react';
import QuestionInput from '../components/QuestionInput';
import './QuestionFlow.css';

// Grows as we build each input type
const SUPPORTED_TYPES = ['text', 'textarea', 'choice', 'sentence', 'group', 'items', 'number', 'ramble', 'headlinePair', 'handle', 'offerType', 'callDetails', 'priceDiscount', 'callAbout', 'weeklyHours', 'serviceSummary', 'calendar', 'pickCalls', 'callQuestions'];

// Screens that move on with their own button (Use this and continue), so Next is hidden
const OWN_NEXT_TYPES = ['ramble'];

// Screens that need a wider column (the ramble's side-by-side summary)
const WIDE_TYPES = ['ramble'];

const isFilled = (v) => String(v ?? '').trim() !== '';

// Items only count once their main field (title, quote...) is filled
const filledCount = (list, key) =>
  Array.isArray(list) ? list.filter((item) => isFilled(item?.[key])).length : 0;

export default function QuestionFlow({
  pageName,
  questions,
  answers,
  onAnswer,
  onExit,                 // Optional: Back on the first screen. Without it, there's no Back there
  onComplete,
  startAtEnd = false,     // Back from the checkpoint lands on the last screen
  startAt = null,         // Optional: question id to open on (their saved screen)
  startFurthest = null,   // Optional: question id of the furthest screen they'd reached
  onPositionChange,       // Optional: ({ at, furthest }) as question ids, whenever either changes
  finishLabel = 'Finish', // Label of the button on the last screen
  hideProgress = false,   // Edit mode shows a single screen, no progress bar
  renderProgress,         // Optional: replaces the default progress bar
  renderAside,            // Optional: right-hand column (the page preview); return null to leave a screen without it
  asideWidth = 'narrow',  // 'narrow' (phone preview) or 'wide' (desktop preview)
  backAtTop = false,      // Back sits above the progress; Next appears once answered
  wide = false, 
}) {
  // An answer, or the default its screen shows as already picked
  // (so a screen that depends on a default appears before they tap anything)
  const answerOf = (id) => answers[id] ?? questions.find((q) => q.id === id)?.default;

  // showIf: { field, equals: 'Paid' } or { field, in: ['A', 'B'] }
  const shows = (q) => {
    if (!q.showIf) return true;
    const v = answerOf(q.showIf.field);
    return Array.isArray(q.showIf.in) ? q.showIf.in.includes(v) : v === q.showIf.equals;
  };

  // variantsBy: a screen whose wording (and check) follows another answer,
  // e.g. "Paste your WhatsApp group link" vs "Paste your Telegram link"
  const resolve = (q) => {
    const variant = q.variantsBy ? q.variants?.[answerOf(q.variantsBy)] : null;
    return variant ? { ...q, ...variant } : q;
  };

  // Hide questions whose showIf condition isn't met (e.g. price when Free)
  const visible = questions.filter(shows).map(resolve);

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

  // validate(value): an error message, or null when it looks right.
  // Only checked once they've typed something, so an empty box isn't an error.
  const typed = String(value ?? '').trim();
  const error = question.validate && typed ? question.validate(typed) : null;

  // Sentence questions need every blank filled; groups need every required field
  // isComplete(answers): a screen's own rule for when it's done (e.g. price only if paid)
  const canContinue =
    !error &&
    (question.isComplete ? question.isComplete(answers) :
    !question.required ||
    !SUPPORTED_TYPES.includes(question.type) ||
    (question.type === 'items'
      ? filledCount(answers[question.id], question.mainField) >= (question.minItems ?? 0)
      : question.fields
        ? question.fields.every((f) => !f.required || isFilled(answers[f.id] ?? f.default))
        : question.parts
          ? question.parts.every((p) => isFilled(answers[p.id]))
          : isFilled(value)));

  // Moves to any screen and remembers the furthest one reached
  const goTo = (i) => {
    setIndex(i);
    setFurthest((f) => Math.max(f, i));
  };

  // The note under the answer, for a screen with a footnote
  const footnote = useFootnote(question.id);

  const goNext = () => {
    if (!canContinue) return;
    // Save a preselected default the user accepted without tapping
    if (answers[question.id] === undefined && question.default !== undefined) {
      onAnswer(question.id, question.default);
    }
    isLast ? onComplete() : goTo(index + 1);
  };

  // laterLabel ("I'll add it later"): move on without a valid answer.
  // Whatever they typed is kept, so they can fix it from where they left off.
  const goLater = () => {
    isLast ? onComplete() : goTo(index + 1);
  };

  // skipLabel ("Skip for now"): an optional screen that's never empty (it
  // starts filled in) moves on with skipValue saved as its answer, whatever
  // is on screen, so a half-written answer never blocks skipping.
  // showSkip(answers): hides it when Next already means the same.
  const goSkip = () => {
    onAnswer(question.id, question.skipValue);
    isLast ? onComplete() : goTo(index + 1);
  };
  const skipButton = question.skipLabel && (!question.showSkip || question.showSkip(answers)) && (
    <span className="flow__skip-wrap" data-tip={question.skipHint} data-tip-align="end">
      <button type="button" className="flow__later" onClick={goSkip}>
        {question.skipLabel}
      </button>
    </span>
  );

  // The first screen only has Back when there's somewhere to go back to
  const canGoBack = index > 0 || Boolean(onExit);

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

  // Shown on hover while Next is disabled. A question can set its own with `nextHint`:
  // a string, or a function of the answers when it depends on what's missing.
  const nextHint =
    error ??
    (typeof question.nextHint === 'function' ? question.nextHint(answers) : question.nextHint) ??
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

  // hideNextUntilComplete: a screen whose own button is the way on until
  // it's done (connecting a calendar), so a disabled Next would only compete
  const showNext = !OWN_NEXT_TYPES.includes(question.type) && !(question.hideNextUntilComplete && !canContinue);

  // Only offered while Next is blocked; once the answer is fine, Next is the way on
  const laterButton = question.laterLabel && !canContinue && (
    <button type="button" className="flow__later" onClick={goLater}>
      {question.laterLabel}
    </button>
  );

  const nextButton = showNext && (
        <span
      className="flow__next-wrap"
      data-tip={canContinue ? undefined : nextHint}
      data-tip-align={backAtTop ? 'start' : 'end'}
    >
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

  // A screen can go without the right-hand column: renderAside returns null for it
  const aside = renderAside ? renderAside({ question }) : null;

  return (
    <div
      className={`flow ${aside ? `flow--split flow--aside-${asideWidth}` : ''} ${
          wide || WIDE_TYPES.includes(question.type) ? 'flow--wide' : ''
      }`}
    >
      <div className="flow__main">
        {backAtTop && canGoBack && backButton}

        {!hideProgress &&
          (renderProgress
            ? renderProgress({ question, index, visible, furthest, goTo })
            : defaultProgress)}

        <div className="flow__question" key={question.id}>
          {/* titleTick: a green tick above the title, for screens that report something done */}
          {question.titleTick && (
            <span className="flow__tick" aria-hidden="true"><Check size={22} strokeWidth={3} /></span>
          )}
          <h1 className="flow__title">
            {question.footnote ? (
              <TitleWithTerm
                title={question.question}
                word={question.footnoteWord}
                noteId={`flow-note-${question.id}`}
                onHint={footnote.hint}
                onShow={footnote.show}
              />
            ) : (
              question.question
            )}
            {question.info && <InfoTip info={question.info} />}
          </h1>
          {question.helper && <p className="flow__helper">{question.helper}</p>}
          <QuestionInput
            question={question}
            value={value}
            answers={answers}
            error={error}
            onChange={(v, id = question.id) => onAnswer(id, v)}
            onSubmit={goNext}
          />
          {/* footnote: a word in the title explained, under the answer (the asterisk jumps here) */}
          {question.footnote && (
            <p
              // A new key each time the term is clicked, so the highlight plays again
              key={`note-${footnote.shown}`}
              id={`flow-note-${question.id}`}
              className={`flow__footnote ${footnote.hinted ? 'flow__footnote--hint' : ''} ${
                footnote.shown > 0 && footnote.flashing ? 'flow__footnote--flash' : ''
              }`}
            >
              <span aria-hidden="true">* </span>
              {question.footnote}
            </p>
          )}
        </div>

                {backAtTop ? (
          // Back is already at the top, so Next sits alone at the right.
          // Screens with their own button (Tidy it up) get no bottom row at all.
          showNext && (
            <div className="flow__nav flow__nav--end">
              {laterButton}
              {skipButton}
              {nextButton}
            </div>
          )
        ) : (
          <div className="flow__nav">
            {canGoBack ? backButton : <span />}
            <div className="flow__nav-end">
              {laterButton}
              {skipButton}
              {nextButton}
            </div>
          </div>
        )}
      </div>

      {aside && <aside className="flow__aside">{aside}</aside>}
    </div>
  );
}

// ------------------------------------------------------------
// A word in a screen's title explained under its answer (question.footnote).
// The word itself, with an asterisk, is the control: hovering it lightly
// marks the note; clicking it brings the note into view and highlights it
// for a moment. footnoteWord: the word to mark (its first appearance); with
// none, or if it isn't in the title, the asterisk goes at the end.
// ------------------------------------------------------------
const FLASH_MS = 2200; // matches flow-note-flash in QuestionFlow.css

function useFootnote(questionId) {
  const [hinted, setHinted] = useState(false);
  const [shown, setShown] = useState(0); // times clicked: a new key replays the highlight
  const [flashing, setFlashing] = useState(false);
  const timer = useRef(null);

  // A new screen starts with nothing highlighted
  useEffect(() => {
    setHinted(false);
    setFlashing(false);
    clearTimeout(timer.current);
  }, [questionId]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const show = (noteId) => {
    const note = document.getElementById(noteId);
    if (note) {
      const r = note.getBoundingClientRect();
      if (r.top < 0 || r.bottom > window.innerHeight) {
        const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        note.scrollIntoView({ block: 'center', behavior: still ? 'auto' : 'smooth' });
      }
    }
    setShown((n) => n + 1);
    setFlashing(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setFlashing(false), FLASH_MS);
  };

  return { hinted, shown, flashing, hint: setHinted, show };
}

function TitleWithTerm({ title, word, noteId, onHint, onShow }) {
  const at = word ? title.toLowerCase().indexOf(word.toLowerCase()) : -1;
  const before = at >= 0 ? title.slice(0, at) : title;
  const term = at >= 0 ? title.slice(at, at + word.length) : '';
  const after = at >= 0 ? title.slice(at + word.length) : '';
  return (
    <>
      {before}
      <button
        type="button"
        className={`flow__term ${term ? '' : 'flow__term--star-only'}`}
        onClick={() => onShow(noteId)}
        onMouseEnter={() => onHint(true)}
        onMouseLeave={() => onHint(false)}
        onFocus={() => onHint(true)}
        onBlur={() => onHint(false)}
        aria-describedby={noteId}
      >
        {term && <span className="flow__term-word">{term}</span>}
        <span className="flow__term-star" aria-hidden="true">*</span>
      </button>
      {after}
    </>
  );
}

// ------------------------------------------------------------
// The (i) beside a screen's title: a few examples and a line under them.
// Shows on hover, and stays open on a click until they click elsewhere,
// click it again or press Escape.
// info: { label (for screen readers), title, examples: [[who, example]], footer }
// ------------------------------------------------------------
function InfoTip({ info }) {
  const [pinned, setPinned] = useState(false);
  const ref = useRef(null);
  const tipId = useId();

  useEffect(() => {
    if (!pinned) return undefined;
    const onDown = (e) => !ref.current?.contains(e.target) && setPinned(false);
    const onKey = (e) => e.key === 'Escape' && setPinned(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [pinned]);

  return (
    <span ref={ref} className={`flow-info ${pinned ? 'flow-info--open' : ''}`}>
      <button
        type="button"
        className="flow-info__btn"
        aria-label={info.label}
        aria-expanded={pinned}
        aria-controls={tipId}
        onClick={() => setPinned((p) => !p)}
      >
        <Info size={18} aria-hidden="true" />
      </button>
      <span className="tip flow-info__tip" id={tipId} role="tooltip">
        {info.title && <span className="flow-info__title">{info.title}</span>}
        {info.examples?.length > 0 && (
          <span className="flow-info__list">
            {info.examples.map(([who, example]) => (
              <span key={who} className="flow-info__row">
                <span className="flow-info__who">{who}</span>
                <span className="flow-info__example">“{example}”</span>
              </span>
            ))}
          </span>
        )}
        {info.footer && <span className="flow-info__footer">{info.footer}</span>}
      </span>
    </span>
  );
}