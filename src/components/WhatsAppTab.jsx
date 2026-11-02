import { useEffect, useState } from 'react';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import MetaConsent from './MetaConsent';
import WhatsAppDrawer, { NameBadge } from './WhatsAppDrawer';
import WhatsAppMessages from './WhatsAppMessages';
import {
  DEFAULT_NAME,
  MOCK_REJECTION,
  WAIT_DAYS,
  WHATSAPP_CHANGED_EVENT,
  anyInReview,
  connectWhatsApp,
  dayLabel,
  demo,
  hasNumber,
  isTooSoon,
  loadWhatsApp,
  markNotReady,
  messageStatus,
  reconnectWhatsApp,
  retryDay,
  settleReview,
} from '../data/whatsappConnection';
import { MESSAGES } from '../data/whatsappMessages';
import { initials } from '../utils/initials';
import '../screens/EditFrame.css'; // the buttons (es__btn), as in the calendar's drawer
import './CalendarConnect.css'; // the notes (cal-note) and quiet links (cal-link)
import './WhatsAppTab.css';

// ------------------------------------------------------------
// The WhatsApp half of the Reminders tab, on a webinar's page
// (WebinarDetails.jsx) and a 1:1 call's page (CallOverview.jsx). It's
// the only place the creator deals with WhatsApp: the connection is one
// for the whole account, so connecting here connects every webinar and
// call.
//
// Not connected: one question, then Meta's screens (MetaConsent.jsx).
//
//   Which WhatsApp is on your number?
//     Regular WhatsApp ─→ how to switch ─→ the name ─→ Meta's screens
//     WhatsApp Business ─────────────────→ the name ─→ Meta's screens
//
// Meta only connects a number with at least 7 days of real use on
// WhatsApp Business, and checks that itself, in its own screens; we
// can't ask beforehand. So we say so up front, let them try, and if
// Meta says no, explain why in a line and give the day worth trying
// again. They can still try sooner.
//
// We ask which app first because regular WhatsApp can't be connected
// and kept: the wrong path through Meta's screens can delete the
// WhatsApp account on that number.
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

// The clock, a minute at a time: enough to notice the week has passed
export function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

// One trip through Meta's screens (the stand-in for now).
//   phase: 'idle' | 'waiting' (Meta's screens are open) | 'cancelled' | 'error'
//   connect({ name }): a new connection, with the name they chose. If
//     Meta says the number isn't ready, that's saved (markNotReady).
//   reconnect(connection): a lost number, back through Meta
//   dialog: Meta's screens while they're open; render it anywhere
function useConnectMeta() {
  const [phase, setPhase] = useState('idle');
  const [asking, setAsking] = useState(null); // { name } or { reconnect: connection }

  const handleResult = ({ outcome, number, business, sharedChats }) => {
    const was = asking;
    setAsking(null);
    if (outcome === 'notReady' && !was.reconnect) {
      setPhase('idle');
      return markNotReady(was.name);
    }
    if (outcome !== 'connected') return setPhase(outcome === 'notReady' ? 'error' : outcome);
    const saved = was.reconnect
      ? reconnectWhatsApp({ number, sharedChats })
      : connectWhatsApp({ number, name: was.name, business, sharedChats });
    setPhase(saved ? 'idle' : 'error');
  };

  const dialog = asking ? (
    <MetaConsent
      number={asking.reconnect?.number ?? null}
      business={asking.reconnect?.business ?? null}
      onResult={handleResult}
    />
  ) : null;

  return {
    phase,
    dialog,
    connect: ({ name }) => {
      setPhase('waiting');
      setAsking({ name });
    },
    reconnect: (connection) => {
      setPhase('waiting');
      setAsking({ reconnect: connection });
    },
  };
}

// What went wrong on the last trip to Meta, and what to do
function MetaProblem({ phase }) {
  if (phase === 'cancelled') {
    return (
      <p className="cal-note" role="status">
        You stopped before connecting. Nothing changed.
      </p>
    );
  }
  if (phase === 'error') {
    return (
      <p className="cal-note cal-note--warn" role="alert">
        Couldn’t connect to Meta. Check your internet connection and try again.
      </p>
    );
  }
  return null;
}

// kind: 'call' | 'webinar'
// offering: whose reminder switches ('call:<id>' or 'webinar:<id>')
// offeringName: the call's or webinar's name, for message previews
// links: where the previews' buttons lead ({ meetingLink } or { webinarId })
export default function WhatsAppTab({ kind, offering, offeringName, links }) {
  const connection = useWhatsApp();
  const now = useNow();

  return (
    <div className="wa">
      {hasNumber(connection) ? (
        <Connected connection={connection} kind={kind} offering={offering} offeringName={offeringName} links={links} />
      ) : (
        <Setup connection={connection} now={now} />
      )}
      <DemoControls connection={connection} kind={kind} />
    </div>
  );
}

