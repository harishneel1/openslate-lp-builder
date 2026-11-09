import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import Drawer from '../components/Drawer';
import InfoTip from '../components/InfoTip';
import {
  DAILY_LIMIT,
  MOCK_REJECTION,
  anyInReview,
  dailyLimit,
  disconnectWhatsApp,
  markWelcomed,
  messageStatus,
  reconnectWhatsApp,
  renameWhatsApp,
} from '../data/whatsappConnection';
import { SHOWN_MESSAGE_IDS } from '../data/whatsappMessages';
import './EditFrame.css'; // es__btn, for the side panels' buttons
import './WhatsAppConnected.css';

// ------------------------------------------------------------
// Settings → WhatsApp, once a number is connected: what's connected,
// whether it's working, and the one thing to do when it isn't.
//
//   WhatsApp  [● Connected]
//   Used for every webinar and 1:1 call.
//   ───────────────────────────────────────────────────────
//   ┃ You're all set                                    ✕ ┃  first visit only
//   ┃ Meta is reviewing your reminder messages. …         ┃
//
//   Number          +91 98765 43210
//   Display name    Harish Neel  [In review]
//   Daily limit     250 students ⓘ   Get verified to raise it
//   Messages        8 reminders: 7 approved, 1 in review   See all
//
//   Disconnect WhatsApp
//
// Something wrong takes the place of "You're all set", most urgent first,
// each with the one thing to do:
//   the number dropped by WhatsApp   paused, emails still go     Reconnect
//   the display name rejected        Meta's reason               Choose another name
//   a message rejected               where to see why            See which
//
// Messages' "See all", and a rejected message's "See which", go to the
// Templates tab (onSeeAll). Side panels (Drawer): Get verified (Coming
// soon), and a new display name. Disconnect asks first
// (ConfirmDialog); it's also how to change number: disconnect, then
// connect the new one.
//
// "Connected on" isn't shown: nothing to do with it.
// connection: the saved connection (connected or lost)
// onSeeAll(): go to Settings → WhatsApp → Templates
// ------------------------------------------------------------

const STATUS = {
  approved: { label: 'Approved', badge: 'good' },
  review: { label: 'In review', badge: 'wait' },
  rejected: { label: 'Not approved', badge: 'bad' },
};

const fmt = (n) => n.toLocaleString('en-IN');

