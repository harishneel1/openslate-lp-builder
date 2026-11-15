import { useEffect, useRef, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import './InlineTitle.css';

// ------------------------------------------------------------
// A title that's edited in place, with a pencil right after its last
// word so it's clear it can be changed (and, if it can be deleted, a bin
// beside the pencil). Used for a course's title (CoursePage.jsx), a
// section's name and a lesson's name while it's renamed (CourseContent.jsx).
//
//   AI Engineering Accelerator ✎
//   Introduction ✎ 🗑
//
// The box is as wide as the words in it (up to the room there is), so
// the pencil always sits at the end of the title. A click on the words or
// the pencil puts the cursor in it, with the words selected; the pencil
// and bin hide while it's being edited.
// Saves on leaving it or Enter; Escape, or an empty box, puts the saved
// one back.
//
// id, label (for screen readers), value, maxLength, onSave(text)
// variant: 'page' (the course's title) | 'section' | 'lesson'
// autoFocus, onFocused(): select it straight away (a new section, a lesson
//   being renamed)
// onEditEnd(): after it's left (saved or not), for a lesson's name, which
//   goes back to being a plain row
// onDelete(), deleteLabel: show a bin after the pencil ("Delete section")
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
}) {
  const [text, setText] = useState(value);
  const input = useRef(null);
  useEffect(() => setText(value), [value]); // changed in another tab

  const edit = () => {
    input.current?.focus();
    input.current?.select();
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
    </div>
  );
}