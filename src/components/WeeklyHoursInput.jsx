import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Copy, Globe, Plus, Repeat, X } from 'lucide-react';
import { loadCallHours, saveCallHours, weekdayHours } from '../data/availabilityStore';
import { MY_CALL_ID } from '../data/myProfile';
import { zoneOptions } from '../data/timeZones';
import { CALL_DEFAULTS } from '../data/callDetails';
import { durationLabel } from '../data/serviceKinds';
import { QUARTERS, WEEK, dayProblems, hoursStatus, timeLabel, toMinutes, toTime } from '../utils/weeklyHours';
import './WeeklyHoursInput.css';

const strip = ({ saved, ...rest }) => rest; // eslint-disable-line no-unused-vars

// ------------------------------------------------------------
// Setup's weekly hours step, for their first call.
//
// Starts from the hours already saved for it (or the defaults), so
// most people can just carry on. Every valid change is saved as that
// call's hours, where the booking page reads them. Tells the flow
// whether it's ready through hoursStatus: 'ok', 'none' (no open days)
// or 'fix'.
// ------------------------------------------------------------
export default function WeeklyHoursInput({ answers = {}, onChange }) {
  const [hours, setHours] = useState(() => strip(loadCallHours(MY_CALL_ID)));
  const callLength = durationLabel(Number(answers.callDuration ?? CALL_DEFAULTS.callDuration));

  // Save whenever it's valid, and tell the flow whether Next can unlock
  useEffect(() => {
    const status = hoursStatus(hours.weekly);
    if (status === 'ok') saveCallHours(MY_CALL_ID, hours);
    onChange(status, 'hoursStatus');
  }, [hours]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <WeeklyHours value={hours} onChange={setHours} callLength={callLength} className="qinput">
      <p className="wh__note">You can change these anytime when you edit this call.</p>
    </WeeklyHours>
  );
}

