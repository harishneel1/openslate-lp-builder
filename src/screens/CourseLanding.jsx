import { useEffect, useRef, useState } from 'react';
import { Check, Plus, Trash2, X } from 'lucide-react';
import {
  COURSE_TITLE_MAX,
  DESCRIPTION_MAX,
  DESCRIPTION_MIN,
  LIST_ITEM_MAX,
  LIST_MAX,
  OUTCOMES_MIN,
  SUBTITLE_MAX,
  listOf,
  descriptionText,
  testimonialsOf,
} from '../data/courses';
import TextEditor from '../components/TextEditor';
import ConfirmDialog from '../components/ConfirmDialog';
import CourseCover from './CourseCover';
import { DurationField, TrackRecordField } from './CourseLandingExtras';
import TestimonialsField from './CourseTestimonials';

// ------------------------------------------------------------
// A course's Landing page step (CoursePage.jsx): everything people see
// before they buy, in one place, most important first.
//
//   Title
//   [AI Engineering Accelerator                                  ]
//   Subtitle
//   [Dinners for busy weeks, from shop to table                  ]
//   Time to complete (optional)               (CourseLandingExtras.jsx)
//   [ 6 ] [hours ▾]
//
//   Description                                                  ✓
//   What the course covers, how it works, and what changes…
//   [Normal ▾] [B] [I] [• list] [1. list] [🔗 Link]
//   [Over four weeks, you'll plan, shop for and cook…            ]
//   12 more characters needed to publish
//
//   What students will learn                                   2/3
//   [e.g. Cook a week of dinners in under an hour                ]
//   [e.g. Plan meals around what's in your kitchen               ]
//   [e.g. Batch-cook lunches that keep for the whole week        ]
//   + Add another
//
//   Cover (optional): an image or a video          (CourseCover.jsx)
//
//   Your track record                          (CourseLandingExtras.jsx)
//
//   + Add requirements   + Add who it's for   + Add testimonials
//
// Each part carries data-guide (its name in courseAnnotations.js): the
// page's guide beside it highlights the part of the example being filled
// in (CoursePage.jsx). The + Add links carry their part's name too.
//
// Only the next thing to do shows. The optional parts (requirements, who
// it's for, testimonials) are one quiet link each, at the end; a click
// opens that part. A part that already has something in it shows open.
// Each open optional part has 🗑 Remove on the right of its heading:
// empty, it closes straight away, back to its + Add link; with something
// in it, it asks first ("Remove requirements? The 2 lines you've added
// will be deleted."), then empties it (saved) and closes it. The parts
// publishing needs have no Remove.
//
// Title: the course's name everywhere (the focus bar, the academy, its
// own contract). Up to 100 characters; it can't be empty: clearing it
// puts the saved one back.
// Subtitle: needed to publish, up to 120 characters.
// Time to complete: optional, a number and hours, days or weeks.
// What students will learn: 3 lines to start, each with an example in
// it (one story: a cooking course), at least 3 needed to publish (the
// count by its heading, grey, a green tick once there are enough).
// + Add another adds a line, up to 10; ✕ takes one away once there are
// more than 3.
// Requirements, Who it's for: one line to start, the same way.
// Each line, and the subtitle, saves when they leave it or press Enter
// ("Saved" in the page's bar), so moving to another step never loses
// anything. How many characters are left shows only near the end (20 or
// fewer).
// Your track record: the coach's own rating and student count, filled
// with 125 and 4.7 to start, shown only once they turn it on.
// Testimonials: what past students have said, made as a webinar's
// reviews: a picture (photo or the Google icon), their name, who they
// are, what they said, and an optional LinkedIn link
// (CourseTestimonials.jsx). Up to 6. The landing page shows them under
// "What students say", as testimonials, never as star ratings: those
// come only from students who took the course.
// Description: needed to publish, always open, written in the text
// editor (TextEditor.jsx, autosave). It saves when they click away, like
// the fields around it. It's also the description on the course's own
// contract, the checkout page's (as plain text: CoursePage.jsx keeps it
// in step), so it has the contract's limit: 2,000 characters of text, and
// at least 50 to publish (DESCRIPTION_MAX, DESCRIPTION_MIN in courses.js,
// counted as descriptionText counts them). Under it: characters used out
// of 2,000, always, and only when it matters, how many more are needed to
// publish or how far over the limit it is (it doesn't save until it's
// shorter, and the page asks before they leave, through onDirtyChange).
// A green tick by its heading once it's long enough.
//
// course, onSave(change) → true if it saved
// onSaveTitle(title) → true if it saved (CoursePage.jsx: renames its contract too)
// onDirtyChange(dirty): the description has (or no longer has) unsaved changes
//   (only while it's too long to save, or before it's saved)
// errors: { subtitle, description, outcomes }: what each still needs, after
//   Continue was pressed with it missing (CoursePage.jsx). Each shows in red
//   under its field, with a red border, and goes as soon as it's fixed.
// onDraft(patch): what's typed so far, as they type ({ subtitle },
//   { description }, { outcomes }...), so the page can say what's still
//   missing before anything saves; onDraft(null) when this closes
//
// Saving: each field saves a second after they stop typing (SAVE_AFTER_MS,
// one save per pause), when they leave it, and when this closes.
// ------------------------------------------------------------

