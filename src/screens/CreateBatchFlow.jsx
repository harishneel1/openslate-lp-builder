import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Copy, ExternalLink } from 'lucide-react';
import QuestionsInput from '../components/QuestionsInput';
import { FeeField, ScheduleFields, feeProblem, scheduleProblem } from '../components/BatchFields';
import { useCopy } from './OfferingsHome';
import {
  DEFAULT_DAYS,
  DEFAULT_LENGTH,
  DEFAULT_START,
  DESCRIPTION_MAX,
  HEALTH_QUESTIONS,
  TITLE_MAX,
  TITLE_SUGGESTIONS,
  descriptionFor,
  loadBatches,
  newBatchId,
} from '../data/batches';
import { storeBatch } from '../data/batchSave';
import { cleanQuestions, questionsProblem } from '../data/callQuestions';
import { coachZone } from '../data/buildBookingsJson';
import '../components/QuestionInput.css';
import './CreateCallFlow.css'; // the ready screen's look (.ready), shared with Create a 1:1 call
import './CreateBatchFlow.css';

// ------------------------------------------------------------
// "Create a batch": one question per screen, like Create a 1:1 call.
//
//   1 Name your batch          "Morning Yoga" (tap a suggestion or type)
//   2 When does it meet?       days, start time, length (BatchFields.jsx)
//   3 What's the monthly fee?  rupees a month, from the day each person joins
//   4 Describe your batch      starts from the name and schedule
//   5 Ask before they join     health questions, starting with injuries
//   then: a short "setting it up" checklist, and "… is ready" with its link
//
// The batch, and its monthly contract, only exist once they finish
// (storeBatch in batchSave.js). Leaving before that keeps nothing.
//
// onExit(): Back on the first screen, nothing made
// onDone(batchId): the button on the ready screen
// url(id): the batch's link to share (under the account's link)
// ------------------------------------------------------------

const STEPS = [
  { id: 'name', title: 'Name your batch', sub: 'People see this on your page and at checkout. Name it after when or what it is.' },
  { id: 'schedule', title: 'When does this batch meet?', sub: 'The same days and time every week. It runs until you stop it.' },
  { id: 'fee', title: 'What’s the monthly fee?', sub: 'Everyone in the batch pays this every month.' },
  {
    id: 'about',
    title: 'Describe your batch',
    sub: 'What happens in class, who it’s for, and anything they need (a mat, an empty stomach).',
  },
  {
    id: 'questions',
    title: 'Ask before they join',
    sub: 'We always ask their name, email and phone. Add what you need to know before their first class.',
  },
];

// The first suggested name none of their batches has
function startingTitle() {
  const taken = loadBatches().map((b) => b.title.trim().toLowerCase());
  return TITLE_SUGGESTIONS.find((t) => !taken.includes(t.toLowerCase())) ?? '';
}

// What stops a screen from moving on, or null
function problemOf(step, draft) {
  if (step === 'name') return draft.title.trim() ? null : 'Give your batch a name.';
  if (step === 'schedule') return scheduleProblem(draft);
  if (step === 'fee') return feeProblem(draft.price);
  if (step === 'about') return draft.description.trim() ? null : 'Write a line or two about your batch.';
  if (step === 'questions') return questionsProblem(draft.questions)?.text ?? null;
  return null;
}

