import { useEffect, useRef, useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import {
  COURSE_TITLE_MAX,
  DESCRIPTION_MAX,
  DESCRIPTION_MIN,
  LIST_ITEM_MAX,
  LIST_MAX,
  OUTCOMES_MIN,
  SUBTITLE_MAX,
  TESTIMONIALS_MAX,
  TESTIMONIAL_NAME_MAX,
  TESTIMONIAL_TEXT_MAX,
  listOf,
  descriptionText,
  testimonialsOf,
} from '../data/courses';
import TextEditor from '../components/TextEditor';
import CourseCover from './CourseCover';

// ------------------------------------------------------------
// A course's Landing page step (CoursePage.jsx): everything people see
// before they buy, in one place, most important first.
//
//   Title
//   [AI Engineering Accelerator                                  ]
//   Subtitle
//   [Dinners for busy weeks, from shop to table                  ]
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
//   Cover image (optional)                       (CourseSettings.jsx)
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
//
// Title: the course's name everywhere (the focus bar, the academy, its
// own contract). Up to 100 characters; it can't be empty: clearing it
// puts the saved one back.
// Subtitle: needed to publish, up to 120 characters.
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
// Testimonials: what past students have said, in their words (from
// WhatsApp, emails, reviews elsewhere), each a quote and, if they're
// happy to be named, a name. Up to 6. The landing page shows them under
// "What students say", as testimonials, never as star ratings: those come
// only from students who took the course. Each saves when they leave it.
// Description: needed to publish, always open, written in the text
// editor (TextEditor.jsx, autosave). It saves when they click away, like
// the fields around it. It's also the description on the course's own
// contract, the checkout page's (as plain text: CoursePage.jsx keeps it
// in step), so it has the contract's limit: 2,000 characters of text, and
// at least 50 to publish (DESCRIPTION_MAX, DESCRIPTION_MIN in courses.js,
// counted as descriptionText counts them). Under it, only when it
// matters: how many more are needed to publish, how many are left (from
// 100), or how far over the limit it is (it doesn't save until it's
// shorter, and the page asks before they leave, through onDirtyChange).
// A green tick by its heading once it's long enough.
//
// course, onSave(change) → true if it saved
// onSaveTitle(title) → true if it saved (CoursePage.jsx: renames its contract too)
// onDirtyChange(dirty): the description has (or no longer has) unsaved changes
//   (only while it's too long to save, or before they've clicked away)
// ------------------------------------------------------------

const NEAR_LIMIT = 20;
const DESCRIPTION_NEAR = 100; // the description's count shows from here

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

const EXTRAS = [
  { id: 'requirements', add: 'Add requirements', has: (c) => listOf(c, 'requirements').length > 0 },
  { id: 'audience', add: 'Add who it’s for', has: (c) => listOf(c, 'audience').length > 0 },
  { id: 'testimonials', add: 'Add testimonials', has: (c) => testimonialsOf(c).length > 0 },
];

// Characters left, only when they're close to the end
const Left = ({ text, max }) =>
  max - text.length <= NEAR_LIMIT ? (
    <span className="lrn__count" aria-live="polite">
      {max - text.length}
    </span>
  ) : null;

export default function CourseLanding({ course, onSave, onSaveTitle, onDirtyChange }) {
  // The optional parts open: those with something in them, and any clicked open
  const [opened, setOpened] = useState(() => new Set(EXTRAS.filter((x) => x.has(course)).map((x) => x.id)));
  const closed = EXTRAS.filter((x) => !opened.has(x.id));

  const open = (id) => {
    setOpened((prev) => new Set([...prev, id]));
    requestAnimationFrame(() => document.querySelector(`.lrn--${id} .lrn__input, .lrn--${id} textarea`)?.focus());
  };

  return (
    <div className="lnd">
      <Title course={course} onSave={onSaveTitle ?? ((title) => onSave({ title }))} />
      <Subtitle course={course} onSave={onSave} />
      <Description course={course} onSave={onSave} onDirtyChange={onDirtyChange} />
      <ListField id="outcomes" course={course} onSave={onSave} />
      <div className="cst lnd__cover" data-guide="cover">
        <CourseCover course={course} onSave={onSave} />
      </div>

      {opened.has('requirements') && <ListField id="requirements" course={course} onSave={onSave} />}
      {opened.has('audience') && <ListField id="audience" course={course} onSave={onSave} />}
      {opened.has('testimonials') && <TestimonialsField course={course} onSave={onSave} />}

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
  useEffect(() => setText(saved), [saved]); // changed in another tab

  const commit = () => {
    const next = text.trim();
    if (!next) setText(saved);
    else if (next !== saved) onSave(next);
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
          autoComplete="off"
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') setText(saved);
          }}
        />
        <Left text={text} max={COURSE_TITLE_MAX} />
      </span>
    </section>
  );
}

