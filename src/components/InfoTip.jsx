import { useEffect, useId, useRef, useState } from 'react';
import { Info } from 'lucide-react';
import './InfoTip.css';

// ------------------------------------------------------------
// The (i) beside a label: a short explanation people can look at when
// they want to, without it taking room on the screen. First made for
// the booking rules (HoursDrawer); also in Add another session.
//
// Shows on hover, and stays open on a click (for people who click
// rather than hover) until they click elsewhere, click it again or
// press Escape. Escape here closes just the bubble, not the panel or
// pop-up it's in.
//
// label: what it explains, for screen readers ("What is “Break between calls”?")
// text:  the explanation
// align: 'start' (default) grows right from the icon; 'end' grows left,
//        for an icon near the right edge of a pop-up
// ------------------------------------------------------------
export default function InfoTip({ label, text, align = 'start' }) {
  const [pinned, setPinned] = useState(false);
  const ref = useRef(null);
  const tipId = useId();

  useEffect(() => {
    if (!pinned) return undefined;
    const onDown = (e) => !ref.current?.contains(e.target) && setPinned(false);
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [pinned]);

  const onKeyDown = (e) => {
    if (e.key === 'Escape' && pinned) {
      e.preventDefault(); // keeps the panel open
      e.stopPropagation();
      setPinned(false);
    }
  };

  return (
    <span
      ref={ref}
      className={`info-tip info-tip--${align} ${pinned ? 'info-tip--open' : ''}`}
      onKeyDown={onKeyDown}
    >
      <button
        type="button"
        className="info-tip__btn"
        aria-label={`What is “${label}”?`}
        aria-describedby={tipId}
        onClick={() => setPinned((p) => !p)}
      >
        <Info size={15} aria-hidden="true" />
      </button>
      <span className="tip info-tip__tip" role="tooltip" id={tipId}>
        {text}
      </span>
    </span>
  );
}