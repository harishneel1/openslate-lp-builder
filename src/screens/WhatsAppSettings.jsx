import { useEffect, useRef, useState } from 'react';
import { AlertCircle, ExternalLink, Loader2 } from 'lucide-react';
import InfoTip from '../components/InfoTip';
import { useWhatsApp } from '../components/WhatsAppTab';
import WhatsAppConnected from './WhatsAppConnected';
import WhatsAppTemplates from './WhatsAppTemplates';
import { REJECTIONS, clearTemplates, decideReviewsNow, nextOutcome, setNextOutcome, useTemplates } from '../data/whatsappTemplates';
import { connectWhatsApp, demo, finishSetup, hasNumber, messageStatus } from '../data/whatsappConnection';
import { MESSAGE_IDS } from '../data/whatsappMessages';
import {
  BLOCK_CHANGED_EVENT,
  ERROR_CHANGED_EVENT,
  SIGNUP_ERRORS,
  SUPPORT_EMAIL,
  nextError,
  openSignupWindow,
  readSignupMessage,
  setBlockPopup,
  setNextError,
  willBlockPopup,
} from '../data/metaSignup';
import '../components/WhatsAppTab.css'; // the badges' shape (wa-badge)
import './WhatsAppSettings.css';

// ------------------------------------------------------------
// Settings → WhatsApp: where the coach connects the one WhatsApp number
// every webinar and 1:1 call sends reminders from.
//
// Not connected: a short checklist. Connect WhatsApp only turns on once
// every line is ticked, because Meta's sign-up fails most often when a
// coach arrives with the wrong kind of number. The ticks aren't saved:
// coming back, they confirm again.
//
//   Send reminders from your WhatsApp number
//   Students get reminders from a number they know.
//   ─────────────────────────────────────────────────
//   Before you start, tick each one
//   ☐ I have a Facebook account
//   ☐ I have a phone number with a SIM card (not a virtual number)
//   ☐ This number isn't on WhatsApp right now  ⓘ
//   ┃☐ I understand this number will stop working in the WhatsApp app
//
//   [ Connect WhatsApp ]
//   Takes about 10 minutes
//
// The (i) explains the third line on hover (InfoTip). The last line is
// the one coaches miss and regret, so it's the only one set apart.
//
// Connect WhatsApp opens Meta's signup in a popup (the mock: metaSignup.js,
// MetaSignupMock.jsx). Around it, this page goes:
//
//   checklist ──Connect──▶ waiting ──Meta says finished──▶ finishing ──▶ connected
//                 (page dimmed:               (a few seconds:
//                  "Complete the setup in      "Finishing setup…")
//                  the Meta window")
//
// The dimmed page has "Show the Meta window", for when it's gone behind.
//
// When it doesn't finish:
//   closed early   Meta says they left (or the window just closes): back
//                  to the checklist, ticks kept, with one calm note above
//                  Connect, the same whichever screen they left. It stays
//                  until they click Connect again.
//   blocked        the browser stopped the window opening: the dimmed page
//                  says so, with Try again (a click, so the browser allows
//                  it) and Cancel.
//   an error       one of five (SIGNUP_ERRORS in metaSignup.js): what went
//                  wrong and what to do, in place of Connect, with Try again
//                  and Contact support, so they're never stuck:
//
//                  ┃ This number is still on WhatsApp
//                  ┃ Use a spare number that isn't on WhatsApp, then try again.
//                  ┃ [ Try again ]  Contact support
//
//                  Three come from Meta's window (the coach closed it on
//                  Meta's error); two from our server while finishing, so
//                  "Finishing setup…" ends in the error instead.
//
// Once connected, this
// shows what's connected and whether it's working (WhatsAppConnected.jsx).
// ------------------------------------------------------------

// How long "Finishing setup…" shows. In the real product it lasts as long
// as our server takes to save the number and send the templates for review.
const FINISHING_MS = 3500;

