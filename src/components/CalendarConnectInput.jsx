import { useEffect } from 'react';
import { Check } from 'lucide-react';
import { isCalendarConnected } from '../data/calendarStore';
import { ConnectPoints, ConnectProblem, GoogleButton, useCalendar, useConnectGoogle } from './CalendarConnect';

// ------------------------------------------------------------
// Setup's "Connect your Google Calendar" step, just before working
// hours, where the reason is obvious: we need to know when they're
// busy before we offer their time to anyone.
//
// There's no skip, and no Next until they're connected (the question
// sets hideNextUntilComplete): the Google button is the way on.
// The flow hears calendarStatus: 'connected' or 'none'.
//
// Kept to the few things a new creator needs:
//   before   two short points, the Google button, "Any Google account works."
//            Coming back without a full yes says why, and offers it again.
//   after    which account, and what we'll check. Which calendars to
//            check and where bookings go have sensible defaults, so
//            they're left to Manage in the 1:1 calls tab.
// ------------------------------------------------------------
export default function CalendarConnectInput({ onChange }) {
  const connection = useCalendar();
  const connected = isCalendarConnected(connection);
  const { phase, missing, connect, dialog } = useConnectGoogle();
  const waiting = phase === 'waiting';

  useEffect(() => {
    onChange(connected ? 'connected' : 'none', 'calendarStatus');
  }, [connected]); // eslint-disable-line react-hooks/exhaustive-deps

  if (connected) {
    return (
      <div className="qinput cal-step">
        <div className="cal-connected">
          <span className="cal-connected__tick" aria-hidden="true">
            <Check size={18} strokeWidth={3} />
          </span>
          <div className="cal-connected__text">
            <p className="cal-connected__title">Connected as {connection.email}</p>
            <p className="cal-connected__sub">{checkingLine(connection)}</p>
          </div>
          <button type="button" className="cal-link" onClick={() => connect()} disabled={waiting}>
            {waiting ? 'Waiting for Google…' : 'Use a different account'}
          </button>
        </div>
        <ConnectProblem phase={phase} missing={missing} still={connection.email} />
        {dialog}
      </div>
    );
  }

  const tried = phase === 'cancelled' || phase === 'partial' || phase === 'error';

  return (
    <div className="qinput cal-step">
      <ConnectPoints />
      <ConnectProblem phase={phase} missing={missing} />
      <div className="cal-step__go">
        <GoogleButton large waiting={waiting} onClick={() => connect()}>
          {tried ? 'Try again' : 'Connect Google Calendar'}
        </GoogleButton>
        <p className="cal-step__fine">Any Google account works.</p>
      </div>
      {dialog}
    </div>
  );
}

// "We'll check your main calendar…", or how many, if they'd picked more
// before (reconnecting keeps their choices)
function checkingLine({ checkIds }) {
  const what =
    checkIds.length === 1 && checkIds[0] === 'primary'
      ? 'your main calendar'
      : checkIds.length === 1
        ? '1 calendar'
        : `${checkIds.length} calendars`;
  // Which calendars to check is under Manage in 1:1 calls; not worth a line here
  return `We’ll check ${what} for times you’re busy.`;
}