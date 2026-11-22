import { useState } from 'react';
import { AlertTriangle, CalendarCheck, Check, ExternalLink, Video } from 'lucide-react';
import {
  setAnswer,
  SETUP_CALL_MINUTES,
  SETUP_CALL_URL,
  slotLabel,
  unlockWithCode,
} from '../data/whatsappSetupCall';
import './WhatsAppSetupCall.css';

// ------------------------------------------------------------
// Settings → WhatsApp → Connection, not connected and not yet unlocked
// (data/whatsappSetupCall.js): in place of the four steps, one card. Setup
// is done together on a call with our team, so there's nothing to fill in
// here yet.
//
//   ┌──────────────────────────────────────────────┐  ┌ ⚠ No business ┐
//   │ Set up WhatsApp on a call with our team      │  │ document yet  │
//   │ A 20-minute video call. …                    │  │ Get MSME …    │
//   │ Before you book                              │  └───────────────┘
//   │ ┌ Do you have a Facebook account? [✓Yes][No]│
//   │ ┌ … a SIM card (not virtual)?      [✓Yes][No]│
//   │ ┌ … a spare number, not on WhatsApp? [Yes][No]│
//   │ ┌ … GST, MSME (Udyam), … ?        [Yes][✓No] │
//   │ [Book your setup call] (off)  3 of 4 done    │
//   │   (booked: Your setup call: Tue 24 Nov, 11:00 am  [Join call] Reschedule)
//   │ ───────────────────────────────────────────  │
//   │ Setup code [ ______ ] [Start setup]          │
//   └──────────────────────────────────────────────┘
//
// Book your setup call turns on only once all four are Yes, so nobody
// books a call they can't finish. A No shows its fix on the right, as the
// steps used to. Answers are kept (data/whatsappSetupCall.js).
// The code is the only way in, so they can't start without us there.
// booking: their setup call ({ startsAt, joinUrl }) or null
// ------------------------------------------------------------

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
      text: 'Automated reminders run on WhatsApp Business API, which needs a number that isn’t on either app. Use a spare number, or get a new SIM.',
      // The other way, kept quieter: free up this number by deleting its account
      alt: {
        text: 'Want to use this number anyway? First delete the WhatsApp account on this number. All its chats, groups and backups will also be deleted, so export any important chats first.',
        link: { href: 'https://whatsapp.com/faq/en/iphone/21325453', label: 'How to delete a WhatsApp account' },
      },
    },
  },
  {
    id: 'document',
    text: 'Do you have a GST, MSME (Udyam) or Incorporation certificate, or a current account statement, in your business’s name?',
    no: {
      hint: 'Meta verifies businesses, so you’ll need one of these.',
      title: 'No business document yet',
      text: 'Get MSME (Udyam) registration first. It’s free and online, usually done the same day, and needs only your Aadhaar and PAN. Then come back and answer Yes.',
      link: { href: 'https://udyamregistration.gov.in/', label: 'Register for MSME (Udyam)' },
    },
  },
];


