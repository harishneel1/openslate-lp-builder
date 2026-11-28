import { useEffect, useRef, useState } from 'react';
import { Info, Mail, Smartphone } from 'lucide-react';
import { EMAIL, INDIAN_MOBILE, fullPhone, showPhone, signIn } from '../data/students';
import CodeBoxes, { CODE_LENGTH, emptyCode } from '../components/CodeBoxes';
import { LogoFill, boxStyle } from '../components/BrandMark';
import { useStudentBrand } from '../data/branding';
import './StudentSignIn.css';

// ------------------------------------------------------------
// The academy's sign-in, laid out as TagMango's, in our light theme:
// shown in place of any academy page (Courses, a lesson) when nobody's
// signed in; once they are, that same page opens (the address never
// changes).
//
//   ┌──────────────────────────────────────┐
//   │ (HN)                                 │
//   │ Sign in with your mobile number and  │
//   │ we'll text you a one-time code.      │
//   │ MOBILE NUMBER                        │
//   │ [IN +91 | 98765 43210              ] │
//   │ ⓘ Sign in is currently available     │
//   │   only with Indian mobile numbers.   │
//   │ [            Send OTP              ] │
//   │ ─────────────── or ───────────────── │
//   │ [ ✉ Continue with email            ] │
//   └──────────────────────────────────────┘
//
// Continue with email swaps the number for an email, with "Continue with
// mobile number" to swap back. Send OTP opens the code step: six boxes
// (typing moves along, pasting fills them all, Backspace goes back),
// Change to fix the number or email, and Resend after 30 seconds.
//
// UI only: no code is sent, and any 6 digits sign them in. The devs build
// the real one.
// ------------------------------------------------------------

const RESEND_AFTER = 30;

export default function StudentSignIn() {
  const [by, setBy] = useState('phone'); // 'phone' | 'email'
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [sentTo, setSentTo] = useState(null); // where the code went; the code step when set
  // Their logo and business name (Settings → Branding), else initials and name
  const brand = useStudentBrand();

  useEffect(() => {
    document.title = `Sign in - ${brand.name}`;
  }, [brand.name]);

  const send = (e) => {
    e.preventDefault();
    if (by === 'phone') {
      const national = phone.replace(/\D/g, '');
      if (!INDIAN_MOBILE.test(national)) return setError('Enter a 10-digit Indian mobile number');
      setSentTo({ phone: national });
    } else {
      const clean = email.trim();
      if (!EMAIL.test(clean)) return setError('Enter an email address, like name@example.com');
      setSentTo({ email: clean });
    }
    setError(null);
    return undefined;
  };

  const swap = () => {
    setBy((b) => (b === 'phone' ? 'email' : 'phone'));
    setError(null);
  };

  return (
    <div className="ssi">
      <main className="ssi__card">
        <span className="ssi__logo" style={boxStyle(brand)} aria-label={brand.name} role="img">
          <LogoFill brand={brand} />
        </span>

        {sentTo ? (
          <CodeStep sentTo={sentTo} onChange={() => setSentTo(null)} />
        ) : (
          <>
            <h1 className="ssi__intro">
              {by === 'phone'
                ? 'Sign in with your mobile number and we’ll text you a one-time code.'
                : 'Sign in with your email and we’ll email you a one-time code.'}
            </h1>

            <form className="ssi__form" onSubmit={send} noValidate>
              {by === 'phone' ? (
                <>
                  <label className="ssi__label" htmlFor="ssi-phone">
                    Mobile number
                  </label>
                  <div className={`ssi__field ${error ? 'ssi__field--error' : ''}`}>
                    <span className="ssi__country" aria-hidden="true">
                      <span className="ssi__flag">IN</span> +91
                    </span>
                    <input
                      id="ssi-phone"
                      className="ssi__input"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      placeholder="98765 43210"
                      maxLength={14}
                      value={phone}
                      autoFocus
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? 'ssi-error' : 'ssi-note'}
                      onChange={(e) => {
                        setPhone(e.target.value.replace(/[^\d ]/g, ''));
                        setError(null);
                      }}
                    />
                  </div>
                </>
              ) : (
                <>
                  <label className="ssi__label" htmlFor="ssi-email">
                    Email
                  </label>
                  <div className={`ssi__field ${error ? 'ssi__field--error' : ''}`}>
                    <input
                      id="ssi-email"
                      className="ssi__input"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="name@example.com"
                      value={email}
                      autoFocus
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? 'ssi-error' : undefined}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setError(null);
                      }}
                    />
                  </div>
                </>
              )}

              {error ? (
                <p id="ssi-error" className="ssi__error" role="alert">
                  {error}
                </p>
              ) : (
                by === 'phone' && (
                  <p id="ssi-note" className="ssi__note">
                    <Info size={17} aria-hidden="true" />
                    Sign in is currently available only with Indian mobile numbers.
                  </p>
                )
              )}

              <button type="submit" className="ssi__btn">
                Send OTP
              </button>
            </form>

            <p className="ssi__or">
              <span>or</span>
            </p>

            <button type="button" className="ssi__btn ssi__btn--outline" onClick={swap}>
              {by === 'phone' ? <Mail size={19} aria-hidden="true" /> : <Smartphone size={19} aria-hidden="true" />}
              {by === 'phone' ? 'Continue with email' : 'Continue with mobile number'}
            </button>
          </>
        )}
      </main>

      <p className="ssi__foot">
        © {new Date().getFullYear()} {brand.name}. All rights reserved.
      </p>
    </div>
  );
}

// The code step: six boxes, Verify, Change, Resend
function CodeStep({ sentTo, onChange }) {
  const [code, setCode] = useState(emptyCode);
  const [error, setError] = useState(null);
  const [left, setLeft] = useState(RESEND_AFTER);
  const [resent, setResent] = useState(false);
  const boxes = useRef(null);
  const where = sentTo.phone ? showPhone(fullPhone(sentTo.phone)) : sentTo.email;

  useEffect(() => {
    boxes.current?.focus();
  }, []);

  useEffect(() => {
    if (left <= 0) return undefined;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  const verify = (e) => {
    e.preventDefault();
    if (code.join('').length < CODE_LENGTH) {
      setError('Enter the 6-digit code');
      boxes.current?.focus();
      return;
    }
    signIn(sentTo);
  };

  const resend = () => {
    setCode(emptyCode());
    setLeft(RESEND_AFTER);
    setResent(true);
    setError(null);
    boxes.current?.focus();
  };

  return (
    <>
      <h1 className="ssi__intro">Enter the 6-digit code</h1>
      <p className="ssi__sent">
        We sent it to <strong>{where}</strong>.{' '}
        <button type="button" className="ssi__link" onClick={onChange}>
          Change
        </button>
      </p>

      <form className="ssi__form" onSubmit={verify} noValidate>
        <CodeBoxes
          ref={boxes}
          value={code}
          invalid={Boolean(error)}
          onChange={(next) => {
            setCode(next);
            setError(null);
          }}
        />

        {error && (
          <p className="ssi__error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="ssi__btn">
          Verify and sign in
        </button>
      </form>

      <p className="ssi__resend" aria-live="polite">
        {left > 0 ? (
          <>
            {resent ? 'New code sent. ' : ''}Didn’t get it? Resend in 0:{String(left).padStart(2, '0')}
          </>
        ) : (
          <>
            Didn’t get it?{' '}
            <button type="button" className="ssi__link" onClick={resend}>
              Resend code
            </button>
          </>
        )}
      </p>
    </>
  );
}