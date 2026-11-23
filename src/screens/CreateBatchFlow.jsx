import { useEffect, useState } from 'react';
import { ArrowLeft, Check, ArrowRight } from 'lucide-react';
import {
  DescriptionField,
  MeetingField,
  CreateContractLink,
  ThumbnailField,
  TitleField,
  WHO_CAN_JOIN,
  classProblem,
  contractsProblem,
} from '../components/BatchFields';
import ContractPicker from '../components/ContractPicker';
import ContractChips, { linkedContracts } from '../components/ContractChips';
import { newBatchId, tidyMeeting } from '../data/batches';
import { storeBatch } from '../data/batchSave';
import { coachZone } from '../data/buildBookingsJson';
import '../components/QuestionInput.css';
import './CreateCallFlow.css'; // the ready screen's look (.ready), shared with Create a 1:1 call
import './CreateBatchFlow.css';

// ------------------------------------------------------------
// "Create a class": one form, like TagMango's Create Workshop, with the
// same fields in the same order (BatchFields.jsx):
//
//   ← All classes
//   Create a class
//   Live as soon as you create it. Everyone on the contracts you link can join.
//
//   Title (with examples) · Thumbnail · Meeting (always Zoom, made for them)
//   Who can join: the contracts it's linked to (one or more)
//   Description
//                                                     [Create class]
//
// then: a short "setting it up" checklist, and "… is ready". No date or
// time here: classes are scheduled one by one, on the fly, from the
// Classes tab of its page (Schedule a class), where "Go to your class"
// lands.
//
// No fee here: how people pay is on the contracts (Contracts page), so a
// coach who charges monthly, or 6 months up front, links those contracts.
// The class only exists once they press Create class (storeBatch in
// batchSave.js). Leaving before that keeps nothing.
//
// onExit(): ← All classes, nothing made
// onDone(batchId): the button on the ready screen
// ------------------------------------------------------------

export default function CreateBatchFlow({ onExit, onDone }) {
  const [batchId] = useState(newBatchId);
  const [draft, setDraft] = useState(() => ({
    id: batchId,
    title: '',
    thumbnail: null,
    meeting: tidyMeeting(),
    sessions: [], // scheduled from its page, one by one
    timeZone: coachZone(),
    contractIds: [],
    description: '',
  }));
  const [tried, setTried] = useState(false); // pressed Create with a problem: show them
  const [failed, setFailed] = useState(false);
  const [made, setMade] = useState(null); // the saved class

  const problem = classProblem(draft);
  const change = (field, value) => setDraft((d) => ({ ...d, [field]: value }));

  // Starts at the top, with its heading in focus for screen readers
  useEffect(() => {
    document.querySelector('.app__main')?.scrollTo?.(0, 0);
    document.getElementById('bflow-title')?.focus();
  }, []);

  const create = () => {
    if (problem) {
      setTried(true);
      // Bring the first problem into view once it's drawn
      setTimeout(() => document.querySelector('.bflow .qinput__error')?.scrollIntoView?.({ block: 'center', behavior: 'smooth' }), 0);
      return;
    }
    const saved = storeBatch({
      ...draft,
      title: draft.title.trim(),
      description: draft.description.trim(),
      meeting: tidyMeeting(),
    });
    if (!saved) {
      setFailed(true);
      return;
    }
    setMade(saved);
  };

  if (made) {
    return <BatchReady batch={made} onDone={() => onDone(made.id)} />;
  }

  return (
    <div className="bflow">
      <button type="button" className="bflow__back" onClick={onExit}>
        <ArrowLeft size={16} aria-hidden="true" /> All classes
      </button>

      <h1 className="bflow__title" id="bflow-title" tabIndex={-1}>
        Create a class
      </h1>
      <p className="bflow__sub">Everyone on the contracts you link can join. You’ll schedule its classes next, whenever suits you.</p>

      <div className="bflow__body bflow__form">
        <TitleField value={draft} onChange={change} showProblem={tried} />
        <ThumbnailField value={draft} onChange={change} />

        <section className="bflow__group" aria-labelledby="bflow-g-meeting">
          <h2 className="bflow__group-title" id="bflow-g-meeting">
            Meeting
          </h2>
          <MeetingField />
        </section>

        <section className="bflow__group" aria-labelledby="bflow-g-who">
          <h2 className="bflow__group-title" id="bflow-g-who">
            Who can join
          </h2>
          <p className="bflow__group-sub">{WHO_CAN_JOIN}</p>
          <CreateContractLink />
          <ContractPicker value={draft.contractIds} onChange={(ids) => change('contractIds', ids)} />
          {tried && contractsProblem(draft) && (
            <span className="qinput__error" role="alert">
              {contractsProblem(draft)}
            </span>
          )}
        </section>

        <DescriptionField value={draft} onChange={change} />

        {failed && (
          <p className="qinput__error bflow__problem" role="alert">
            We couldn’t save your class in this browser. Free up some space and try again.
          </p>
        )}
      </div>

      <div className="bflow__actions">
        <button type="button" className="bflow__next" onClick={create}>
          Create class
        </button>
      </div>
    </div>
  );
}

// ---------- The class, made ----------
// As a 1:1 call's ready screen (CallReady in CreateCallFlow.jsx): a short
// checklist ticks off, then the contracts whose people can join
// (ContractChips.jsx). Nothing to share here: as on
// TagMango, people join by buying one of its contracts, and those are
// shared from the Contracts page. Plays once; with reduced
// motion it starts finished.
const READY_STEPS = ['Saving your class', 'Linking your contracts', 'Making its Zoom room'];
const READY_STEP_MS = 700;
const READY_PAUSE = 400;

function BatchReady({ batch, onDone }) {
  const [skip] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  const [done, setDone] = useState(skip ? READY_STEPS.length : 0);
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
        <h1 className="ready__title">Setting up your class…</h1>
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
      <h1 className="ready__title ready__in">“{batch.title}” is ready</h1>
      {linkedContracts(batch).length === 0 ? (
        <p className="ready__text ready__in">Link a contract to it, so people can join.</p>
      ) : (
        <div className="ready__in ready__who">
          <ContractChips
            batch={batch}
            label={`Anyone on ${linkedContracts(batch).length === 1 ? 'this contract' : 'these contracts'} can join, and gets its reminders:`}
          />
        </div>
      )}

      <p className="ready__text ready__in">Next, schedule its first class.</p>

      <button type="button" className="ready__done ready__later" onClick={onDone}>
        Schedule a class
        <ArrowRight size={16} aria-hidden="true" />
      </button>
    </div>
  );
}