// booking: their setup call ({ startsAt, joinUrl }) or null
// answers: the questions' answers so far (saved: setAnswer)
export default function SetupCallGate({ booking, answers }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const yeses = QUESTIONS.filter((q) => answers[q.id] === 'yes').length;
  const noes = QUESTIONS.filter((q) => answers[q.id] === 'no');
  const ready = yeses === QUESTIONS.length;
  const submit = (e) => {
    e.preventDefault();
    const result = unlockWithCode(code);
    if (result.error) setError(result.error);
  };
  // "See how to fix": to that fix in the box on the right (below, on a narrow screen)
  const showFix = (id) => {
    const item = document.getElementById(`wac-fix-${id}`);
    item?.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'nearest' });
    item?.focus({ preventScroll: true });
  };

  return (
    <>
      <section className="wac-card wsc" aria-labelledby="wsc-title">
        <h3 className="wsc__title" id="wsc-title">
          Set up WhatsApp on a call with our team
        </h3>
        <p className="wsc__text">
          A {SETUP_CALL_MINUTES}-minute video call. We go through Meta’s steps with you and connect your number
          together, so nothing gets stuck.
        </p>

        <h4 className="wsc__sub">Before you book</h4>
        <p className="wsc__sub-text">Answer Yes to all four, so we can finish setup on the call.</p>
        <Questions answers={answers} onShowFix={showFix} />

        {booking ? (
          <div className="wsc__booked">
            <span className="wsc__booked-icon" aria-hidden="true">
              <CalendarCheck size={20} />
            </span>
            <div className="wsc__booked-words">
              <p className="wsc__booked-label">Your setup call</p>
              <p className="wsc__booked-when">{slotLabel(booking.startsAt)}</p>
            </div>
            <div className="wsc__booked-actions">
              <a className="oh__add wsc__join" href={booking.joinUrl} target="_blank" rel="noreferrer">
                <Video size={16} aria-hidden="true" /> Join call
              </a>
              <a className="wcn-link" href={SETUP_CALL_URL} target="_blank" rel="noreferrer">
                Reschedule
              </a>
            </div>
          </div>
        ) : ready ? (
          <a className="oh__add wsc__book" href={SETUP_CALL_URL} target="_blank" rel="noreferrer">
            Book your setup call
          </a>
        ) : (
          <div className="wac-step__nav">
            <button type="button" className="oh__add wac__connect wsc__book" disabled aria-describedby="wsc-left">
              Book your setup call
            </button>
            <span className="wac__progress" id="wsc-left" aria-live="polite">
              {yeses === 0 ? 'Answer Yes to all four' : `${yeses} of ${QUESTIONS.length} done`}
            </span>
          </div>
        )}

        <form className="wsc__code" onSubmit={submit} noValidate>
          <label className="po-field__label" htmlFor="wsc-code">
            Setup code
          </label>
          <div className="wsc__code-row">
            <input
              id="wsc-code"
              className={`po-input wsc__code-input ${error ? 'po-input--error' : ''}`}
              value={code}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6 digits"
              maxLength={7}
              onChange={(e) => {
                setCode(e.target.value);
                setError(null);
              }}
              aria-invalid={Boolean(error)}
              aria-describedby="wsc-code-note"
            />
            <button type="submit" className="es__btn es__btn--primary">
              Start setup
            </button>
          </div>
          <p className="po-field__note" id="wsc-code-note" role={error ? 'alert' : undefined}>
            {error ? <span className="po-field__error">{error}</span> : 'Our team gives you this on the call.'}
          </p>
        </form>
      </section>

      <Help noes={noes} />
    </>
  );
}

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// ---------- The four yes/no questions ----------
// Each worded so Yes is the answer we need, a box of its own with Yes and
// No side by side. The answer shows on the row: green with a tick on Yes,
// amber on No, with a short hint and "See how to fix", which moves to that
// fix in the box on the right. (Looks: wac__ in WhatsAppSettings.css.)
function Questions({ answers, onShowFix }) {
  return (
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
                      onChange={() => setAnswer(q.id, value)}
                    />
                    <span className="wac__pill">
                      {value === 'yes' && answers[q.id] === 'yes' && <Check size={15} strokeWidth={3} aria-hidden="true" />}
                      {value === 'yes' ? 'Yes' : 'No'}
                    </span>
                  </label>
                ))}
              </span>
            </div>
            {answer === 'no' && (
              <p className="wac__hint">
                {q.no.hint}{' '}
                <button type="button" className="wac__hint-link" onClick={() => onShowFix(q.id)}>
                  See how to fix
                </button>
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ---------- The box on the right ----------
// Only once an answer is No: one fix for each, in the questions' order,
// titled with the problem. Until then the space is empty, so the card
// never changes width. Each fix can take focus, for "See how to fix".
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
              {q.no.alt && (
                <div className="wac-help__alt">
                  <p>{q.no.alt.text}</p>
                  <a className="wac-help__link" href={q.no.alt.link.href} target="_blank" rel="noreferrer">
                    {q.no.alt.link.label}
                    <ExternalLink size={13} aria-hidden="true" />
                  </a>
                </div>
              )}
            </div>
          ))}
        </aside>
      )}
    </div>
  );
}

// Above the steps, once unlocked: that it lasts for this call
export function UnlockedNote() {
  return (
    <p className="wsc-on" role="status">
      Setup is open for this call. If you leave before connecting, you’ll need a new code from our team. Anything you
      fill in is kept.
    </p>
  );
}