const NEAR_LIMIT = 20;
const SAVE_AFTER_MS = 1000;

// A save that waits for a pause in typing: later(fn) runs fn SAVE_AFTER_MS
// after the last call; now() cancels the wait. One waiting at close runs then.
function useLater() {
  const timer = useRef(null);
  const waiting = useRef(null);
  const run = () => {
    clearTimeout(timer.current);
    const fn = waiting.current;
    waiting.current = null;
    fn?.();
  };
  useEffect(() => run, []); // eslint-disable-line react-hooks/exhaustive-deps
  return {
    later: (fn) => {
      clearTimeout(timer.current);
      waiting.current = fn;
      timer.current = setTimeout(run, SAVE_AFTER_MS);
    },
    cancel: () => {
      clearTimeout(timer.current);
      waiting.current = null;
    },
  };
}

// Text saved from what they typed: the same but for spaces at the ends.
// A save mustn't take away a space they've just typed.
const keepTyped = (saved) => (typed) => (typed.trim() === saved ? typed : saved);
const DESCRIPTION_NEAR = 100; // the description's count turns orange from here

const LISTS = {
  outcomes: {
    title: 'What students will learn',
    help: 'Things they’ll be able to do once they’ve finished.',
    rows: OUTCOMES_MIN,
    examples: [
      'e.g. Cook a week of dinners in under an hour',
      'e.g. Plan meals around what’s in your kitchen',
      'e.g. Batch-cook lunches that keep for the whole week',
    ],
  },
  requirements: {
    title: 'Requirements',
    help: 'What they need first. If nothing, say so: it reassures beginners.',
    rows: 1,
    examples: ['e.g. No experience needed'],
  },
  audience: {
    title: 'Who it’s for',
    help: 'Who will get the most from it.',
    rows: 1,
    examples: ['e.g. Working parents who want to cook at home more'],
  },
};

// name: what Remove's question calls the part; unit: what one of its entries is
const EXTRAS = [
  { id: 'requirements', add: 'Add requirements', name: 'requirements', unit: 'line', has: (c) => listOf(c, 'requirements').length > 0 },
  { id: 'audience', add: 'Add who it’s for', name: '“Who it’s for”', unit: 'line', has: (c) => listOf(c, 'audience').length > 0 },
  { id: 'testimonials', add: 'Add testimonials', name: 'testimonials', unit: 'testimonial', has: (c) => testimonialsOf(c).length > 0 },
];

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Under a field: characters used out of the most it takes, like "18 / 60".
// Always there, so it reads as a count, not a number that seems to fall on
// its own. Orange from NEAR_LIMIT characters before the end, red past it.
// The field points to it with aria-describedby, so a screen reader hears
// it with the field rather than on every key.
const num = (n) => n.toLocaleString('en-IN');
// Under a single-line field: what it still needs (red, only after Continue)
// on the left, its count on the right
const Under = ({ errorId, error, countId, used, max }) => (
  <div className="lrn__under">
    {error && (
      <p className="lrn__error" id={errorId}>
        {error}
      </p>
    )}
    <Count id={countId} used={used} max={max} />
  </div>
);

const Count = ({ id, used, max, near = NEAR_LIMIT }) => {
  const tone = used > max ? 'lrn__count--over' : max - used <= near ? 'lrn__count--near' : '';
  return (
    <span id={id} className={`lrn__count ${tone}`}>
      {num(used)} / {num(max)}
      <span className="sr-only"> characters</span>
    </span>
  );
};

