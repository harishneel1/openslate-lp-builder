import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, FileText, Lock } from 'lucide-react';
import {
  buildContractCheckout,
  contractDonePath,
  contractTotals,
  moneyExact,
} from '../data/contractCheckout';
import { saveContractSignup } from '../data/contractSignupsStore';
import { COUNTRY_CODES, COUPONS, GSTIN, GST_RATE, INDIAN_STATES, PAYMENT_METHODS } from '../data/checkoutRules';
import { answersFor, askedQuestions, checkAnswers, emptyAnswer } from '../data/callQuestions';
import { formatMoney } from '../data/contractPricing';
import LinkedText from '../components/LinkedText';
import { Field, QuestionField, checkDetails, describe } from './CheckoutPage';
import '../styles/storeTheme.css';
import './CheckoutPage.css';
import './ContractCheckoutPage.css';
import { BrandBar } from '../components/BrandMark';

// ------------------------------------------------------------
// A contract's own checkout: /web/checkout/<contract id>. The page a
// coach shares to sell a course, laid out like TagMango's and our call
// checkout (whose fields and styles it shares):
//
//   left   title, the coach, price, then the cover, then the full
//          description (links clickable)
//   right  their details (name, email, phone, then the contract's
//          questions), coupon, business GST details, the summary and Pay
//
// Everything comes from the contract (contractCheckout.js):
//   price     the one for where they are (India INR, Europe EUR, else USD),
//             the selling price crossed out when there's a discounted one
//   GST       as the coach set it: none, 18% on top, or already included
//   free      "Register" instead of Pay; no coupon, GST or payment badges
// Pay (mocked: a moment's wait) saves the sign-up (contractSignupsStore.js),
// then goes to the success page, /web/checkout/<id>/done.
//
// Pages instead of the form: a contract that's gone or turned off says so;
// one a call, webinar or batch owns sends them to that page.
//
// The coach's ↗ on the Contracts page opens this exact page: it's the live
// link, the same one they share, with nothing added for them.
// &region=IN, EU or ELSE: see the page as someone there would
// &fail=1: the first payment fails, to see the try-again state
// ------------------------------------------------------------

const EMPTY_GST = { gstin: '', business: '', address: '', state: '' };
const GST_PERCENT_LABEL = `${Math.round(GST_RATE * 100)}%`;

export default function ContractCheckoutPage({ contractId, region, fail = false }) {
  const page = useMemo(() => buildContractCheckout({ contractId, region }), [contractId, region]);
  const { status, creator } = page;

  useEffect(() => {
    document.title = page.contract ? `${page.contract.title} · ${creator.name}` : creator.name;
  }, [page.contract, creator.name]);

  // A contract a call, webinar or batch owns: its own page is the one to use
  useEffect(() => {
    if (status === 'elsewhere') window.location.replace(page.href);
  }, [status, page.href]);

  if (status === 'missing') {
    return (
      <Notice
        title="This page isn’t available"
        text={`It may have been removed, or the link may be wrong. Check the link with ${creator.firstName}.`}
      />
    );
  }
  if (status === 'closed') {
    return (
      <Notice
        title="Sign-ups have closed"
        text={`${page.title} isn’t taking new sign-ups right now. Ask ${creator.firstName} if it’ll open again.`}
      />
    );
  }
  if (status === 'elsewhere') {
    return <Notice title="Taking you there…" text={`${page.title} has its own page.`} href={page.href} label="Go now" />;
  }

  return <CheckoutForm page={page} fail={fail} />;
}

// A page in place of the checkout
function Notice({ title, text, href, label }) {
  return (
    <div className="co store-theme">
      <main className="co__notice">
        <span className="co__notice-icon" aria-hidden="true">
          <FileText size={26} />
        </span>
        <h1 className="co__notice-title">{title}</h1>
        <p className="co__notice-text">{text}</p>
        {href && (
          <a className="co__notice-btn" href={href}>
            {label}
          </a>
        )}
      </main>
    </div>
  );
}

