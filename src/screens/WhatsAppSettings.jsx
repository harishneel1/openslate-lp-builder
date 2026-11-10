import { useEffect, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, Check, Clock, ExternalLink, Loader2 } from 'lucide-react';
import { useWhatsApp } from '../components/WhatsAppTab';
import WhatsAppConnected from './WhatsAppConnected';
import WhatsAppTemplates from './WhatsAppTemplates';
import { REJECTIONS, clearTemplates, decideReviewsNow, nextOutcome, setNextOutcome, useTemplates } from '../data/whatsappTemplates';
import { connectWhatsApp, demo, finishSetup, hasNumber, messageStatus } from '../data/whatsappConnection';
import { SHOWN_MESSAGE_IDS as MESSAGE_IDS } from '../data/whatsappMessages';
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
// Not connected: three yes/no questions. Connect WhatsApp only turns on
// once all three are Yes, because Meta's sign-up fails most often when a
// coach arrives with the wrong kind of number. Each is worded so Yes is
// the answer we need. The answers aren't saved: coming back, they answer
// again.
//
//   Automatic WhatsApp reminders from your number   [● Not connected]
//   ─────────────────────────────────────────────────────────────────────
//   ┌ Before you connect          ⏱ About 10 min ┐  ┌ ⚠ Number already on ──┐
//   │ ┌ Do you have a Facebook…   [✓ Yes] [No] ┐ │  │   WhatsApp            │
//   │ ┌ Do you have a phone…      [✓ Yes] [No] ┐ │  │ Use a spare number, … │
//   │ ┌ Is this a spare number…   [Yes] [No]   ┐ │  └───────────────────────┘
//   │ │ Use a spare number, or a new SIM. See how to fix
//   │                                            │
//   │ [ Connect WhatsApp ]  2 of 3 done          │
//   │ Disclaimer: This number will stop working in the WhatsApp app once it's connected.
//   └────────────────────────────────────────────┘
//
// One box, top to bottom: the questions only exist to unlock Connect, so
// they sit together. Each question is a box of its own with two plain
// buttons, Yes and No, that look like buttons, side by side on every row,
// so it's clear every question takes its own answer. Nothing else on the
// row looks clickable. The answer shows on the row: green with a tick on
// Yes, amber on No, with a short hint inside and "See how to fix", which
// moves to that fix in the box on the right.
// Beside Connect, a line that follows the answers, so each Yes visibly
// brings the button closer (PROGRESS): "Answer Yes to all three to
// connect", then "2 of 3 done", then "You're ready" as the button turns on.
//
// The box on the right only shows once an answer is No: one fix for each
// No, in amber, titled with the problem (in the place and look of Payment
// details' "How payouts work"). Until then, and once they're all Yes
// again, that space is empty, so the questions never change width.
// The line under Connect is the one coaches miss and regret, so it's set
// apart in amber. Clicking Connect is agreeing to it: no box to tick.
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
//                  to the questions, answers kept, with one calm note above
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

