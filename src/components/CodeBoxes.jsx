import { forwardRef, useImperativeHandle, useRef } from 'react';

// ------------------------------------------------------------
// The six boxes a one-time code goes in, on the sign-in (StudentSignIn.jsx)
// and on Update number/email (UpdateContactPage.jsx).
// Typing moves to the next box, pasting fills them all, Backspace on an
// empty box goes back, and the arrow keys move between them.
//
// value: an array of 6 single digits ('' where empty)
// onChange(next array)
// invalid: outlines them in red
// ref.focus() → the first empty box (or the last)
// Its look is in StudentSignIn.css (.ssi__code, .ssi__digit).
// ------------------------------------------------------------

export const CODE_LENGTH = 6;
export const emptyCode = () => Array(CODE_LENGTH).fill('');

const CodeBoxes = forwardRef(function CodeBoxes({ value, onChange, invalid = false }, ref) {
  const boxes = useRef([]);

  useImperativeHandle(ref, () => ({
    focus() {
      const at = value.findIndex((d) => !d);
      boxes.current[at === -1 ? CODE_LENGTH - 1 : at]?.focus();
    },
  }));

  // Digits typed or pasted from box `from` on
  const put = (from, typed) => {
    const got = typed.replace(/\D/g, '').slice(0, CODE_LENGTH - from);
    if (!got) return;
    const next = [...value];
    [...got].forEach((d, i) => {
      next[from + i] = d;
    });
    onChange(next);
    boxes.current[Math.min(from + got.length, CODE_LENGTH - 1)]?.focus();
  };

  const clear = (i) => {
    const next = [...value];
    next[i] = '';
    onChange(next);
  };

  const onKey = (i) => (e) => {
    if (e.key === 'Backspace' && !value[i] && i > 0) {
      e.preventDefault();
      const next = [...value];
      next[i - 1] = '';
      onChange(next);
      boxes.current[i - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && i > 0) {
      e.preventDefault();
      boxes.current[i - 1]?.focus();
    } else if (e.key === 'ArrowRight' && i < CODE_LENGTH - 1) {
      e.preventDefault();
      boxes.current[i + 1]?.focus();
    }
  };

  return (
    <fieldset className="ssi__code">
      <legend className="sr-only">One-time code</legend>
      {value.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            boxes.current[i] = el;
          }}
          className={`ssi__digit ${invalid ? 'ssi__digit--error' : ''}`}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={CODE_LENGTH}
          value={d}
          aria-label={`Digit ${i + 1} of ${CODE_LENGTH}`}
          aria-invalid={invalid}
          onChange={(e) => {
            const typed = e.target.value.replace(/\D/g, '');
            if (!typed) clear(i);
            // Typing over a filled box: keep only the new digit
            else put(i, d && typed.length === 2 ? typed.replace(d, '') || d : typed);
          }}
          onPaste={(e) => {
            e.preventDefault();
            put(0, e.clipboardData.getData('text'));
          }}
          onKeyDown={onKey(i)}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </fieldset>
  );
});

export default CodeBoxes;