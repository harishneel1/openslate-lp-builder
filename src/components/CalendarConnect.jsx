import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import googleIcon from '../assets/google-g.svg';
import GoogleConsent from './GoogleConsent';
import { CALENDAR_CHANGED_EVENT, PERMISSIONS, connectCalendar, loadCalendar } from '../data/calendarStore';
import './CalendarConnect.css';

// ------------------------------------------------------------
// The pieces of connecting Google Calendar, shared by the setup step
// (CalendarConnectInput.jsx) and the offerings home (CalendarPanel.jsx,
// CalendarDrawer.jsx).
// ------------------------------------------------------------

// The saved connection, kept up to date when it changes anywhere
// (this screen, another one, or another tab)
export function useCalendar() {
  const [connection, setConnection] = useState(loadCalendar);
  useEffect(() => {
    const refresh = () => setConnection(loadCalendar());
    window.addEventListener(CALENDAR_CHANGED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(CALENDAR_CHANGED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);
  return connection;
}

// Runs one trip to Google (the stand-in for now).
//   phase: 'idle' | 'waiting' (Google's screen is open) | 'cancelled' | 'partial' | 'error'
//   missing: the permissions Google came back without (phase 'partial')
//   connect(email?): opens Google; an email skips choosing the account (reconnecting)
//   dialog: Google's screen while it's open; render it anywhere on the page
// Only a yes to everything is saved. Anything less leaves the connection
// as it was, so switching accounts and failing keeps the old one.
export function useConnectGoogle({ onConnected } = {}) {
  const [phase, setPhase] = useState('idle');
  const [missing, setMissing] = useState([]);
  const [asking, setAsking] = useState(null); // { email } while Google's screen is open

  const connect = (email = null) => {
    setPhase('waiting');
    setAsking({ email });
  };

  const handleResult = ({ outcome, email, granted }) => {
    setAsking(null);
    if (outcome === 'cancelled' || outcome === 'error') return setPhase(outcome);

    const lacking = PERMISSIONS.filter((p) => !granted.includes(p.id));
    if (lacking.length) {
      setMissing(lacking);
      return setPhase('partial');
    }

    const connection = connectCalendar(email);
    if (!connection) return setPhase('error');
    setPhase('idle');
    onConnected?.(connection);
  };

  const dialog = asking ? <GoogleConsent email={asking.email} onResult={handleResult} /> : null;
  return { phase, missing, connect, dialog };
}

// Google's own style of button: white, the G, dark text
// large: the main action on its screen (the setup step)
export function GoogleButton({ waiting = false, large = false, onClick, children }) {
  return (
    <button
      type="button"
      className={`cal-google ${large ? 'cal-google--large' : ''}`}
      onClick={onClick}
      disabled={waiting}
      aria-busy={waiting}
    >
      <img src={googleIcon} alt="" className="cal-google__g" />
      {waiting ? 'Waiting for Google…' : children}
    </button>
  );
}

// What else connecting does, under the step's subtitle (which gives the
// main reason: we check when they're busy). Two short lines, so the
// Google button stays the thing to look at.
const POINTS = ['Each booking goes into your calendar with its own Meet link', 'We never touch your other events'];

export function ConnectPoints() {
  return (
    <ul className="cal-points">
      {POINTS.map((point) => (
        <li key={point} className="cal-point">
          <Check size={16} strokeWidth={2.5} className="cal-point__tick" aria-hidden="true" />
          {point}
        </li>
      ))}
    </ul>
  );
}

// What went wrong on the last trip to Google, and what to do.
// still: the account they're still connected to (switching accounts), if any
export function ConnectProblem({ phase, missing = [], still = null }) {
  const kept = still ? ` You’re still connected as ${still}.` : '';

  if (phase === 'cancelled') {
    return (
      <p className="cal-note" role="status">
        {still
          ? `Nothing changed.${kept}`
          : 'You stopped before connecting. A calendar is needed so no one can book a time you’re already busy.'}
      </p>
    );
  }

  if (phase === 'partial') {
    return (
      <div className="cal-note cal-note--warn" role="alert">
        <p>Google didn’t give us everything we need.{kept} When Google asks, keep {missing.length > 1 ? 'these' : 'this'} ticked:</p>
        <ul className="cal-note__list">
          {missing.map((p) => (
            <li key={p.id}>
              <strong>{p.label}</strong>: {p.why}.
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <p className="cal-note cal-note--warn" role="alert">
        Couldn’t connect to Google. Check your internet connection and try again.{kept}
      </p>
    );
  }

  return null;
}

// The calendars we check for busy times, as a plain list of ticks.
// At least one stays ticked: the last one can't be unticked.
// The main calendar shows as "Main calendar" rather than its address,
// which is already shown above it.
// onChange({ checkIds })
export function CalendarChoices({ connection, onChange }) {
  const { calendars, checkIds } = connection;

  const toggle = (id) => {
    const next = checkIds.includes(id) ? checkIds.filter((x) => x !== id) : [...checkIds, id];
    if (next.length) onChange({ checkIds: next });
  };

  return (
    <fieldset className="cal-choice">
      <legend className="cal-choice__title">Calendars we check</legend>
      <p className="cal-choice__sub">We won’t offer times that clash with events in these.</p>
      <ul className="cal-list">
        {calendars.map((c) => {
          const on = checkIds.includes(c.id);
          const last = on && checkIds.length === 1;
          return (
            <li key={c.id}>
              <label
                className={`cal-check ${last ? 'cal-check--locked' : ''}`}
                data-tip={last ? 'At least one calendar has to be checked' : undefined}
                data-tip-align="start"
              >
                <input type="checkbox" checked={on} disabled={last} onChange={() => toggle(c.id)} />
                <span className="cal-check__name">{c.primary ? 'Main calendar' : c.name}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}