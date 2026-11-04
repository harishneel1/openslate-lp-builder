import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, Check, Clock, Lock, Video } from 'lucide-react';
import {
  classDay,
  classTime,
  dayOn,
  feeLine,
  getBatch,
  nextClasses,
  scheduleLine,
} from '../data/batches';
import { zoneShort } from '../components/BatchFields';
import { addMember, memberByEmail, nextRenewal, renewalDayLine, shortDate } from '../data/batchMembers';
import { contractOf, getService } from '../data/mockServices';
import { formatMoney } from '../data/contractPricing';
import { COUNTRY_CODES } from '../data/checkoutRules';
import { ANSWER_MAX, answersFor, checkAnswers, emptyAnswer } from '../data/callQuestions';
import { mockAccount } from '../data/myPage';
import { todayIn } from '../utils/slots';
import '../styles/storeTheme.css';
import './BatchPage.css';

// ------------------------------------------------------------
// A batch's page for students: what it is, when it meets, and joining.
// Opened from its link, /<account link>/<batch id>, or at
// ?mock=batch&batch=<id> (see main.jsx).
//
//   Morning Yoga                            ┌ Join this batch ─────────┐
//   by Harish Neel                          │ Name / Email / Phone     │
//   📅 Mon–Sat   🕖 6:30–7:30 am IST         │ Any injuries…?           │
//   🎥 Live on Zoom                          │ ₹2,000 today             │
//   (description)                           │ Then ₹2,000 every month  │
//   Next classes: Tomorrow 6:30 am, …       │ on the 14th, until you   │
//                                           │ cancel.                  │
//                                           │ [Pay ₹2,000]             │
//                                           └──────────────────────────┘
//
// Paying makes them a member: they hold the batch's contract from today,
// paid up to the same date next month (addMember in batchMembers.js).
// Then "You're in": their first class, when they renew, and where their
// classes will be. Students join classes from their feed when they log
// in, so there's no class link here or in any email; the button is the
// contract's after-payment button ("Login now", to the coach's site).
//
// A mock payment, as on the 1:1 checkout: no card details, no failure.
// The real product uses the existing checkout and sets up the monthly
// charge from there.
// ------------------------------------------------------------

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function checkPerson(form) {
  const digits = form.phone.replace(/\D/g, '');
  return {
    name: form.name.trim() ? null : 'Enter your name',
    email: !form.email.trim()
      ? 'Enter your email address'
      : EMAIL.test(form.email.trim())
        ? null
        : 'Enter an email address like name@example.com',
    phone: !digits ? 'Enter your phone number' : digits.length < 6 || digits.length > 15 ? 'Enter a valid phone number' : null,
  };
}