// ------------------------------------------------------------
// Weekly hours: when they're free, not the times people book.
// Used by setup (above) and the hours panel on the call's edit screen.
// It only edits: whoever uses it decides when to save.
//
// People kept reading each day's hours as slots they were making one
// by one. So, like Calendly, every day is laid out as an open sheet:
// its hours always showing as from–to fields, edited in place, with no
// Edit/Done and nothing that looks like a bookable button. A line at
// the top says what happens to the hours: people pick a time inside
// them for this call.
//
//   open day     Mon  [10:00 am] – [1:00 pm]  ✕  ＋  ⧉
//                     [4:00 pm]  – [8:00 pm]  ✕
//   closed day   Sun  Unavailable  ＋
//
// ✕ on a day's last hours closes the day (no separate switch).
// ⧉ copies a day's hours to the days they tick.
//
// value: the call's hours ({ timeZone, weekly, ... }); anything else on it is kept
// onChange(hours): the hours with a change made
// callLength: "30 min", for the line at the top
// children: shown under the sheet
// ------------------------------------------------------------
export function WeeklyHours({ value, onChange, callLength, className = '', children }) {
  const [copying, setCopying] = useState(null); // the day whose copy menu is open
  const titleId = useId();
  const zoneId = useId();
  const weekly = value.weekly ?? {};

  const problems = useMemo(
    () => Object.fromEntries(WEEK.map((d) => [d.id, dayProblems(weekly[d.id] ?? [])])),
    [weekly],
  );
  const anyOpen = WEEK.some(({ id }) => (weekly[id] ?? []).length > 0);
  const zones = useMemo(() => zoneOptions(value.timeZone), [value.timeZone]);

  const change = (fn) => onChange(fn(structuredClone(value)));

  const openDay = (day) =>
    change((s) => {
      s.weekly[day] = structuredClone(weekdayHours); // same as the default weekdays
      return s;
    });

  const setRange = (day, i, part, v) =>
    change((s) => {
      s.weekly[day][i][part] = v;
      return s;
    });

  // A new block starts an hour after the last one ends, if there's room
  const addRange = (day) =>
    change((s) => {
      const ranges = s.weekly[day];
      const lastEnd = ranges.length ? Math.max(...ranges.map(([, t]) => toMinutes(t))) : 480;
      const start = Math.min(lastEnd + 60, 1380);
      s.weekly[day] = [...ranges, [toTime(start), toTime(Math.min(start + 120, 1440))]];
      return s;
    });

  // Removing a day's last hours makes it unavailable
  const removeRange = (day, i) =>
    change((s) => {
      s.weekly[day].splice(i, 1);
      return s;
    });

  // This day's hours on each ticked day, open or not
  const copyTo = (day, targets) =>
    change((s) => {
      targets.forEach((id) => {
        s.weekly[id] = structuredClone(s.weekly[day]);
      });
      return s;
    });

  return (
    <div className={`wh ${className}`}>
      <section className="wh__card" aria-labelledby={titleId}>
        <header className="wh__head">
          <h2 className="wh__title" id={titleId}>
            <Repeat size={18} aria-hidden="true" />
            Weekly hours
          </h2>
          <p className="wh__sub">
            The hours you’re usually free, every week. We’ll split them into slots for your{' '}
            <strong>{callLength}</strong> call.
          </p>
        </header>

        <ul className="wh__days">
          {WEEK.map(({ id, label, short }) => {
            const ranges = weekly[id] ?? [];
            const on = ranges.length > 0;
            const dayErrors = problems[id];
            const broken = Object.keys(dayErrors).length > 0;

            return (
              <li key={id} className={`wh__day ${on ? '' : 'wh__day--off'}`} aria-label={label}>
                <span className="wh__badge" aria-hidden="true">
                  {short}
                </span>

                {on ? (
                  <div className="wh__ranges">
                    {ranges.map(([from, to], i) => (
                      <div key={i} className="wh__range-wrap">
                        <div className="wh__range">
                          <TimeSelect
                            label={`${label}, from`}
                            value={from}
                            max={1425}
                            invalid={Boolean(dayErrors[i])}
                            onChange={(v) => setRange(id, i, 0, v)}
                          />
                          <span className="wh__dash" aria-hidden="true">
                            –
                          </span>
                          <TimeSelect
                            label={`${label}, until`}
                            value={to}
                            min={15}
                            invalid={Boolean(dayErrors[i])}
                            onChange={(v) => setRange(id, i, 1, v)}
                          />

                          <div className="wh__actions">
                            <IconButton
                              tip={ranges.length > 1 ? 'Remove these hours' : `Make ${label} unavailable`}
                              label={`Remove ${timeLabel(toMinutes(from))} to ${timeLabel(toMinutes(to))} on ${label}`}
                              onClick={() => removeRange(id, i)}
                            >
                              <X size={17} />
                            </IconButton>

                            {/* Add and copy act on the whole day, so they sit on its first line only */}
                            {i === 0 && (
                              <>
                                <IconButton
                                  tip="Add more hours"
                                  label={`Add more hours on ${label}`}
                                  onClick={() => addRange(id)}
                                >
                                  <Plus size={17} />
                                </IconButton>
                                <div className="wh__copy">
                                  <IconButton
                                    tip={broken ? 'Fix these hours to copy them' : 'Copy to other days'}
                                    label={`Copy ${label}’s hours to other days`}
                                    expanded={copying === id}
                                    disabled={broken}
                                    onClick={() => setCopying(copying === id ? null : id)}
                                  >
                                    <Copy size={16} />
                                  </IconButton>
                                  {copying === id && (
                                    <CopyMenu
                                      from={id}
                                      onApply={(targets) => {
                                        copyTo(id, targets);
                                        setCopying(null);
                                      }}
                                      onClose={() => setCopying(null)}
                                    />
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                        {dayErrors[i] && <p className="qinput__error wh__error">{dayErrors[i]}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="wh__closed">
                    <span className="wh__unavailable">Unavailable</span>
                    <IconButton tip="Add hours" label={`Add hours on ${label}`} onClick={() => openDay(id)}>
                      <Plus size={17} />
                    </IconButton>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <footer className="wh__foot">
          <Globe size={15} aria-hidden="true" />
          <label className="wh__zone-label" htmlFor="wh-zone">
            Times in
          </label>
          <select
            id={zoneId}
            className="wh__zone"
            value={value.timeZone}
            onChange={(e) => change((s) => ({ ...s, timeZone: e.target.value }))}
          >
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.label}
              </option>
            ))}
          </select>
        </footer>
      </section>

      {!anyOpen && (
        <p className="qinput__error" role="alert">
          Add hours to at least one day so people can book you.
        </p>
      )}
      {children}
    </div>
  );
}

// A start or end time. A native select, so phones open their own picker.
function TimeSelect({ value, onChange, label, invalid, min = 0, max = 1440 }) {
  return (
    <select
      className={`wh__time ${invalid ? 'wh__time--error' : ''}`}
      aria-label={label}
      aria-invalid={invalid || undefined}
      value={toMinutes(value)}
      onChange={(e) => onChange(toTime(Number(e.target.value)))}
    >
      {QUARTERS.filter((q) => q >= min && q <= max).map((q) => (
        <option key={q} value={q}>
          {timeLabel(q)}
        </option>
      ))}
    </select>
  );
}

// A round icon button with a hover hint (see tooltip.css)
function IconButton({ tip, label, onClick, disabled = false, expanded, children }) {
  return (
    <button
      type="button"
      className="wh__icon"
      data-tip={expanded ? undefined : tip} // no hint over its own open menu
      aria-label={label}
      aria-expanded={expanded}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

// "Copy times to…": every other day as a tick box, then Apply.
// Closes on Escape or a click outside, without copying.
function CopyMenu({ from, onApply, onClose }) {
  const [picked, setPicked] = useState([]);
  const ref = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  const titleId = useId();

  // Opens on the first day to tick. A click on its own copy button is left
  // to that button (it toggles the menu shut), so it doesn't close and reopen.
  useEffect(() => {
    const menu = ref.current;
    menu?.querySelector('input:not(:disabled)')?.focus();
    const away = (e) => {
      if (!menu?.parentElement?.contains(e.target)) close.current();
    };
    const esc = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault(); // only the menu closes, not a panel it sits in
      close.current();
      menu?.parentElement?.querySelector('button')?.focus(); // back to the copy button
    };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
    };
  }, []);

  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <div className="wh__menu" ref={ref} role="dialog" aria-labelledby={titleId}>
      <p className="wh__menu-title" id={titleId}>
        Copy times to…
      </p>
      <ul className="wh__menu-days">
        {WEEK.map(({ id, label }) => {
          const self = id === from;
          return (
            <li key={id}>
              <label className={`wh__menu-day ${self ? 'wh__menu-day--self' : ''}`}>
                {label}
                <input
                  type="checkbox"
                  checked={self || picked.includes(id)}
                  disabled={self}
                  onChange={() => toggle(id)}
                />
              </label>
            </li>
          );
        })}
      </ul>
      <button type="button" className="wh__menu-apply" disabled={picked.length === 0} onClick={() => onApply(picked)}>
        Apply
      </button>
    </div>
  );
}