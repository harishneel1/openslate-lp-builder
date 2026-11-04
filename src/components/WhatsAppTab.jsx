import { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import WhatsAppDrawer, { NameBadge } from './WhatsAppDrawer';
import WhatsAppMessages from './WhatsAppMessages';
import {
  MOCK_REJECTION,
  SETUP_STEPS,
  WHATSAPP_CHANGED_EVENT,
  anyInReview,
  demo,
  finishSetup,
  goToStep,
  hasNumber,
  loadWhatsApp,
  messageStatus,
  reconnectWhatsApp,
  settleReview,
  setupStep,
} from '../data/whatsappConnection';
import { MESSAGES } from '../data/whatsappMessages';
import '../screens/EditFrame.css'; // the buttons (es__btn), as in the calendar's drawer
import './CalendarConnect.css'; // the notes (cal-note)
import './WhatsAppTab.css';

// ------------------------------------------------------------
// The WhatsApp half of the Reminders tab, on a webinar's page
// (WebinarDetails.jsx) and a 1:1 call's page (CallOverview.jsx). It's
// the only place the creator deals with WhatsApp: the connection is one
// for the whole account, so connecting here connects every webinar and
// call.
//
// Not connected: three steps, then connected. What each step is hasn't
// been settled yet (it depends on Meta's process and our WhatsApp
// partner's), so each is a placeholder for now, with Continue and Back:
//
//   ① ── ② ── ③
//   Step 2
//   What this step asks of you goes here.
//   [ Back ]  [ Continue ]
//
// Continue on the last step connects a stand-in number, and the tab
// shows the finished design below.
//
// Connected: one line at the top ("Sending from …", with Manage), the
// name's review, and what's wrong if anything is. Below it, this webinar's
// or call's WhatsApp reminders (WhatsAppMessages.jsx).
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

  return (
    <div className="wa">
      {hasNumber(connection) ? (
        <Connected connection={connection} kind={kind} offering={offering} offeringName={offeringName} links={links} />
      ) : (
        <Setup step={setupStep(connection)} />
      )}
      <DemoControls connection={connection} kind={kind} />
    </div>
  );
}

// ------------------------------------------------------------
// Not connected yet: the three steps
// ------------------------------------------------------------
const STEPS = Array.from({ length: SETUP_STEPS }, (_, i) => i + 1);

// step: the step they're on, or 0 before they've started (shown as step 1)
function Setup({ step }) {
  const on = Math.max(step, 1);
  const last = on === SETUP_STEPS;

  return (
    <div className="wa-setup">
      <div className="wa-head">
        <h3 className="wa-head__title">Remind people on WhatsApp too</h3>
        <p className="wa-head__text">
          Reminders go from your own WhatsApp number, so people see your name and their replies come straight to you.
          Emails keep going out as they do now.
        </p>
      </div>

      <section className="wa-card" aria-labelledby="wa-step-title">
        <ol className="wa-steps" aria-label={`Step ${on} of ${SETUP_STEPS}`}>
          {STEPS.map((n) => (
            <li
              key={n}
              className={`wa-steps__step ${n < on ? 'wa-steps__step--done' : ''} ${n === on ? 'wa-steps__step--now' : ''}`}
              aria-current={n === on ? 'step' : undefined}
            >
              <span className="wa-steps__dot">{n}</span>
              <span className="wa-steps__name">Step {n}</span>
            </li>
          ))}
        </ol>

        <h4 id="wa-step-title" className="wa-q">
          Step {on}
        </h4>
        <p className="wa-card__text">What this step asks of you goes here.</p>

        <div className="wa-card__actions">
          {on > 1 && (
            <button type="button" className="es__btn es__btn--quiet" onClick={() => goToStep(on - 1)}>
              Back
            </button>
          )}
          <button
            type="button"
            className="es__btn es__btn--primary"
            onClick={() => (last ? finishSetup() : goToStep(on + 1))}
          >
            {last ? 'Finish' : 'Continue'}
          </button>
        </div>
      </section>
    </div>
  );
}

// ------------------------------------------------------------
// Connected (or lost)
// ------------------------------------------------------------
function Connected({ connection, kind, offering, offeringName, links }) {
  const [managing, setManaging] = useState(false);
  const lost = connection.status === 'lost';

  return (
    <div className="wa-on">
      <div className="wa-from">
        <span className={`wa-from__icon ${lost ? 'wa-from__icon--off' : ''}`} aria-hidden="true">
          <MessageCircle size={18} strokeWidth={2.25} />
        </span>
        <div className="wa-from__text">
          <p className="wa-from__line">
            Sending from <strong>{connection.number}</strong>
          </p>
          <p className="wa-from__sub">
            as {connection.name}
            <NameBadge connection={connection} />
          </p>
        </div>
        <button type="button" className="es__btn es__btn--quiet wa-from__manage" onClick={() => setManaging(true)}>
          Manage
        </button>
      </div>

      {lost ? (
        <div className="cal-note cal-note--warn wa-problem" role="alert">
          <p>
            <strong>WhatsApp reminders are paused.</strong> WhatsApp stopped letting us send from this number. This
            happens when the number is removed from WhatsApp Business or connected somewhere else. Emails still go
            out.
          </p>
          <button type="button" className="es__btn es__btn--primary" onClick={reconnectWhatsApp}>
            Reconnect
          </button>
        </div>
      ) : connection.nameStatus === 'rejected' ? (
        <div className="cal-note cal-note--warn wa-problem" role="alert">
          <p>
            <strong>Meta didn’t approve “{connection.name}”.</strong> {MOCK_REJECTION}
          </p>
          <button type="button" className="es__btn es__btn--primary" onClick={() => setManaging(true)}>
            Choose another name
          </button>
        </div>
      ) : connection.nameStatus === 'review' ? (
        <p className="cal-note" role="status">
          Meta is checking your name. It usually takes a few minutes, and sometimes up to a day.
        </p>
      ) : null}

      <WhatsAppMessages
        connection={connection}
        kind={kind}
        offering={offering}
        offeringName={offeringName}
        links={links}
      />

      {managing && <WhatsAppDrawer connection={connection} onClose={() => setManaging(false)} />}
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