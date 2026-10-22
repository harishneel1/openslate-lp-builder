import { Clock, Globe, Lock } from 'lucide-react';
import { lengthLabel, webinarPrice, webinarWhen } from '../../data/webinar';
import { mockAccount } from '../../data/myPage';
import { COUNTRY_CODES } from '../../data/checkoutRules';
import { initials } from '../../utils/initials';
import '../../styles/storeTheme.css';
import '../../screens/CheckoutPage.css'; // the same look as every OpenSlate checkout
import './SignupDesign.css';

// ------------------------------------------------------------
// A webinar's sign-up page (its contract), as people will see it: what
// they're signing up for on the left, their details and the button on
// the right. The same layout and look as the 1:1 call checkout
// (CheckoutPage.jsx), filled from the webinar's answers.
//
// Shown in the preview tab (?preview=<id>&page=signup). It's a preview:
// the fields can be typed in, but nobody can sign up or pay from it.
// ------------------------------------------------------------
export default function SignupDesign({ answers }) {
  const title = String(answers.headline ?? '').trim() || 'Webinar';
  const about = String(answers.subheadline ?? '').trim();
  const when = webinarWhen(answers);
  const length = lengthLabel(answers);
  const language = String(answers.language ?? '').trim();
  const price = webinarPrice(answers);
  const button = price.isFree ? 'Register for free' : `Pay ${price.label}`;

  return (
    <div className="co store-theme signup-design">
      <div className="co__layout">
        {/* ================= Left: what they're signing up for ================= */}
        <section className="co__what" aria-label="The webinar">
          <h1 className="co__title">{title}</h1>
          <p className="co__by">
            <span className="co__photo" aria-hidden="true">
              {initials(mockAccount.name)}
            </span>
            with {mockAccount.name}
          </p>
          <p className={price.isFree ? 'co__price co__price--free' : 'co__price'}>
            {price.label}
            {price.was && (
              <s className="co__price-was">
                <span className="sr-only">was </span>
                {price.was}
              </s>
            )}
          </p>

          {when && (
            <div className="co__session">
              <div className="co__session-head">
                <h2 className="co__session-label">Live webinar</h2>
              </div>
              <div className="co__session-body">
                <span className="co__cal" aria-hidden="true">
                  <span className="co__cal-month">{when.month}</span>
                  <span className="co__cal-day">{when.day}</span>
                </span>
                <div className="co__session-text">
                  <p className="co__session-day">{when.line.split(', ')[0]}</p>
                  <p className="co__session-time">{when.line.split(', ')[1]}</p>
                  <ul className="co__facts">
                    {length && (
                      <li>
                        <Clock size={14} aria-hidden="true" /> {length}
                      </li>
                    )}
                    {language && (
                      <li>
                        <Globe size={14} aria-hidden="true" /> {language}
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {about && <p className="co__desc">{about}</p>}
        </section>

        {/* ================= Right: their details ================= */}
        <form className="co__pay" onSubmit={(e) => e.preventDefault()} aria-labelledby="su-details">
          <div className="co__box">
            <h2 id="su-details" className="co__box-title">
              Your details
            </h2>
            <SignupField id="su-name" label="Name">
              <input id="su-name" className="co-input" type="text" autoComplete="off" />
            </SignupField>
            <SignupField id="su-email" label="Email" hint="We'll send the joining link here.">
              <input id="su-email" className="co-input" type="email" autoComplete="off" />
            </SignupField>
            <SignupField id="su-phone" label="Phone number">
              <div className="co-phone">
                <select className="co-input co-select co-phone__code" aria-label="Country code" defaultValue={COUNTRY_CODES[0]?.code}>
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code} title={c.name}>
                      {c.code}
                    </option>
                  ))}
                </select>
                <input id="su-phone" className="co-input" type="tel" autoComplete="off" inputMode="tel" />
              </div>
            </SignupField>
          </div>

          <div className="co__box">
            <h2 className="co__box-title">Summary</h2>
            <dl className="co__lines">
              <div className="co__line">
                <dt>
                  {title}
                  {when && <span className="co__line-sub">{when.line}</span>}
                </dt>
                <dd>
                  {price.label}
                  {price.was && (
                    <s className="co__line-was">
                      <span className="sr-only">was </span>
                      {price.was}
                    </s>
                  )}
                </dd>
              </div>
              <div className="co__line co__line--total">
                <dt>Total</dt>
                <dd>{price.label}</dd>
              </div>
            </dl>

            {/* A preview: the button shows, but does nothing */}
            <button type="submit" className="co__pay-btn" disabled>
              {button}
            </button>
            <p className="signup-design__note">This is a preview, so nobody can sign up from it.</p>
            {!price.isFree && (
              <p className="co__secure">
                <Lock size={13} aria-hidden="true" /> Secure payment by Razorpay
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

function SignupField({ id, label, hint, children }) {
  return (
    <div className="co-field">
      <label className="co-field__label" htmlFor={id}>
        {label}
        <span className="co-field__req" aria-hidden="true">
          {' '}*
        </span>
      </label>
      {hint && (
        <p className="co-field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {children}
    </div>
  );
}