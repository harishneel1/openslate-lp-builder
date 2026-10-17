import { useEffect, useMemo, useState } from 'react';
import { CalendarOff, Check, ExternalLink, Plus, X } from 'lucide-react';
import AppLayout from '../components/AppLayout';
import { DEFAULT_SCHEDULE, loadSchedule, saveSchedule } from '../data/availabilityStore';
import { zoneOptions } from '../data/timeZones';
import { todayIn, addDays } from '../utils/slots';
import './AvailabilityPage.css';

// ------------------------------------------------------------
// The creator's Availability screen (?mock=availability), inside
// the product's own shell under Services. One schedule for all
// their 1:1 calls: weekly hours, days off, and booking rules.
// Saving updates the booking page straight away (same browser).
// ------------------------------------------------------------

const DAYS = [
  { id: 'mon', label: 'Monday' },
  { id: 'tue', label: 'Tuesday' },
  { id: 'wed', label: 'Wednesday' },
  { id: 'thu', label: 'Thursday' },
  { id: 'fri', label: 'Friday' },
  { id: 'sat', label: 'Saturday' },
  { id: 'sun', label: 'Sunday' },
];

// '16:30' ⇄ 990
const toMinutes = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const toTime = (mins) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

// 990 → '4:30 pm', 1440 → 'Midnight'
function timeLabel(mins) {
  if (mins === 1440) return 'Midnight';
  const h = Math.floor(mins / 60);
  return `${h % 12 || 12}:${String(mins % 60).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

// Every quarter hour, for the start and end dropdowns
const QUARTERS = Array.from({ length: 97 }, (_, i) => i * 15);

const RULES = [
  {
    key: 'bufferMins',
    label: 'Break between calls',
    hint: 'Kept free before and after every booking.',
    options: [0, 5, 10, 15, 30, 45, 60].map((v) => [v, v === 0 ? 'No break' : `${v} minutes`]),
  },
  {
    key: 'minNoticeMins',
    label: 'Minimum notice',
    hint: 'How soon before a call people can still book it.',
    options: [[60, '1 hour'], [120, '2 hours'], [240, '4 hours'], [720, '12 hours'], [1440, '1 day'], [2880, '2 days']],
  },
  {
    key: 'bookAheadDays',
    label: 'How far ahead people can book',
    hint: 'Times further out than this stay hidden.',
    options: [[7, '1 week'], [14, '2 weeks'], [30, '30 days'], [60, '60 days'], [90, '90 days']],
  },
  {
    key: 'startEveryMins',
    label: 'Duration of each call',
    hint: 'Every 30 minutes gives 10:00, 10:30, 11:00 and so on.',
    options: [[15, '15 minutes'], [30, '30 minutes'], [60, 'Hour, on the hour']],
  },
];

// Problems with one day's hours: { [index]: message }
function dayProblems(ranges) {
  const found = {};
  ranges.forEach(([from, to], i) => {
    if (toMinutes(to) <= toMinutes(from)) found[i] = 'Ends before it starts';
  });
  ranges.forEach(([from, to], i) => {
    if (found[i]) return;
    const clash = ranges.findIndex(
      ([f, t], j) => j !== i && !found[j] && toMinutes(from) < toMinutes(t) && toMinutes(to) > toMinutes(f),
    );
    if (clash !== -1) found[i] = `Overlaps with ${timeLabel(toMinutes(ranges[clash][0]))} to ${timeLabel(toMinutes(ranges[clash][1]))}`;
  });
  return found;
}

// '2026-10-26' → 'Monday 26 October'
function longDate(date) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });
}

const strip = ({ saved, ...rest }) => rest; // eslint-disable-line no-unused-vars

function Switch({ checked, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className="av-switch" onClick={() => onChange(!checked)}>
      <span className="av-switch__knob" />
    </button>
  );
}

function TimeSelect({ value, onChange, label, min = 0, max = 1440 }) {
  return (
    <select className="av-select av-select--time" aria-label={label} value={toMinutes(value)} onChange={(e) => onChange(toTime(Number(e.target.value)))}>
      {QUARTERS.filter((q) => q >= min && q <= max).map((q) => (
        <option key={q} value={q}>
          {timeLabel(q)}
        </option>
      ))}
    </select>
  );
}

export default function AvailabilityPage() {
  const [saved, setSaved] = useState(() => strip(loadSchedule()));
  const [draft, setDraft] = useState(saved);
  const [status, setStatus] = useState(null); // 'saved' | 'failed' | null
  const [newDayOff, setNewDayOff] = useState('');
  const [dayOffError, setDayOffError] = useState(null);

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const problems = useMemo(
    () => Object.fromEntries(DAYS.map((d) => [d.id, dayProblems(draft.weekly[d.id] ?? [])])),
    [draft.weekly],
  );
  const hasProblems = Object.values(problems).some((p) => Object.keys(p).length > 0);
  const zones = useMemo(() => zoneOptions(draft.timeZone), [draft.timeZone]);
  const today = todayIn(draft.timeZone);

  useEffect(() => {
    document.title = 'Availability';
  }, []);

  // Leaving with unsaved changes: the browser asks first
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const change = (fn) => {
    setDraft((d) => fn(structuredClone(d)));
    setStatus(null);
  };

  // ---------- Weekly hours ----------
  const toggleDay = (day, on) =>
    change((d) => {
      d.weekly[day] = on ? [['09:00', '17:00']] : [];
      return d;
    });

  const setRange = (day, i, part, value) =>
    change((d) => {
      d.weekly[day][i][part] = value;
      return d;
    });

  // A new block starts an hour after the last one ends, if there's room
  const addRange = (day) =>
    change((d) => {
      const ranges = d.weekly[day];
      const lastEnd = ranges.length ? Math.max(...ranges.map(([, t]) => toMinutes(t))) : 480;
      const start = Math.min(lastEnd + 60, 1380);
      d.weekly[day] = [...ranges, [toTime(start), toTime(Math.min(start + 120, 1440))]];
      return d;
    });

  const removeRange = (day, i) =>
    change((d) => {
      d.weekly[day].splice(i, 1);
      return d;
    });

  // Same hours on every day that's switched on
  const copyToAll = (day) =>
    change((d) => {
      DAYS.forEach(({ id }) => {
        if (id !== day && d.weekly[id]?.length) d.weekly[id] = structuredClone(d.weekly[day]);
      });
      return d;
    });

  // ---------- Days off ----------
  const daysOff = Object.keys(draft.overrides ?? {})
    .filter((date) => date >= today && (draft.overrides[date] ?? []).length === 0)
    .sort();

  const addDayOff = () => {
    if (!newDayOff) return setDayOffError('Choose a date');
    if (newDayOff < today) return setDayOffError('Choose today or a later date');
    if (daysOff.includes(newDayOff)) return setDayOffError(`${longDate(newDayOff)} is already a day off`);
    change((d) => {
      d.overrides = { ...(d.overrides ?? {}), [newDayOff]: [] };
      return d;
    });
    setNewDayOff('');
    setDayOffError(null);
  };

  const removeDayOff = (date) =>
    change((d) => {
      delete d.overrides[date];
      return d;
    });

  // ---------- Save ----------
  const save = () => {
    if (hasProblems) return;
    // Past days off no longer matter: drop them as we save
    const clean = { ...draft, overrides: Object.fromEntries(Object.entries(draft.overrides ?? {}).filter(([date]) => date >= today)) };
    if (saveSchedule(clean)) {
      setSaved(clean);
      setDraft(clean);
      setStatus('saved');
    } else {
      setStatus('failed');
    }
  };

  const discard = () => {
    setDraft(saved);
    setStatus(null);
  };

  const noHours = DAYS.every(({ id }) => !(draft.weekly[id] ?? []).length);

  return (
    <AppLayout activeNav="services" onNavigate={(id) => id !== 'services' && window.location.assign(window.location.pathname)}>
      <div className="av">
        <header className="av__head">
          <div>
            <h1 className="av__title">Availability</h1>
            <p className="av__subtitle">When people can book your 1:1 calls. These hours apply to all of them.</p>
          </div>
          <a className="av__preview" href="?mock=book&service=call-coaching" target="_blank" rel="noreferrer">
            Preview booking page <ExternalLink size={15} aria-hidden="true" />
          </a>
        </header>

        {/* ================= Weekly hours ================= */}
        <section className="av-card" aria-labelledby="av-weekly">
          <div className="av-card__head">
            <h2 id="av-weekly" className="av-card__title">Weekly hours</h2>
            <label className="av-zone">
              <span>Your time zone</span>
              <select
                className="av-select"
                value={draft.timeZone}
                onChange={(e) => change((d) => ({ ...d, timeZone: e.target.value }))}
              >
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {noHours && (
            <p className="av-warning" role="status">
              No hours are switched on, so nobody can book a call. Switch on at least one day.
            </p>
          )}

          <ul className="av-days">
            {DAYS.map(({ id, label }) => {
              const ranges = draft.weekly[id] ?? [];
              const on = ranges.length > 0;
              return (
                <li key={id} className={on ? 'av-day' : 'av-day av-day--off'}>
                  <div className="av-day__name">
                    <Switch checked={on} onChange={(v) => toggleDay(id, v)} label={`Take calls on ${label}`} />
                    <span>{label}</span>
                  </div>

                  <div className="av-day__hours">
                    {on ? (
                      <>
                        {ranges.map(([from, to], i) => (
                          <div key={i} className="av-range">
                            <div className="av-range__row">
                              <TimeSelect value={from} max={1425} label={`${label}, block ${i + 1}, from`} onChange={(v) => setRange(id, i, 0, v)} />
                              <span className="av-range__to">to</span>
                              <TimeSelect value={to} min={15} label={`${label}, block ${i + 1}, to`} onChange={(v) => setRange(id, i, 1, v)} />
                              <button
                                type="button"
                                className="av-icon-btn"
                                aria-label={`Remove ${timeLabel(toMinutes(from))} to ${timeLabel(toMinutes(to))} on ${label}`}
                                onClick={() => (ranges.length === 1 ? toggleDay(id, false) : removeRange(id, i))}
                              >
                                <X size={16} aria-hidden="true" />
                              </button>
                            </div>
                            {problems[id][i] && <p className="av-error">{problems[id][i]}</p>}
                          </div>
                        ))}
                        <div className="av-day__actions">
                          <button type="button" className="av-link" onClick={() => addRange(id)}>
                            <Plus size={15} aria-hidden="true" /> Add hours
                          </button>
                          <button type="button" className="av-link av-link--quiet" onClick={() => copyToAll(id)}>
                            Copy to other open days
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className="av-day__closed">Not taking calls</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* ================= Days off ================= */}
        <section className="av-card" aria-labelledby="av-off">
          <div className="av-card__head av-card__head--stack">
            <h2 id="av-off" className="av-card__title">Days off</h2>
            <p className="av-card__hint">Holidays and other days you're away. No one can book on these.</p>
          </div>

          {daysOff.length > 0 && (
            <ul className="av-offs">
              {daysOff.map((date) => (
                <li key={date} className="av-off">
                  <CalendarOff size={16} aria-hidden="true" />
                  <span>{longDate(date)}</span>
                  <button type="button" className="av-icon-btn" aria-label={`Remove ${longDate(date)}`} onClick={() => removeDayOff(date)}>
                    <X size={16} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="av-add-off">
            <input
              type="date"
              className="av-select av-date"
              aria-label="Day off"
              min={today}
              max={addDays(today, 365)}
              value={newDayOff}
              onChange={(e) => {
                setNewDayOff(e.target.value);
                setDayOffError(null);
              }}
            />
            <button type="button" className="av-secondary" onClick={addDayOff}>
              Add day off
            </button>
          </div>
          {dayOffError && <p className="av-error">{dayOffError}</p>}
        </section>

        {/* ================= Booking rules ================= */}
        <section className="av-card" aria-labelledby="av-rules">
          <div className="av-card__head av-card__head--stack">
            <h2 id="av-rules" className="av-card__title">Booking rules</h2>
          </div>
          <div className="av-rules">
            {RULES.map(({ key, label, hint, options }) => (
              <label key={key} className="av-rule">
                <span className="av-rule__text">
                  <span className="av-rule__label">{label}</span>
                  <span className="av-rule__hint">{hint}</span>
                </span>
                <select
                  className="av-select"
                  value={draft[key]}
                  onChange={(e) => change((d) => ({ ...d, [key]: Number(e.target.value) }))}
                >
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

        <button
          type="button"
          className="av-reset"
          onClick={() => change(() => structuredClone({ ...DEFAULT_SCHEDULE, timeZone: draft.timeZone }))}
        >
          Reset to the starting schedule
        </button>

        {/* ================= Save bar ================= */}
        <div className="av-bar" aria-live="polite">
          <p className="av-bar__status">
            {status === 'saved' && !dirty && (
              <>
                <Check size={16} aria-hidden="true" /> Saved. The booking page uses these hours now.
              </>
            )}
            {status === 'failed' && <span className="av-bar__failed">Couldn't save. Check your browser allows storage and try again.</span>}
            {dirty && hasProblems && <span className="av-bar__failed">Fix the hours marked in red to save.</span>}
            {dirty && !hasProblems && 'You have unsaved changes.'}
          </p>
          <div className="av-bar__actions">
            {dirty && (
              <button type="button" className="av-secondary" onClick={discard}>
                Discard
              </button>
            )}
            <button type="button" className="av-primary" onClick={save} disabled={!dirty || hasProblems}>
              Save changes
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}