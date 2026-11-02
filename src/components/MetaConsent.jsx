import { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Loader2, Plus, Smartphone } from 'lucide-react';
import { MOCK_NUMBER } from '../data/whatsappConnection';
import { initials } from '../utils/initials';
import { mockAccount } from '../data/myPage';
import './MetaConsent.css';

// How long "Connecting…" shows, standing in for the trip to Meta and back
const ROUND_TRIP_MS = 1100;

// ------------------------------------------------------------
// Stand-in for Meta's own "connect WhatsApp" screens (Embedded Signup,
// for a number already on the WhatsApp Business app), until the real
// connection is built. The real ones open in a Facebook pop-up; these
// are in Meta's colours and labelled as a stand-in so no one mistakes
// them. The steps follow Meta's, in order:
//
//   1. Log in with Facebook
//   2. Choose their business on Meta (or make one)    skipped on reconnect
//   3. The WhatsApp Business number
//   4. The code Meta sends to it
//   5. Scan a QR code with the WhatsApp Business app
//   6. Share existing chats and contacts, or not
//
// It can send back everything the real one can, so the screens around
// it can be tried:
//   connected  all the way through
//   cancelled  Cancel, or Escape, at any step
//   notReady   "pretend the number isn't ready", at the bottom: Meta's
//              answer when the number hasn't had 7 days of real use on
//              WhatsApp Business (the real one says so on its own screen)
//   error      "pretend Meta fails", at the bottom
//
// number: fills in step 3, and can't be changed (reconnecting)
// business: skips step 2 (reconnecting)
// onResult({ outcome, number, business, sharedChats })
// ------------------------------------------------------------
export default function MetaConsent({ number: fixedNumber = null, business: fixedBusiness = null, onResult }) {
  const ref = useRef(null);
  const timer = useRef(null);
  const [step, setStep] = useState('login');
  const [business, setBusiness] = useState(fixedBusiness);
  const [number, setNumber] = useState(fixedNumber ?? MOCK_NUMBER);
  const [numberError, setNumberError] = useState(null);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState(null);
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      clearTimeout(timer.current);
      if (dialog?.open) dialog.close();
    };
  }, []);

  const finish = (outcome, sharedChats = false) =>
    onResult({ outcome, number: number.trim(), business, sharedChats });

  // The last step (or a pretend failure): a moment of "Connecting…", then the result
  const after = (outcome, sharedChats = false) => {
    setWaiting(true);
    timer.current = setTimeout(() => finish(outcome, sharedChats), ROUND_TRIP_MS);
  };

  const sendCode = () => {
    const digits = number.replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 15) return setNumberError('Enter the number with its country code.');
    setNumberError(null);
    setStep('code');
  };

  const checkCode = () => {
    if (!/^\d{6}$/.test(code.trim())) return setCodeError('Enter the 6-digit code.');
    setCodeError(null);
    setStep('qr');
  };

  const cancel = () => finish('cancelled');

  return (
    <dialog
      ref={ref}
      className="mc"
      aria-labelledby="mc-title"
      onCancel={(e) => {
        e.preventDefault(); // Escape: closing it ourselves counts as Cancel
        e.stopPropagation(); // and only this: not a drawer it was opened from
        if (!waiting) cancel();
      }}
    >
      <div className="mc__bar">
        <span className="mc__f" aria-hidden="true">
          f
        </span>
        <span>Connect WhatsApp</span>
        <span className="mc__stand-in">Stand-in for Meta</span>
      </div>

      {waiting ? (
        <div className="mc__waiting" role="status">
          <Loader2 size={28} className="mc__spin" aria-hidden="true" />
          Connecting your number…
        </div>
      ) : step === 'login' ? (
        <div className="mc__body">
          <h2 id="mc-title" className="mc__title">
            Log in to continue to OpenSlate
          </h2>
          <p className="mc__sub">OpenSlate will be able to send WhatsApp messages from your number.</p>
          <button
            type="button"
            className="mc__account"
            onClick={() => setStep(fixedBusiness ? 'number' : 'business')}
            autoFocus
          >
            <span className="mc__avatar" aria-hidden="true">
              {initials(mockAccount.name)}
            </span>
            <span>Continue as {mockAccount.name.split(' ')[0]}</span>
          </button>
          <Actions onCancel={cancel} />
        </div>
      ) : step === 'business' ? (
        <div className="mc__body">
          <h2 id="mc-title" className="mc__title">
            Choose your business
          </h2>
          <p className="mc__sub">Your WhatsApp number will belong to this business on Meta.</p>
          <ul className="mc__list">
            <li>
              <button
                type="button"
                className="mc__option"
                onClick={() => {
                  setBusiness(mockAccount.name);
                  setStep('number');
                }}
                autoFocus
              >
                <Building2 size={20} aria-hidden="true" />
                <span>{mockAccount.name}</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className="mc__option"
                onClick={() => {
                  setBusiness(`${mockAccount.name} Academy`);
                  setStep('number');
                }}
              >
                <Plus size={20} aria-hidden="true" />
                <span>Create a new business</span>
              </button>
            </li>
          </ul>
          <Actions onCancel={cancel} />
        </div>
      ) : step === 'number' ? (
        <form
          className="mc__body"
          onSubmit={(e) => {
            e.preventDefault();
            sendCode();
          }}
          noValidate
        >
          <h2 id="mc-title" className="mc__title">
            Your WhatsApp Business number
          </h2>
          <p className="mc__sub">The number on your WhatsApp Business app. You’ll keep using the app as you do now.</p>
          <label className="mc__label" htmlFor="mc-number">
            Phone number
          </label>
          <input
            id="mc-number"
            className="mc__input"
            type="tel"
            inputMode="tel"
            value={number}
            readOnly={Boolean(fixedNumber)}
            onChange={(e) => setNumber(e.target.value)}
            aria-invalid={Boolean(numberError)}
            aria-describedby={numberError ? 'mc-number-error' : undefined}
            autoFocus
          />
          {numberError && (
            <p id="mc-number-error" className="mc__error">
              {numberError}
            </p>
          )}
          <Actions onCancel={cancel} next="Send code" submit />
        </form>
      ) : step === 'code' ? (
        <form
          className="mc__body"
          onSubmit={(e) => {
            e.preventDefault();
            checkCode();
          }}
          noValidate
        >
          <h2 id="mc-title" className="mc__title">
            Enter the code
          </h2>
          <p className="mc__sub">We sent a 6-digit code to {number.trim()} on WhatsApp Business.</p>
          <label className="mc__label" htmlFor="mc-code">
            Code
          </label>
          <input
            id="mc-code"
            className="mc__input mc__input--code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            aria-invalid={Boolean(codeError)}
            aria-describedby={codeError ? 'mc-code-error' : 'mc-code-hint'}
            autoFocus
          />
          {codeError ? (
            <p id="mc-code-error" className="mc__error">
              {codeError}
            </p>
          ) : (
            <p id="mc-code-hint" className="mc__hint">
              Prototype: any 6 digits work.
            </p>
          )}
          <Actions onCancel={cancel} next="Continue" submit />
        </form>
      ) : step === 'qr' ? (
        <div className="mc__body">
          <h2 id="mc-title" className="mc__title">
            Scan this with WhatsApp Business
          </h2>
          <ol className="mc__steps">
            <li>Open WhatsApp Business on your phone.</li>
            <li>Tap the new message from Facebook, then Scan QR code.</li>
            <li>Point your phone at this code.</li>
          </ol>
          <div className="mc__qr-wrap">
            <FakeQr seed={number} />
            <Smartphone size={18} className="mc__qr-phone" aria-hidden="true" />
          </div>
          <Actions onCancel={cancel} next="I’ve scanned it" onNext={() => setStep('share')} />
        </div>
      ) : (
        <div className="mc__body">
          <h2 id="mc-title" className="mc__title">
            Share your chats with OpenSlate?
          </h2>
          <p className="mc__sub">
            Your existing chats and contacts on WhatsApp Business. You can connect without sharing them.
          </p>
          <div className="mc__actions">
            <button type="button" className="mc__text-btn" onClick={() => after('connected', false)}>
              Don’t share
            </button>
            <button type="button" className="mc__continue" onClick={() => after('connected', true)} autoFocus>
              Share
            </button>
          </div>
        </div>
      )}

      {!waiting && (
        <p className="mc__test">
          Prototype only:{' '}
          <button type="button" onClick={() => after('notReady')}>
            pretend the number isn’t ready
          </button>
          {' · '}
          <button type="button" onClick={() => after('error')}>
            pretend Meta fails
          </button>
        </p>
      )}
    </dialog>
  );
}