export default function CreateBatchFlow({ onExit, onDone, url }) {
  const [batchId] = useState(newBatchId);
  const [draft, setDraft] = useState(() => ({
    id: batchId,
    title: startingTitle(),
    days: DEFAULT_DAYS,
    startTime: DEFAULT_START,
    durationMins: DEFAULT_LENGTH,
    timeZone: coachZone(),
    price: '',
    description: '',
    questions: HEALTH_QUESTIONS,
  }));
  const [at, setAt] = useState(0);
  const [tried, setTried] = useState(false); // pressed Next with a problem: show it
  const [touchedAbout, setTouchedAbout] = useState(false); // typed their own description
  const [failed, setFailed] = useState(false);
  const [made, setMade] = useState(null); // the saved batch

  const step = STEPS[at];
  const problem = problemOf(step.id, draft);
  const change = (field, value) => setDraft((d) => ({ ...d, [field]: value }));

  // The description starts from the name and schedule, and follows them
  // until they write their own
  useEffect(() => {
    if (!touchedAbout) setDraft((d) => ({ ...d, description: descriptionFor(d) }));
  }, [draft.title, draft.days, draft.startTime, touchedAbout]); // eslint-disable-line react-hooks/exhaustive-deps

  // Each screen starts at the top, with its heading in focus for screen readers
  useEffect(() => {
    document.querySelector('.app__main')?.scrollTo?.(0, 0);
    document.getElementById('bflow-title')?.focus();
  }, [at]);

  const back = () => {
    setTried(false);
    if (at === 0) onExit();
    else setAt(at - 1);
  };

  const next = () => {
    if (problem) {
      setTried(true);
      return;
    }
    setTried(false);
    if (at < STEPS.length - 1) {
      setAt(at + 1);
      return;
    }
    const saved = storeBatch({
      ...draft,
      title: draft.title.trim(),
      price: Number(draft.price),
      description: draft.description.trim(),
      questions: cleanQuestions(draft.questions),
    });
    if (!saved) {
      setFailed(true);
      return;
    }
    setMade(saved);
  };

  if (made) {
    return <BatchReady title={made.title} url={url(made.id)} onDone={() => onDone(made.id)} />;
  }

  return (
    <div className="bflow">
      <button type="button" className="bflow__back" onClick={back}>
        <ArrowLeft size={16} aria-hidden="true" /> {at === 0 ? 'All batches' : 'Back'}
      </button>

      <div className="bflow__progress" aria-hidden="true">
        {STEPS.map((s, i) => (
          <span key={s.id} className={`bflow__bar ${i <= at ? 'bflow__bar--on' : ''}`} />
        ))}
      </div>
      <p className="bflow__count">
        Step {at + 1} of {STEPS.length}
      </p>

      <h1 className="bflow__title" id="bflow-title" tabIndex={-1}>
        {step.title}
      </h1>
      <p className="bflow__sub">{step.sub}</p>

      <div className="bflow__body">
        {step.id === 'name' && (
          <div className="qinput__field">
            <input
              className="qinput__text"
              value={draft.title}
              maxLength={TITLE_MAX}
              placeholder="Morning Yoga"
              aria-label="Batch name"
              onChange={(e) => change('title', e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && next()}
            />
            <div className="call__try">
              <span className="call__try-label">Try</span>
              <div className="call__try-list">
                {TITLE_SUGGESTIONS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`call__try-chip ${draft.title === t ? 'call__try-chip--on' : ''}`}
                    onClick={() => change('title', t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step.id === 'schedule' && <ScheduleFields value={draft} onChange={change} showProblem={tried} />}

        {step.id === 'fee' && <FeeField value={draft} onChange={change} showProblem={tried} />}

        {step.id === 'about' && (
          <div className="qinput__field">
            <textarea
              className="qinput__text bflow__about"
              rows={6}
              value={draft.description}
              maxLength={DESCRIPTION_MAX}
              aria-label="Description"
              onChange={(e) => {
                setTouchedAbout(true);
                change('description', e.target.value);
              }}
            />
            <span className="qinput__example">We wrote a start from your batch’s name and time. Make it yours.</span>
          </div>
        )}

        {step.id === 'questions' && (
          <QuestionsInput cards value={draft.questions} onChange={(list) => change('questions', list)} />
        )}

        {tried && problem && step.id !== 'schedule' && step.id !== 'fee' && (
          <p className="qinput__error bflow__problem" role="alert">
            {problem}
          </p>
        )}
        {failed && (
          <p className="qinput__error bflow__problem" role="alert">
            We couldn’t save your batch in this browser. Free up some space and try again.
          </p>
        )}
      </div>

      <div className="bflow__actions">
        <button type="button" className="bflow__next" onClick={next}>
          {at === STEPS.length - 1 ? 'Create batch' : 'Next'}
          {at < STEPS.length - 1 && <ArrowRight size={16} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}

// ---------- The batch, made ----------
// As a 1:1 call's ready screen (CallReady in CreateCallFlow.jsx): a short
// checklist ticks off, then the link to share. Plays once; with reduced
// motion it starts finished.
const READY_STEPS = ['Saving your schedule', 'Setting up your monthly contract', 'Creating your batch link'];
const READY_STEP_MS = 700;
const READY_PAUSE = 400;

function BatchReady({ title, url, onDone }) {
  const [copy, copyLink] = useCopy();
  const [skip] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  const [done, setDone] = useState(skip ? READY_STEPS.length : 0);
  const [ready, setReady] = useState(skip);
  const shown = url.replace(/^https?:\/\//, '');

  useEffect(() => {
    if (skip) return undefined;
    const timers = READY_STEPS.map((_, i) => setTimeout(() => setDone(i + 1), READY_STEP_MS * (i + 1)));
    timers.push(setTimeout(() => setReady(true), READY_STEP_MS * READY_STEPS.length + READY_PAUSE));
    return () => timers.forEach(clearTimeout);
  }, [skip]);

  if (!ready) {
    return (
      <div className="ready ready--building">
        <h1 className="ready__title">Setting up your batch…</h1>
        <ul className="ready__steps" aria-live="polite">
          {READY_STEPS.map((s, i) => {
            const state = i < done ? 'done' : i === done ? 'current' : 'todo';
            return (
              <li key={s} className={`ready__step ready__step--${state}`}>
                <span className="ready__mark" aria-hidden="true">
                  {state === 'done' && <Check size={14} strokeWidth={3} />}
                </span>
                {s}
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
      <h1 className="ready__title ready__in">“{title}” is ready to join</h1>
      <p className="ready__text ready__in">Share this link. Anyone with it can pay and join your batch.</p>

      <div className="ready__link">
        <span className="ready__url" title={shown}>
          {shown}
        </span>
        <button type="button" className="ready__copy" onClick={() => copyLink(url)}>
          {copy === 'copied' ? <Check size={15} strokeWidth={3} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
          {copy === 'copied' ? 'Copied' : 'Copy link'}
        </button>
      </div>
      <span className="sr-only" aria-live="polite">
        {copy === 'copied' && 'Link copied'}
      </span>
      {copy === 'failed' && (
        <p className="qinput__error ready__error" role="alert">
          Couldn’t copy. Select the link and copy it yourself.
        </p>
      )}

      <a className="ready__preview ready__later" href={url} target="_blank" rel="noopener noreferrer">
        <ExternalLink size={15} aria-hidden="true" />
        View live page
      </a>

      <button type="button" className="ready__done ready__later" onClick={onDone}>
        Go to your batch
        <ArrowRight size={16} aria-hidden="true" />
      </button>
    </div>
  );
}