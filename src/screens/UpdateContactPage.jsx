import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, CircleHelp, Info, Mail, Smartphone } from 'lucide-react';
import { academyCoursesPath } from '../data/courses';
import { mockAccount } from '../data/myPage';
import {
  EMAIL,
  INDIAN_MOBILE,
  accountPath,
  fullPhone,
  showPhone,
  updateStudent,
  usedByOther,
} from '../data/students';
import AcademyTop from '../components/AcademyTop';
import CodeBoxes, { CODE_LENGTH, emptyCode } from '../components/CodeBoxes';
import './StudentSignIn.css';
import './AccountPage.css';

// ------------------------------------------------------------
// Update number/email: /web/account/change-number-email. From the
// student's menu, and My account. TagMango's, in Cloud Storage's look:
//
//   ← Back to account
//   Update number/email
//   ┌───────────────────────────────────────┐  ┌──────────────────────┐
//   │ [📱] Mobile number                     │  │ [?]                  │
//   │      +91 98765 43210        [Change]   │  │ Update number/email  │
//   ├───────────────────────────────────────┤  │ A one-time code      │
//   │ [✉] Email                              │  │ confirms every       │
//   │      priya@example.com      [Change]   │  │ change. Your courses │
//   └───────────────────────────────────────┘  │ stay with you.       │
//                                              └──────────────────────┘
//
// Change opens that row: the new number (+91, Indian only, as sign-in) or
// email, then Send OTP and Cancel. Send OTP asks for the code sent to the
// NEW one: six boxes, Verify, Cancel, Resend after 30 seconds. Verified,
// the row shows the new one, with "Number updated" or "Email updated".
// One row at a time: opening one closes the other.
// No email yet (they signed in with their number and never gave one):
// "Not added", and Add instead of Change.
//
// Refused: the same as now, or one another student uses.
// Their courses stay: the old number or email is kept with them
// (students.js), so sign-ups made with it still count.
// UI only: no code is sent, and any 6 digits work.
//
// student: who's signed in
// ------------------------------------------------------------

const RESEND_AFTER = 30;

export default function UpdateContactPage({ student }) {
  const [open, setOpen] = useState(null); // 'phone' | 'email' | null
  const [done, setDone] = useState(null); // 'phone' | 'email': just updated

  useEffect(() => {
    document.title = `Update number/email - ${mockAccount.name}`;
  }, []);

  const start = (kind) => {
    setOpen(kind);
    setDone(null);
  };

  return (
    <div className="acd acc">
      <AcademyTop student={student} home={academyCoursesPath} onCourses={false} />

      <main className="acc__main">
        <a className="acc__back" href={accountPath}>
          <ArrowLeft size={16} aria-hidden="true" /> Back to account
        </a>
        <h1 className="acc__title">Update number/email</h1>

        <div className="acc-split">
          <section className="acc-panel acc-contacts" aria-label="Your number and email">
            <ContactRow
              kind="phone"
              student={student}
              open={open === 'phone'}
              updated={done === 'phone'}
              onOpen={() => start('phone')}
              onClose={() => setOpen(null)}
              onDone={() => {
                setOpen(null);
                setDone('phone');
              }}
            />
            <ContactRow
              kind="email"
              student={student}
              open={open === 'email'}
              updated={done === 'email'}
              onOpen={() => start('email')}
              onClose={() => setOpen(null)}
              onDone={() => {
                setOpen(null);
                setDone('email');
              }}
            />
          </section>

          <aside className="acc-panel acc-help">
            <span className="acc-tile acc-tile--grey" aria-hidden="true">
              <CircleHelp size={20} />
            </span>
            <h2 className="acc-help__title">Update number/email</h2>
            <p className="acc-help__text">
              Change the number or email you sign in with. A one-time code confirms every change. Your courses stay
              with you.
            </p>
          </aside>
        </div>
      </main>
    </div>
  );
}

const WORDS = {
  phone: { label: 'Mobile number', thing: 'number', Icon: Smartphone, done: 'Number updated.' },
  email: { label: 'Email', thing: 'email', Icon: Mail, done: 'Email updated.' },
};

