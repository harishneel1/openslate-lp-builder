import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarClock, ChevronDown, Clock, Eye, Lock, Phone, Video } from 'lucide-react';
import { buildCheckoutJson } from '../data/buildCheckoutJson';
import { matchZone } from '../data/timeZones';
import { COUNTRY_CODES, COUPONS, GSTIN, HOLD_SECONDS, INDIAN_STATES, PAYMENT_METHODS, breakdown, money } from '../data/checkoutRules';
import '../styles/storeTheme.css';
import './CheckoutPage.css';
import { getMyProfile, isMyCall, myMeetingLink, profileHrefFor } from '../data/myProfile';
import { createBooking } from '../data/bookingsStore';
import { ANSWER_MAX, EXAMPLE_QUESTIONS, answersFor, checkAnswers, emptyAnswer } from '../data/callQuestions';

// ------------------------------------------------------------
// Mock checkout, laid out like the product's real checkout:
// what they're buying on the left, their details and the money
// on the right. For a call, it adds the session (with a hold
// timer), the time in the order summary, and the call's booking
// questions (set in Edit service, see callQuestions.js). Courses and other products would show none of those.
//
// ?mock=checkout&service=<id>&time=<UTC instant>&tz=<zone>
//   &taken=1   the time was taken before they got here
//   &hold=20   hold for 20 seconds instead of 10 minutes, to see it run out
//   &fail=1    the first payment attempt fails, to see the try-again state
// Paying goes to ?mock=booked (the confirmation page). For the creator's
// own calls it first checks the time is still free and saves the booking
// (bookingsStore.js), with the link people use to join their video calls.
// ------------------------------------------------------------

