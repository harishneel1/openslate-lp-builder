import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import {
  PLATFORM_NAME,
  SIGNUP_ERRORS,
  nextError,
  postCancel,
  postError,
  postFinish,
  setNextError,
} from '../data/metaSignup';
import { mockAccount } from '../data/myPage';
import { initials } from '../utils/initials';
import './MetaSignupMock.css';

// ------------------------------------------------------------
// ?mock=meta-signup: a stand-in for Meta's Embedded Signup popup, opened
// by Connect WhatsApp (Settings → WhatsApp). Not Meta's real screens, but
// close enough in order, wording and look (Meta's blue, grey, system
// font) for a product walkthrough. No Meta logos: plain text stands in.
//
//   login        Continue as Harish?                 (Facebook's login)
//   intro        Connect your account to Your App
//   business     Your business portfolio
//   profile      Create a WhatsApp Business profile  (account, display name, category)
//   phone        Add a phone number                  (and text or call)
//   code         Verify your phone number            (any 6 digits work)
//   access       Review Your App's access request
//   done         You're all set → Finish
//
// Finish tells the page that opened it (metaSignup.js postFinish) and
// closes. Closing on the last screen counts as finishing, as in Meta's.
// Closing on any other screen, or Cancel on the login, tells it the coach
// left, and where (postCancel), as Meta's does.
//
// Errors (round 3): the one picked in the prototype controls, if any, is
// read as the window opens and used once. Meta's own errors show on their
// screen, in Meta's words, with Next held until the coach changes what
// they typed (fixing it here, as they can in Meta's):
//   phone   number already on WhatsApp, number not supported
//   code    couldn't verify (Resend clears it too)
// Closing the window while one shows tells our page (postError). The
// errors our server finds after Meta's window (connected elsewhere,
// permissions) ride along on Finish, for our page to show.
// Fields start filled from the coach's account where Meta's would, so a
// walkthrough is mostly Next, Next, Next. The phone number and code are
// left for them to type: those are the parts coaches really do.
// ------------------------------------------------------------

const STEPS = ['login', 'intro', 'business', 'profile', 'phone', 'code', 'access', 'done'];

// Each screen as the cancel message names it (Meta's current_step).
// Stand-ins, apart from PHONE_NUMBER_SETUP: confirm the real list with AiSensy.
const META_STEP = {
  login: 'LOGIN',
  intro: 'INTRO',
  business: 'BUSINESS_PORTFOLIO',
  profile: 'WHATSAPP_PROFILE',
  phone: 'PHONE_NUMBER_SETUP',
  code: 'PHONE_NUMBER_VERIFICATION',
  access: 'PERMISSIONS',
};

const CATEGORIES = ['Education', 'Professional services', 'Health and wellness', 'Other'];

const COUNTRY_CODES = ['+91', '+1', '+44', '+61', '+971', '+65'];

const firstName = mockAccount.name.split(' ')[0];

