import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import googleIcon from '../assets/google-g.svg';
import CalendarDrawer from './CalendarDrawer';
import { ConnectProblem, GoogleButton, useCalendar, useConnectGoogle } from './CalendarConnect';

// ------------------------------------------------------------
// "Calendar": the last row of the "Your page" card on the offerings
// home (OfferingsHome.jsx), laid out like the row above it (.oh__row:
// label, value, actions). It stays in the same place in every state;
// only the row itself changes:
//
//   connected      the account, Connected, and Manage (CalendarDrawer.jsx)
//   lost           tinted red: new bookings are paused, Reconnect
//   not connected  tinted red: new bookings are paused, Connect
// ------------------------------------------------------------
export default function CalendarRow() {
  const connection = useCalendar();
  const status = connection?.status ?? 'none';
  const ok = status === 'connected';
  const lost = status === 'lost';
  const [managing, setManaging] = useState(false);
  const { phase, missing, connect, dialog } = useConnectGoogle();
  const waiting = phase === 'waiting';

  // Disconnected while the drawer's open: there's nothing left to manage
  useEffect(() => {
    if (!ok) setManaging(false);
  }, [ok]);

  return (
    <>
      <div className={`oh__row cal-row ${ok ? '' : 'cal-row--alert'}`}>
        <span className="oh__row-label">Calendar</span>

        {ok ? (
          <div className="oh__row-value cal-row__account">
            <img src={googleIcon} alt="" className="cal-row__g" />
            <span className="cal-row__email">{connection.email}</span>
            <span className="cal-row__status">Connected</span>
          </div>
        ) : (
          <div className="oh__row-value cal-row__problem">
            <p className="cal-row__title">
              <AlertCircle size={16} aria-hidden="true" />
              {lost ? 'Disconnected, so new bookings are paused' : 'Not connected, so new bookings are paused'}
            </p>
            <p className="cal-row__sub">
              {lost ? (
                <>
                  We can’t reach {connection.email}. Bookings you already have aren’t affected.{' '}
                  {!waiting && (
                    <button type="button" className="cal-row__other" onClick={() => connect()}>
                      Use another account
                    </button>
                  )}
                </>
              ) : (
                'We check it so no one books a time you’re busy, and add each booking to it.'
              )}
            </p>
          </div>
        )}

        <div className="oh__row-actions">
          {ok ? (
            <button type="button" className="oh__btn" onClick={() => setManaging(true)}>
              Manage
            </button>
          ) : (
            <GoogleButton waiting={waiting} onClick={() => connect(lost ? connection.email : null)}>
              {lost ? 'Reconnect' : 'Connect'}
            </GoogleButton>
          )}
        </div>

        {/* Cancelled, partial or failed trips to Google: under the row's text */}
        {!ok && phase !== 'idle' && phase !== 'waiting' && (
          <div className="cal-row__note">
            <ConnectProblem phase={phase} missing={missing} />
          </div>
        )}
      </div>

      {managing && ok && <CalendarDrawer connection={connection} onClose={() => setManaging(false)} />}
      {dialog}
    </>
  );
}