import { useEffect, useMemo, useState } from 'react';
import { Copy, Plus, X } from 'lucide-react';
import { loadSchedule, saveSchedule } from '../data/availabilityStore';
import { zoneOptions } from '../data/timeZones';
import {
  QUARTERS,
  WEEK,
  dayProblems,
  rangesText,
  timeLabel,
  toMinutes,
  toTime,
} from '../utils/weeklyHours';
import './WeeklyHoursInput.css';

const strip = ({ saved, ...rest }) => rest; // eslint-disable-line no-unused-vars

// One line per day: its hours as text, with Edit to change them in place.
// Starts from the hours already saved (or the defaults), so most people can
// just carry on. Every valid change is saved to the same place the
// Availability page and booking page use. Tells the flow whether it's
// ready through hoursStatus: 'ok', 'none' (no open days) or 'fix'.
export default function WeeklyHoursInput({ onChange }) {
  const [schedule, setSchedule] = useState(() => strip(loadSchedule()));
  const [open, setOpen] = useState(null); // the day being edited

  const problems = useMemo(
    () => Object.fromEntries(WEEK.map((d) => [d.id, dayProblems(schedule.weekly[d.id] ?? [])])),
    [schedule.weekly],
  );
  const hasProblems = Object.values(problems).some((p) => Object.keys(p).length > 0);
  const anyOpen = WEEK.some(({ id }) => (schedule.weekly[id] ?? []).length > 0);
  const zones = useMemo(() => zoneOptions(schedule.timeZone), [schedule.timeZone]);

  // Save whenever it's valid, and tell the flow whether Next can unlock
  useEffect(() => {
    if (!hasProblems && anyOpen) saveSchedule(schedule);
    onChange(hasProblems ? 'fix' : anyOpen ? 'ok' : 'none', 'hoursStatus');
  }, [schedule]); // eslint-disable-line react-hooks/exhaustive-deps

  const change = (fn) => setSchedule((s) => fn(structuredClone(s)));

  const toggleDay = (day, on) => {
    change((s) => {
      s.weekly[day] = on ? [['10:00', '18:00']] : [];
      return s;
    });
    setOpen(on ? day : null);
  };

  const setRange = (day, i, part, value) =>
    change((s) => {
      s.weekly[day][i][part] = value;
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

  const removeRange = (day, i) =>
    change((s) => {
      s.weekly[day].splice(i, 1);
      return s;
    });

  // Same hours on every other day that's switched on
  const copyToOthers = (day) =>
    change((s) => {
      WEEK.forEach(({ id }) => {
        if (id !== day && s.weekly[id]?.length) s.weekly[id] = structuredClone(s.weekly[day]);
      });
      return s;
    });

  return (
    <div className="qinput wh">
      <label className="wh__zone">
        <span className="qinput__label">Your time zone</span>
        <select
          className="wh__select"
          value={schedule.timeZone}
          onChange={(e) => change((s) => ({ ...s, timeZone: e.target.value }))}
        >
          {zones.map((z) => (
            <option key={z.id} value={z.id}>{z.label}</option>
          ))}
        </select>
      </label>

      <ul className="wh__days">
        {WEEK.map(({ id, label }) => {
          const ranges = schedule.weekly[id] ?? [];
          const on = ranges.length > 0;
          const editing = open === id && on;
          const dayErrors = problems[id];
          const broken = Object.keys(dayErrors).length > 0;

          return (
            <li key={id} className={`wh__day ${editing ? 'wh__day--open' : ''}`}>
              <div className="wh__row">
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={`${label}: ${on ? 'open' : 'closed'}`}
                  className="wh__switch"
                  onClick={() => toggleDay(id, !on)}
                >
                  <span className="wh__knob" />
                </button>
                <span className="wh__name">{label}</span>
                <span className={`wh__hours ${on ? '' : 'wh__hours--off'} ${broken ? 'wh__hours--broken' : ''}`}>
                  {on ? (broken ? 'Check these hours' : rangesText(ranges)) : 'Unavailable'}
                </span>
                {on && (
                  <button
                    type="button"
                    className="wh__edit"
                    aria-expanded={editing}
                    onClick={() => setOpen(editing ? null : id)}
                  >
                    {editing ? 'Done' : 'Edit'}
                  </button>
                )}
              </div>

              {editing && (
                <div className="wh__editor">
                  {ranges.map(([from, to], i) => (
                    <div key={i} className="wh__range-wrap">
                      <div className="wh__range">
                        <TimeSelect
                          label={`${label}, from`}
                          value={from}
                          max={1425}
                          onChange={(v) => setRange(id, i, 0, v)}
                        />
                        <span className="wh__to">to</span>
                        <TimeSelect
                          label={`${label}, until`}
                          value={to}
                          min={15}
                          onChange={(v) => setRange(id, i, 1, v)}
                        />
                        {ranges.length > 1 && (
                          <button
                            type="button"
                            className="wh__remove"
                            aria-label={`Remove ${timeLabel(toMinutes(from))} to ${timeLabel(toMinutes(to))}`}
                            onClick={() => removeRange(id, i)}
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>
                      {dayErrors[i] && <p className="qinput__error">{dayErrors[i]}</p>}
                    </div>
                  ))}
                  <div className="wh__tools">
                    <button type="button" className="wh__tool" onClick={() => addRange(id)}>
                      <Plus size={15} /> Add hours
                    </button>
                    <button
                      type="button"
                      className="wh__tool"
                      onClick={() => copyToOthers(id)}
                      disabled={broken}
                    >
                      <Copy size={15} /> Copy to other open days
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {!anyOpen && <p className="qinput__error">Switch on at least one day so people can book you.</p>}
      <p className="wh__note">You can change these anytime from Availability.</p>
    </div>
  );
}

function TimeSelect({ value, onChange, label, min = 0, max = 1440 }) {
  return (
    <select
      className="wh__select wh__select--time"
      aria-label={label}
      value={toMinutes(value)}
      onChange={(e) => onChange(toTime(Number(e.target.value)))}
    >
      {QUARTERS.filter((q) => q >= min && q <= max).map((q) => (
        <option key={q} value={q}>{timeLabel(q)}</option>
      ))}
    </select>
  );
}