// ------------------------------------------------------------
// Not connected yet
// ------------------------------------------------------------
function Setup({ connection, now }) {
  const notReady = connection?.status === 'notReady';
  // 'which' | 'switch' | 'name'
  const [step, setStep] = useState('which');
  // Meta said not ready, and they've chosen to try again
  const [retrying, setRetrying] = useState(false);

  // Meta saying no (again) brings back its explanation
  const saidNoAt = connection?.at;
  useEffect(() => {
    setRetrying(false);
  }, [saidNoAt]);

  // Reset from somewhere else: back to the first question
  const none = !connection;
  useEffect(() => {
    if (none) setStep((s) => (s === 'name' ? 'which' : s));
  }, [none]);

  return (
    <div className="wa-setup">
      <div className="wa-head">
        <h3 className="wa-head__title">Remind people on WhatsApp too</h3>
        <p className="wa-head__text">
          Reminders go from your own WhatsApp number, so people see your name and their replies come straight to you.
          Emails keep going out as they do now.
        </p>
      </div>

      {notReady && !retrying ? (
        <NotReady
          connection={connection}
          now={now}
          onRetry={() => setRetrying(true)}
          onStartOver={() => {
            demo.reset();
            setStep('which');
          }}
        />
      ) : notReady ? (
        <NameStep initialName={connection.name} onBack={() => setRetrying(false)} />
      ) : step === 'which' ? (
        <Which onBusiness={() => setStep('name')} onRegular={() => setStep('switch')} />
      ) : step === 'switch' ? (
        <Switch onBack={() => setStep('which')} onSwitched={() => setStep('name')} />
      ) : (
        <NameStep onBack={() => setStep('which')} />
      )}
    </div>
  );
}

// "Which WhatsApp is on your number?"
function Which({ onBusiness, onRegular }) {
  return (
    <section className="wa-card" aria-labelledby="wa-which">
      <h4 id="wa-which" className="wa-q">
        Which WhatsApp do you use on the number you’d send from?
      </h4>
      <div className="wa-choices">
        <button type="button" className="wa-choice" onClick={onBusiness}>
          <span className="wa-choice__name">WhatsApp Business</span>
          <span className="wa-choice__text">The app made for businesses. Its icon has a B in the bubble.</span>
        </button>
        <button type="button" className="wa-choice" onClick={onRegular}>
          <span className="wa-choice__name">Regular WhatsApp</span>
          <span className="wa-choice__text">The everyday app most people use.</span>
        </button>
      </div>
    </section>
  );
}

// On regular WhatsApp: how to move the number to WhatsApp Business
function Switch({ onBack, onSwitched }) {
  return (
    <section className="wa-card" aria-labelledby="wa-switch">
      <BackLink onClick={onBack} />
      <h4 id="wa-switch" className="wa-q">
        First, move your number to WhatsApp Business
      </h4>
      <p className="wa-card__text">It’s free, you keep the same number, and your chats come with you.</p>
      <ol className="wa-howto">
        <li>Install WhatsApp Business from the Play Store or App Store.</li>
        <li>Open it and enter the number you use on WhatsApp now. When it asks, bring your chats across.</li>
        <li>
          Use it as you normally would for at least {WAIT_DAYS} days. Meta only connects numbers it has seen in real
          use, so it knows they belong to a real business.
        </li>
      </ol>
      <div className="wa-card__actions">
        <button type="button" className="es__btn es__btn--primary" onClick={onSwitched}>
          I’ve switched
        </button>
      </div>
    </section>
  );
}

// Meta said the number isn't ready: why, in a line, and when to try again
function NotReady({ connection, now, onRetry, onStartOver }) {
  const tooSoon = isTooSoon(connection, now);
  const day = dayLabel(retryDay(connection));
  return (
    <section className="wa-card" aria-labelledby="wa-not-ready">
      <h4 id="wa-not-ready" className="wa-q">
        {tooSoon ? 'Your number needs a few more days on WhatsApp Business' : 'Ready to try again'}
      </h4>
      <p className="wa-card__text">
        Meta only connects numbers with at least {WAIT_DAYS} days of real chats on WhatsApp Business. It’s how Meta
        tells real businesses from spammers.
      </p>
      <p className="wa-card__text">
        {tooSoon
          ? `Keep chatting as usual and try again from ${day}. Until then, reminders go out by email.`
          : 'It’s been a week. If you’ve been chatting on WhatsApp Business, Meta should connect your number now.'}
      </p>
      <div className="wa-card__actions">
        <button type="button" className={`es__btn ${tooSoon ? 'es__btn--quiet' : 'es__btn--primary'}`} onClick={onRetry}>
          Try again{tooSoon ? ' now' : ''}
        </button>
        <button type="button" className="cal-link" onClick={onStartOver}>
          Start over
        </button>
      </div>
    </section>
  );
}

