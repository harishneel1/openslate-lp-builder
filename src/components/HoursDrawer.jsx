import { useEffect, useId, useRef, useState } from 'react';
import { CalendarOff, Info } from 'lucide-react';
import Drawer from './Drawer';
import { WeeklyHours } from './WeeklyHoursInput';
import { BOOKING_RULES } from '../data/bookingRules';
import { sameHours } from '../data/availabilityStore';
import { hoursStatus } from '../utils/weeklyHours';
import '../screens/EditFrame.css'; // the save bar's buttons, reused in the footer
import './HoursDrawer.css';

// ------------------------------------------------------------
// One call's hours, edited in a panel from the right, so the edit
// screen stays one short column of sections.
//
//   Weekly hours    the same sheet as setup (WeeklyHoursInput.jsx)
//   Booking rules   break between calls, how soon, how far ahead; each
//                   with an (i) saying why, and an example for the value
//                   picked that changes as they pick another
// Days off are shared by every call, so they're set on the 1:1 calls
// page, under Calendar (DaysOffRow.jsx). A line at the bottom says so.
//
// Changes stay in the panel until "Use these hours", which hands them
// to the edit screen's draft; the screen's own Save saves them with
// everything else. Closing with changes asks first.
//
// value: the call's hours now (its draft, if already changed)
// callName / callLength: for the lines that say which call this is
// onApply(hours): use these hours (the panel then closes)
// onClose(): close without them
// ------------------------------------------------------------
export default function HoursDrawer({ value, callName, callLength, onApply, onClose }) {
  const [hours, setHours] = useState(() => structuredClone(value));
  const [asking, setAsking] = useState(false); // "Drop your changes?" showing
  const status = hoursStatus(hours.weekly);
  const changed = !sameHours(hours, value);

  const update = (next) => {
    setHours(next);
    setAsking(false);
  };
  const requestClose = () => (changed ? setAsking(true) : onClose());
  const apply = () => status === 'ok' && onApply(hours);

  const footer = asking ? (
    <>
      <p className="hd__status" role="alert">
        <strong>These hours aren’t used yet.</strong> Drop your changes?
      </p>
      <div className="hd__actions">
        <button type="button" className="es__btn es__btn--quiet" onClick={() => setAsking(false)}>
          Keep editing
        </button>
        <button type="button" className="es__btn es__btn--danger" onClick={onClose}>
          Drop changes
        </button>
      </div>
    </>
  ) : (
    <>
      <p className="hd__status" aria-live="polite">
        {status === 'fix' && 'Fix the hours marked in red to use them.'}
        {status === 'none' && 'Add hours to at least one day to use them.'}
      </p>
      <div className="hd__actions">
        <button type="button" className="es__btn es__btn--quiet" onClick={requestClose}>
          Cancel
        </button>
        <button type="button" className="es__btn es__btn--primary" onClick={apply} disabled={status !== 'ok'}>
          Use these hours
        </button>
      </div>
    </>
  );

  return (
    <Drawer
      className="hd"
      title="When people can book"
      sub={
        callName
          ? `For ${callName} only. Your other calls keep their own hours.`
          : 'For this call only. Your other calls keep their own hours.'
      }
      onClose={requestClose}
      footer={footer}
    >
      <WeeklyHours value={hours} onChange={update} callLength={callLength} />
      <BookingRules value={hours} onChange={update} />
      <p className="hd-note">
        <CalendarOff size={16} aria-hidden="true" />
        <span>
          Days off apply to all your calls. Set them on the 1:1 calls page, under Calendar.
        </span>
      </p>
    </Drawer>
  );
}

// The call's booking rules: one dropdown each
function BookingRules({ value, onChange }) {
  const titleId = useId();
  return (
    <section className="hd-rules" aria-labelledby={titleId}>
      <h2 className="hd-rules__title" id={titleId}>
        Booking rules
      </h2>
      <div className="hd-rules__list">
        {BOOKING_RULES.map((rule) => (
          <BookingRule
            key={rule.key}
            rule={rule}
            value={value[rule.key]}
            onChange={(v) => onChange({ ...value, [rule.key]: v })}
          />
        ))}
      </div>
    </section>
  );
}

//   Break between calls (i)                         [ 15 minutes ▾ ]
//   Also applies to your other 1:1 calls.
//   ┌ Example: If a call ends at 3:00 PM, the next one ┐
//   └ can start at 3:15 PM at the earliest.             ┘
function BookingRule({ rule, value, onChange }) {
  const { label, hint, why, options, example } = rule;
  const selectId = useId();
  return (
    <div className="hd-rule">
      <div className="hd-rule__text">
        <span className="hd-rule__head">
          <label className="hd-rule__label" htmlFor={selectId}>
            {label}
          </label>
          {why && <InfoTip label={label} text={why} />}
        </span>
        {hint && <span className="hd-rule__hint">{hint}</span>}
        {example && (
          <p className="hd-rule__example" aria-live="polite">
            <span className="hd-rule__example-tag">Example:</span>{' '}
            {example(value).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>))}
          </p>
        )}
      </div>
      <select
        id={selectId}
        className="hd-rule__select"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {/* A saved value that's no longer a choice still shows */}
        {!options.some(([v]) => v === value) && <option value={value}>{value}</option>}
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
}

// The (i) beside a rule's name. Shows on hover, and stays open on a
// click (for people who click rather than hover) until they click
// elsewhere, click it again or press Escape. Escape here closes just
// the bubble, not the panel.
function InfoTip({ label, text }) {
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
    <span ref={ref} className={`hd-info ${pinned ? 'hd-info--open' : ''}`} onKeyDown={onKeyDown}>
      <button
        type="button"
        className="hd-info__btn"
        aria-label={`What is “${label}”?`}
        aria-describedby={tipId}
        onClick={() => setPinned((p) => !p)}
      >
        <Info size={15} aria-hidden="true" />
      </button>
      <span className="tip hd-info__tip" role="tooltip" id={tipId}>
        {text}
      </span>
    </span>
  );
}