const CHECKS = [
  { id: 'facebook', text: 'I have a Facebook account' },
  { id: 'sim', text: 'I have a phone number with a SIM card (not a virtual number)' },
  {
    id: 'fresh',
    text: 'This number isn’t on WhatsApp right now',
    tip: 'Use a spare number that isn’t on WhatsApp, or get a new SIM for this.',
  },
  { id: 'app', text: 'I understand this number will stop working in the WhatsApp app', warn: true },
];

// Two pages, each with its own place in Settings' menu (SettingsPage.jsx):
//   Connection   connecting the number, and what's connected
//   Templates    the messages it sends, and Meta's review of each
//                (WhatsAppTemplates.jsx)
// view: 'connection' | 'templates'; onView(view) moves between them (the
//   connected screen's "See all", Templates' "Connect WhatsApp")
// startCreate: { product, moment } to open Templates' editor on a new one
export default function WhatsAppSettings({ view = 'connection', onView, startCreate = null }) {
  const connection = useWhatsApp();
  return view === 'templates' ? (
    <WhatsAppTemplates connection={connection} onConnect={() => onView('connection')} startCreate={startCreate} />
  ) : (
    <Connection connection={connection} onSeeAll={() => onView('templates')} />
  );
}

// ---------- Connection: connecting, and what's connected ----------
// onSeeAll(): go to Templates (from the connected screen's Messages row)
function Connection({ connection, onSeeAll }) {
  const signup = useSignup();

  // While finishing, the checklist stays under the dimmed page until it's done
  if (hasNumber(connection) && signup.phase === 'idle')
    return <WhatsAppConnected connection={connection} onSeeAll={onSeeAll} />;

  return (
    <>
      <NotConnected onConnect={signup.start} cancelled={signup.cancelled} error={signup.error} />
      {signup.phase === 'blocked' && <Blocked onRetry={signup.start} onCancel={signup.dismiss} />}
      {(signup.phase === 'waiting' || signup.phase === 'finishing') && (
        <Waiting phase={signup.phase} onShow={signup.show} />
      )}
    </>
  );
}