export default function CourseLanding({ course, onSave, onSaveTitle, onDirtyChange, onDraft, errors = {} }) {
  // Closing: the page goes back to what's saved
  useEffect(() => () => onDraft?.(null), []); // eslint-disable-line react-hooks/exhaustive-deps

  // The optional parts open: those with something in them, and any clicked open
  const [opened, setOpened] = useState(() => new Set(EXTRAS.filter((x) => x.has(course)).map((x) => x.id)));
  const closed = EXTRAS.filter((x) => !opened.has(x.id));

  const [removing, setRemoving] = useState(null); // { id, count }: the question is up

  const open = (id) => {
    setOpened((prev) => new Set([...prev, id]));
    requestAnimationFrame(() => document.querySelector(`.lrn--${id} .lrn__input, .lrn--${id} textarea`)?.focus());
  };

  // Closes an optional part: back to its + Add link, the keyboard on it
  const close = (id) => {
    setOpened((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    requestAnimationFrame(() => document.querySelector(`.lnd__extra[data-guide="${id}"]`)?.focus());
  };

  // 🗑 Remove on an optional part: count is how many entries have words in them
  const askRemove = (id, count) => {
    if (count === 0) close(id);
    else setRemoving({ id, count });
  };

  const confirmRemove = () => {
    const { id } = removing;
    setRemoving(null);
    if (onSave({ [id]: [] })) close(id);
  };

  const removingPart = removing ? EXTRAS.find((x) => x.id === removing.id) : null;

  return (
    <div className="lnd">
      <Title course={course} onSave={onSaveTitle ?? ((title) => onSave({ title }))} />
      <Subtitle course={course} onSave={onSave} onDraft={onDraft} error={errors.subtitle} />
      <DurationField course={course} onSave={onSave} />
      <Description
        course={course}
        onSave={onSave}
        onDirtyChange={onDirtyChange}
        onDraft={onDraft}
        error={errors.description}
      />
      <ListField id="outcomes" course={course} onSave={onSave} onDraft={onDraft} error={errors.outcomes} />
      <div className="cst lnd__cover" data-guide="cover">
        <CourseCover course={course} onSave={onSave} />
      </div>
      <TrackRecordField course={course} onSave={onSave} />

      {opened.has('requirements') && (
        <ListField id="requirements" course={course} onSave={onSave} onRemove={(n) => askRemove('requirements', n)} />
      )}
      {opened.has('audience') && <ListField id="audience" course={course} onSave={onSave} onRemove={(n) => askRemove('audience', n)} />}
      {opened.has('testimonials') && (
        <TestimonialsField course={course} onSave={onSave} onRemove={(n) => askRemove('testimonials', n)} />
      )}

      {removing && removingPart && (
        <ConfirmDialog
          title={`Remove ${removingPart.name}?`}
          confirmLabel="Remove"
          danger
          onCancel={() => setRemoving(null)}
          onConfirm={confirmRemove}
        >
          <p>
            The {plural(removing.count, removingPart.unit)} you’ve added will be deleted. You can add {removingPart.name} again
            any time.
          </p>
        </ConfirmDialog>
      )}

      {closed.length > 0 && (
        <div className="lnd__extras">
          {closed.map((x) => (
            <button key={x.id} type="button" className="lnd__extra" data-guide={x.id} onClick={() => open(x.id)}>
              <Plus size={16} aria-hidden="true" />
              {x.add}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Title({ course, onSave }) {
  const saved = course.title ?? '';
  const [text, setText] = useState(saved);
  useEffect(() => setText(keepTyped(saved)), [saved]); // saved here, or changed in another tab
  const { later, cancel } = useLater();

  // Leaving it empty puts the saved one back; a pause while it's empty waits
  const save = (value) => {
    const next = value.trim();
    if (next && next !== saved) onSave(next);
  };
  const commit = () => {
    cancel();
    if (!text.trim()) setText(saved);
    else save(text);
  };

  return (
    <section className="lnd__part lnd__part--title" data-guide="title">
      <label className="lrn__title" htmlFor="lnd-title-input">
        Title
      </label>
      <span className="lrn__box lnd__subtitle">
        <input
          id="lnd-title-input"
          className="lrn__input"
          value={text}
          maxLength={COURSE_TITLE_MAX}
          aria-describedby="lnd-title-count"
          autoComplete="off"
          onChange={(e) => {
            const value = e.target.value;
            setText(value);
            later(() => save(value));
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') {
              cancel();
              setText(saved);
            }
          }}
        />
      </span>
      <Under countId="lnd-title-count" used={text.length} max={COURSE_TITLE_MAX} />
    </section>
  );
}

function Subtitle({ course, onSave, onDraft, error }) {
  const saved = course.subtitle ?? '';
  const [text, setText] = useState(saved);
  useEffect(() => setText(keepTyped(saved)), [saved]); // saved here, or changed in another tab
  useEffect(() => onDraft?.({ subtitle: text.trim() }), [text]); // eslint-disable-line react-hooks/exhaustive-deps
  const { later, cancel } = useLater();

  const save = (value) => {
    const next = value.trim();
    if (next !== saved) onSave({ subtitle: next });
  };
  const commit = () => {
    cancel();
    save(text);
  };

  return (
    <section className="lnd__part" data-guide="subtitle">
      <label className="lrn__title" htmlFor="lnd-subtitle-input">
        Subtitle
      </label>
      <p className="lrn__help" id="lnd-subtitle-help">
        One line under the title that says what it’s about.
      </p>
      <span className={`lrn__box lnd__subtitle ${error ? 'lrn__box--error' : ''}`}>
        <input
          id="lnd-subtitle-input"
          className="lrn__input"
          value={text}
          maxLength={SUBTITLE_MAX}
          placeholder="e.g. Dinners for busy weeks, from shop to table"
          aria-invalid={error ? true : undefined}
          aria-describedby={`${error ? 'lnd-subtitle-error ' : ''}lnd-subtitle-help lnd-subtitle-count`}
          autoComplete="off"
          onChange={(e) => {
            const value = e.target.value;
            setText(value);
            later(() => save(value));
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') {
              cancel();
              setText(saved);
            }
          }}
        />
      </span>
      <Under
        errorId="lnd-subtitle-error"
        error={error}
        countId="lnd-subtitle-count"
        used={text.length}
        max={SUBTITLE_MAX}
      />
    </section>
  );
}

let keySeed = 0;
const newKey = () => `row-${(keySeed += 1)}`;

// One list: a line each, + Add another under them. onRemove(count): the
// part is optional, so 🗑 Remove shows by its heading (count: the lines
// with words in them)
function ListField({ id, course, onSave, onRemove, onDraft, error }) {
  const field = LISTS[id];
  const saved = listOf(course, id);
  const pad = (list) => {
    const rows = list.map((text) => ({ key: newKey(), text }));
    while (rows.length < field.rows) rows.push({ key: newKey(), text: '' });
    return rows;
  };
  const [rows, setRows] = useState(() => pad(saved));
  const [focusKey, setFocusKey] = useState(null); // a line just added, to type in
  const inputs = useRef({});

  useEffect(() => {
    if (!focusKey) return;
    inputs.current[focusKey]?.focus();
    setFocusKey(null);
  }, [focusKey]);

  // Saves the lines with words in them, when they're not what's saved
  const listFrom = (next) => next.map((r) => r.text.trim()).filter(Boolean);
  const { later, cancel } = useLater();
  const commit = (next) => {
    cancel();
    const list = listFrom(next);
    if (JSON.stringify(list) !== JSON.stringify(saved)) onSave({ [id]: list });
  };
  useEffect(() => onDraft?.({ [id]: listFrom(rows) }), [rows]); // eslint-disable-line react-hooks/exhaustive-deps

  const filled = rows.filter((r) => r.text.trim()).length;
  const isOutcomes = id === 'outcomes';
  const enough = filled >= OUTCOMES_MIN;
  const headId = `lrn-${id}`;

  const add = () => {
    const row = { key: newKey(), text: '' };
    setRows((prev) => [...prev, row]);
    setFocusKey(row.key);
  };

  const remove = (key) => {
    const next = rows.filter((r) => r.key !== key);
    setRows(next);
    commit(next);
  };

  return (
    <section className={`lnd__part lrn--${id}`} aria-labelledby={headId} data-guide={id}>
      <div className="lrn__head">
        <h3 className="lrn__title" id={headId}>
          {field.title}
        </h3>
        {isOutcomes && (
          <span className={`lrn__tally ${enough ? 'lrn__tally--ok' : ''}`}>
            {enough && <Check size={14} strokeWidth={3} aria-hidden="true" />}
            {enough ? filled : `${filled}/${OUTCOMES_MIN}`}
            <span className="sr-only">
              {enough ? ' added, enough to publish' : `, at least ${OUTCOMES_MIN} needed to publish`}
            </span>
          </span>
        )}
        {onRemove && (
          <button type="button" className="lnd__remove" onClick={() => onRemove(filled)}>
            <Trash2 size={15} aria-hidden="true" />
            Remove
            <span className="sr-only"> {field.title}</span>
          </button>
        )}
      </div>
      <p className="lrn__help">{field.help}</p>

      <ul className="lrn__rows">
        {rows.map((row, i) => (
          <li key={row.key} className="lrn__row">
            <span className="lrn__field">
              <span className={`lrn__box ${error && !row.text.trim() ? 'lrn__box--error' : ''}`}>
                <input
                  ref={(el) => {
                    inputs.current[row.key] = el;
                  }}
                  className="lrn__input"
                  value={row.text}
                  maxLength={LIST_ITEM_MAX}
                  placeholder={field.examples[i] ?? ''}
                  aria-label={`${field.title}, line ${i + 1}`}
                  aria-invalid={error && !row.text.trim() ? true : undefined}
                  aria-describedby={`${error ? `${headId}-error ` : ''}${headId}-count-${row.key}`}
                  autoComplete="off"
                  onChange={(e) => {
                    const text = e.target.value;
                    const next = rows.map((r) => (r.key === row.key ? { ...r, text } : r));
                    setRows(next);
                    later(() => commit(next));
                  }}
                  onBlur={() => commit(rows)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                  }}
                />
              </span>
              <Count id={`${headId}-count-${row.key}`} used={row.text.length} max={LIST_ITEM_MAX} />
            </span>
            {rows.length > field.rows && (
              <button
                type="button"
                className="ilt__tool ilt__tool--delete lrn__remove"
                title="Remove"
                aria-label={`Remove line ${i + 1}`}
                onClick={() => remove(row.key)}
              >
                <X size={16} aria-hidden="true" />
              </button>
            )}
          </li>
        ))}
      </ul>

      {error && (
        <p className="lrn__error lrn__error--list" id={`${headId}-error`}>
          {error}
        </p>
      )}

      {rows.length < LIST_MAX && (
        <button type="button" className="lnd__extra lrn__add" onClick={add}>
          <Plus size={16} aria-hidden="true" />
          Add another
        </button>
      )}
    </section>
  );
}

function Description({ course, onSave, onDirtyChange, onDraft, error }) {
  const saved = course.description ?? '';
  const [count, setCount] = useState(() => descriptionText(saved).length);
  const left = DESCRIPTION_MAX - count;
  const over = left < 0;
  const short = count > 0 && count < DESCRIPTION_MIN;
  const enough = count >= DESCRIPTION_MIN && !over;

  return (
    <section className={`lnd__part lnd__desc ${over || error ? 'lnd__desc--over' : ''}`} aria-labelledby="lnd-description" data-guide="description">
      <div className="lrn__head">
        <h3 className="lrn__title" id="lnd-description">
          Description
        </h3>
        {enough && (
          <span className="lrn__tally lrn__tally--ok">
            <Check size={14} strokeWidth={3} aria-hidden="true" />
            <span className="sr-only">Long enough to publish</span>
          </span>
        )}
      </div>
      <p className="lrn__help">
        What the course covers, how it works, and what changes for students by the end. It also appears on the
        course’s checkout page.
      </p>
      <div className="lnd__editor">
        <TextEditor
          initialHtml={saved}
          autosave
          label="Course description"
          placeholder="e.g. Over four weeks, you’ll plan, shop for and cook a week of dinners in one afternoon. Each lesson is a short video with a recipe card to print…"
          onSave={(html) => onSave({ description: html })}
          onChange={(html) => {
            setCount(descriptionText(html).length);
            onDraft?.({ description: html });
          }}
          canSave={(html) => descriptionText(html).length <= DESCRIPTION_MAX}
          onDirtyChange={onDirtyChange}
        />
      </div>
      {/* Under it: what needs doing on the left (only when something does),
          characters used out of the limit on the right, always */}
      <div className="lnd__desc-under">
        <p className={`lnd__desc-note ${over || error ? 'lnd__desc-note--error' : ''}`} aria-live="polite">
          {over
            ? `${num(-left)} characters over the limit. Shorten it to save.`
            : error
              ? error
              : short
              ? `${DESCRIPTION_MIN - count} more character${DESCRIPTION_MIN - count === 1 ? '' : 's'} needed to publish`
              : ''}
        </p>
        <Count used={count} max={DESCRIPTION_MAX} near={DESCRIPTION_NEAR} />
      </div>
    </section>
  );
}