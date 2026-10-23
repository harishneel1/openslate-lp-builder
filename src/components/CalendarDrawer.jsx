import { useEffect, useRef, useState } from 'react';
import googleIcon from '../assets/google-g.svg';
import Drawer from './Drawer';
import { disconnectCalendar, updateCalendar } from '../data/calendarStore';
import { CalendarChoices, ConnectProblem, useConnectGoogle } from './CalendarConnect';
import '../screens/EditFrame.css'; // the drawer buttons (es__btn), as in HoursDrawer

// ------------------------------------------------------------
// "Manage" from the calendar panel. Three things, nothing else:
//
//   the account          and Switch account, beside it
//   calendars we check   a plain list of ticks
//   Disconnect           in the footer, opposite Done; asks first
//
// New bookings always go into their main calendar, so there's no
// choice to make about that. Ticks save straight away, so Done
// only closes it.
//
// connection: the connected calendar (the panel closes this when it isn't)
// onClose(): Done, ✕, Escape or a click outside
// ------------------------------------------------------------
export default function CalendarDrawer({ connection, onClose }) {
  const [confirming, setConfirming] = useState(false);
  const { phase, missing, connect, dialog } = useConnectGoogle();
  const waiting = phase === 'waiting';

  const footer = (
    <>
      <button type="button" className="cal-danger-btn" onClick={() => setConfirming(true)}>
        Disconnect
      </button>
      <button type="button" className="es__btn es__btn--primary" onClick={onClose}>
        Done
      </button>
    </>
  );

  return (
    <Drawer
      className="cal-drawer"
      title="Your calendar"
      sub="Used for every offering. Changes save straight away."
      onClose={onClose}
      footer={footer}
    >
      <div className="cal-drawer__body">
        <div className="cal-account">
          <img src={googleIcon} alt="" className="cal-account__g" />
          <p className="cal-account__email">{connection.email}</p>
          <button type="button" className="cal-link" onClick={() => connect()} disabled={waiting}>
            {waiting ? 'Waiting for Google…' : 'Switch account'}
          </button>
        </div>

        {/* Backing out of switching changed nothing, so it needs no message */}
        {phase !== 'cancelled' && <ConnectProblem phase={phase} missing={missing} still={connection.email} />}

        <CalendarChoices connection={connection} onChange={updateCalendar} />
      </div>

      {confirming && (
        <DisconnectDialog
          email={connection.email}
          onKeep={() => setConfirming(false)}
          onDisconnect={() => {
            setConfirming(false);
            disconnectCalendar(); // the panel then closes this drawer
          }}
        />
      )}
      {dialog}
    </Drawer>
  );
}

// "Are you sure?", saying exactly what disconnecting does
function DisconnectDialog({ email, onKeep, onDisconnect }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.open && dialog.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className="cal-confirm"
      aria-labelledby="cal-confirm-title"
      onCancel={(e) => {
        e.preventDefault();
        e.stopPropagation(); // Escape closes this, not the drawer under it
        onKeep();
      }}
      onMouseDown={(e) => e.target === ref.current && onKeep()}
    >
      <h2 id="cal-confirm-title" className="cal-confirm__title">
        Disconnect Google Calendar?
      </h2>
      <p className="cal-confirm__text">
        Your booking page will stop taking new bookings until you connect a calendar again. Bookings you already have
        stay as they are, in {email}.
      </p>
      <div className="cal-confirm__actions">
        <button type="button" className="es__btn es__btn--quiet" onClick={onKeep} autoFocus>
          Keep connected
        </button>
        <button type="button" className="es__btn es__btn--danger" onClick={onDisconnect}>
          Disconnect
        </button>
      </div>
    </dialog>
  );
}