// The questions, each worded so Yes is the answer setup needs.
//   no: what a No means and what to do about it: hint, the short line in
//       the question's own box; title and text (and a link), its fix in
//       the box on the right
const QUESTIONS = [
  {
    id: 'facebook',
    text: 'Do you have a Facebook account?',
    no: {
      hint: 'You’ll need one to connect.',
      title: 'No Facebook account',
      text: 'Meta, which owns WhatsApp, connects numbers through Facebook. Create a free account, then come back and answer Yes.',
      link: { href: 'https://www.facebook.com/r.php', label: 'Create a Facebook account' },
    },
  },
  {
    id: 'sim',
    text: 'Do you have a phone number with a SIM card (not a virtual number)?',
    no: {
      hint: 'Virtual and landline numbers can’t be used.',
      title: 'No number with a SIM card',
      text: 'WhatsApp only accepts regular mobile numbers with a SIM card. Virtual and landline numbers don’t work. A new prepaid SIM is enough.',
    },
  },
  {
    id: 'fresh',
    text: 'Is this a spare number, not on WhatsApp or WhatsApp Business?',
    no: {
      hint: 'Numbers on WhatsApp or WhatsApp Business can’t be used.',
      title: 'Already on WhatsApp or WhatsApp Business?',
      text: 'Then it can’t be used here. Automated reminders run on WhatsApp Business API, which needs a number that isn’t on either app. Use a spare number, or get a new SIM.',
    },
  },
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

// tag: something beside the title (the red "Not connected"), or null
function Head({ title, sub = null, tag = null }) {
  return (
    <div className="oh__panel-head">
      <h2 className={`oh__panel-title ${tag ? 'wcn__title' : ''}`}>
        {title}
        {tag}
      </h2>
      {sub && <p className="oh__panel-sub">{sub}</p>}
    </div>
  );
}

// ---------- Not connected: the questions ----------
// onConnect(): Connect WhatsApp, once every answer is Yes
// cancelled: they left Meta's window early last time: a note above Connect
// error: what stopped it last time: shown in place of Connect, with Try again
function NotConnected({ onConnect, cancelled, error }) {
  const [answers, setAnswers] = useState({}); // { facebook: 'yes' | 'no', ... }; none picked at first
  const yeses = QUESTIONS.filter((q) => answers[q.id] === 'yes').length;
  const ready = yeses === QUESTIONS.length;
  const noes = QUESTIONS.filter((q) => answers[q.id] === 'no');

  // "See how to fix": to that fix in the box on the right (below, on a narrow screen)
  const showFix = (id) => {
    const item = document.getElementById(`wac-fix-${id}`);
    item?.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'nearest' });
    item?.focus({ preventScroll: true });
  };

  return (
    <>
      {/* The connected screen's Connected tag, in its other state, in the same place */}
      <Head
        title="Automatic WhatsApp reminders from your number"
        tag={<span className="wcn-state wcn-state--off">Not connected</span>}
      />
      <div className="settings__body settings__body--split">
        <section className="wac-card" aria-labelledby="wac-title">
          <div className="wac-card__head">
            <h3 className="wac-card__title" id="wac-title">
              Before you connect
            </h3>
            {/* The time it takes, seen before they start */}
            <span className="wac-card__time">
              <Clock size={14} aria-hidden="true" /> About 10 min
            </span>
          </div>

          <ul className="wac__list">
            {QUESTIONS.map((q) => {
              const answer = answers[q.id] ?? 'none';
              return (
                <li key={q.id} className={`wac__q wac__q--${answer}`}>
                  <div className="wac__q-row">
                    <span className="wac__text" id={`wac-q-${q.id}`}>
                      {q.text}
                    </span>
                    <span className="wac__seg" role="radiogroup" aria-labelledby={`wac-q-${q.id}`}>
                      {['yes', 'no'].map((value) => (
                        <label key={value} className={`wac__choice wac__choice--${value}`}>
                          <input
                            type="radio"
                            name={`wac-${q.id}`}
                            value={value}
                            className="wac__radio"
                            checked={answers[q.id] === value}
                            onChange={() => setAnswers((a) => ({ ...a, [q.id]: value }))}
                          />
                          <span className="wac__pill">
                            {value === 'yes' && answers[q.id] === 'yes' && (
                              <Check size={15} strokeWidth={3} aria-hidden="true" />
                            )}
                            {value === 'yes' ? 'Yes' : 'No'}
                          </span>
                        </label>
                      ))}
                    </span>
                  </div>
                  {answer === 'no' && (
                    <p className="wac__hint">
                      {q.no.hint}{' '}
                      <button type="button" className="wac__hint-link" onClick={() => showFix(q.id)}>
                        See how to fix
                      </button>
                    </p>
                  )}
                </li>
              );
            })}
          </ul>

          {error ? (
            <div className="wac__go">
              <SetupError id={error} onRetry={onConnect} />
              <Disclaimer />
            </div>
          ) : (
            <div className="wac__go">
              {cancelled && (
                <p className="wac__left" role="status">
                  Setup wasn’t completed. You can pick up where you left off anytime.
                </p>
              )}
              <div className="wac__go-row">
                <button
                  type="button"
                  className="oh__add wac__connect"
                  disabled={!ready}
                  onClick={onConnect}
                  aria-describedby="wac-progress wac-warn"
                >
                  Connect WhatsApp
                </button>
                <Progress yeses={yeses} total={QUESTIONS.length} />
              </div>
              <Disclaimer />
            </div>
          )}
        </section>

        <Help noes={noes} />
      </div>
    </>
  );
}

// Beside Connect: how close the answers are to turning it on
function Progress({ yeses, total }) {
  const ready = yeses === total;
  return (
    <span className={`wac__progress ${ready ? 'wac__progress--ready' : ''}`} id="wac-progress" aria-live="polite">
      {ready ? (
        <>
          <Check size={16} strokeWidth={3} aria-hidden="true" /> You’re ready
        </>
      ) : yeses === 0 ? (
        'Answer Yes to all three to connect'
      ) : (
        `${yeses} of ${total} done`
      )}
    </span>
  );
}

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Under Connect: what connecting does to the number, as a plain
// disclaimer. Connect is agreeing to it.
function Disclaimer() {
  return (
    <p className="wac__warn" id="wac-warn">
      <span className="wac__warn-label">Disclaimer:</span> This number will stop working in the WhatsApp app once it’s
      connected.
    </p>
  );
}

// ---------- The box on the right ----------
// Only once an answer is No: one fix for each, in the questions' order,
// titled with the problem. The live region stays, so the fix is read out
// as it appears. Each fix can take focus, for "See how to fix".
// noes: the questions answered No
function Help({ noes }) {
  return (
    <div className="wac-help-slot" aria-live="polite">
      {noes.length > 0 && (
        <aside className="settings__help wac-help" aria-label="How to fix">
          {noes.map((q) => (
            <div key={q.id} className="wac-help__item" id={`wac-fix-${q.id}`} tabIndex={-1}>
              <h3 className="wac-help__title">
                <AlertTriangle size={17} aria-hidden="true" />
                {q.no.title}
              </h3>
              <p>{q.no.text}</p>
              {q.no.link && (
                <a className="wac-help__link" href={q.no.link.href} target="_blank" rel="noreferrer">
                  {q.no.link.label}
                  <ExternalLink size={13} aria-hidden="true" />
                </a>
              )}
            </div>
          ))}
        </aside>
      )}
    </div>
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