function Subtitle({ course, onSave }) {
  const saved = course.subtitle ?? '';
  const [text, setText] = useState(saved);
  useEffect(() => setText(saved), [saved]); // changed in another tab

  const commit = () => {
    const next = text.trim();
    if (next !== saved) onSave({ subtitle: next });
  };

  return (
    <section className="lnd__part" data-guide="subtitle">
      <label className="lrn__title" htmlFor="lnd-subtitle-input">
        Subtitle
      </label>
      <p className="lrn__help" id="lnd-subtitle-help">
        One line under the title that says what it’s about.
      </p>
      <span className="lrn__box lnd__subtitle">
        <input
          id="lnd-subtitle-input"
          className="lrn__input"
          value={text}
          maxLength={SUBTITLE_MAX}
          placeholder="e.g. Dinners for busy weeks, from shop to table"
          aria-describedby="lnd-subtitle-help"
          autoComplete="off"
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') setText(saved);
          }}
        />
        <Left text={text} max={SUBTITLE_MAX} />
      </span>
    </section>
  );
}

let keySeed = 0;
const newKey = () => `row-${(keySeed += 1)}`;

// One list: a line each, + Add another under them
function ListField({ id, course, onSave }) {
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
  const commit = (next) => {
    const list = next.map((r) => r.text.trim()).filter(Boolean);
    if (JSON.stringify(list) !== JSON.stringify(saved)) onSave({ [id]: list });
  };

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
      </div>
      <p className="lrn__help">{field.help}</p>

      <ul className="lrn__rows">
        {rows.map((row, i) => (
          <li key={row.key} className="lrn__row">
            <span className="lrn__box">
              <input
                ref={(el) => {
                  inputs.current[row.key] = el;
                }}
                className="lrn__input"
                value={row.text}
                maxLength={LIST_ITEM_MAX}
                placeholder={field.examples[i] ?? ''}
                aria-label={`${field.title}, line ${i + 1}`}
                autoComplete="off"
                onChange={(e) => {
                  const text = e.target.value;
                  setRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, text } : r)));
                }}
                onBlur={() => commit(rows)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                }}
              />
              <Left text={row.text} max={LIST_ITEM_MAX} />
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

      {rows.length < LIST_MAX && (
        <button type="button" className="lnd__extra lrn__add" onClick={add}>
          <Plus size={16} aria-hidden="true" />
          Add another
        </button>
      )}
    </section>
  );
}