// Cancel, and the step's own way on (a submit button inside a form)
function Actions({ onCancel, next = null, onNext, submit = false }) {
  return (
    <div className="mc__actions">
      <button type="button" className="mc__text-btn" onClick={onCancel}>
        Cancel
      </button>
      {next && (
        <button type={submit ? 'submit' : 'button'} className="mc__continue" onClick={submit ? undefined : onNext}>
          {next}
        </button>
      )}
    </div>
  );
}

// A QR-looking pattern: the three corner squares, and dots from the
// number, so it looks the same each time for the same number. It isn't
// a real code; nothing scans it.
const QR_SIZE = 25;

function FakeQr({ seed }) {
  const cells = useMemo(() => {
    let h = 2166136261;
    for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    const rand = () => {
      h ^= h << 13;
      h ^= h >>> 17;
      h ^= h << 5;
      return ((h >>> 0) % 1000) / 1000;
    };
    const inFinder = (x, y) =>
      [
        [0, 0],
        [QR_SIZE - 7, 0],
        [0, QR_SIZE - 7],
      ].some(([fx, fy]) => x >= fx - 1 && x <= fx + 7 && y >= fy - 1 && y <= fy + 7);
    const out = [];
    for (let y = 0; y < QR_SIZE; y++) {
      for (let x = 0; x < QR_SIZE; x++) if (!inFinder(x, y) && rand() < 0.48) out.push([x, y]);
    }
    return out;
  }, [seed]);

  const finder = (x, y) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width="7" height="7" fill="#1c1e21" />
      <rect x={x + 1} y={y + 1} width="5" height="5" fill="#fff" />
      <rect x={x + 2} y={y + 2} width="3" height="3" fill="#1c1e21" />
    </g>
  );

  return (
    <svg className="mc__qr" viewBox={`-2 -2 ${QR_SIZE + 4} ${QR_SIZE + 4}`} role="img" aria-label="QR code to scan">
      <rect x="-2" y="-2" width={QR_SIZE + 4} height={QR_SIZE + 4} fill="#fff" />
      {cells.map(([x, y]) => (
        <rect key={`${x}:${y}`} x={x} y={y} width="1" height="1" fill="#1c1e21" />
      ))}
      {finder(0, 0)}
      {finder(QR_SIZE - 7, 0)}
      {finder(0, QR_SIZE - 7)}
    </svg>
  );
}