// The name people will see, then Meta's screens
function NameStep({ initialName = DEFAULT_NAME, onBack }) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState(null);
  const { phase, dialog, connect } = useConnectMeta();
  const waiting = phase === 'waiting';

  const go = () => {
    const trimmed = name.trim();
    if (trimmed.length < 3) return setError('Enter at least 3 letters.');
    setError(null);
    connect({ name: trimmed });
  };

  return (
    <section className="wa-card" aria-labelledby="wa-name">
      {onBack && <BackLink onClick={onBack} />}
      <h4 id="wa-name" className="wa-q">
        The name people will see
      </h4>
      <p className="wa-card__text">
        It’s on every message you send. Meta checks it, and it can’t be changed once you connect, so use your own name or
        your brand’s.
      </p>

      <div className="wa-name">
        <form
          className="wa-name__form"
          onSubmit={(e) => {
            e.preventDefault();
            go();
          }}
          noValidate
        >
          <label className="wa-label" htmlFor="wa-name-input">
            Name
          </label>
          <input
            id="wa-name-input"
            className="wa-input"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'wa-name-error' : undefined}
          />
          {error && (
            <p id="wa-name-error" className="wa-error">
              {error}
            </p>
          )}
          <button type="submit" className="es__btn es__btn--primary wa-name__go" disabled={waiting}>
            {waiting ? 'Waiting for Meta…' : 'Connect WhatsApp'}
          </button>
          <p className="wa-hint">
            Opens Facebook, where you’ll confirm your number and scan a QR code with WhatsApp Business. Meta connects
            numbers with at least {WAIT_DAYS} days of real use on WhatsApp Business.
          </p>
        </form>
        <ChatPreview name={name.trim() || DEFAULT_NAME} />
      </div>

      <MetaProblem phase={phase} />
      {dialog}
    </section>
  );
}

// How their name shows on a reminder, on a student's phone
function ChatPreview({ name }) {
  return (
    <figure className="wa-chat" aria-label={`How a reminder looks on WhatsApp, from ${name}`}>
      <div className="wa-chat__top">
        <span className="wa-chat__face" aria-hidden="true">
          {initials(name)}
        </span>
        <span className="wa-chat__who">
          <span className="wa-chat__name">{name}</span>
          <span className="wa-chat__kind">Business account</span>
        </span>
      </div>
      <div className="wa-chat__body">
        <p className="wa-chat__bubble">
          Hi Priya, a quick reminder: we’re on in 1 hour. Join here when it’s time.
          <span className="wa-chat__time">6:00 pm</span>
        </p>
      </div>
      <figcaption className="wa-chat__caption">On a student’s phone</figcaption>
    </figure>
  );
}

function BackLink({ onClick }) {
  return (
    <button type="button" className="wa-back" onClick={onClick}>
      <ArrowLeft size={16} aria-hidden="true" /> Back
    </button>
  );
}

// ------------------------------------------------------------
// Connected (or lost)
// ------------------------------------------------------------
function Connected({ connection, kind, offering, offeringName, links }) {
  const [managing, setManaging] = useState(false);
  const { phase, dialog, reconnect } = useConnectMeta();
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
          <button
            type="button"
            className="es__btn es__btn--primary"
            onClick={() => reconnect(connection)}
            disabled={phase === 'waiting'}
          >
            {phase === 'waiting' ? 'Waiting for Meta…' : 'Reconnect'}
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

      <MetaProblem phase={phase} />

      <WhatsAppMessages
        connection={connection}
        kind={kind}
        offering={offering}
        offeringName={offeringName}
        links={links}
      />

      {managing && <WhatsAppDrawer connection={connection} onClose={() => setManaging(false)} />}
      {dialog}
    </div>
  );
}

// ------------------------------------------------------------
// Prototype only: move the connection between states, to try each screen.
// (Meta saying the number isn't ready is in Meta's own stand-in screens.)
// ------------------------------------------------------------
function DemoControls({ connection, kind }) {
  const connected = connection?.status === 'connected';
  const ids = MESSAGES[kind].map((m) => m.id);
  const toReject = connected ? ids.find((id) => messageStatus(connection, id) !== 'rejected') : null;

  return (
    <details className="wa-demo">
      <summary>Prototype controls</summary>
      <div className="wa-demo__buttons">
        <button type="button" onClick={demo.skipWeek} disabled={connection?.status !== 'notReady'}>
          A week passes
        </button>
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