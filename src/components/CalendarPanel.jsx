import { useEffect, useState } from 'react';
import { Settings2 } from 'lucide-react';
import googleIcon from '../assets/google-g.svg';
import CalendarDrawer from './CalendarDrawer';
import { ConnectProblem, GoogleButton, useCalendar, useConnectGoogle } from './CalendarConnect';

const STATUS_LABELS = { connected: 'Connected', lost: 'Disconnected', none: 'Not connected' };

// ------------------------------------------------------------
// "Your calendar" on the offerings home: the calendar belongs to the
// creator, not to one offering, so it sits with their profile and link.
//
//   connected      the account, what's checked, where bookings go, and
//                  Manage (CalendarDrawer.jsx) for changing any of it
//   lost           Google stopped letting us in: Reconnect, right here
//   not connected  disconnected, or finished setup before the calendar
//                  step existed: Connect, right here
// The last two say plainly that new bookings are stopped, since
// that's the thing to fix first.
// ------------------------------------------------------------
export default function CalendarPanel() {
  const connection = useCalendar();
  const status = connection?.status ?? 'none';
  const ok = status === 'connected';
  const [managing, setManaging] = useState(false);
  const { phase, missing, connect, dialog } = useConnectGoogle();
  const waiting = phase === 'waiting';

  // Disconnected while the drawer's open: there's nothing left to manage
  useEffect(() => {
    if (!ok) setManaging(false);
  }, [ok]);

  return (
    <section className={`cal-panel ${ok ? '' : 'cal-panel--alert'}`} aria-labelledby="cal-panel-title">
      <div className="cal-panel__row">
        <img src={googleIcon} alt="" className="cal-panel__g" />

        <div className="cal-panel__text">
          <div className="cal-panel__title-row">
            <h2 className="cal-panel__title" id="cal-panel-title">
              Your calendar
            </h2>
            <span className={`cal-status cal-status--${status}`}>{STATUS_LABELS[status]}</span>
          </div>
          {ok ? <Summary connection={connection} /> : <Problem status={status} email={connection?.email} />}
        </div>

        <div className="cal-panel__action">
          {ok ? (
            <button type="button" className="cal-secondary" onClick={() => setManaging(true)}>
              <Settings2 size={16} aria-hidden="true" /> Manage
            </button>
          ) : (
            <>
              <GoogleButton waiting={waiting} onClick={() => connect(status === 'lost' ? connection.email : null)}>
                {status === 'lost' ? 'Reconnect' : 'Connect Google Calendar'}
              </GoogleButton>
              {status === 'lost' && !waiting && (
                <button type="button" className="cal-link" onClick={() => connect()}>
                  Use a different account
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {!ok && <ConnectProblem phase={phase} missing={missing} />}
      {managing && ok && <CalendarDrawer connection={connection} onClose={() => setManaging(false)} />}
      {dialog}
    </section>
  );
}

// Connected: whose calendar, how many are checked, where bookings go
function Summary({ connection }) {
  const { email, calendars, checkIds, writeId } = connection;
  const checked = checkIds.length;
  const writeName = calendars.find((c) => c.id === writeId)?.name ?? email;
  return (
    <>
      <p className="cal-panel__email">{email}</p>
      <p className="cal-panel__sub">
        Checking {checked === 1 ? '1 calendar' : `${checked} calendars`} for times you’re busy. New bookings go into{' '}
        {writeId === 'primary' ? 'your main calendar' : writeName}.
      </p>
    </>
  );
}

// Lost or not connected: what's wrong, what it means for bookings
function Problem({ status, email }) {
  return status === 'lost' ? (
    <p className="cal-panel__sub">
      <strong>We can’t reach {email} any more, so your booking page isn’t taking new bookings.</strong> This usually
      happens after a Google password change, or if access was removed in your Google Account. Bookings you already
      have aren’t affected.
    </p>
  ) : (
    <p className="cal-panel__sub">
      <strong>No calendar connected, so your booking page isn’t taking new bookings.</strong> We check your calendar so
      no one books a time you’re already busy, and add each booking to it.
    </p>
  );
}