export default function MetaSignupMock() {
  const [step, setStep] = useState('login');
  const [form, setForm] = useState({
    portfolio: mockAccount.name,
    accountName: mockAccount.name,
    displayName: mockAccount.name,
    category: 'Education',
    countryCode: '+91',
    number: '',
    method: 'sms',
    code: '',
  });
  const set = (key) => (e) => edit(key, e.target.value);
  const at = STEPS.indexOf(step);
  const go = (to) => setStep(STEPS[at + to]);
  const [alone, setAlone] = useState(false); // opened without our page behind it

  // The error this setup hits (prototype), used up once read
  const [fault, setFault] = useState(nextError);
  useEffect(() => setNextError(null), []);
  const [metaError, setMetaError] = useState(null); // Meta's error showing on this screen
  // Changing what they typed clears Meta's error: they're fixing it
  const edit = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setMetaError(null);
  };
  // Next: the error, if this is its screen, else on
  const next = () => {
    if (fault && SIGNUP_ERRORS[fault].where === step) {
      setMetaError(fault);
      setFault(null);
      return;
    }
    go(1);
  };

  useEffect(() => {
    document.title = 'Facebook';
  }, []);

  const digits = form.number.replace(/\D/g, '');
  const fullNumber = `${form.countryCode} ${form.number.trim()}`;

  // Sent once: Finish closes the window, which fires pagehide too
  const sentRef = useRef(false);
  const finish = () => {
    if (sentRef.current) return;
    const fail = fault && SIGNUP_ERRORS[fault].where === 'finishing' ? fault : null;
    const sent = postFinish({
      number: fullNumber,
      displayName: form.displayName.trim(),
      business: form.portfolio,
      fail,
    });
    sentRef.current = sent;
    if (sent) window.close();
    else setAlone(true);
  };

  // Leaving early: say where, once (or which error was showing)
  const cancel = () => {
    if (sentRef.current) return;
    sentRef.current = metaError ? postError(metaError) : postCancel(META_STEP[step]);
  };

  // The window closing: on the last screen that still counts as finishing
  // (Meta's rule); anywhere else, they left early
  const leaveRef = useRef(null);
  leaveRef.current = step === 'done' ? finish : cancel;
  useEffect(() => {
    const onLeave = () => leaveRef.current();
    window.addEventListener('pagehide', onLeave);
    return () => window.removeEventListener('pagehide', onLeave);
  }, []);

  if (step === 'login') {
    return (
      <Login
        onContinue={() => go(1)}
        onCancel={() => {
          cancel();
          window.close();
        }}
      />
    );
  }

  // What each screen shows, and whether Next is ready
  const screens = {
    intro: {
      title: `Connect your account to ${PLATFORM_NAME}`,
      body: (
        <>
          <p className="mx__text">
            {PLATFORM_NAME} will use your WhatsApp Business account to send messages to your customers.
          </p>
          <ul className="mx__ticks">
            <li>Choose or create your business portfolio</li>
            <li>Create a WhatsApp Business profile</li>
            <li>Add and verify a phone number</li>
          </ul>
          <p className="mx__fine">
            By continuing, you agree to the WhatsApp Business Terms of Service and Meta’s Terms.
          </p>
        </>
      ),
      next: 'Get started',
      ready: true,
    },
    business: {
      title: 'Your business portfolio',
      body: (
        <>
          <p className="mx__text">Choose the business portfolio to connect, or create a new one.</p>
          <Field label="Business portfolio">
            <Select value={form.portfolio} onChange={set('portfolio')}>
              <option value={mockAccount.name}>{mockAccount.name}</option>
              <option value="new">Create a new business portfolio</option>
            </Select>
          </Field>
          {form.portfolio === 'new' && (
            <p className="mx__fine">A new portfolio named “{mockAccount.name}” will be created for you.</p>
          )}
        </>
      ),
      ready: true,
    },
    profile: {
      title: 'Create a WhatsApp Business profile',
      body: (
        <>
          <Field label="WhatsApp Business account name">
            <input className="mx__input" value={form.accountName} onChange={set('accountName')} />
          </Field>
          <Field label="Display name" help="Shown to customers on every message. Meta reviews it.">
            <input className="mx__input" value={form.displayName} onChange={set('displayName')} />
          </Field>
          <Field label="Category">
            <Select value={form.category} onChange={set('category')}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
        </>
      ),
      ready: form.accountName.trim() && form.displayName.trim(),
    },
    phone: {
      title: 'Add a phone number for WhatsApp',
      body: (
        <>
          <p className="mx__text">This number can’t already be on WhatsApp.</p>
          <Field label="Phone number" group>
            <div className="mx__phone">
              <Select value={form.countryCode} onChange={set('countryCode')} aria-label="Country code">
                {COUNTRY_CODES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
              <input
                className="mx__input"
                inputMode="tel"
                placeholder="98765 43210"
                value={form.number}
                onChange={set('number')}
                aria-label="Phone number"
                autoFocus
              />
            </div>
          </Field>
          <fieldset className="mx__radios">
            <legend className="mx__label">Choose how to verify your number</legend>
            <Radio name="method" value="sms" checked={form.method === 'sms'} onChange={set('method')}>
              Text message
            </Radio>
            <Radio name="method" value="call" checked={form.method === 'call'} onChange={set('method')}>
              Phone call
            </Radio>
          </fieldset>
        </>
      ),
      ready: digits.length >= 6 && digits.length <= 15,
    },
    code: {
      title: 'Verify your phone number',
      body: (
        <>
          <p className="mx__text">
            Enter the 6-digit code {form.method === 'sms' ? 'we texted to' : 'we said in the call to'}{' '}
            <strong>{fullNumber}</strong>.
          </p>
          <Field label="Verification code">
            <input
              className="mx__input mx__input--code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="••••••"
              value={form.code}
              onChange={(e) => edit('code', e.target.value.replace(/\D/g, ''))}
              autoFocus
            />
          </Field>
          <p className="mx__fine">
            Didn’t get a code?{' '}
            <button type="button" className="mx__link" onClick={() => setMetaError(null)}>
              Resend
            </button>
          </p>
        </>
      ),
      ready: form.code.length === 6,
      next: 'Verify',
    },
    access: {
      title: `Review ${PLATFORM_NAME}’s access request`,
      body: (
        <>
          <p className="mx__text">{PLATFORM_NAME} is asking to:</p>
          <ul className="mx__perms">
            <li>
              <Check size={18} aria-hidden="true" />
              <span>
                <strong>Manage your WhatsApp accounts</strong>
                <span className="mx__fine">Your account “{form.accountName}” and its message templates</span>
              </span>
            </li>
            <li>
              <Check size={18} aria-hidden="true" />
              <span>
                <strong>Send messages from your WhatsApp numbers</strong>
                <span className="mx__fine">{fullNumber}</span>
              </span>
            </li>
          </ul>
        </>
      ),
      next: 'Confirm',
      ready: true,
    },
    done: {
      body: (
        <div className="mx__done">
          <span className="mx__done-icon" aria-hidden="true">
            <Check size={28} strokeWidth={3} />
          </span>
          <h1 className="mx__title">You’re all set</h1>
          <p className="mx__text">
            Your WhatsApp Business account is connected to {PLATFORM_NAME}. Click Finish to go back.
          </p>
          {alone && (
            <p className="mx__fine mx__alone">
              This window was opened on its own, so nothing was connected. Open it from Settings → WhatsApp.
            </p>
          )}
        </div>
      ),
      next: 'Finish',
      ready: true,
      noBack: true,
    },
  };

  const screen = screens[step];

  return (
    <div className="mx">
      <header className="mx__bar">
        <span className="mx__pair" aria-hidden="true">
          <span className="mx__avatar mx__avatar--app">{initials(PLATFORM_NAME)}</span>
          <span className="mx__dots" />
          <span className="mx__avatar mx__avatar--meta">Meta</span>
        </span>
        <span className="mx__progress" aria-hidden="true">
          <span style={{ width: `${(at / (STEPS.length - 1)) * 100}%` }} />
        </span>
      </header>

      <main className="mx__body">
        {screen.title && <h1 className="mx__title">{screen.title}</h1>}
        {screen.body}
        {metaError && (
          <p className="mx__error" role="alert">
            {SIGNUP_ERRORS[metaError].meta}
          </p>
        )}
      </main>

      <footer className="mx__foot">
        {!screen.noBack && at > 1 && (
          <button type="button" className="mx__btn" onClick={() => go(-1)}>
            Back
          </button>
        )}
        <button
          type="button"
          className="mx__btn mx__btn--primary"
          disabled={!screen.ready || Boolean(metaError)}
          onClick={step === 'done' ? finish : next}
        >
          {screen.next ?? 'Next'}
        </button>
      </footer>
    </div>
  );
}