// One row: what they have now and Change; opened, the new one, then its code
function ContactRow({ kind, student, open, updated, onOpen, onClose, onDone }) {
  const { label, Icon, done: doneText } = WORDS[kind];
  const now = kind === 'phone' ? showPhone(student.phone) : student.email;
  const [draft, setDraft] = useState('');
  const [error, setError] = useState(null);
  const [sentTo, setSentTo] = useState(null); // the new one, once the code's "sent"
  const field = useRef(null);
  const changeButton = useRef(null);
  const id = `acc-${kind}`;

  // Opening starts fresh, with the box focused
  useEffect(() => {
    if (!open) return;
    setDraft('');
    setError(null);
    setSentTo(null);
    requestAnimationFrame(() => field.current?.focus());
  }, [open]);

  const close = () => {
    onClose();
    requestAnimationFrame(() => changeButton.current?.focus());
  };

  const send = (e) => {
    e.preventDefault();
    let value;
    if (kind === 'phone') {
      const national = draft.replace(/\D/g, '');
      if (!INDIAN_MOBILE.test(national)) return setError('Enter a 10-digit Indian mobile number');
      if (fullPhone(national) === student.phone) return setError('That’s already your number');
      if (usedByOther(student.id, { phone: national })) return setError('Another account uses this number');
      value = national;
    } else {
      const clean = draft.trim().toLowerCase();
      if (!EMAIL.test(clean)) return setError('Enter an email address, like name@example.com');
      if (clean === student.email) return setError('That’s already your email');
      if (usedByOther(student.id, { email: clean })) return setError('Another account uses this email');
      value = clean;
    }
    setError(null);
    setSentTo(value);
    return undefined;
  };

  return (
    <div className={`acc-contact ${open ? 'acc-contact--open' : ''}`}>
      <div className="acc-contact__head">
        <span className="acc-tile" aria-hidden="true">
          <Icon size={20} />
        </span>
        <div className="acc-row__text">
          <span className="acc-row__name">{label}</span>
          <span className={`acc-row__detail ${now ? '' : 'acc-row__detail--none'}`}>{now || 'Not added'}</span>
          {updated && (
            <span className="acc-contact__done" role="status">
              {doneText}
            </span>
          )}
        </div>
        {!open && (
          <button ref={changeButton} type="button" className="acc-btn" onClick={onOpen}>
            {now ? 'Change' : 'Add'}
          </button>
        )}
      </div>

      {open && !sentTo && (
        <form className="acc-contact__form" onSubmit={send} noValidate>
          <label className="acc-field__label" htmlFor={id}>
            {now ? `New ${WORDS[kind].thing}` : label}
          </label>
          <div className={`acc-field ${error ? 'acc-field--error' : ''}`}>
            {kind === 'phone' && (
              <span className="acc-field__prefix" aria-hidden="true">
                +91
              </span>
            )}
            <input
              ref={field}
              id={id}
              className="acc-field__input"
              type={kind === 'phone' ? 'tel' : 'email'}
              inputMode={kind === 'phone' ? 'numeric' : 'email'}
              autoComplete={kind === 'phone' ? 'tel-national' : 'email'}
              placeholder={kind === 'phone' ? '98765 43210' : 'name@example.com'}
              maxLength={kind === 'phone' ? 14 : 254}
              value={draft}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `${id}-error` : kind === 'phone' ? `${id}-note` : undefined}
              onChange={(e) => {
                setDraft(kind === 'phone' ? e.target.value.replace(/[^\d ]/g, '') : e.target.value);
                setError(null);
              }}
            />
          </div>
          {error ? (
            <p id={`${id}-error`} className="acc-field__error" role="alert">
              {error}
            </p>
          ) : (
            kind === 'phone' && (
              <p id={`${id}-note`} className="acc-field__note">
                <Info size={15} aria-hidden="true" />
                Only Indian mobile numbers can be used for now.
              </p>
            )
          )}
          <div className="acc-contact__actions">
            <button type="submit" className="acc-btn acc-btn--primary">
              Send OTP
            </button>
            <button type="button" className="acc-btn acc-btn--quiet" onClick={close}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {open && sentTo && (
        <CodeForm
          kind={kind}
          sentTo={sentTo}
          onBack={() => setSentTo(null)}
          onCancel={close}
          onVerified={() => {
            const { error: failed } = updateStudent(student.id, { [kind]: sentTo });
            if (failed) return failed;
            onDone();
            requestAnimationFrame(() => changeButton.current?.focus());
            return null;
          }}
        />
      )}
    </div>
  );
}

// The code sent to the new number or email
function CodeForm({ kind, sentTo, onBack, onCancel, onVerified }) {
  const [code, setCode] = useState(emptyCode);
  const [error, setError] = useState(null);
  const [left, setLeft] = useState(RESEND_AFTER);
  const boxes = useRef(null);
  const where = kind === 'phone' ? showPhone(fullPhone(sentTo)) : sentTo;

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
    const failed = onVerified();
    if (failed) setError(failed);
  };

  return (
    <form className="acc-contact__form" onSubmit={verify} noValidate>
      <p className="acc-contact__sent">
        Enter the 6-digit code we sent to <strong>{where}</strong>.{' '}
        <button type="button" className="ssi__link" onClick={onBack}>
          Change
        </button>
      </p>
      <div className="acc-contact__code">
        <CodeBoxes
          ref={boxes}
          value={code}
          invalid={Boolean(error)}
          onChange={(next) => {
            setCode(next);
            setError(null);
          }}
        />
      </div>
      {error && (
        <p className="acc-field__error" role="alert">
          {error}
        </p>
      )}
      <div className="acc-contact__actions">
        <button type="submit" className="acc-btn acc-btn--primary">
          Verify
        </button>
        <button type="button" className="acc-btn acc-btn--quiet" onClick={onCancel}>
          Cancel
        </button>
        <span className="acc-contact__resend" aria-live="polite">
          {left > 0 ? (
            `Resend in 0:${String(left).padStart(2, '0')}`
          ) : (
            <button
              type="button"
              className="ssi__link"
              onClick={() => {
                setCode(emptyCode());
                setLeft(RESEND_AFTER);
                setError(null);
                boxes.current?.focus();
              }}
            >
              Resend code
            </button>
          )}
        </span>
      </div>
    </form>
  );
}