function CheckoutForm({ page, fail }) {
  const { creator, contract, free, monthly, price, gst: gstSetting } = page;
  const questions = askedQuestions(contract.questions);
  const paragraphs = contract.description
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const [form, setForm] = useState({ name: '', email: '', code: '+91', phone: '' });
  const [replies, setReplies] = useState({});
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [payFailed, setPayFailed] = useState(false);
  const failedOnce = useRef(false);
  const [couponOpen, setCouponOpen] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [coupon, setCoupon] = useState(null); // { code, percent }
  const [couponError, setCouponError] = useState(null);
  const [gstOpen, setGstOpen] = useState(false);
  const [gstDraft, setGstDraft] = useState(EMPTY_GST);
  const [gstDetails, setGstDetails] = useState(null);
  const [gstErrors, setGstErrors] = useState({});
  const formRef = useRef(null);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const sums = free ? null : contractTotals(price, gstSetting, coupon?.percent ?? 0);
  const currency = price?.currency ?? 'INR';
  // Business GST details only matter where there's Indian GST on the bill
  const takesGstDetails = Boolean(sums?.gst);

  const set = (key) => (e) => {
    const { value } = e.target;
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((errs) => ({ ...errs, [key]: null }));
  };
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
    const found = {
      gstin: !gstin ? 'Enter your GSTIN' : GSTIN.test(gstin) ? null : 'Enter a 15-character GSTIN, like 33ABCDE1234F1Z5',
      business: business ? null : 'Enter the name on your GST registration',
      address: address ? null : 'Enter the address on your GST registration',
      state: gstDraft.state ? null : 'Choose the state of your GST registration',
    };
    setGstErrors(found);
    if (Object.values(found).some(Boolean)) return;
    setGstDetails({ gstin, business, address, state: gstDraft.state });
    setGstOpen(false);
  };

  const submit = (e) => {
    e.preventDefault();
    if (busy) return;
    const answerErrors = Object.fromEntries(Object.entries(checkAnswers(questions, replies)).map(([id, m]) => [`q-${id}`, m]));
    const found = { ...checkDetails(form), ...answerErrors };
    setErrors(found);
    const first = Object.keys(found).find((k) => found[k]);
    if (first) {
      formRef.current?.querySelector(`#co-${first}`)?.focus();
      return;
    }
    setBusy(true);
    setPayFailed(false);

    const failNow = fail && !free && !failedOnce.current;
    timer.current = setTimeout(
      () => {
        if (failNow) {
          failedOnce.current = true;
          setBusy(false);
          setPayFailed(true);
          return;
        }
        const record = saveContractSignup({
          contractId: contract.id,
          contractTitle: contract.title,
          name: form.name.trim(),
          email: form.email.trim(),
          phone: `${form.code} ${form.phone.trim()}`,
          answers: answersFor(questions, replies),
          free,
          currency,
          price: free ? 0 : sums.amount,
          coupon,
          discount: free ? 0 : sums.discount,
          gst: free ? null : sums.gst,
          total: free ? 0 : sums.total,
          gstDetails: takesGstDetails ? gstDetails : null,
        });
        // Couldn't save it (browser storage blocked): the mock carries on without it
        window.location.assign(contractDonePath(contract.id, record?.id));
      },
      free ? 700 : 1500,
    );
  };

  const payLabel = free ? 'Register' : `Pay ${moneyExact(sums.total, currency)}${monthly ? ' a month' : ''}`;

  return (
    <div className="co store-theme">
      {/* Their logo and business name, once branding's saved */}
      <BrandBar />
      <div className="co__layout">
        {/* ================= Left: what they're signing up for ================= */}
        <section className="co__what" aria-label="What you’re signing up for">
          <h1 className="co__title">{contract.title}</h1>
          <p className="co__by">
            <span className="co__photo" aria-hidden="true">
              {creator.initials}
            </span>
            By {creator.name}
          </p>

          {free ? (
            <p className="co__price co__price--free">Free</p>
          ) : (
            <div className="cc__price">
              <p className="co__price">
                {formatMoney(sums.amount, currency)}
                {monthly && <span className="cc__per">/month</span>}
                {sums.compare && (
                  <s className="co__price-was">
                    <span className="sr-only">was </span>
                    {formatMoney(sums.compare, currency)}
                  </s>
                )}
              </p>
              {gstSetting.enabled && currency === 'INR' && (
                <p className="cc__price-note">
                  {gstSetting.included ? 'Includes GST' : `+ ${GST_PERCENT_LABEL} GST`}
                </p>
              )}
            </div>
          )}

          {/* The cover sits between the price and the description, as on a call's checkout */}
          {contract.cover && <img className="co__image" src={contract.cover} alt="" />}

          {paragraphs.length > 0 && (
            <div className="co__desc">
              {paragraphs.map((p, i) => (
                <p key={i}>
                  <LinkedText text={p} />
                </p>
              ))}
            </div>
          )}

          <p className="cc__legal">
            You agree to share the information you enter on this page with {creator.name} (who owns this page)
            {free ? '' : ' and Razorpay'}, in line with the law that applies.
          </p>
        </section>

        {/* ================= Right: their details and the money ================= */}
        <form className="co__pay" ref={formRef} onSubmit={submit} noValidate aria-labelledby="co-details">
          <div className="co__box">
            <h2 id="co-details" className="co__box-title">
              Your details
            </h2>

            <Field id="co-name" label="Name" required error={errors.name}>
              <input id="co-name" className="co-input" type="text" autoComplete="name" value={form.name} onChange={set('name')} {...describe('co-name', false, errors.name)} />
            </Field>

            <Field id="co-email" label="Email" required hint="We’ll send your receipt and access details here." error={errors.email}>
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

            {questions.length > 0 && (
              <div className="co__questions">
                {questions.map((q) => (
                  <QuestionField key={q.id} q={q} value={replies[q.id] ?? emptyAnswer(q)} error={errors[`q-${q.id}`]} onChange={reply(q.id)} />
                ))}
              </div>
            )}
          </div>

          {/* ---------- Coupon: closed until they need it ---------- */}
          {!free && (
            <div className="co__box co__box--tight">
              {coupon ? (
                <div className="co__coupon-applied">
                  <span>
                    <strong>{coupon.code}</strong> applied, {coupon.percent}% off
                  </span>
                  <button
                    type="button"
                    className="co__link"
                    onClick={() => {
                      setCoupon(null);
                      setCouponCode('');
                    }}
                  >
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
                          onChange={(e) => {
                            setCouponCode(e.target.value);
                            setCouponError(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              applyCoupon();
                            }
                          }}
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

          {/* ---------- Business GST details: only where there's GST ---------- */}
          {takesGstDetails && (
            <div className="co__box co__box--tight">
              {gstDetails && !gstOpen ? (
                <div className="co__gst-saved">
                  <span className="co__gst-saved-text">
                    Invoice to <strong>{gstDetails.business}</strong>
                    <span className="co__gst-saved-id">
                      GSTIN {gstDetails.gstin}, {gstDetails.state}
                    </span>
                  </span>
                  <span className="co__gst-actions">
                    <button
                      type="button"
                      className="co__link"
                      onClick={() => {
                        setGstDraft(gstDetails);
                        setGstOpen(true);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="co__link"
                      onClick={() => {
                        setGstDetails(null);
                        setGstDraft(EMPTY_GST);
                        setGstErrors({});
                      }}
                    >
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
                      <p className="co-field__hint">For a tax invoice in your business’s name.</p>
                      <Field id="co-gstin" label="GSTIN" required error={gstErrors.gstin}>
                        <input
                          id="co-gstin"
                          className="co-input co-input--caps"
                          maxLength={18}
                          autoComplete="off"
                          value={gstDraft.gstin}
                          onChange={(e) => {
                            setGstDraft((d) => ({ ...d, gstin: e.target.value }));
                            setGstErrors((x) => ({ ...x, gstin: null }));
                          }}
                          {...describe('co-gstin', false, gstErrors.gstin)}
                        />
                      </Field>
                      <Field id="co-business" label="Registration name" required error={gstErrors.business}>
                        <input
                          id="co-business"
                          className="co-input"
                          autoComplete="organization"
                          value={gstDraft.business}
                          onChange={(e) => {
                            setGstDraft((d) => ({ ...d, business: e.target.value }));
                            setGstErrors((x) => ({ ...x, business: null }));
                          }}
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
                          onChange={(e) => {
                            setGstDraft((d) => ({ ...d, address: e.target.value }));
                            setGstErrors((x) => ({ ...x, address: null }));
                          }}
                          {...describe('co-address', false, gstErrors.address)}
                        />
                      </Field>
                      <Field id="co-gst-state" label="State" required error={gstErrors.state}>
                        <select
                          id="co-gst-state"
                          className="co-input co-select"
                          value={gstDraft.state}
                          onChange={(e) => {
                            setGstDraft((d) => ({ ...d, state: e.target.value }));
                            setGstErrors((x) => ({ ...x, state: null }));
                          }}
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

          {/* ---------- Summary and Pay ---------- */}
          <div className="co__box">
            <h2 className="co__box-title">Summary</h2>
            <dl className="co__lines">
              <div className="co__line">
                <dt>
                  {contract.title}
                  {monthly && <span className="co__line-sub">Charged every month from today</span>}
                </dt>
                <dd>
                  {free ? 'Free' : moneyExact(sums.amount, currency)}
                  {sums?.compare && (
                    <s className="co__line-was">
                      <span className="sr-only">was </span>
                      {moneyExact(sums.compare, currency)}
                    </s>
                  )}
                </dd>
              </div>
              {sums?.discount > 0 && (
                <div className="co__line co__line--save">
                  <dt>Coupon {coupon.code}</dt>
                  <dd>−{moneyExact(sums.discount, currency)}</dd>
                </div>
              )}
              {sums?.gst && !sums.gst.included && (
                <div className="co__line">
                  <dt>GST ({GST_PERCENT_LABEL})</dt>
                  <dd>{moneyExact(sums.gst.amount, currency)}</dd>
                </div>
              )}
              <div className="co__line co__line--total">
                <dt>
                  Total
                  {sums?.gst?.included && (
                    <span className="co__line-sub">
                      Includes {moneyExact(sums.gst.amount, currency)} GST ({GST_PERCENT_LABEL})
                    </span>
                  )}
                </dt>
                <dd>{free ? 'Free' : moneyExact(sums.total, currency)}</dd>
              </div>
            </dl>

            {payFailed && (
              <div className="co__failed" role="alert">
                <p className="co__failed-title">Your payment didn’t go through</p>
                <p className="co__failed-text">
                  You haven’t been charged, and your details are still here. Try again, or use a different way to pay.
                </p>
              </div>
            )}

            <button type="submit" className="co__pay-btn" disabled={busy}>
              {busy ? (free ? 'Registering…' : 'Processing payment…') : payLabel}
            </button>
            {!free && (
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