const ICONS = { clock: Clock, phone: Phone, video: Video };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Each check returns the message to show, or null if the field is fine
function check(form) {
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

// required: a red asterisk after the label; optional: "(optional)" after it
function Field({ id, label, hint, error, required, optional, children }) {
  return (
    <div className={error ? 'co-field co-field--error' : 'co-field'}>
      <label className="co-field__label" htmlFor={id}>
        {label}
        {required && (
          <span className="co-field__req" aria-hidden="true">
            {' '}*
          </span>
        )}
        {optional && <span className="co-field__opt"> (optional)</span>}
      </label>
      {hint && (
        <p className="co-field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p className="co-field__error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

// aria props that tie an input to its hint and error
const describe = (id, hasHint, error, required = true) => ({
  'aria-required': required || undefined,
  'aria-invalid': error ? true : undefined,
  'aria-describedby': [hasHint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined,
});

// One of the call's booking questions (callQuestions.js), in the form
// that fits its type:
//   short / long   a line, or a box for a few sentences
//   choice         one radio per option
//   multi          one checkbox per option
//   dropdown       a menu, starting on "Choose one"
//   phone          a country code and a number, like the phone field above
// The first input's id is co-q-<id>, so a missed one gets the focus on submit.
function QuestionField({ q, value, error, onChange }) {
  const id = `co-q-${q.id}`;
  const aria = describe(id, false, error, q.required);

  // Single choice and checkboxes: a group of options under the question
  if (q.type === 'choice' || q.type === 'multi') {
    const multi = q.type === 'multi';
    const picked = (option) => (multi ? value.includes(option) : value === option);
    const toggle = (option) =>
      multi
        ? onChange(value.includes(option) ? value.filter((o) => o !== option) : [...value, option])
        : onChange(option);
    return (
      <fieldset
        className={error ? 'co-field co-field--error co-choice' : 'co-field co-choice'}
        aria-describedby={error ? `${id}-error` : undefined}
      >
        <legend className="co-field__label">
          {q.text}
          <Marker required={q.required} />
        </legend>
        {multi && <p className="co-field__hint co-choice__hint">Choose all that apply.</p>}
        <div
          className="co-choice__list"
          role={multi ? 'group' : 'radiogroup'}
          aria-required={!multi && q.required ? true : undefined}
        >
          {q.options.map((option, i) => (
            <label key={option} className={picked(option) ? 'co-choice__option co-choice__option--on' : 'co-choice__option'}>
              <input
                type={multi ? 'checkbox' : 'radio'}
                name={id}
                id={i === 0 ? id : undefined} // the first gets the focus when it's missed
                value={option}
                checked={picked(option)}
                onChange={() => toggle(option)}
                aria-invalid={error ? true : undefined}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
        {error && (
          <p className="co-field__error" id={`${id}-error`}>
            {error}
          </p>
        )}
      </fieldset>
    );
  }

  return (
    <Field id={id} label={q.text} required={q.required} optional={!q.required} error={error}>
      {q.type === 'dropdown' ? (
        <select id={id} className="co-input co-select" value={value} onChange={(e) => onChange(e.target.value)} {...aria}>
          <option value="">Choose one</option>
          {q.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : q.type === 'phone' ? (
        <div className="co-phone">
          <select
            className="co-input co-select co-phone__code"
            aria-label={`Country code for ${q.text}`}
            value={value.code}
            onChange={(e) => onChange({ ...value, code: e.target.value })}
          >
            {COUNTRY_CODES.map((c) => (
              <option key={c.code} value={c.code} title={c.name}>
                {c.code}
              </option>
            ))}
          </select>
          <input
            id={id}
            className="co-input"
            type="tel"
            inputMode="tel"
            value={value.number}
            onChange={(e) => onChange({ ...value, number: e.target.value })}
            {...aria}
          />
        </div>
      ) : q.type === 'long' ? (
        <textarea
          id={id}
          className="co-input co-input--area"
          rows={3}
          maxLength={ANSWER_MAX.long}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          {...aria}
        />
      ) : (
        <input
          id={id}
          className="co-input"
          type="text"
          maxLength={ANSWER_MAX.short}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          {...aria}
        />
      )}
    </Field>
  );
}

// After a question's text: a red * when it's required, "(optional)" when it isn't
function Marker({ required }) {
  return required ? (
    <span className="co-field__req" aria-hidden="true">
      {' '}*
    </span>
  ) : (
    <span className="co-field__opt"> (optional)</span>
  );
}

// 600 → '10 minutes', 60 → '1 minute', 20 → '20 seconds'
function duration(seconds) {
  if (seconds < 60) return `${seconds} ${seconds === 1 ? 'second' : 'seconds'}`;
  const m = Math.round(seconds / 60);
  return `${m} ${m === 1 ? 'minute' : 'minutes'}`;
}

// 583 → '9:43'
const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// preview=1: the creator previewing their service. No time, no session box,
// no hold, and nothing can be booked from it.
// exampleQuestions: show EXAMPLE_QUESTIONS instead of the call's own
// (&questions=example), for the preview beside the questions step.
export default function CheckoutPage({ serviceId, time, state, slots, timeZone, taken, hold, fail, preview, exampleQuestions = false }) {
  const previewing = preview === '1';
  const zone = matchZone(timeZone) ?? matchZone(Intl.DateTimeFormat().resolvedOptions().timeZone) ?? 'Asia/Kolkata';
  const page = useMemo(
    () => buildCheckoutJson({ serviceId, time, profileState: state, slotsState: slots, timeZone: zone, taken: taken === '1', preview: previewing }),
    [serviceId, time, state, slots, zone, taken, previewing],
  );
  const { status, creator, service, slot } = page;
  const questions = exampleQuestions ? EXAMPLE_QUESTIONS : (page.questions ?? []);

  const [form, setForm] = useState({ name: '', email: '', code: '+91', phone: '' });
  const [replies, setReplies] = useState({}); // their answers to the call's questions, by question id
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [payFailed, setPayFailed] = useState(false); // the last payment attempt didn't go through
  const [lost, setLost] = useState(false); // the time was taken while they were filling in the form
  const failedOnce = useRef(false); // &fail=1 fails only the first attempt
  const [couponOpen, setCouponOpen] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [coupon, setCoupon] = useState(null); // { code, percent } once applied
  const [couponError, setCouponError] = useState(null);
  // Business GST details, for a tax invoice in their company's name
  const [gstOpen, setGstOpen] = useState(false);
  const EMPTY_GST = { gstin: '', business: '', address: '', state: '' };
  const [gstDraft, setGstDraft] = useState(EMPTY_GST);
  const [gst, setGst] = useState(null); // { gstin, business, address, state } once saved
  const [gstErrors, setGstErrors] = useState({});
  const formRef = useRef(null);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  // ---------- The hold: counts down while they're on the page ----------
  const holdFor = Number(hold) > 0 ? Number(hold) : HOLD_SECONDS;
  const [left, setLeft] = useState(holdFor);
  useEffect(() => {
    if (status !== 'ok' || busy || previewing) return undefined;
    const id = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [status, busy]);

  const stateParam = state ? `&state=${encodeURIComponent(state)}` : '';
  const bookingHref = `?mock=book&service=${encodeURIComponent(serviceId ?? '')}&tz=${encodeURIComponent(zone)}${stateParam}`;
  const profileHref = profileHrefFor(serviceId, stateParam); // their own page, or Meera's

  useEffect(() => {
    document.title = service ? `Book ${service.title} with ${creator.name}` : creator.name;
  }, [service, creator.name]);

  const set = (key) => (e) => {
    const { value } = e.target;
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((errs) => ({ ...errs, [key]: null })); // fixed: the message goes
  };

  // An answer to one of the call's questions
  const reply = (id) => (value) => {
    setReplies((r) => ({ ...r, [id]: value }));
    if (errors[`q-${id}`]) setErrors((errs) => ({ ...errs, [`q-${id}`]: null }));
  };

  const applyCoupon = () => {
    const code = couponCode.trim().toUpperCase();
    if (!code) return setCouponError('Enter a coupon code');
    if (!COUPONS[code]) return setCouponError(`${code} isn't a valid coupon`);
    setCoupon({ code, percent: COUPONS[code] });
    setCouponError(null);
  };

  const saveGst = () => {
    const gstin = gstDraft.gstin.replace(/\s/g, '').toUpperCase();
    const business = gstDraft.business.trim();
    const address = gstDraft.address.trim();
    const { state: gstState } = gstDraft;
    const found = {
      gstin: !gstin ? 'Enter your GSTIN' : GSTIN.test(gstin) ? null : 'Enter a 15-character GSTIN, like 33ABCDE1234F1Z5',
      business: business ? null : 'Enter the name on your GST registration',
      address: address ? null : 'Enter the address on your GST registration',
      state: gstState ? null : 'Choose the state of your GST registration',
    };
    setGstErrors(found);
    if (Object.values(found).some(Boolean)) return;
    setGst({ gstin, business, address, state: gstState });
    setGstOpen(false);
  };

  // ---------- Pages instead of the form ----------
  const notice = (title, text, href, label) => (
    <div className="co store-theme">
      <main className="co__notice">
        <span className="co__notice-icon" aria-hidden="true">
          <CalendarClock size={26} />
        </span>
        <h1 className="co__notice-title">{title}</h1>
        <p className="co__notice-text">{text}</p>
        <a className="co__notice-btn" href={href}>
          {label}
        </a>
      </main>
    </div>
  );

  if (status === 'missing') {
    return notice(
      "This call isn't available",
      'It may have been removed, or the link may be wrong.',
      profileHref,
      `See ${creator.firstName}'s other services`,
    );
  }
  if (status === 'taken' || lost) {
    return notice(
      'That time is no longer available',
      `Someone may have booked it while you were choosing. Pick another time for your ${service.title.toLowerCase()} with ${creator.firstName}.`,
      bookingHref,
      'Pick another time',
    );
  }
  if (left === 0 && !busy && !previewing) {
    return notice(
      'Your hold on this time has ended',
      `We held ${slot.weekday} ${slot.day} ${slot.month}, ${slot.time} for you for ${duration(holdFor)}. It may still be free: pick it again to carry on.`,
      bookingHref,
      'Pick a time again',
    );
  }

  // ---------- The money ----------
  const { price } = service;
  const sums = breakdown(price.amount, coupon?.percent ?? 0);
  const payLabel = price.isFree ? 'Confirm booking' : `Pay ${money(sums.total)}`;

  const submit = (e) => {
    e.preventDefault();
    if (busy || previewing) return;
    // Their details, then the questions, in the order they're on the page
    const answerErrors = Object.fromEntries(Object.entries(checkAnswers(questions, replies)).map(([id, e]) => [`q-${id}`, e]));
    const found = { ...check(form), ...answerErrors };
    setErrors(found);
    const first = Object.keys(found).find((k) => found[k]);
    if (first) {
      formRef.current?.querySelector(`#co-${first}`)?.focus();
      return;
    }
    setBusy(true);
    setPayFailed(false);

    // What the confirmation page needs (the real product would load the booking by its id instead)
    const params = new URLSearchParams({
      mock: 'booked',
      service: service.id,
      time: slot.start,
      tz: zone,
      name: form.name.trim(),
      email: form.email.trim(),
      phone: `${form.code} ${form.phone.trim()}`,
    });
    if (!price.isFree) {
      params.set('paid', String(sums.total));
      params.set('pid', `pay_${Math.random().toString(36).slice(2, 16)}`);
    }
    if (gst) {
      params.set('gstin', gst.gstin);
      params.set('gstname', gst.business);
    }
    if (state) params.set('state', state);

    // Pretend payment (or the booking, when free) takes a moment
    const failNow = fail === '1' && !price.isFree && !failedOnce.current;
    timer.current = setTimeout(
      () => {
        if (failNow) {
          failedOnce.current = true;
          setBusy(false);
          setPayFailed(true); // the hold timer carries on from where it paused
          return;
        }
        // Their own call: the server's last check, then the booking is saved.
        // (Meera's demo calls aren't saved, so her mock bookings stay as they are.)
        if (isMyCall(service.id)) {
          const again = buildCheckoutJson({ serviceId, time, profileState: state, slotsState: slots, timeZone: zone });
          if (again.status !== 'ok') {
            setBusy(false);
            setLost(true);
            return;
          }
          const call = getMyProfile().services.find((s) => s.id === service.id);
          const made = createBooking({
            serviceId: service.id,
            title: service.title,
            start: slot.start,
            durationMins: call.durationMins,
            format: call.format,
            guest: { name: form.name.trim(), email: form.email.trim(), phone: `${form.code} ${form.phone.trim()}` },
            guestTimeZone: zone, // the clock they picked the time on
            answers: answersFor(questions, replies), // the call's questions as asked, with their answers
            paid: price.isFree ? 0 : sums.total,
            meetingLink: myMeetingLink(),
          });
          // Couldn't save it (browser storage blocked): the mock carries on without it
          if (made) params.set('booking', made.id);
        }
        window.location.assign(`?${params}`);
      },
      price.isFree ? 700 : 1500,
    );
  };

  const ordered = [...service.facts].sort((a, b) => Number(b.icon === 'clock') - Number(a.icon === 'clock'));
  const when = slot ? `${slot.weekday} ${slot.day} ${slot.month}, ${slot.time}` : null;

  return (
    <div className="co store-theme">
      {previewing && (
        <p className="co__preview">
          <Eye size={16} aria-hidden="true" /> This is a preview of your service. Nobody can book from it.
        </p>
      )}
      <div className="co__layout">
        {/* ================= Left: what they're buying ================= */}
        <section className="co__what" aria-label="Your booking">
          <h1 className="co__title">{service.title}</h1>
          <p className="co__by">
            <span className="co__photo" aria-hidden="true">
              {creator.photo ? <img src={creator.photo} alt="" /> : creator.initials}
            </span>
            with {creator.name}
          </p>
          <p className={price.isFree ? 'co__price co__price--free' : 'co__price'}>
            {price.label}
            {price.compare && (
              <s className="co__price-was">
                <span className="sr-only">was </span>
                {price.compare}
              </s>
            )}
          </p>

          {/* Only for calls: the chosen time, held while they pay (none in a preview) */}
          {slot && (
          <div className="co__session">
            <div className="co__session-head">
              <h2 className="co__session-label">Your session</h2>
              <a className="co__change" href={bookingHref}>
                Change
              </a>
            </div>
            <div className="co__session-body">
              <span className="co__cal" aria-hidden="true">
                <span className="co__cal-month">{slot.month}</span>
                <span className="co__cal-day">{slot.day}</span>
              </span>
              <div className="co__session-text">
                <p className="co__session-day">{slot.weekday} {slot.day} {slot.month}</p>
                <p className="co__session-time">
                  {slot.time} to {slot.ends}
                </p>
                <p className="co__session-zone">{slot.zoneLabel}</p>
                <ul className="co__facts">
                  {ordered.map(({ icon, text }) => {
                    const Icon = ICONS[icon];
                    return (
                      <li key={text}>
                        {Icon && <Icon size={14} aria-hidden="true" />} {text}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
            <p className={left <= 60 ? 'co__hold co__hold--low' : 'co__hold'} role="timer" aria-live="off">
              We're holding this time for you for <strong>{clock(left)}</strong>
            </p>
          </div>
          )}

          {service.image && <img className="co__image" src={service.image} alt="" />}
          {/* The full description, as on the booking page */}
          {service.about?.length > 0 ? (
            <div className="co__desc">
              {service.about.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          ) : (
            service.description && <p className="co__desc">{service.description}</p>
          )}
        </section>

        {/* ================= Right: their details and the money ================= */}
        <form className="co__pay" ref={formRef} onSubmit={submit} noValidate aria-labelledby="co-details">
          <div className="co__box">
            <h2 id="co-details" className="co__box-title">Your details</h2>

            <Field id="co-name" label="Name" required error={errors.name}>
              <input id="co-name" className="co-input" type="text" autoComplete="name" value={form.name} onChange={set('name')} {...describe('co-name', false, errors.name)} />
            </Field>

            <Field id="co-email" label="Email" required hint="We'll send the joining link here." error={errors.email}>
              <input id="co-email" className="co-input" type="email" autoComplete="email" inputMode="email" value={form.email} onChange={set('email')} {...describe('co-email', true, errors.email)} />
            </Field>

            <Field id="co-phone" label="Phone number" required error={errors.phone}>
              <div className="co-phone">
                <select className="co-input co-select co-phone__code" aria-label="Country code" value={form.code} onChange={set('code')}>
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code} title={c.name}>
                      {c.code}
                    </option>
                  ))}
                </select>
                <input id="co-phone" className="co-input" type="tel" autoComplete="tel-national" inputMode="tel" value={form.phone} onChange={set('phone')} {...describe('co-phone', false, errors.phone)} />
              </div>
            </Field>

            {/* The call's booking questions, as the creator set them. One box
                around them, so the questions step's preview can point at them. */}
            {questions.length > 0 && (
              <div className="co__questions">
                {questions.map((q) => (
                  <QuestionField key={q.id} q={q} value={replies[q.id] ?? emptyAnswer(q)} error={errors[`q-${q.id}`]} onChange={reply(q.id)} />
                ))}
              </div>
            )}
          </div>

          {/* ---------- Coupon: closed until they need it ---------- */}
          {!price.isFree && (
            <div className="co__box co__box--tight">
              {coupon ? (
                <div className="co__coupon-applied">
                  <span>
                    <strong>{coupon.code}</strong> applied, {coupon.percent}% off
                  </span>
                  <button type="button" className="co__link" onClick={() => { setCoupon(null); setCouponCode(''); }}>
                    Remove
                  </button>
                </div>
              ) : (
                <>
                  <button type="button" className="co__coupon-toggle" aria-expanded={couponOpen} aria-controls="co-coupon" onClick={() => setCouponOpen((v) => !v)}>
                    Have a coupon?
                    <ChevronDown size={18} aria-hidden="true" />
                  </button>
                  {couponOpen && (
                    <div id="co-coupon" className="co__coupon">
                      <div className="co__coupon-row">
                        <input
                          className="co-input"
                          aria-label="Coupon code"
                          value={couponCode}
                          onChange={(e) => { setCouponCode(e.target.value); setCouponError(null); }}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyCoupon(); } }}
                          aria-invalid={couponError ? true : undefined}
                          aria-describedby={couponError ? 'co-coupon-error' : undefined}
                        />
                        <button type="button" className="co__coupon-apply" onClick={applyCoupon}>
                          Apply
                        </button>
                      </div>
                      {couponError && (
                        <p className="co-field__error" id="co-coupon-error">
                          {couponError}
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ---------- Business GST details: closed until they need it ---------- */}
          {!price.isFree && (
            <div className="co__box co__box--tight">
              {gst && !gstOpen ? (
                <div className="co__gst-saved">
                  <span className="co__gst-saved-text">
                    Invoice to <strong>{gst.business}</strong>
                    <span className="co__gst-saved-id">GSTIN {gst.gstin}, {gst.state}</span>
                  </span>
                  <span className="co__gst-actions">
                    <button type="button" className="co__link" onClick={() => { setGstDraft(gst); setGstOpen(true); }}>
                      Edit
                    </button>
                    <button type="button" className="co__link" onClick={() => { setGst(null); setGstDraft(EMPTY_GST); setGstErrors({}); }}>
                      Remove
                    </button>
                  </span>
                </div>
              ) : (
                <>
                  <button type="button" className="co__coupon-toggle" aria-expanded={gstOpen} aria-controls="co-gst" onClick={() => setGstOpen((v) => !v)}>
                    <span>
                      Add GST details <span className="co__optional">(optional)</span>
                    </span>
                    <ChevronDown size={18} aria-hidden="true" />
                  </button>
                  {gstOpen && (
                    <div id="co-gst" className="co__gst">
                      <p className="co-field__hint">For a tax invoice in your business's name.</p>
                      <Field id="co-gstin" label="GSTIN" required error={gstErrors.gstin}>
                        <input
                          id="co-gstin"
                          className="co-input co-input--caps"
                          maxLength={18}
                          autoComplete="off"
                          value={gstDraft.gstin}
                          onChange={(e) => { setGstDraft((d) => ({ ...d, gstin: e.target.value })); setGstErrors((x) => ({ ...x, gstin: null })); }}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveGst(); } }}
                          {...describe('co-gstin', false, gstErrors.gstin)}
                        />
                      </Field>
                      <Field id="co-business" label="Registration name" required error={gstErrors.business}>
                        <input
                          id="co-business"
                          className="co-input"
                          autoComplete="organization"
                          value={gstDraft.business}
                          onChange={(e) => { setGstDraft((d) => ({ ...d, business: e.target.value })); setGstErrors((x) => ({ ...x, business: null })); }}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveGst(); } }}
                          {...describe('co-business', false, gstErrors.business)}
                        />
                      </Field>
                      <Field id="co-address" label="Registration address" required error={gstErrors.address}>
                        <textarea
                          id="co-address"
                          className="co-input co-input--area co-input--short"
                          rows={2}
                          autoComplete="street-address"
                          value={gstDraft.address}
                          onChange={(e) => { setGstDraft((d) => ({ ...d, address: e.target.value })); setGstErrors((x) => ({ ...x, address: null })); }}
                          {...describe('co-address', false, gstErrors.address)}
                        />
                      </Field>
                      <Field id="co-gst-state" label="State" required error={gstErrors.state}>
                        <select
                          id="co-gst-state"
                          className="co-input co-select"
                          value={gstDraft.state}
                          onChange={(e) => { setGstDraft((d) => ({ ...d, state: e.target.value })); setGstErrors((x) => ({ ...x, state: null })); }}
                          {...describe('co-gst-state', false, gstErrors.state)}
                        >
                          <option value="">Choose a state</option>
                          {INDIAN_STATES.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <button type="button" className="co__coupon-apply co__gst-save" onClick={saveGst}>
                        Save GST details
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ---------- Order summary ---------- */}
          <div className="co__box">
            <h2 className="co__box-title">Summary</h2>
            <dl className="co__lines">
              <div className="co__line">
                <dt>
                  {service.title}
                  {when && <span className="co__line-sub">{when}</span>}
                </dt>
                <dd>
                  {price.isFree ? 'Free' : money(sums.amount)}
                  {price.compare && <s className="co__line-was"><span className="sr-only">was </span>{price.compare}</s>}
                </dd>
              </div>
              {sums.discount > 0 && (
                <div className="co__line co__line--save">
                  <dt>Coupon {coupon.code}</dt>
                  <dd>−{money(sums.discount)}</dd>
                </div>
              )}
              {!price.isFree && (
                <div className="co__line">
                  <dt>GST (18%)</dt>
                  <dd>{money(sums.gst)}</dd>
                </div>
              )}
              <div className="co__line co__line--total">
                <dt>Total</dt>
                <dd>{price.isFree ? 'Free' : money(sums.total)}</dd>
              </div>
            </dl>

            {payFailed && (
              <div className="co__failed" role="alert">
                <p className="co__failed-title">Your payment didn't go through</p>
                <p className="co__failed-text">
                  You haven't been charged, and your details are still here. We're holding your time for another{' '}
                  <strong>{clock(left)}</strong>, so you can try again or use a different way to pay.
                </p>
              </div>
            )}

            <button type="submit" className="co__pay-btn" disabled={busy || previewing}>
              {busy ? (price.isFree ? 'Booking…' : 'Processing payment…') : payLabel}
            </button>
            {!price.isFree && (
              <div className="co__trust">
                <p className="co__secure">
                  <Lock size={13} aria-hidden="true" /> Secure payment by Razorpay
                </p>
                {/* Swap each label for the official logo image the real checkout already uses */}
                <ul className="co__badges" aria-label="Ways to pay">
                  {PAYMENT_METHODS.map((m) => (
                    <li key={m} className="co__badge">
                      {m}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}