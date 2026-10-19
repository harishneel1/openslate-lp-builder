import { useEffect, useState } from 'react';
import { CalendarOff, Check, ExternalLink, X } from 'lucide-react';
import AppLayout from '../components/AppLayout';
import { loadDaysOff, saveDaysOff } from '../data/availabilityStore';
import { todayIn, addDays } from '../utils/slots';
import './AvailabilityPage.css';

// ------------------------------------------------------------
// The creator's days off (?mock=availability), inside the product's
// own shell under Services. Days off belong to the creator, so a day
// away blocks every call. Weekly hours and booking rules are set on
// each call, from its edit screen (HoursDrawer.jsx).
// Saving updates the booking page straight away (same browser).
// ------------------------------------------------------------

// '2026-10-26' → 'Monday 26 October'
function longDate(date) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });
}

// Today where they are (days off aren't tied to any one call's time zone)
const localZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export default function AvailabilityPage() {
  const [saved, setSaved] = useState(loadDaysOff);
  const [draft, setDraft] = useState(saved);
  const [status, setStatus] = useState(null); // 'saved' | 'failed' | null
  const [newDayOff, setNewDayOff] = useState('');
  const [dayOffError, setDayOffError] = useState(null);

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const today = todayIn(localZone());

  useEffect(() => {
    document.title = 'Days off';
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

  const daysOff = Object.keys(draft)
    .filter((date) => date >= today && (draft[date] ?? []).length === 0)
    .sort();

  const addDayOff = () => {
    if (!newDayOff) return setDayOffError('Choose a date');
    if (newDayOff < today) return setDayOffError('Choose today or a later date');
    if (daysOff.includes(newDayOff)) return setDayOffError(`${longDate(newDayOff)} is already a day off`);
    setDraft((d) => ({ ...d, [newDayOff]: [] }));
    setStatus(null);
    setNewDayOff('');
    setDayOffError(null);
  };

  const removeDayOff = (date) => {
    setDraft((d) => {
      const next = { ...d };
      delete next[date];
      return next;
    });
    setStatus(null);
  };

  // Past days off no longer matter: dropped as we save
  const save = () => {
    const clean = Object.fromEntries(Object.entries(draft).filter(([date]) => date >= today));
    if (saveDaysOff(clean)) {
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

  return (
    <AppLayout activeNav="services" onNavigate={(id) => id !== 'services' && window.location.assign(window.location.pathname)}>
      <div className="av">
        <header className="av__head">
          <div>
            <h1 className="av__title">Days off</h1>
            <p className="av__subtitle">
              Holidays and other days you’re away. No one can book any of your calls on these. Each call’s weekly hours
              are set when you edit the call.
            </p>
          </div>
          <a className="av__preview" href="?mock=book&service=call-coaching" target="_blank" rel="noreferrer">
            Preview booking page <ExternalLink size={15} aria-hidden="true" />
          </a>
        </header>

        <section className="av-card" aria-labelledby="av-off">
          <div className="av-card__head av-card__head--stack">
            <h2 id="av-off" className="av-card__title">Your days off</h2>
          </div>

          {daysOff.length > 0 ? (
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
          ) : (
            <p className="av-card__hint">No days off coming up. Add a date below.</p>
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

        {/* ================= Save bar ================= */}
        <div className="av-bar" aria-live="polite">
          <p className="av-bar__status">
            {status === 'saved' && !dirty && (
              <>
                <Check size={16} aria-hidden="true" /> Saved. The booking page uses these days off now.
              </>
            )}
            {status === 'failed' && <span className="av-bar__failed">Couldn’t save. Check your browser allows storage and try again.</span>}
            {dirty && 'You have unsaved changes.'}
          </p>
          <div className="av-bar__actions">
            {dirty && (
              <button type="button" className="av-secondary" onClick={discard}>
                Discard
              </button>
            )}
            <button type="button" className="av-primary" onClick={save} disabled={!dirty}>
              Save changes
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}