export default function BatchPage({ batchId }) {
  const [batch] = useState(() => getBatch(batchId));
  const contract = useMemo(() => {
    const c = batch?.contractId ? getService(batch.contractId) : null;
    return c ? contractOf(c) : null;
  }, [batch]);

  const [form, setForm] = useState({ name: '', email: '', code: '+91', phone: '' });
  const questions = batch?.questions ?? [];
  const [answers, setAnswers] = useState(() => Object.fromEntries(questions.map((q) => [q.id, emptyAnswer(q)])));
  const [tried, setTried] = useState(false);
  const [joined, setJoined] = useState(null); // the member, once paid
  const [already, setAlready] = useState(null); // already a member, by email
  const [failed, setFailed] = useState(false);
  const now = useMemo(() => Date.now(), []);

  useEffect(() => {
    document.title = batch ? `Join ${batch.title}` : 'Batch not found';
  }, [batch]);

  if (!batch) {
    return (
      <div className="store-theme bp bp--center">
        <div className="bp__message">
          <h1 className="bp__message-title">This batch isn’t here</h1>
          <p className="bp__message-text">The link may be old, or the batch was closed. Ask the coach for a new link.</p>
        </div>
      </div>
    );
  }

  const zone = zoneShort(batch.timeZone);
  const classes = nextClasses(batch, now, 3);
  const today = dayOn(now, batch);
  const startsOn = todayIn(batch.timeZone, now);
  const renews = nextRenewal(startsOn);
  const fee = formatMoney(batch.price, 'INR');
  const paragraphs = String(batch.description ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const personErrors = checkPerson(form);
  const answerErrors = checkAnswers(questions, answers);
  const hasErrors = Object.values(personErrors).some(Boolean) || Object.values(answerErrors).some(Boolean);
  const errorOf = (id) => (tried ? (personErrors[id] ?? answerErrors[id] ?? null) : null);

  const pay = () => {
    setTried(true);
    setAlready(null);
    if (hasErrors) {
      requestAnimationFrame(() => document.querySelector('.bp [aria-invalid="true"]')?.focus());
      return;
    }
    const existing = memberByEmail(batch.id, form.email);
    if (existing) {
      setAlready(existing);
      return;
    }
    const member = addMember(batch, {
      name: form.name,
      email: form.email,
      phone: { code: form.code, number: form.phone.trim() },
      answers: answersFor(questions, answers),
    });
    if (!member) {
      setFailed(true);
      return;
    }
    setJoined(member);
    window.scrollTo(0, 0);
  };

  if (joined) {
    const first = classes.find((c) => c.start > Date.now()) ?? classes[0];
    const button = contract?.success ?? { buttonLabel: 'Log in', buttonUrl: `https://${mockAccount.domain}` };
    return (
      <div className="store-theme bp bp--center">
        <div className="bp__done">
          <span className="bp__done-tick" aria-hidden="true">
            <Check size={26} strokeWidth={3} />
          </span>
          <h1 className="bp__done-title">You’re in, {joined.name.split(/\s+/)[0]}</h1>
          <p className="bp__done-text">
            Welcome to {batch.title} with {mockAccount.name}.
          </p>

          <dl className="bp__done-facts">
            {first && (
              <div>
                <dt>Your first class</dt>
                <dd>
                  {classDay(first.date, today)}, {classTime(first, batch)} {zone}
                </dd>
              </div>
            )}
            <div>
              <dt>Classes</dt>
              <dd>
                {scheduleLine(batch)} {zone}, live on Zoom
              </dd>
            </div>
            <div>
              <dt>Paid</dt>
              <dd>
                {fee} for {shortDate(startsOn)} to {shortDate(joined.renewsOn)}
              </dd>
            </div>
            <div>
              <dt>Next payment</dt>
              <dd>
                {fee} on {shortDate(joined.renewsOn)}
              </dd>
            </div>
          </dl>

          <p className="bp__done-where">
            Log in to {mockAccount.domain} to join your classes. Each class shows at the top of your feed, ready to join a
            few minutes before it starts. We’ve emailed your receipt to {joined.email}.
          </p>

          {button.buttonUrl && (
            <a className="bp__pay bp__done-btn" href={button.buttonUrl} target="_blank" rel="noopener noreferrer">
              {button.buttonLabel || 'Log in'} <ArrowRight size={16} aria-hidden="true" />
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="store-theme bp">
      <div className="bp__layout">
        <section className="bp__about" aria-labelledby="bp-title">
          {contract?.cover && <img className="bp__cover" src={contract.cover} alt="" />}
          <h1 className="bp__title" id="bp-title">
            {batch.title}
          </h1>
          <p className="bp__by">by {mockAccount.name}</p>

          <ul className="bp__facts">
            <li>
              <CalendarDays size={18} aria-hidden="true" /> {scheduleLine(batch).split(' · ')[0]}
            </li>
            <li>
              <Clock size={18} aria-hidden="true" /> {scheduleLine(batch).split(' · ')[1]} {zone}
            </li>
            <li>
              <Video size={18} aria-hidden="true" /> Live on Zoom
            </li>
          </ul>

          {paragraphs.length > 0 && (
            <div className="bp__description">
              {paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          )}

          {classes.length > 0 && (
            <div className="bp__next">
              <h2 className="pf__section-title bp__next-title">Next classes</h2>
              <ul className="bp__next-list">
                {classes.map((c) => (
                  <li key={c.start}>
                    <span>{classDay(c.date, today)}</span>
                    <span className="bp__muted">
                      {classTime(c, batch)} {zone}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="bp__join" aria-labelledby="bp-join-title">
          <h2 className="bp__join-title" id="bp-join-title">
            Join this batch
          </h2>

          <Field id="name" label="Name" error={errorOf('name')}>
            <input
              id="bp-name"
              className="bp__input"
              autoComplete="name"
              value={form.name}
              aria-invalid={Boolean(errorOf('name'))}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field id="email" label="Email" error={errorOf('email')}>
            <input
              id="bp-email"
              className="bp__input"
              type="email"
              autoComplete="email"
              value={form.email}
              aria-invalid={Boolean(errorOf('email'))}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field id="phone" label="Phone" error={errorOf('phone')}>
            <span className="bp__phone">
              <select
                className="bp__input bp__code"
                value={form.code}
                aria-label="Country code"
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} {c.name}
                  </option>
                ))}
              </select>
              <input
                id="bp-phone"
                className="bp__input"
                inputMode="tel"
                autoComplete="tel-national"
                value={form.phone}
                aria-invalid={Boolean(errorOf('phone'))}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </span>
          </Field>

          {questions.map((q) => (
            <Answer
              key={q.id}
              q={q}
              value={answers[q.id]}
              error={errorOf(q.id)}
              onChange={(v) => setAnswers({ ...answers, [q.id]: v })}
            />
          ))}

          <div className="bp__price">
            <p className="bp__price-row">
              <span>Today</span>
              <strong>{fee}</strong>
            </p>
            <p className="bp__price-note">
              Then {feeLine(batch).replace('/month', '')} every month on the {renewalDayLine(startsOn)}, starting{' '}
              {shortDate(renews)}, until you cancel.
            </p>
          </div>

          {already && (
            <p className="bp__notice" role="alert">
              {already.email} is already in this batch. Log in to {mockAccount.domain} to join your classes.
            </p>
          )}
          {failed && (
            <p className="bp__error" role="alert">
              We couldn’t finish joining. You haven’t been charged. Try again.
            </p>
          )}

          <button type="button" className="bp__pay" onClick={pay}>
            <Lock size={16} aria-hidden="true" /> Pay {fee}
          </button>
          <p className="bp__secure">A preview: no money is taken.</p>
        </section>
      </div>
    </div>
  );
}

function Field({ id, label, error, children }) {
  return (
    <div className="bp__field">
      <label className="bp__label" htmlFor={`bp-${id}`}>
        {label} <span className="bp__req" aria-hidden="true">*</span>
      </label>
      {children}
      {error && (
        <span className="bp__error" id={`bp-${id}-error`}>
          {error}
        </span>
      )}
    </div>
  );
}

// One of the batch's questions (callQuestions.js types)
function Answer({ q, value, error, onChange }) {
  const id = `bp-${q.id}`;
  const label = (
    <>
      {q.text} {q.required ? <span className="bp__req" aria-hidden="true">*</span> : <span className="bp__muted">(optional)</span>}
    </>
  );

  if (q.type === 'choice' || q.type === 'multi') {
    const multi = q.type === 'multi';
    return (
      <fieldset className="bp__field bp__set">
        <legend className="bp__label">{label}</legend>
        {q.options.map((o) => {
          const on = multi ? (value ?? []).includes(o) : value === o;
          return (
            <label key={o} className="bp__option">
              <input
                type={multi ? 'checkbox' : 'radio'}
                name={id}
                checked={on}
                onChange={() =>
                  onChange(multi ? (on ? value.filter((x) => x !== o) : [...(value ?? []), o]) : o)
                }
              />
              {o}
            </label>
          );
        })}
        {error && <span className="bp__error">{error}</span>}
      </fieldset>
    );
  }

  return (
    <div className="bp__field">
      <label className="bp__label" htmlFor={id}>
        {label}
      </label>
      {q.type === 'long' ? (
        <textarea
          id={id}
          className="bp__input bp__input--long"
          rows={3}
          maxLength={ANSWER_MAX.long}
          value={value ?? ''}
          aria-invalid={Boolean(error)}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : q.type === 'dropdown' ? (
        <select id={id} className="bp__input" value={value ?? ''} aria-invalid={Boolean(error)} onChange={(e) => onChange(e.target.value)}>
          <option value="">Choose one</option>
          {q.options.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      ) : q.type === 'phone' ? (
        <span className="bp__phone">
          <select
            className="bp__input bp__code"
            value={value?.code ?? '+91'}
            aria-label="Country code"
            onChange={(e) => onChange({ ...value, code: e.target.value })}
          >
            {COUNTRY_CODES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} {c.name}
              </option>
            ))}
          </select>
          <input
            id={id}
            className="bp__input"
            inputMode="tel"
            value={value?.number ?? ''}
            aria-invalid={Boolean(error)}
            onChange={(e) => onChange({ ...value, number: e.target.value })}
          />
        </span>
      ) : (
        <input
          id={id}
          className="bp__input"
          maxLength={ANSWER_MAX.short}
          value={value ?? ''}
          aria-invalid={Boolean(error)}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {error && <span className="bp__error">{error}</span>}
    </div>
  );
}