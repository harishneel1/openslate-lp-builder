import { useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import { usePanel } from './DatePicker';
import './Pickers.css';

// ------------------------------------------------------------
// Picking a start time: a field that shows "7:00 pm IST" and opens a
// panel of time buttons, every 30 minutes, under Morning, Afternoon and
// Evening (the same groups as the 1:1 booking page). Replaces the
// browser's own time box and its scrolling wheel: the coach sees 7:00,
// 7:30 and 8:00 side by side and taps one.
//
//   [🕖 7:00 pm IST          ]
//   ┌ Morning | Afternoon | [Evening] ┐
//   │ 5:00 pm  5:30 pm  6:00 pm  6:30 pm │
//   │ 7:00 pm  7:30 pm  …               │
//   └───────────────────────────────────┘
//
// It opens on the group of the chosen time, with that time marked.
// A time that isn't on the half hour (an older 7:15) still shows, in its
// group. Picking closes it; a click outside or Escape closes it unchanged.
// On a phone it comes up from the bottom of the screen (Pickers.css).
//
// id: for the <label htmlFor> beside it
// value: 'HH:MM' (24-hour) or ''; onChange('HH:MM')
// zone: shown after the time ('IST'), or null
// className: the field's look where it's used
// ------------------------------------------------------------

const pad = (n) => String(n).padStart(2, '0');
const isTime = (v) => /^\d{2}:\d{2}$/.test(String(v ?? ''));

// '19:00' → '7:00 pm'
export function timeInWords(time) {
  if (!isTime(time)) return '';
  const [h, m] = time.split(':').map(Number);
  return `${h % 12 || 12}:${pad(m)} ${h >= 12 ? 'pm' : 'am'}`;
}

// Every half hour from `from` up to (not including) `to`, in hours
const halfHours = (from, to) =>
  Array.from({ length: (to - from) * 2 }, (_, i) => `${pad(from + Math.floor(i / 2))}:${i % 2 ? '30' : '00'}`);

const PERIODS = [
  { id: 'morning', label: 'Morning', times: halfHours(5, 12) },
  { id: 'afternoon', label: 'Afternoon', times: halfHours(12, 17) },
  { id: 'evening', label: 'Evening', times: halfHours(17, 24) },
];

// Which group a time sits in (very early hours count as morning)
const periodOf = (time) => {
  const h = Number(time.split(':')[0]);
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
};

export default function TimePicker({ id, value, onChange, zone = null, className = '', placeholder = 'Pick a time' }) {
  const { open, setOpen, close, wrapRef, triggerRef, onPanelKeyDown } = usePanel();
  const chosen = isTime(value) ? value : null;
  const [tab, setTab] = useState(chosen ? periodOf(chosen) : 'evening');
  const gridRef = useRef(null);

  const openPanel = () => {
    setTab(chosen ? periodOf(chosen) : 'evening');
    setOpen(true);
  };

  // On open: the keyboard starts on the chosen time (or the group's first)
  useEffect(() => {
    if (!open) return;
    const grid = gridRef.current;
    (grid?.querySelector('[aria-pressed="true"]') ?? grid?.querySelector('button'))?.focus();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (time) => {
    onChange(time);
    close();
  };

  const period = PERIODS.find((p) => p.id === tab);
  // The chosen time, if it's off the half hour, joins its group in order
  const times =
    chosen && periodOf(chosen) === tab && !period.times.includes(chosen)
      ? [...period.times, chosen].sort()
      : period.times;

  const shown = chosen ? `${timeInWords(chosen)}${zone ? ` ${zone}` : ''}` : placeholder;

  return (
    <div className="pk" ref={wrapRef}>
      <button
        type="button"
        id={id}
        ref={triggerRef}
        className={`pk__trigger ${className} ${chosen ? '' : 'pk__trigger--empty'}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? close() : openPanel())}
      >
        <Clock size={18} className="pk__icon" aria-hidden="true" />
        <span className="pk__value">{shown}</span>
      </button>

      {open && (
        <>
          <div className="pk__scrim" onClick={() => close()} aria-hidden="true" />
          <div className="pk__panel pk__panel--time" role="dialog" aria-label="Choose a start time" onKeyDown={onPanelKeyDown}>
            <div className="pk__tabs" role="group" aria-label="Part of the day">
              {PERIODS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`pk__tab ${tab === p.id ? 'pk__tab--on' : ''}`}
                  aria-pressed={tab === p.id}
                  onClick={() => setTab(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="pk__times" ref={gridRef} role="group" aria-label={`${period.label} times`}>
              {times.map((time) => (
                <button
                  key={time}
                  type="button"
                  className={`pk__time ${time === chosen ? 'pk__time--chosen' : ''}`}
                  aria-pressed={time === chosen}
                  onClick={() => pick(time)}
                >
                  {timeInWords(time)}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}