// Testimonials: a quote and a name each, + Add another under them
function TestimonialsField({ course, onSave }) {
  const saved = testimonialsOf(course);
  const blank = () => ({ id: `tst-new-${newKey()}`, name: '', text: '' });
  const [rows, setRows] = useState(() => (saved.length ? saved : [blank()]));
  const [focusId, setFocusId] = useState(null);

  useEffect(() => {
    if (!focusId) return;
    document.getElementById(`tst-text-${focusId}`)?.focus();
    setFocusId(null);
  }, [focusId]);

  const commit = (next) => {
    const list = next.filter((r) => r.text.trim()).map((r) => ({ id: r.id, name: r.name.trim(), text: r.text.trim() }));
    const before = saved.map((r) => ({ id: r.id, name: r.name, text: r.text }));
    if (JSON.stringify(list) !== JSON.stringify(before)) onSave({ testimonials: list });
  };

  const edit = (id, field, value) => setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));

  const add = () => {
    const row = blank();
    setRows((prev) => [...prev, row]);
    setFocusId(row.id);
  };

  const remove = (id) => {
    const next = rows.filter((r) => r.id !== id);
    setRows(next.length ? next : [blank()]);
    commit(next);
  };

  return (
    <section className="lnd__part lrn--testimonials" aria-labelledby="lrn-testimonials" data-guide="testimonials">
      <div className="lrn__head">
        <h3 className="lrn__title" id="lrn-testimonials">
          Testimonials
        </h3>
      </div>
      <p className="lrn__help">
        What past students have said, in their words: from WhatsApp, emails or reviews elsewhere. They show as
        testimonials, not star ratings.
      </p>

      <ul className="tst__list">
        {rows.map((row, i) => (
          <li key={row.id} className="tst__row">
            <div className="tst__fields">
              <span className="lrn__box tst__quote">
                <textarea
                  id={`tst-text-${row.id}`}
                  className="lrn__input tst__text"
                  rows={3}
                  value={row.text}
                  maxLength={TESTIMONIAL_TEXT_MAX}
                  placeholder="e.g. My back stopped hurting by week two. I finally have a routine I keep."
                  aria-label={`Testimonial ${i + 1}: what they said`}
                  onChange={(e) => edit(row.id, 'text', e.target.value)}
                  onBlur={() => commit(rows)}
                />
                <Left text={row.text} max={TESTIMONIAL_TEXT_MAX} />
              </span>
              <span className="lrn__box tst__name">
                <input
                  className="lrn__input"
                  value={row.name}
                  maxLength={TESTIMONIAL_NAME_MAX}
                  placeholder="Their name (optional), e.g. Ananya R."
                  aria-label={`Testimonial ${i + 1}: their name`}
                  autoComplete="off"
                  onChange={(e) => edit(row.id, 'name', e.target.value)}
                  onBlur={() => commit(rows)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                  }}
                />
              </span>
            </div>
            {(rows.length > 1 || row.text) && (
              <button
                type="button"
                className="ilt__tool ilt__tool--delete lrn__remove"
                title="Remove"
                aria-label={`Remove testimonial ${i + 1}`}
                onClick={() => remove(row.id)}
              >
                <X size={16} aria-hidden="true" />
              </button>
            )}
          </li>
        ))}
      </ul>

      {rows.length < TESTIMONIALS_MAX && (
        <button type="button" className="lnd__extra lrn__add" onClick={add}>
          <Plus size={16} aria-hidden="true" />
          Add another
        </button>
      )}
    </section>
  );
}

function Description({ course, onSave, onDirtyChange }) {
  const saved = course.description ?? '';
  const [count, setCount] = useState(() => descriptionText(saved).length);
  const left = DESCRIPTION_MAX - count;
  const over = left < 0;
  const short = count > 0 && count < DESCRIPTION_MIN;
  const enough = count >= DESCRIPTION_MIN && !over;

  return (
    <section className={`lnd__part lnd__desc ${over ? 'lnd__desc--over' : ''}`} aria-labelledby="lnd-description" data-guide="description">
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
          onChange={(html) => setCount(descriptionText(html).length)}
          canSave={(html) => descriptionText(html).length <= DESCRIPTION_MAX}
          onDirtyChange={onDirtyChange}
        />
      </div>
      {(over || short || left <= DESCRIPTION_NEAR) && (
        <p className={`lnd__desc-note ${over ? 'lnd__desc-note--error' : ''}`} aria-live="polite">
          {over
            ? `${(-left).toLocaleString('en-IN')} characters over the ${DESCRIPTION_MAX.toLocaleString('en-IN')} limit. Shorten it to save.`
            : short
              ? `${DESCRIPTION_MIN - count} more character${DESCRIPTION_MIN - count === 1 ? '' : 's'} needed to publish`
              : `${left} character${left === 1 ? '' : 's'} left`}
        </p>
      )}
    </section>
  );
}