// ---------- Meta's window, and what happens around it ----------
// phase: 'idle' | 'waiting' (the window is open) | 'finishing' | 'blocked'
// cancelled: they left Meta's window early, last time
// error: what stopped it last time (a SIGNUP_ERRORS id, or 'unknown'), or null
function useSignup() {
  const [phase, setPhase] = useState('idle');
  const [cancelled, setCancelled] = useState(false);
  const [error, setError] = useState(null);
  const popup = useRef(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  // Meta's message: finished. Save the number, then show it connected.
  useEffect(() => {
    const onMessage = (event) => {
      const message = readSignupMessage(event);
      if (!message || phaseRef.current !== 'waiting') return;
      // Left early. (Meta also says on which screen: message.data.current_step,
      // worth logging. The note is the same whichever it was.)
      if (message.event === 'CANCEL') {
        setCancelled(true);
        setPhase('idle');
        return;
      }
      // Closed on Meta's own error: say what it was, in our words
      if (message.event === 'ERROR') {
        setError(SIGNUP_ERRORS[message.mock?.error] ? message.mock.error : 'unknown');
        setPhase('idle');
        return;
      }
      if (message.event !== 'FINISH') return;
      setPhase('finishing');
      const { number, displayName, business, fail } = message.mock ?? {};
      setTimeout(() => {
        // Our server couldn't use the number after all
        if (fail) setError(fail);
        else connectWhatsApp({ number, name: displayName, business, sharedChats: false });
        setPhase('idle');
      }, FINISHING_MS);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // The window closed with no message (Meta's usually sends one, but a
  // closed window is enough to know): left early. A short wait first,
  // since a message and the close arrive together.
  useEffect(() => {
    if (phase !== 'waiting') return undefined;
    const id = setInterval(() => {
      if (!popup.current?.closed) return;
      clearInterval(id);
      setTimeout(() => {
        if (phaseRef.current !== 'waiting') return;
        setCancelled(true);
        setPhase('idle');
      }, 400);
    }, 500);
    return () => clearInterval(id);
  }, [phase]);

  const start = () => {
    setCancelled(false);
    setError(null);
    const opened = openSignupWindow();
    if (!opened) {
      setPhase('blocked');
      return;
    }
    popup.current = opened;
    setPhase('waiting');
  };

  const show = () => popup.current?.focus();
  const dismiss = () => setPhase('idle');

  return { phase, cancelled, error, start, show, dismiss };
}

// The browser stopped Meta's window opening
function Blocked({ onRetry, onCancel }) {
  const card = useRef(null);
  useEffect(() => card.current?.focus(), []);
  return (
    <div className="wac-wait" onKeyDown={(e) => e.key === 'Escape' && onCancel()}>
      <div
        className="wac-wait__card"
        ref={card}
        tabIndex={-1}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="wac-blocked-title"
        aria-describedby="wac-blocked-text"
      >
        <span className="wac-wait__icon" aria-hidden="true">
          <AlertCircle size={24} />
        </span>
        <h2 className="wac-wait__title" id="wac-blocked-title">
          Your browser blocked the Meta window
        </h2>
        <p className="wac-wait__text" id="wac-blocked-text">
          Allow pop-ups for this site, then try again.
        </p>
        <div className="wac-wait__actions">
          <button type="button" className="es__btn es__btn--quiet" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="oh__add" onClick={onRetry}>
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}

// The page dimmed while Meta's window is open, then while setup finishes
function Waiting({ phase, onShow }) {
  const card = useRef(null);
  useEffect(() => card.current?.focus(), [phase]);
  const finishing = phase === 'finishing';

  return (
    <div className="wac-wait">
      <div className="wac-wait__card" ref={card} tabIndex={-1} role="status" aria-live="polite">
        <span className="wac-wait__icon" aria-hidden="true">
          {finishing ? <Loader2 size={24} className="wac-wait__spin" /> : <ExternalLink size={24} />}
        </span>
        {finishing ? (
          <>
            <h2 className="wac-wait__title">Finishing setup…</h2>
            <p className="wac-wait__text">Connecting your number and preparing your reminder templates.</p>
          </>
        ) : (
          <>
            <h2 className="wac-wait__title">Complete the setup in the Meta window</h2>
            <p className="wac-wait__text">Don’t close this page.</p>
            <button type="button" className="wac-wait__show" onClick={onShow}>
              Show the Meta window
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Head({ title, sub }) {
  return (
    <div className="oh__panel-head">
      <h2 className="oh__panel-title">{title}</h2>
      <p className="oh__panel-sub">{sub}</p>
    </div>
  );
}

// ---------- Not connected: the checklist ----------
// onConnect(): Connect WhatsApp, once everything's ticked
// cancelled: they left Meta's window early last time: a note above Connect
// error: what stopped it last time: shown in place of Connect, with Try again
function NotConnected({ onConnect, cancelled, error }) {
  const [ticked, setTicked] = useState({});
  const ready = CHECKS.every((c) => ticked[c.id]);

  return (
    <>
      <Head title="Send reminders from your WhatsApp number" sub="Students get reminders from a number they know." />
      <div className="settings__body">
        <fieldset className="wac">
          <legend className="wac__legend">Before you start, tick each one</legend>
          <ul className="wac__list">
            {CHECKS.map((c) => (
              <li key={c.id}>
                <label className={`wac__row ${c.warn ? 'wac__row--warn' : ''}`}>
                  <input
                    type="checkbox"
                    className="wac__box"
                    checked={Boolean(ticked[c.id])}
                    onChange={(e) => setTicked((t) => ({ ...t, [c.id]: e.target.checked }))}
                  />
                  <span className="wac__text">
                    {c.text}
                    {c.tip && (
                      // A click on the (i) or its bubble mustn't tick the box
                      <span className="wac__tip" onClick={(e) => e.preventDefault()}>
                        <InfoTip label="a number that isn’t on WhatsApp" text={c.tip} />
                      </span>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>

        {error ? (
          <SetupError id={error} onRetry={onConnect} />
        ) : (
          <div className="wac__go">
            {cancelled && (
              <p className="wac__left" role="status">
                Setup wasn’t completed. You can pick up where you left off anytime.
              </p>
            )}
            <button type="button" className="oh__add wac__connect" disabled={!ready} onClick={onConnect}>
              Connect WhatsApp
            </button>
            <p className="wac__note">Takes about 10 minutes</p>
          </div>
        )}
      </div>
    </>
  );
}

// ---------- What stopped setup, and what to do ----------
// For a code we don't know: still says what to do next
const UNKNOWN_ERROR = {
  title: 'Setup didn’t finish',
  text: 'Something went wrong on Meta’s side. Try again, or contact us and we’ll sort it out.',
};

function SetupError({ id, onRetry }) {
  const heading = useRef(null);
  useEffect(() => heading.current?.focus(), [id]);
  const error = SIGNUP_ERRORS[id] ?? UNKNOWN_ERROR;
  const mail = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`WhatsApp setup: ${error.title}`)}&body=${encodeURIComponent(
    `Error: ${id}\n\nWhat happened:\n`,
  )}`;

  return (
    <div className="wac-error" role="alert">
      <h3 className="wac-error__title" ref={heading} tabIndex={-1}>
        {error.title}
      </h3>
      <p className="wac-error__text">{error.text}</p>
      <div className="wac-error__actions">
        <button type="button" className="oh__add" onClick={onRetry}>
          Try again
        </button>
        <a className="wac-error__help" href={mail}>
          Contact support
        </a>
      </div>
    </div>
  );
}

// ---------- Prototype controls, for Settings' panel ----------
export function WhatsAppControlRows() {
  const connection = useWhatsApp();
  const block = useBlockSwitch();
  const failWith = useNextErrorSwitch();
  const connected = hasNumber(connection);
  return (
    <>
      <div className="proto__row">
        <span className="proto__label">WhatsApp</span>
        <div className="proto__controls">
          <button type="button" className="proto__btn" aria-pressed={!connection} onClick={demo.reset}>
            Not connected
          </button>
          <button type="button" className="proto__btn" aria-pressed={hasNumber(connection)} onClick={finishSetup}>
            Connected
          </button>
          <button
            type="button"
            className="proto__btn"
            aria-pressed={block}
            disabled={hasNumber(connection)}
            onClick={() => setBlockPopup(!block)}
          >
            Block the next popup
          </button>
        </div>
      </div>
      {connected && <ConnectedControlRows connection={connection} />}
      {/* Used once, by the next Connect, so Try again then goes through */}
      {!connected && (
        <div className="proto__row">
          <span className="proto__label">Next setup</span>
          <div className="proto__controls">
            <button
              type="button"
              className="proto__btn"
              aria-pressed={!failWith}
              disabled={connected}
              onClick={() => setNextError(null)}
            >
              Works
            </button>
            {Object.entries(SIGNUP_ERRORS).map(([id, e]) => (
              <button
                key={id}
                type="button"
                className="proto__btn"
                aria-pressed={failWith === id}
                disabled={connected}
                onClick={() => setNextError(id)}
              >
                {e.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <TemplateControlRows />
    </>
  );
}

// Their own templates: how Meta's review of the next one goes (approved,
// or turned down for one of REJECTIONS' reasons), and the rest
function TemplateControlRows() {
  const own = useTemplates(); // re-renders when they change
  const outcome = nextOutcome();
  const inReview = own.some((t) => t.status === 'review');
  return (
    <>
      <div className="proto__row">
        <span className="proto__label">Next template</span>
        <div className="proto__controls">
          <button
            type="button"
            className="proto__btn"
            aria-pressed={outcome === 'approve'}
            onClick={() => setNextOutcome('approve')}
          >
            Approved
          </button>
          {Object.entries(REJECTIONS).map(([id, r]) => (
            <button
              key={id}
              type="button"
              className="proto__btn"
              aria-pressed={outcome === `reject:${id}`}
              onClick={() => setNextOutcome(`reject:${id}`)}
            >
              Rejected: {r.label.toLowerCase()}
            </button>
          ))}
        </div>
      </div>
      <div className="proto__row">
        <span className="proto__label">Your templates</span>
        <div className="proto__controls">
          <button type="button" className="proto__btn" onClick={decideReviewsNow} disabled={!inReview}>
            Meta decides now
          </button>
          <button type="button" className="proto__btn" onClick={clearTemplates} disabled={own.length === 0}>
            Delete all of mine
          </button>
        </div>
      </div>
    </>
  );
}

// Once connected: move the connected screen between its states
function ConnectedControlRows({ connection }) {
  const counts = { approved: 0, review: 0, rejected: 0 };
  MESSAGE_IDS.forEach((id) => (counts[messageStatus(connection, id)] += 1));
  const toReject = MESSAGE_IDS.find((id) => messageStatus(connection, id) !== 'rejected');
  const lost = connection.status === 'lost';
  const Btn = ({ pressed, onClick, children, disabled = false }) => (
    <button type="button" className="proto__btn" aria-pressed={pressed} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );

  return (
    <>
      <div className="proto__row">
        <span className="proto__label">First visit</span>
        <div className="proto__controls">
          <Btn onClick={demo.replayWelcome}>Show “You’re all set” again</Btn>
        </div>
      </div>
      <div className="proto__row">
        <span className="proto__label">Display name</span>
        <div className="proto__controls">
          <Btn pressed={connection.nameStatus === 'review'} onClick={demo.nameInReview}>
            In review
          </Btn>
          <Btn pressed={connection.nameStatus === 'approved'} onClick={demo.approveName}>
            Approved
          </Btn>
          <Btn pressed={connection.nameStatus === 'rejected'} onClick={demo.rejectName}>
            Not approved
          </Btn>
        </div>
      </div>
      <div className="proto__row">
        <span className="proto__label">Messages</span>
        <div className="proto__controls">
          <Btn pressed={counts.review === MESSAGE_IDS.length} onClick={demo.messagesInReview}>
            All in review
          </Btn>
          <Btn pressed={counts.approved === MESSAGE_IDS.length} onClick={() => demo.approveMessages(MESSAGE_IDS)}>
            All approved
          </Btn>
          <Btn onClick={() => demo.rejectMessage(toReject)} disabled={!toReject}>
            Reject one more
          </Btn>
        </div>
      </div>
      <div className="proto__row">
        <span className="proto__label">Business</span>
        <div className="proto__controls">
          <Btn pressed={!connection.verified} onClick={() => demo.setVerified(false)}>
            Unverified
          </Btn>
          <Btn pressed={Boolean(connection.verified)} onClick={() => demo.setVerified(true)}>
            Verified
          </Btn>
        </div>
      </div>
      <div className="proto__row">
        <span className="proto__label">Number</span>
        <div className="proto__controls">
          <Btn pressed={!lost} onClick={() => lost && demo.reconnect()}>
            Working
          </Btn>
          <Btn pressed={lost} onClick={demo.loseNumber}>
            WhatsApp drops it
          </Btn>
        </div>
      </div>
    </>
  );
}

// The error the next setup will hit, kept up to date (the Meta window,
// another browser window, clears it once it's used)
function useNextErrorSwitch() {
  const [id, setId] = useState(nextError);
  useEffect(() => {
    const refresh = () => setId(nextError());
    window.addEventListener(ERROR_CHANGED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(ERROR_CHANGED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);
  return id;
}

// Whether the next Connect will be blocked, kept up to date (it turns
// itself off once used)
function useBlockSwitch() {
  const [on, setOn] = useState(willBlockPopup);
  useEffect(() => {
    const refresh = () => setOn(willBlockPopup());
    window.addEventListener(BLOCK_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(BLOCK_CHANGED_EVENT, refresh);
  }, []);
  return on;
}