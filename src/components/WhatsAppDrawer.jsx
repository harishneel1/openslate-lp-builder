import { useEffect, useRef, useState } from 'react';
import Drawer from './Drawer';
import { dayLabel, dayOf, disconnectWhatsApp, renameWhatsApp } from '../data/whatsappConnection';
import '../screens/EditFrame.css'; // the drawer buttons (es__btn), as in the calendar's drawer
import './CalendarConnect.css'; // Disconnect and its "are you sure?" (cal-danger-btn, cal-confirm)
import './WhatsAppTab.css';

// ------------------------------------------------------------
// "Manage" from the WhatsApp tab. What's connected, and Disconnect:
//
//   Number              +91 98765 43210
//   Name people see     Harish Neel   [Name in review]
//   Business on Meta    Harish Neel
//   Chats shared        Yes
//   Connected           Mon 2 Nov 2026
//
//   Disconnect                                         Done
//
// Nothing here can be changed, with one exception: a name Meta didn't
// approve. Then the name row becomes a box to try another, which goes
// back to Meta for review. (Meta locks an approved name once the number
// is connected, so there's no rename otherwise.)
//
// connection: the connected (or lost) number
// onClose(): Done, ✕, Escape or a click outside
// ------------------------------------------------------------
export default function WhatsAppDrawer({ connection, onClose }) {
  const [confirming, setConfirming] = useState(false);
  const rejected = connection.status === 'connected' && connection.nameStatus === 'rejected';

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

  // "Mon 2 Nov 2026"
  const connected = `${dayLabel(dayOf(Date.parse(connection.connectedAt)))} ${new Date(connection.connectedAt).getFullYear()}`;

  return (
    <Drawer title="WhatsApp" sub="Used for every webinar and 1:1 call." onClose={onClose} footer={footer}>
      <dl className="wa-facts">
        <div className="wa-facts__row">
          <dt>Number</dt>
          <dd>{connection.number}</dd>
        </div>
        <div className="wa-facts__row">
          <dt>Name people see</dt>
          <dd>
            {connection.name} <NameBadge connection={connection} />
          </dd>
        </div>
        {connection.business && (
          <div className="wa-facts__row">
            <dt>Business on Meta</dt>
            <dd>{connection.business}</dd>
          </div>
        )}
        <div className="wa-facts__row">
          <dt>Chats shared</dt>
          <dd>{connection.sharedChats ? 'Yes' : 'No'}</dd>
        </div>
        <div className="wa-facts__row">
          <dt>Connected</dt>
          <dd>{connected}</dd>
        </div>
      </dl>

      {rejected && <Rename current={connection.name} onDone={onClose} />}

      {confirming && (
        <DisconnectDialog
          number={connection.number}
          onKeep={() => setConfirming(false)}
          onDisconnect={() => {
            setConfirming(false);
            disconnectWhatsApp();
            onClose();
          }}
        />
      )}
    </Drawer>
  );
}

// A name Meta didn't approve: try another
function Rename({ current, onDone }) {
  const [name, setName] = useState(current);
  const [error, setError] = useState(null);

  return (
    <form
      className="wa-rename"
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = name.trim();
        if (trimmed.length < 3) return setError('Enter at least 3 letters.');
        if (trimmed === current) return setError('Meta didn’t approve this one. Try a different name.');
        if (renameWhatsApp(trimmed)) onDone();
      }}
      noValidate
    >
      <label className="wa-label" htmlFor="wa-rename-input">
        Try another name
      </label>
      <p className="wa-hint">Your own name or your brand’s works best. It goes back to Meta to check.</p>
      <div className="wa-day__row">
        <input
          id="wa-rename-input"
          className="wa-input"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'wa-rename-error' : undefined}
          autoFocus
        />
        <button type="submit" className="es__btn es__btn--primary">
          Send to Meta
        </button>
      </div>
      {error && (
        <p id="wa-rename-error" className="wa-error">
          {error}
        </p>
      )}
    </form>
  );
}

// "Are you sure?", saying exactly what disconnecting does
function DisconnectDialog({ number, onKeep, onDisconnect }) {
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
      aria-labelledby="wa-confirm-title"
      onCancel={(e) => {
        e.preventDefault();
        e.stopPropagation(); // Escape closes this, not the drawer under it
        onKeep();
      }}
      onMouseDown={(e) => e.target === ref.current && onKeep()}
    >
      <h2 id="wa-confirm-title" className="cal-confirm__title">
        Disconnect WhatsApp?
      </h2>
      <p className="cal-confirm__text">
        Reminders stop going out on WhatsApp for every webinar and 1:1 call. Emails keep going. You keep using{' '}
        {number} on WhatsApp Business as before. WhatsApp may make you wait a while before this number can be connected
        again.
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

// The name's review, beside it. Approved needs no badge.
export function NameBadge({ connection }) {
  if (connection.status === 'lost') return <span className="wa-badge wa-badge--bad">Disconnected</span>;
  if (connection.nameStatus === 'review') return <span className="wa-badge wa-badge--wait">Name in review</span>;
  if (connection.nameStatus === 'rejected') return <span className="wa-badge wa-badge--bad">Name not approved</span>;
  return null;
}