export default function WhatsAppConnected({ connection, onSeeAll }) {
  const [panel, setPanel] = useState(null); // 'verify' | 'rename'
  const [disconnecting, setDisconnecting] = useState(false);
  const lost = connection.status === 'lost';
  const problem = problemOf(connection);

  // "You're all set": on the first visit after setup. It's marked seen as it
  // shows, and stays for this visit until closed, so it never comes back.
  const [welcomeOpen, setWelcomeOpen] = useState(connection.welcomed === false);
  useEffect(() => {
    if (connection.welcomed !== false) return;
    setWelcomeOpen(true);
    markWelcomed();
  }, [connection.welcomed]);
  // A problem ends it: once fixed, the screen doesn't go back to "all set"
  useEffect(() => {
    if (problem) setWelcomeOpen(false);
  }, [problem?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const welcome = welcomeOpen && !problem;

  return (
    <>
      <div className="oh__panel-head">
        <h2 className="oh__panel-title wcn__title">
          WhatsApp
          <span className={`wcn-state ${lost ? 'wcn-state--paused' : ''}`}>{lost ? 'Paused' : 'Connected'}</span>
        </h2>
        <p className="oh__panel-sub">Used for every webinar and 1:1 call.</p>
      </div>

      <div className="settings__body wcn">
        {problem ? (
          <Problem problem={problem} connection={connection} onOpen={setPanel} onSeeAll={onSeeAll} />
        ) : welcome ? (
          <Welcome inReview={anyInReview(connection)} onClose={() => setWelcomeOpen(false)} />
        ) : null}

        <dl className="wcn-facts">
          <div className="wcn-facts__row">
            <dt>Number</dt>
            <dd className="wcn-facts__number">{connection.number}</dd>
          </div>
          <div className="wcn-facts__row">
            <dt>Display name</dt>
            <dd>
              {connection.name}
              {connection.nameStatus !== 'approved' && <Badge status={connection.nameStatus} />}
            </dd>
          </div>
          <div className="wcn-facts__row">
            <dt>Daily limit</dt>
            <dd>
              <span className="wcn-facts__with-tip">
                {fmt(dailyLimit(connection))} students
                <InfoTip
                  label="Daily limit"
                  text={
                    connection.verified
                      ? 'Different students you can message each day, not messages.'
                      : `Different students you can message each day, not messages. Verified businesses can reach ${fmt(DAILY_LIMIT.verified)}.`
                  }
                />
              </span>
              {connection.verified ? (
                <span className="wa-badge wcn-badge--good">Verified</span>
              ) : (
                <button type="button" className="wcn-link" onClick={() => setPanel('verify')}>
                  Get verified to raise it
                </button>
              )}
            </dd>
          </div>
          <div className="wcn-facts__row">
            <dt>Messages</dt>
            <dd>
              {messagesSummary(connection)}
              <button type="button" className="wcn-link" onClick={onSeeAll}>
                See all
              </button>
            </dd>
          </div>
        </dl>

        <button type="button" className="wcn-disconnect" onClick={() => setDisconnecting(true)}>
          Disconnect WhatsApp
        </button>
      </div>

      {panel === 'verify' && <VerifyPanel onClose={() => setPanel(null)} />}
      {panel === 'rename' && <RenamePanel current={connection.name} onClose={() => setPanel(null)} />}

      {disconnecting && (
        <ConfirmDialog
          title="Disconnect WhatsApp?"
          confirmLabel="Disconnect"
          danger
          onCancel={() => setDisconnecting(false)}
          onConfirm={() => {
            setDisconnecting(false);
            disconnectWhatsApp();
          }}
        >
          <p>WhatsApp reminders stop for every webinar and 1:1 call. Emails keep going out.</p>
          <p>To connect again, or to use a different number, you’ll go through setup again.</p>
        </ConfirmDialog>
      )}
    </>
  );
}

// ---------- What's wrong, most urgent first ----------
function problemOf(c) {
  if (c.status === 'lost') return { id: 'lost' };
  if (c.nameStatus === 'rejected') return { id: 'name' };
  const rejected = SHOWN_MESSAGE_IDS.filter((id) => messageStatus(c, id) === 'rejected');
  if (rejected.length) return { id: 'message', count: rejected.length };
  return null;
}

function Problem({ problem, connection, onOpen, onSeeAll }) {
  const heading = useRef(null);
  useEffect(() => heading.current?.focus(), [problem.id]);

  const content = {
    lost: {
      title: 'WhatsApp reminders are paused',
      text: 'WhatsApp stopped letting us send from this number. Emails still go out.',
      action: 'Reconnect',
      onAction: reconnectWhatsApp,
    },
    name: {
      title: `Meta didn’t approve “${connection.name}”`,
      text: MOCK_REJECTION,
      action: 'Choose another name',
      onAction: () => onOpen('rename'),
    },
    message: {
      title: problem.count === 1 ? '1 reminder wasn’t approved' : `${problem.count} reminders weren’t approved`,
      text: `Meta’s reason is in Templates. Pick another template for ${problem.count === 1 ? 'it' : 'them'} on the call or webinar.`,
      action: 'See which',
      onAction: onSeeAll,
    },
  }[problem.id];

  return (
    <div className="wcn-note wcn-note--problem" role="alert">
      <div className="wcn-note__words">
        <h3 className="wcn-note__title" ref={heading} tabIndex={-1}>
          {content.title}
        </h3>
        <p className="wcn-note__text">{content.text}</p>
      </div>
      <button type="button" className="oh__add" onClick={content.onAction}>
        {content.action}
      </button>
    </div>
  );
}

// ---------- First visit ----------
function Welcome({ inReview, onClose }) {
  return (
    <div className="wcn-note wcn-note--done" role="status">
      <div className="wcn-note__words">
        <h3 className="wcn-note__title">You’re all set</h3>
        <p className="wcn-note__text">
          {inReview
            ? 'Meta is reviewing your reminder messages. It usually takes a few minutes, and up to 24 hours.'
            : 'Your reminder messages are approved and ready to go.'}
        </p>
      </div>
      <button type="button" className="wcn-note__close" onClick={onClose} aria-label="Close">
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  );
}

// ---------- Small pieces ----------
function Badge({ status }) {
  const s = STATUS[status];
  return <span className={`wa-badge wcn-badge--${s.badge}`}>{s.label}</span>;
}

// "8 reminders: 7 approved, 1 in review", or "8 reminders, all approved"
function messagesSummary(c) {
  const counts = { approved: 0, review: 0, rejected: 0 };
  SHOWN_MESSAGE_IDS.forEach((id) => (counts[messageStatus(c, id)] += 1));
  const parts = Object.entries(counts).filter(([, n]) => n > 0);
  const total = `${SHOWN_MESSAGE_IDS.length} reminders`;
  if (parts.length === 1) return `${total}, all ${STATUS[parts[0][0]].label.toLowerCase()}`;
  return `${total}: ${parts.map(([s, n]) => `${n} ${STATUS[s].label.toLowerCase()}`).join(', ')}`;
}

// ---------- Side panels ----------
function VerifyPanel({ onClose }) {
  return (
    <Drawer
      title="Get verified"
      onClose={onClose}
      footer={
        <button type="button" className="es__btn es__btn--primary" onClick={onClose}>
          Done
        </button>
      }
    >
      <div className="wcn-verify">
        <span className="wa-badge wcn-badge--soon">Coming soon</span>
        <p>
          Verified businesses can message up to {fmt(DAILY_LIMIT.verified)} different students a day, instead of{' '}
          {fmt(DAILY_LIMIT.unverified)}.
        </p>
        <p>Meta verifies your business by checking its documents. You’ll be able to start that here.</p>
      </div>
    </Drawer>
  );
}

// Meta rejected the display name: try another, which goes back for review
function RenamePanel({ current, onClose }) {
  const [name, setName] = useState(current);
  const [error, setError] = useState(null);
  const submit = () => {
    const trimmed = name.trim();
    if (trimmed.length < 3) return setError('Enter at least 3 letters.');
    if (trimmed === current) return setError('Meta didn’t approve this one. Try a different name.');
    if (renameWhatsApp(trimmed)) onClose();
  };

  return (
    <Drawer
      title="Choose another name"
      sub="Shown to students on every message."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="es__btn es__btn--quiet" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="es__btn es__btn--primary" onClick={submit}>
            Send to Meta
          </button>
        </>
      }
    >
      <form
        className="wcn-rename"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        noValidate
      >
        <label className="wcn-rename__label" htmlFor="wcn-rename-input">
          Display name
        </label>
        <input
          id="wcn-rename-input"
          className="wcn-rename__input"
          value={name}
          maxLength={60}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          aria-invalid={Boolean(error)}
          aria-describedby="wcn-rename-hint"
          autoFocus
        />
        <p id="wcn-rename-hint" className={error ? 'wcn-rename__error' : 'wcn-rename__hint'}>
          {error ?? 'Your own name or your brand’s works best. Meta checks it again.'}
        </p>
      </form>
    </Drawer>
  );
}