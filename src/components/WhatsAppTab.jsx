import { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import WhatsAppMessages from './WhatsAppMessages';
import {
  WHATSAPP_CHANGED_EVENT,
  anyInReview,
  demo,
  goToWhatsAppSettings,
  isSetUp,
  loadWhatsApp,
  messageStatus,
  settleReview,
} from '../data/whatsappConnection';
import { MESSAGES } from '../data/whatsappMessages';
import '../screens/EditFrame.css'; // the buttons (es__btn), as in the calendar's drawer
import './CalendarConnect.css'; // the notes (cal-note)
import './WhatsAppTab.css';

// ------------------------------------------------------------
// The WhatsApp half of the Reminders tab, on a webinar's page
// (WebinarDetails.jsx) and a 1:1 call's page (CallOverview.jsx): which
// WhatsApp reminders this webinar or call sends. The number itself is
// one for the whole account, connected and looked after in Settings →
// WhatsApp (WhatsAppSettings.jsx). This tab only points there:
//
// Not connected:
//   Remind people on WhatsApp too
//   Connect your number once in Settings, and every webinar and 1:1
//   call can use it.
//   [ Set up in Settings ]
//
// Connected: one line at the top, with the way to Settings:
//   (●) Sending from +91 98765 43210            [WhatsApp settings]
//       as Harish Neel
// Below it, this webinar's or call's WhatsApp reminders, with their
// switches (WhatsAppMessages.jsx).
//
// When the number can't send at all (dropped by WhatsApp, or a name
// Meta rejected), one line says so, and that it's fixed in Settings.
// A message Meta rejected shows on its own row instead. The name's
// review isn't mentioned here: Settings shows it.
//
// Settings opens through goToWhatsAppSettings (whatsappConnection.js),
// which the app hears (App.jsx), so nothing between here and the app
// needs to pass it down.
//
// Prototype controls at the bottom move the connection between states.
// ------------------------------------------------------------

// The saved connection, kept up to date when it changes anywhere (this
// tab, another page's, or another browser tab). While the name or any
// message is with Meta, it checks every second whether the stand-in's
// review is done.
export function useWhatsApp() {
  const [connection, setConnection] = useState(loadWhatsApp);
  useEffect(() => {
    const refresh = () => setConnection(loadWhatsApp());
    window.addEventListener(WHATSAPP_CHANGED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(WHATSAPP_CHANGED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const inReview = anyInReview(connection);
  useEffect(() => {
    if (!inReview) return undefined;
    settleReview();
    const id = setInterval(() => settleReview(), 1000);
    return () => clearInterval(id);
  }, [inReview]);

  return connection;
}

// kind: 'call' | 'webinar'
// offering: whose reminder switches ('call:<id>' or 'webinar:<id>')
// offeringName: the call's or webinar's name, for message previews
// links: where the previews' buttons lead ({ meetingLink, callId } or { webinarId })
export default function WhatsAppTab({ kind, offering, offeringName, links }) {
  const connection = useWhatsApp();

  // Until setup is finished (contact number added, Meta done reviewing), the
  // same card as before connecting: what's left is shown in Settings
  return (
    <div className="wa">
      {isSetUp(connection) ? (
        <Connected connection={connection} kind={kind} offering={offering} offeringName={offeringName} links={links} />
      ) : (
        <NotConnected />
      )}
      <DemoControls connection={connection} kind={kind} />
    </div>
  );
}

// ------------------------------------------------------------
// Not connected: the way to Settings
// ------------------------------------------------------------
function NotConnected() {
  return (
    <div className="wa-card wa-invite">
      <h3 className="wa-head__title">Remind people on WhatsApp too</h3>
      <p className="wa-head__text">Connect your number once in Settings, and every webinar and 1:1 call can use it.</p>
      <button type="button" className="es__btn es__btn--primary wa-invite__go" onClick={() => goToWhatsAppSettings()}>
        Set up in Settings
      </button>
    </div>
  );
}

// ------------------------------------------------------------
// Connected (or lost)
// ------------------------------------------------------------
function Connected({ connection, kind, offering, offeringName, links }) {
  const lost = connection.status === 'lost';
  const nameRejected = !lost && connection.nameStatus === 'rejected';

  return (
    <div className="wa-on">
      <div className="wa-from">
        <span className={`wa-from__icon ${lost ? 'wa-from__icon--off' : ''}`} aria-hidden="true">
          <MessageCircle size={18} strokeWidth={2.25} />
        </span>
        <div className="wa-from__text">
          <p className="wa-from__line">
            Sending from your no-reply number <strong>{connection.number}</strong>
          </p>
          <p className="wa-from__sub">as {connection.name}</p>
        </div>
        <button type="button" className="es__btn es__btn--quiet wa-from__manage" onClick={() => goToWhatsAppSettings()}>
          WhatsApp settings
        </button>
      </div>

      {(lost || nameRejected) && (
        <div className="cal-note cal-note--warn wa-problem" role="alert">
          <p>
            {lost ? (
              <>
                <strong>WhatsApp reminders are paused.</strong> Reconnect your number in Settings.
              </>
            ) : (
              <>
                <strong>Meta didn’t approve the name “{connection.name}”.</strong> Choose another in Settings.
              </>
            )}
          </p>
          <button type="button" className="es__btn es__btn--primary" onClick={() => goToWhatsAppSettings()}>
            {lost ? 'Reconnect in Settings' : 'Choose a name in Settings'}
          </button>
        </div>
      )}

      <WhatsAppMessages
        connection={connection}
        kind={kind}
        offering={offering}
        offeringName={offeringName}
        links={links}
      />
    </div>
  );
}

// ------------------------------------------------------------
// Prototype only: move the connection between states, to try each screen
// ------------------------------------------------------------
function DemoControls({ connection, kind }) {
  const connected = connection?.status === 'connected';
  const ids = MESSAGES[kind].map((m) => m.id);
  const toReject = connected ? ids.find((id) => messageStatus(connection, id) !== 'rejected') : null;

  return (
    <details className="wa-demo">
      <summary>Prototype controls</summary>
      <div className="wa-demo__buttons">
        <button type="button" onClick={demo.approveName} disabled={!connected || connection.nameStatus === 'approved'}>
          Approve name now
        </button>
        <button type="button" onClick={demo.rejectName} disabled={!connected || connection.nameStatus === 'rejected'}>
          Reject name
        </button>
        <button
          type="button"
          onClick={() => demo.approveMessages(ids)}
          disabled={!connected || ids.every((id) => messageStatus(connection, id) === 'approved')}
        >
          Approve all messages
        </button>
        <button type="button" onClick={() => demo.rejectMessage(toReject)} disabled={!toReject}>
          Reject a message
        </button>
        <button type="button" onClick={demo.loseNumber} disabled={!connected}>
          WhatsApp drops the number
        </button>
        <button type="button" onClick={demo.reset} disabled={!connection}>
          Reset everything
        </button>
      </div>
    </details>
  );
}