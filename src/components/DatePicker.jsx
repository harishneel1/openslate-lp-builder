import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import './Pickers.css';

// ------------------------------------------------------------
// Picking a date: a field that shows the date in words and opens a
// month calendar. Used for a webinar's date (the landing page's event
// details, and Run again). Replaces the browser's own date box, which
// looks different in every browser, shows 10/24/2026, and only opens
// from its little icon.
//
//   [📅 Sat, 31 Oct 2026      ]
//   ┌ ‹  October 2026  › ─────┐
//   │ Sun Mon Tue … Sat        │
//   │  …   26  27  …  31(●)    │   ● the chosen date; today has a dot under it
//   └──────────────────────────┘
//
// A click anywhere on the field opens it. Picking a date closes it;
// a click outside or Escape closes it without a change. Weeks start on
// Sunday, like Indian wall calendars. Days before `min` can't be picked.
// Arrow keys move a day (up/down a week), Page Up/Down a month.
// On a phone it comes up from the bottom of the screen (Pickers.css).
//
// id: for the <label htmlFor> beside it
// value: 'YYYY-MM-DD' or ''; onChange('YYYY-MM-DD')
// min: the first date that can be picked (today by default)
// className: the field's look where it's used (e.g. 'qinput__text qinput__picker')
// ------------------------------------------------------------

const pad = (n) => String(n).padStart(2, '0');
const isISO = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? ''));
const toISO = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

// '2026-10-31' → a local Date at midnight
function fromISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const todayISO = () => toISO(new Date());

const addDays = (iso, n) => {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
};

// Same day in another month, kept inside that month (31 Oct + 1 month → 30 Nov)
const addMonths = (iso, n) => {
  const d = fromISO(iso);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return toISO(d);
};

// 'Sat, 31 Oct 2026'
export function dateInWords(iso) {
  if (!isISO(iso)) return '';
  const d = fromISO(iso);
  const weekday = d.toLocaleDateString('en-GB', { weekday: 'short' });
  const month = d.toLocaleDateString('en-GB', { month: 'short' });
  return `${weekday}, ${d.getDate()} ${month} ${d.getFullYear()}`;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Open/close for a field with a panel under it: closes on a click
// outside or Escape, and gives focus back to the field. Escape is kept
// from reaching a pop-up around it, so it closes the panel, not the pop-up.
export function usePanel() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [open]);

  const onPanelKeyDown = (e) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    close();
  };

  return { open, setOpen, close, wrapRef, triggerRef, onPanelKeyDown };
}

export default function DatePicker({ id, value, onChange, min = todayISO(), className = '', placeholder = 'Pick a date' }) {
  const { open, setOpen, close, wrapRef, triggerRef, onPanelKeyDown } = usePanel();
  const [focus, setFocus] = useState(min); // the day the keyboard is on
  const gridRef = useRef(null);
  const moved = useRef(false); // focus the day only after the keyboard moves (or on open)

  const today = todayISO();
  const chosen = isISO(value) ? value : null;
  const view = fromISO(focus); // the month shown is the focused day's month
  const year = view.getFullYear();
  const month = view.getMonth();
  const monthName = new Date(year, month, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  const openCalendar = () => {
    const start = chosen && chosen >= min ? chosen : min;
    setFocus(start);
    moved.current = true;
    setOpen(true);
  };

  // Put the keyboard on the focused day when it opens or the keyboard moves
  useEffect(() => {
    if (!open || !moved.current) return;
    moved.current = false;
    gridRef.current?.querySelector(`[data-date="${focus}"]`)?.focus();
  }, [open, focus]);

  const pick = (iso) => {
    onChange(iso);
    close();
  };

  const moveTo = (iso) => {
    const next = iso < min ? min : iso;
    moved.current = true;
    setFocus(next);
  };

  const onDayKey = (e) => {
    const steps = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (steps[e.key] !== undefined) {
      e.preventDefault();
      moveTo(addDays(focus, steps[e.key]));
    } else if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault();
      moveTo(addMonths(focus, e.key === 'PageUp' ? -1 : 1));
    }
  };

  // The month's days, after blanks up to its first weekday (weeks start on Sunday)
  const lead = new Date(year, month, 1).getDay();
  const count = new Date(year, month + 1, 0).getDate();
  const cells = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: count }, (_, i) => toISO(new Date(year, month, i + 1))),
  ];
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  while (weeks[weeks.length - 1].length < 7) weeks[weeks.length - 1].push(null);

  // The previous month is all before min: nothing to pick there
  const prevDisabled = toISO(new Date(year, month, 0)) < min;

  return (
    <div className="pk" ref={wrapRef}>
      <button
        type="button"
        id={id}
        ref={triggerRef}
        className={`pk__trigger ${className} ${chosen ? '' : 'pk__trigger--empty'}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? close() : openCalendar())}
      >
        <CalendarDays size={18} className="pk__icon" aria-hidden="true" />
        <span className="pk__value">{chosen ? dateInWords(chosen) : placeholder}</span>
      </button>

      {open && (
        <>
          {/* Phones only: dims the page behind the sheet; a tap closes it */}
          <div className="pk__scrim" onClick={() => close()} aria-hidden="true" />
          <div className="pk__panel pk__panel--date" role="dialog" aria-label="Choose a date" onKeyDown={onPanelKeyDown}>
            <div className="pk__head">
              <button
                type="button"
                className="pk__nav"
                onClick={() => setFocus((f) => (addMonths(f, -1) < min ? min : addMonths(f, -1)))}
                disabled={prevDisabled}
                aria-label="Previous month"
              >
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
              <p className="pk__month" aria-live="polite">
                {monthName}
              </p>
              <button type="button" className="pk__nav" onClick={() => setFocus((f) => addMonths(f, 1))} aria-label="Next month">
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </div>

            <table className="pk__grid" ref={gridRef} role="grid" aria-label={monthName}>
              <thead>
                <tr>
                  {WEEKDAYS.map((d) => (
                    <th key={d} scope="col" className="pk__weekday">
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeks.map((week, w) => (
                  <tr key={w}>
                    {week.map((iso, i) =>
                      iso === null ? (
                        <td key={`blank-${i}`} />
                      ) : (
                        <td key={iso}>
                          <button
                            type="button"
                            data-date={iso}
                            className={[
                              'pk__day',
                              iso === chosen && 'pk__day--chosen',
                              iso === today && 'pk__day--today',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                            disabled={iso < min}
                            tabIndex={iso === focus ? 0 : -1}
                            aria-pressed={iso === chosen}
                            aria-current={iso === today ? 'date' : undefined}
                            aria-label={`${dateInWords(iso)}${iso === today ? ', today' : ''}`}
                            onClick={() => pick(iso)}
                            onKeyDown={onDayKey}
                            onFocus={() => setFocus(iso)}
                          >
                            {fromISO(iso).getDate()}
                          </button>
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}