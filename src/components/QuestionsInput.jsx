import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, GripVertical, Lock, Plus, Trash2 } from 'lucide-react';
import {
  MAX_OPTIONS,
  MAX_QUESTIONS,
  OPTION_MAX,
  QUESTION_MAX,
  QUESTION_TYPES,
  fieldProblems,
  hasOptions,
  isOn,
  newQuestion,
  withType,
} from '../data/callQuestions';
import './QuestionsInput.css';

// ------------------------------------------------------------
// A call's invitee form, inside its "Invitee form" section
// (EditService.jsx), laid out like Calendly's. See callQuestions.js
// for the questions' shape.
//
//   Invitee details    [🔒 Name, Email, Phone]      always asked, not editable
//   Invitee questions
//   │ ⠿ Question 1                          🗑
//   │ [ What's your current CTC?          ]
//   │ ☐ Required
//   │ Answer type  [One line            ▾]
//   │ Status  On ●
//   + Add new question
//
// Every question stays open. Single choice, Checkboxes and Dropdown show
// their options under Answer type, each with a handle and a delete, and
// "+ Add another". Each type says in a line what people will see.
// Reorder by dragging a handle, or focus it and use the arrow keys.
// A field's problem shows once they've left it, not while it's new.
// Changes go into the draft and are saved with the screen's Save.
//
// value: the questions. onChange(next): the whole list, changed.
// note: a line at the end (where the form shows).
// ------------------------------------------------------------
export default function QuestionsInput({ value, onChange, note = null }) {
  const [newId, setNewId] = useState(null); // a question just added: its box gets the cursor
  const [announce, setAnnounce] = useState(''); // where a question moved to, for screen readers
  const listRef = useRef(null);
  const addRef = useRef(null);
  const refocus = useRef(null); // a handle to focus again once its question has moved
  const full = value.length >= MAX_QUESTIONS;

  const update = (id, change) => onChange(value.map((q) => (q.id === id ? change(q) : q)));

  const moveQuestion = (from, to) => {
    if (to < 0 || to >= value.length || from === to) return;
    const next = [...value];
    const [q] = next.splice(from, 1);
    next.splice(to, 0, q);
    onChange(next);
    setAnnounce(`Question moved to position ${to + 1} of ${value.length}`);
  };
  const sort = useDragSort(listRef, moveQuestion);

  // A keyboard move: the handle moved with its question, so focus it again
  useEffect(() => {
    if (!refocus.current) return;
    listRef.current?.querySelector(`[data-handle="${refocus.current}"]`)?.focus();
    refocus.current = null;
  }, [value]);

  const add = () => {
    if (full) return;
    const q = newQuestion();
    onChange([...value, q]);
    setNewId(q.id);
  };

  const remove = (id) => {
    onChange(value.filter((q) => q.id !== id));
    addRef.current?.focus();
  };

  return (
    <div className="bq">
      {/* ---------- Invitee details: always asked ---------- */}
      <div className="bq__block">
        <h3 className="bq__label" id="bq-details">Invitee details</h3>
        <p className="bq__sub">Always asked, before your questions.</p>
        <div className="bq__fixed" aria-labelledby="bq-details">
          <span>Name, Email, Phone</span>
          <Lock size={15} aria-hidden="true" />
        </div>
      </div>

      {/* ---------- Invitee questions ---------- */}
      <div className="bq__block">
        <h3 className="bq__label">Invitee questions</h3>

        {value.length > 0 && (
          <ol className="bq__list" ref={listRef}>
            {value.map((q, i) => (
              <Question
                key={q.id}
                q={q}
                n={i + 1}
                count={value.length}
                autoFocus={newId === q.id}
                dragging={sort.dragging === i}
                handleProps={{
                  ...sort.handleProps(i),
                  onKeyDown: (e) => {
                    const to = e.key === 'ArrowUp' ? i - 1 : e.key === 'ArrowDown' ? i + 1 : null;
                    if (to === null) return;
                    e.preventDefault();
                    refocus.current = q.id;
                    moveQuestion(i, to);
                  },
                }}
                onChange={(change) => update(q.id, change)}
                onRemove={() => remove(q.id)}
              />
            ))}
          </ol>
        )}

        <button type="button" className="bq__link" ref={addRef} onClick={add} disabled={full}>
          <Plus size={17} aria-hidden="true" />
          Add new question
        </button>
        {full && <p className="bq__sub">You can ask up to {MAX_QUESTIONS} questions.</p>}
      </div>

      {note && <p className="bq__note">{note}</p>}
      <span className="sr-only" aria-live="polite">
        {announce}
      </span>
    </div>
  );
}

