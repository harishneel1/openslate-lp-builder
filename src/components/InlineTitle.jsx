import { useEffect, useRef, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import './InlineTitle.css';

// ------------------------------------------------------------
// A title that's edited in place, with a pencil right after its last
// word so it's clear it can be changed (and, if it can be deleted, a bin
// beside the pencil). The pencil is always shown, never only on hover:
// touch screens have no hover, and it says "you can rename this".
// Used for a course's name in the focus bar (AppLayout.jsx, variant
// 'bar'), a section's name and a lesson's name (CourseContent.jsx), and
// the open lesson's name in its panel (LessonPane.jsx, variant 'pane').
//
//   AI Engineering Accelerator ✎
//   Introduction ✎ 🗑
//
// The box is as wide as the words in it (up to the room there is), so
// the pencil always sits at the end of the title. A click on the words or
// the pencil puts the cursor in it, with all the words selected (the
// first click only: after that clicks place the cursor); the pencil
// and bin hide while it's being edited.
// Saves on leaving it or Enter; Escape, or an empty box, puts the saved
// one back.
//
// id, label (for screen readers), value, maxLength, onSave(text)
// variant: 'page' | 'bar' (the focus bar) | 'section' | 'lesson' | 'pane'
// autoFocus, onFocused(): select it straight away (a new section, a lesson
//   being renamed)
// onEditEnd(): after it's left (saved or not), for a lesson's name, which
//   goes back to being a plain row
// onDelete(), deleteLabel: show a bin after the pencil ("Delete section")
// hint: one line shown under the box while it's being edited (a published
//   course: "Students and your landing page will show the new name…")
// countNear: while editing, how many characters are left shows once
//   there are this many or fewer (needs maxLength)
// ------------------------------------------------------------

export default function InlineTitle({
  id,
  label,
  value,
  maxLength,
  onSave,
  variant = 'page',
  autoFocus,
  onFocused,
  onEditEnd,
  onDelete,
  deleteLabel = 'Delete',
  hint = null,
  countNear = null,
}) {
  const [text, setText] = useState(value);
  const input = useRef(null);
  useEffect(() => setText(value), [value]); // changed in another tab, or elsewhere on the page

  const edit = () => {
    input.current?.focus();
    input.current?.select();
    // Again once the click is done: the browser can put back where the
    // cursor last was in it (unless they've already typed)
    const before = input.current?.value;
    requestAnimationFrame(() => {
      const el = input.current;
      if (el && document.activeElement === el && el.value === before) el.select();
    });
  };

  useEffect(() => {
    if (!autoFocus) return;
    edit();
    onFocused?.();
  }, [autoFocus]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = () => {
    const next = text.trim();
    if (!next) setText(value);
    else if (next !== value) onSave(next);
    onEditEnd?.();
  };

  const small = variant !== 'page';
  const left = maxLength ? maxLength - text.length : null;
  const showCount = countNear != null && left != null && left <= countNear;

  return (
    <div className={`ilt ilt--${variant}`}>
      <label className="ilt__sr" htmlFor={id}>
        {label}
      </label>
      <span className="ilt__box">
        {/* The same words, hidden, so the box is as wide as they are */}
        <span className="ilt__size" aria-hidden="true">
          {text || ' '}
        </span>
        <input
          ref={input}
          id={id}
          className="ilt__input"
          size={1} // no built-in width: the hidden words set it
          value={text}
          maxLength={maxLength}
          autoComplete="off"
          aria-describedby={hint ? `${id}-hint` : undefined}
          // The first click in selects the whole name, so typing replaces
          // it; once in, clicks place the cursor as usual
          onMouseDown={(e) => {
            if (document.activeElement === e.currentTarget) return;
            e.preventDefault();
            edit();
          }}
          onFocus={(e) => e.currentTarget.select()} // Tab in: the whole name too
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') {
              setText(value);
              requestAnimationFrame(() => e.target.blur());
            }
          }}
        />
      </span>
      {showCount && (
        <span className="ilt__count" aria-live="polite">
          {left}
        </span>
      )}
      {/* For the mouse; the box itself is what the keyboard reaches */}
      <button
        type="button"
        className="ilt__tool"
        tabIndex={-1}
        aria-hidden="true"
        title="Rename"
        onMouseDown={(e) => e.preventDefault()}
        onClick={edit}
      >
        <Pencil size={small ? 15 : 18} />
      </button>
      {onDelete && (
        <button
          type="button"
          className="ilt__tool ilt__tool--delete"
          title={deleteLabel}
          aria-label={`${deleteLabel}: ${value}`}
          onClick={onDelete}
        >
          <Trash2 size={small ? 15 : 18} />
        </button>
      )}
      {hint && (
        <span className="ilt__hint" id={`${id}-hint`}>
          {hint}
        </span>
      )}
    </div>
  );
}