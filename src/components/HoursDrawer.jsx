import { useId, useState } from 'react';
import { CalendarOff, ExternalLink } from 'lucide-react';
import Drawer from './Drawer';
import { WeeklyHours } from './WeeklyHoursInput';
import { BOOKING_RULES } from '../data/bookingRules';
import { sameHours } from '../data/availabilityStore';
import { hoursStatus } from '../utils/weeklyHours';
import '../screens/EditFrame.css'; // the save bar's buttons, reused in the footer
import './HoursDrawer.css';

// Days off are set once, for every call, on their own screen
const DAYS_OFF_HREF = '?mock=availability';

// ------------------------------------------------------------
// One call's hours, edited in a panel from the right, so the edit
// screen stays one short column of sections.
//
//   Weekly hours    the same sheet as setup (WeeklyHoursInput.jsx)
//   Booking rules   break between calls, notice, how far ahead, start times
//   Days off        a pointer: they're shared by every call
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

      <p className="hd__days-off">
        <CalendarOff size={16} aria-hidden="true" />
        <span>
          Days off apply to all your calls.{' '}
          <a href={DAYS_OFF_HREF} target="_blank" rel="noopener">
            Set days off
            <ExternalLink size={13} aria-hidden="true" />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
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
        {BOOKING_RULES.map(({ key, label, hint, options }) => (
          <label key={key} className="hd-rule">
            <span className="hd-rule__text">
              <span className="hd-rule__label">{label}</span>
              <span className="hd-rule__hint">{hint}</span>
            </span>
            <select
              className="hd-rule__select"
              value={value[key]}
              onChange={(e) => onChange({ ...value, [key]: Number(e.target.value) })}
            >
              {/* A saved value that's no longer a choice still shows */}
              {!options.some(([v]) => v === value[key]) && <option value={value[key]}>{value[key]}</option>}
              {options.map(([v, text]) => (
                <option key={v} value={v}>
                  {text}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </section>
  );
}