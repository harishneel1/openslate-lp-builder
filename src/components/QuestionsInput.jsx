import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, ChevronDown, GripVertical, Lock, Plus, Trash2 } from 'lucide-react';
import {
  MAX_OPTIONS,
  MAX_QUESTIONS,
  OPTION_MAX,
  QUESTION_MAX,
  QUESTION_TYPES,
  fieldProblems,
  hasOptions,
  newQuestion,
  withType,
} from '../data/callQuestions';
import './QuestionsInput.css';

// ------------------------------------------------------------
// A call’s booking questions, inside its "Booking questions" section
// (EditService.jsx), laid out like Calendly's. See callQuestions.js
// for the questions' shape.
//
//   Their details      [🔒 Name, Email, Phone]      always asked, not editable
//   Your questions
//   │ ⠿ Question 1                          🗑
//   │ [ What's your current CTC?          ]
//   │ ☐ Required
//   │ Answer type  [One line            ▾]
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
// cards: the setup screens' look ("Ask additional questions during
//   checkout"), on the grey page: each question its own white card, as on
//   the other setup screens, and no Their details block (the screen's
//   subheader says name, email and phone are always asked):
//
//   ┌ ⠿ QUESTION 1                               ↑  ↓  🗑 ┐
//   │ [ What would you like to talk about?                ] │
//   │ [ Paragraph            ▾ ]          ☐ Required       │
//   └ (choices, for the types that have them)               ┘
//   ┌ + Add a question  (dashed)                            ┐
//   Reordering on cards: ↑ and ↓ move a question one place (greyed at the
//   ends, hidden with only one question), and the moved card glows for a
//   moment so the eye can follow it. Dragging works from anywhere on the
//   card's header row, not just the dots: the card follows the pointer,
//   a dashed slot shows where it will land, the others slide out of its
//   way, and letting go glides it into the slot (useCardDrag). Escape puts
//   it back. The list's order only changes on letting go.
// Text only for screen readers uses bq__sr-only (its own copy, as this
// builder shows on screens that don't load a global sr-only style).
// ------------------------------------------------------------
export default function QuestionsInput({ value, onChange, note = null, cards = false }) {
  const [newId, setNewId] = useState(null); // a question just added: its box gets the cursor
  const [announce, setAnnounce] = useState(''); // where a question moved to, for screen readers
  const [movedId, setMovedId] = useState(null); // cards: a question just moved by ↑ ↓, glowing for a moment
  const refocusArrow = useRef(null); // cards: { id, dir } of the arrow clicked, to keep focus on it
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

  // Cards: drag that follows the pointer, committed on letting go
  const [settle, setSettle] = useState(null); // { id, offset }: glide the dropped card from where it was let go
  const cardDrag = useCardDrag(listRef, ({ from, to, offset }) => {
    const id = value[from].id;
    if (to !== from) {
      moveQuestion(from, to);
      setMovedId(id);
    }
    setSettle({ id, offset });
  });

  // The dropped (or put back) card: from where it was let go, into its place
  useLayoutEffect(() => {
    if (!settle) return;
    const el = listRef.current?.querySelector(`[data-qid="${settle.id}"]`);
    if (el && settle.offset && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      el.animate([{ transform: `translateY(${settle.offset}px)` }, { transform: 'none' }], {
        duration: 200,
        easing: 'ease-out',
      });
    }
    setSettle(null);
  }, [settle]);

  // A keyboard move: the handle moved with its question, so focus it again
  useEffect(() => {
    if (refocus.current) {
      listRef.current?.querySelector(`[data-handle="${refocus.current}"]`)?.focus();
      refocus.current = null;
    }
    // ↑ or ↓: stay on that arrow, or the other one if it's now at the end
    if (refocusArrow.current) {
      const { id, dir } = refocusArrow.current;
      const arrow = (d) => listRef.current?.querySelector(`[data-move="${id}-${d}"]`);
      const target = arrow(dir);
      (target && !target.disabled ? target : arrow(dir === 'up' ? 'down' : 'up'))?.focus();
      refocusArrow.current = null;
    }
  }, [value]);

  // The glow fades on its own
  useEffect(() => {
    if (!movedId) return undefined;
    const t = setTimeout(() => setMovedId(null), 900);
    return () => clearTimeout(t);
  }, [movedId]);

  // ↑ ↓ on a card
  const step = (i, dir) => {
    const to = dir === 'up' ? i - 1 : i + 1;
    if (to < 0 || to >= value.length) return;
    refocusArrow.current = { id: value[i].id, dir };
    setMovedId(value[i].id);
    moveQuestion(i, to);
  };

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
    <div className={`bq ${cards ? 'bq--cards' : ''}`}>
      {/* ---------- Their details: always asked ---------- */}
      {!cards && (
        <div className="bq__block">
          <h3 className="bq__label" id="bq-details">Their details</h3>
          <p className="bq__sub">Always asked, before your questions.</p>
          <div className="bq__fixed" aria-labelledby="bq-details">
            <span>Name, Email, Phone</span>
            <Lock size={15} aria-hidden="true" />
          </div>
        </div>
      )}

      {/* ---------- Your questions ---------- */}
      <div className="bq__block">
        {!cards && <h3 className="bq__label">Your questions</h3>}

        {value.length > 0 && (
          <ol className={`bq__list ${cardDrag.drag ? 'bq__list--dragging' : ''}`} ref={listRef}>
            {value.map((q, i) => (
              <Question
                key={q.id}
                q={q}
                cards={cards}
                n={i + 1}
                count={value.length}
                autoFocus={newId === q.id}
                dragging={cards ? false : sort.dragging === i}
                lifted={cards && cardDrag.drag?.from === i}
                dragStyle={cards ? cardDrag.styleFor(i) : undefined}
                rowDragProps={cards ? cardDrag.rowProps(i) : null}
                moved={movedId === q.id}
                onStep={(dir) => step(i, dir)}
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
            {/* Where the dragged card will land: a dashed slot its size */}
            {cardDrag.slot && <li className="bq__slot" aria-hidden="true" style={cardDrag.slot} />}
          </ol>
        )}

        <button type="button" className={cards ? 'bq__add' : 'bq__link'} ref={addRef} onClick={add} disabled={full}>
          <Plus size={17} aria-hidden="true" />
          {cards ? 'Add a question' : 'Add new question'}
        </button>
        {full && <p className="bq__sub">You can ask up to {MAX_QUESTIONS} questions.</p>}
      </div>

      {note && <p className="bq__note">{note}</p>}
      <span className="bq__sr-only" aria-live="polite">
        {announce}
      </span>
    </div>
  );
}

// One question, always open
// cards: the setup look: a card, the question on one line that grows, and
// Answer type with Required beside it
// moved: just moved by ↑ ↓ (cards glow). onStep('up' | 'down'): move it one place.
// lifted: being dragged (cards). dragStyle: its move while a card is dragged.
// rowDragProps: what lets the header row start a drag (cards).
function Question({ q, n, count, cards, autoFocus, dragging, lifted, dragStyle, rowDragProps, moved, handleProps, onStep, onChange, onRemove }) {
  const base = `bq-${q.id}`;
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
  // Drag a choice by its handle, the same way as a question card: it follows
  // the pointer, the others slide out of its way, a dashed slot shows where
  // it lands, and letting go glides it in and glows for a moment
  const [movedOption, setMovedOption] = useState(null); // index just moved, glowing
  const [settleOption, setSettleOption] = useState(null); // { index, offset }: glide it from where it was let go
  const optionDrag = useCardDrag(
    optionsRef,
    ({ from, to, offset }) => {
      if (to !== from) {
        moveOption(from, to);
        setMovedOption(to);
      }
      setSettleOption({ index: to, offset });
    },
    ':scope > [data-oid]',
  );

  useLayoutEffect(() => {
    if (!settleOption) return;
    const el = optionsRef.current?.querySelector(`:scope > [data-oid="${settleOption.index}"]`);
    if (el && settleOption.offset && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      el.animate([{ transform: `translateY(${settleOption.offset}px)` }, { transform: 'none' }], {
        duration: 200,
        easing: 'ease-out',
      });
    }
    setSettleOption(null);
  }, [settleOption]);

  useEffect(() => {
    if (movedOption === null) return undefined;
    const t = setTimeout(() => setMovedOption(null), 900);
    return () => clearTimeout(t);
  }, [movedOption]);

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

  // Required: a checkbox
  const required = (
    <label className="bq__check-row">
      <input
        type="checkbox"
        checked={q.required}
        onChange={(e) => onChange((cur) => ({ ...cur, required: e.target.checked }))}
      />
      <span className="bq__check" aria-hidden="true" />
      Required
    </label>
  );

  return (
    <li
      data-qid={q.id}
      style={dragStyle}
      className={`bq__q ${cards ? 'bq__q--card' : ''} ${dragging ? 'bq__q--dragging' : ''} ${lifted ? 'bq__q--lifted' : ''} ${moved ? 'bq__q--moved' : ''}`}
    >
      {/* On cards, the whole row is something to grab (not only the dots): its
          buttons still click as buttons (useCardDrag skips them) */}
      <div className={`bq__q-head ${cards && count > 1 ? 'bq__q-head--grab' : ''}`} {...(cards && count > 1 ? rowDragProps : {})}>
        <button
          type="button"
          className={`bq__handle ${cards && count === 1 ? 'bq__handle--hidden' : ''}`}
          data-handle={q.id}
          aria-label={`Reorder question ${n} of ${count}. Drag, or use the up and down arrow keys.`}
          {...(cards ? { onKeyDown: handleProps.onKeyDown } : handleProps)}
        >
          <GripVertical size={18} aria-hidden="true" />
        </button>
        <h4 className="bq__q-title" id={`${base}-title`}>
          Question {n}
        </h4>
        {/* ↑ ↓: the plain way to reorder, on cards, when there's something to reorder */}
        {cards && count > 1 && (
          <>
            <button
              type="button"
              className="bq__icon"
              data-move={`${q.id}-up`}
              onClick={() => onStep('up')}
              disabled={n === 1}
              aria-label={`Move question ${n} up`}
              data-tip={n === 1 ? undefined : 'Move up'}
              data-tip-align="end"
            >
              <ArrowUp size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="bq__icon"
              data-move={`${q.id}-down`}
              onClick={() => onStep('down')}
              disabled={n === count}
              aria-label={`Move question ${n} down`}
              data-tip={n === count ? undefined : 'Move down'}
              data-tip-align="end"
            >
              <ArrowDown size={18} aria-hidden="true" />
            </button>
          </>
        )}
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
            className={`bq__input bq__input--area ${cards ? 'bq__input--grow' : ''} ${textProblem ? 'bq__input--error' : ''}`}
            rows={cards ? 1 : 2}
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

        {/* Required (above Answer type, as in the editor; on cards, beside it) */}
        {!cards && required}

        {/* Answer type (on cards, with Required beside it) */}
        <div className={cards ? 'bq__row' : undefined}>
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
            {!cards && <p className="bq__sub bq__sub--under">{QUESTION_TYPES.find((t) => t.id === q.type)?.example}</p>}
          </div>
          {cards && required}
        </div>

        {/* Single choice, Checkboxes and Dropdown: the options people pick from */}
        {hasOptions(q.type) && (
          <fieldset className="bq__options-set">
            <legend className="bq__sr-only">Choices for question {n}</legend>
            <ol className={`bq__options ${optionDrag.drag ? 'bq__options--dragging' : ''}`} ref={optionsRef}>
              {q.options.map((o, k) => {
                const problem = left[`option${k}`] ? problems.options[k] : null;
                return (
                  <li
                    key={k}
                    data-oid={k}
                    style={optionDrag.styleFor(k)}
                    className={`bq__option bq__option--${q.type} ${optionDrag.drag?.from === k ? 'bq__option--lifted' : ''} ${movedOption === k ? 'bq__option--moved' : ''}`}
                  >
                    <button
                      type="button"
                      className="bq__handle bq__handle--small"
                      data-option-handle
                      aria-label={`Reorder choice ${k + 1} of ${q.options.length}. Drag, or use the up and down arrow keys.`}
                      {...optionDrag.rowProps(k)}
                      onKeyDown={(e) => {
                        const to = e.key === 'ArrowUp' ? k - 1 : e.key === 'ArrowDown' ? k + 1 : null;
                        if (to === null || to < 0 || to >= q.options.length) return;
                        e.preventDefault();
                        refocusOption.current = to;
                        moveOption(k, to);
                        setMovedOption(to);
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
              {/* Where the dragged choice will land: a dashed slot its size */}
              {optionDrag.slot && <li className="bq__slot bq__slot--option" aria-hidden="true" style={optionDrag.slot} />}
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
// Cards: drag to reorder, with the card under the pointer.
// Pressing on a card's header row (not its buttons, other than the handle)
// picks the card up. While it's held:
//   - it moves with the pointer (styleFor: translateY), lifted above the rest
//   - the cards it passes slide out of its way, by its height
//   - slot: a dashed outline where it will land
// Letting go calls onDrop({ from, to, offset }): the list moves it, and
// offset is how far it was from its new place, to glide it in. Escape, or
// a lost pointer, drops it where it started.
// Positions are taken once, when it's picked up, in page pixels (so
// scrolling while dragging doesn't throw them off).
// ------------------------------------------------------------
// itemSelector: the list's items (question cards by default; choices pass their own).
// Pressing starts a drag from the element given rowProps: a whole header row
// (its buttons still click, except the handle), or just a handle.
function useCardDrag(listRef, onDrop, itemSelector = ':scope > [data-qid]') {
  const [drag, setDrag] = useState(null); // { from, over, dy }
  const start = useRef(null); // { y, from, boxes: [{ top, height }], gap, listTop }

  const items = () => [...(listRef.current?.querySelectorAll(itemSelector) ?? [])];

  // Where the held card's middle is now → the place it would go
  const placeFor = (dy) => {
    if (!start.current) return 0;
    const { from, boxes } = start.current;
    const middle = boxes[from].top + boxes[from].height / 2 + dy;
    let to = from;
    boxes.forEach((b, i) => {
      if (i < from && middle < b.top + b.height / 2) to = Math.min(to, i);
      if (i > from && middle > b.top + b.height / 2) to = Math.max(to, i);
    });
    return to;
  };

  const finish = (commit) => {
    const s = start.current;
    if (!s || !drag) return;
    const { from, boxes } = s;
    const to = commit ? drag.over : from;
    // Where the card is now, against the top of its new place
    const landing = to === from ? boxes[from].top : to > from ? boxes[to].top + boxes[to].height - boxes[from].height : boxes[to].top;
    const offset = boxes[from].top + drag.dy - landing;
    start.current = null;
    setDrag(null);
    onDrop({ from, to, offset });
  };

  // Escape puts it back
  useEffect(() => {
    if (!drag) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') finish(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const rowProps = (index) => ({
    onPointerDown: (e) => {
      if (e.button !== 0) return;
      const button = e.target.closest?.('button');
      // ↑ ↓ and delete still click (unless the press is on the element that drags: a handle)
      if (button && button !== e.currentTarget && !button.hasAttribute('data-handle')) return;
      const els = items();
      if (els.length < 2) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      const boxes = els.map((el) => {
        const r = el.getBoundingClientRect();
        return { top: r.top + window.scrollY, height: r.height };
      });
      const gap = boxes.length > 1 ? boxes[1].top - (boxes[0].top + boxes[0].height) : 16;
      const listTop = listRef.current.getBoundingClientRect().top + window.scrollY;
      start.current = { y: e.pageY, from: index, boxes, gap, listTop };
      setDrag({ from: index, over: index, dy: 0 });
    },
    onPointerMove: (e) => {
      if (!start.current) return;
      // Worked out now, while the drag is surely on: React runs the updater
      // later, and a quick let-go in between would have cleared start.current
      const dy = e.pageY - start.current.y;
      const over = placeFor(dy);
      setDrag((d) => (d ? { ...d, dy, over } : d));
    },
    onPointerUp: () => finish(true),
    onPointerCancel: () => finish(false),
  });

  // Each card's move while one is held
  const styleFor = (i) => {
    if (!drag || !start.current) return undefined;
    const { from, over, dy } = drag;
    if (i === from) return { transform: `translateY(${dy}px)` };
    const shift = start.current.boxes[from].height + start.current.gap;
    if (from < over && i > from && i <= over) return { transform: `translateY(${-shift}px)` };
    if (over < from && i >= over && i < from) return { transform: `translateY(${shift}px)` };
    return { transform: 'none' };
  };

  // The dashed slot: where the held card's top will be, inside the list
  let slot = null;
  if (drag && start.current) {
    const { from, over } = drag;
    const { boxes, listTop } = start.current;
    const top = over === from ? boxes[from].top : over > from ? boxes[over].top + boxes[over].height - boxes[from].height : boxes[over].top;
    slot = { top: top - listTop, height: boxes[from].height };
  }

  return { drag, rowProps, styleFor, slot };
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