// ---------- Facebook's login, first ----------
function Login({ onContinue, onCancel }) {
  return (
    <div className="mx mx--login">
      <main className="mx__login">
        <p className="mx__brand">Log in with Facebook</p>
        <span className="mx__face" aria-hidden="true">
          {initials(mockAccount.name)}
        </span>
        <h1 className="mx__title">Continue as {firstName}?</h1>
        <p className="mx__text">
          {PLATFORM_NAME} will receive your name and profile picture, and access to set up WhatsApp.
        </p>
        <button type="button" className="mx__btn mx__btn--primary mx__btn--wide" onClick={onContinue} autoFocus>
          Continue as {firstName}
        </button>
        <button type="button" className="mx__btn mx__btn--wide" onClick={onCancel}>
          Cancel
        </button>
        <p className="mx__fine">Not you? Log in to another account</p>
      </main>
    </div>
  );
}

// ---------- Small pieces, in Meta's style ----------
// group: holds more than one control (each with its own label), so it isn't one <label>
function Field({ label, help, group = false, children }) {
  const Tag = group ? 'div' : 'label';
  return (
    <Tag className="mx__field">
      <span className="mx__label">{label}</span>
      {children}
      {help && <span className="mx__fine">{help}</span>}
    </Tag>
  );
}

function Select({ children, ...props }) {
  return (
    <span className="mx__select">
      <select className="mx__input" {...props}>
        {children}
      </select>
      <ChevronDown size={16} aria-hidden="true" />
    </span>
  );
}

function Radio({ children, ...props }) {
  return (
    <label className="mx__radio">
      <input type="radio" {...props} />
      {children}
    </label>
  );
}