// One question, always open
function Question({ q, n, count, autoFocus, dragging, handleProps, onChange, onRemove }) {
  const base = `bq-${q.id}`;
  const on = isOn(q);
  const [left, setLeft] = useState({}); // fields they've been in and left: their problems show
  const leave = (key) => () => setLeft((l) => ({ ...l, [key]: true }));
  const problems = fieldProblems(q);
  const textProblem = left.text ? problems.text : null;

  // ---------- Choices ----------
  const optionsRef = useRef(null);
  const refocusOption = useRef(null);
  const focusNewOption = useRef(false);

  const setOption = (k, text) => onChange((cur) => ({ ...cur, options: cur.options.map((o, j) => (j === k ? text : o)) }));
  const addOption = () => {
    focusNewOption.current = true;
    onChange((cur) => ({ ...cur, options: [...cur.options, ''] }));
  };
  const removeOption = (k) => {
    onChange((cur) => ({ ...cur, options: cur.options.filter((_, j) => j !== k) }));
    // What they'd left is now another box's: start those afresh
    setLeft((l) => Object.fromEntries(Object.entries(l).filter(([key]) => !key.startsWith('option'))));
  };
  const moveOption = (from, to) => {
    if (to < 0 || to >= q.options.length || from === to) return;
    onChange((cur) => {
      const options = [...cur.options];
      const [o] = options.splice(from, 1);
      options.splice(to, 0, o);
      return { ...cur, options };
    });
  };
  const optionSort = useDragSort(optionsRef, moveOption);

  // Focus: the newest option box once it's there, or a handle that moved by keyboard
  useEffect(() => {
    const boxes = optionsRef.current?.querySelectorAll('input');
    if (focusNewOption.current) {
      boxes?.[boxes.length - 1]?.focus();
      focusNewOption.current = false;
    } else if (refocusOption.current !== null) {
      optionsRef.current?.querySelectorAll('[data-option-handle]')[refocusOption.current]?.focus();
      refocusOption.current = null;
    }
  }, [q.options]);

  // Enter in a choice goes to the next one, or adds one after the last
  const optionKey = (e, k) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (k === q.options.length - 1) {
      if (q.options.length < MAX_OPTIONS) addOption();
    } else {
      optionsRef.current?.querySelectorAll('input')[k + 1]?.focus();
    }
  };

  return (
    <li className={`bq__q ${dragging ? 'bq__q--dragging' : ''} ${on ? '' : 'bq__q--off'}`}>
      <div className="bq__q-head">
        <button
          type="button"
          className="bq__handle"
          data-handle={q.id}
          aria-label={`Reorder question ${n} of ${count}. Drag, or use the up and down arrow keys.`}
          {...handleProps}
        >
          <GripVertical size={18} aria-hidden="true" />
        </button>
        <h4 className="bq__q-title" id={`${base}-title`}>
          Question {n}
          {!on && <span className="bq__off-tag">Off</span>}
        </h4>
        <button
          type="button"
          className="bq__icon bq__icon--danger"
          onClick={onRemove}
          aria-label={`Delete question ${n}`}
          data-tip="Delete question"
          data-tip-align="end"
        >
          <Trash2 size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="bq__q-body">
        {/* The question */}
        <div className="bq__field">
          <textarea
            id={`${base}-text`}
            className={`bq__input bq__input--area ${textProblem ? 'bq__input--error' : ''}`}
            rows={2}
            value={q.text}
            maxLength={QUESTION_MAX}
            placeholder="e.g. What’s your current CTC?"
            aria-labelledby={`${base}-title`}
            autoFocus={autoFocus}
            onChange={(e) => onChange((cur) => ({ ...cur, text: e.target.value }))}
            onBlur={leave('text')}
            aria-invalid={textProblem ? true : undefined}
            aria-describedby={textProblem ? `${base}-text-error` : undefined}
          />
          {textProblem && <FieldError id={`${base}-text-error`}>{textProblem}</FieldError>}
        </div>

        {/* Required */}
        <label className="bq__check-row">
          <input
            type="checkbox"
            checked={q.required}
            onChange={(e) => onChange((cur) => ({ ...cur, required: e.target.checked }))}
          />
          <span className="bq__check" aria-hidden="true" />
          Required
        </label>

        {/* Answer type */}
        <div className="bq__field">
          <label className="bq__field-label" htmlFor={`${base}-type`}>
            Answer type
          </label>
          <div className="bq__select">
            <select
              id={`${base}-type`}
              className="bq__input"
              value={q.type}
              onChange={(e) => onChange((cur) => withType(cur, e.target.value))}
            >
              {QUESTION_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <ChevronDown size={18} className="bq__select-chevron" aria-hidden="true" />
          </div>
          <p className="bq__sub bq__sub--under">{QUESTION_TYPES.find((t) => t.id === q.type)?.example}</p>
        </div>

        {/* Single choice, Checkboxes and Dropdown: the options people pick from */}
        {hasOptions(q.type) && (
          <fieldset className="bq__options-set">
            <legend className="sr-only">Choices for question {n}</legend>
            <ol className="bq__options" ref={optionsRef}>
              {q.options.map((o, k) => {
                const problem = left[`option${k}`] ? problems.options[k] : null;
                return (
                  <li key={k} className={`bq__option bq__option--${q.type} ${optionSort.dragging === k ? 'bq__option--dragging' : ''}`}>
                    <button
                      type="button"
                      className="bq__handle bq__handle--small"
                      data-option-handle
                      aria-label={`Reorder choice ${k + 1} of ${q.options.length}. Drag, or use the up and down arrow keys.`}
                      {...optionSort.handleProps(k)}
                      onKeyDown={(e) => {
                        const to = e.key === 'ArrowUp' ? k - 1 : e.key === 'ArrowDown' ? k + 1 : null;
                        if (to === null || to < 0 || to >= q.options.length) return;
                        e.preventDefault();
                        refocusOption.current = to;
                        moveOption(k, to);
                      }}
                    >
                      <GripVertical size={16} aria-hidden="true" />
                    </button>
                    <div className="bq__option-field">
                      <input
                        className={`bq__input ${problem ? 'bq__input--error' : ''}`}
                        type="text"
                        value={o}
                        maxLength={OPTION_MAX}
                        placeholder={`Choice ${k + 1}`}
                        aria-label={`Choice ${k + 1}`}
                        onChange={(e) => setOption(k, e.target.value)}
                        onBlur={leave(`option${k}`)}
                        onKeyDown={(e) => optionKey(e, k)}
                        aria-invalid={problem ? true : undefined}
                        aria-describedby={problem ? `${base}-option${k}-error` : undefined}
                      />
                      {problem && <FieldError id={`${base}-option${k}-error`}>{problem}</FieldError>}
                    </div>
                    <button
                      type="button"
                      className="bq__icon bq__icon--danger"
                      onClick={() => removeOption(k)}
                      disabled={q.options.length <= 2}
                      aria-label={`Delete choice ${k + 1}`}
                      data-tip={q.options.length <= 2 ? 'A choice needs at least two options' : 'Delete choice'}
                      data-tip-align="end"
                    >
                      <Trash2 size={17} aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ol>
            {q.options.length < MAX_OPTIONS ? (
              <button type="button" className="bq__link bq__link--small" onClick={addOption}>
                <Plus size={16} aria-hidden="true" />
                Add another
              </button>
            ) : (
              <p className="bq__sub">You can give up to {MAX_OPTIONS} choices.</p>
            )}
          </fieldset>
        )}

        {/* Status: off keeps the question but doesn't ask it */}
        <div className="bq__field">
          <span className="bq__field-label" id={`${base}-status`}>
            Status
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-labelledby={`${base}-status`}
            className="bq__switch-row"
            onClick={() => onChange((cur) => ({ ...cur, enabled: !isOn(cur) }))}
          >
            <span className="bq__switch-text">{on ? 'On' : 'Off'}</span>
            <span className="bq__switch" aria-hidden="true" />
            {!on && <span className="bq__sub">Not asked on checkout</span>}
          </button>
        </div>
      </div>
    </li>
  );
}

function FieldError({ id, children }) {
  return (
    <p className="bq__error" id={id}>
      <AlertTriangle size={14} aria-hidden="true" />
      {children}
    </p>
  );
}

// ------------------------------------------------------------
// Drag to reorder, for a list whose items are listRef's children.
// Press on an item's handle and move: the item swaps places as the
// pointer passes the middle of its neighbours. Works with a mouse,
// a pen or a finger (the handle has touch-action: none).
// onMove(from, to): move one item. dragging: the index held, or null.
// ------------------------------------------------------------
function useDragSort(listRef, onMove) {
  const held = useRef(null); // the index being dragged
  const [dragging, setDragging] = useState(null);

  const handleProps = (index) => ({
    onPointerDown: (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      held.current = index;
      setDragging(index);
    },
    onPointerMove: (e) => {
      if (held.current === null || !listRef.current) return;
      const from = held.current;
      let to = from;
      [...listRef.current.children].forEach((item, i) => {
        const r = item.getBoundingClientRect();
        const middle = r.top + r.height / 2;
        if (i < from && e.clientY < middle) to = Math.min(to, i);
        if (i > from && e.clientY > middle) to = Math.max(to, i);
      });
      if (to !== from) {
        onMove(from, to);
        held.current = to;
        setDragging(to);
      }
    },
    onPointerUp: () => {
      held.current = null;
      setDragging(null);
    },
    onPointerCancel: () => {
      held.current = null;
      setDragging(null);
    },
  });

  return { dragging, handleProps };
}