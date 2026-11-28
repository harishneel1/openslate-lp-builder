import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ArrowUpRight, Check, FileText } from 'lucide-react';
import { contractOf, getService } from '../data/mockServices';
import { checkoutCreator, moneyExact } from '../data/contractCheckout';
import { getContractSignup } from '../data/contractSignupsStore';
import { academyCoursesPath, coursePlayerPath, courseSoldBy } from '../data/courses';
import { signIn } from '../data/students';
import { mockAccount } from '../data/myPage';
import { isWebLink, shortLink, withScheme } from '../utils/links';
import '../styles/storeTheme.css';
import './CheckoutPage.css';
import './ContractCheckoutPage.css';
import { BrandBar } from '../components/BrandMark';

// ------------------------------------------------------------
// After they pay on a contract's checkout: /web/checkout/<id>/done?order=<id>.
// What the contract's Success page step set (ContractEditor.jsx), and what
// "After they pay" in its preview shows:
//   a tick, "Payment successful" (or "You're registered" when free)
//   what they signed up for, what they paid, the order id, their email
//   the button, when it has a name and a link
//   the redirect, when there's a link: after the delay they picked
//     (0 = straight away), with "Go now" so nobody has to wait
// In the real product the order id comes back from Razorpay, and the
// server checks the payment before this page says it went through.
//
// A course's contract (the one its Buy button sells, courseSoldBy in
// courses.js, published): "You're in", and Start learning instead of the
// contract's own button and redirect. Start learning signs them in to
// the academy with the email (or number) they gave at checkout
// (signIn in students.js), and opens the course at its first lesson
// (CoursePlayerPage.jsx), so there's no second sign-in with a code. Their
// sign-up on this contract is what gives them the course. Opened without
// an order (an old link), it goes to the academy's sign-in instead.
// In the real product the server signs them in from the confirmed
// payment, not from the address.
//
// Prototype only: the creator's academy address (mockAccount.domain,
// academy.harishneel.com, which "Login now" starts with) isn't a real
// site yet, so any link to it opens this app's own academy instead
// (/web/courses), where students sign in. The real app keeps the link
// as it is.
// ------------------------------------------------------------

function openable(url) {
  const full = withScheme(url);
  try {
    if (new URL(full).hostname === mockAccount.domain) return academyCoursesPath;
  } catch {
    // Not a link: left as it is
  }
  return full;
}

export default function ContractDonePage({ contractId, orderId }) {
  const creator = checkoutCreator();
  const raw = useMemo(() => getService(contractId), [contractId]);
  const contract = raw ? contractOf(raw) : null;
  const order = useMemo(() => getContractSignup(orderId), [orderId]);
  const course = useMemo(() => courseSoldBy(contractId), [contractId]);
  const free = order ? order.free : contract?.type === 'free';

  const { buttonLabel, buttonUrl, redirectUrl, redirectDelay } = contract?.success ?? {};
  const label = String(buttonLabel ?? '').trim();
  // A course's thank-you has Start learning in place of these
  const showButton = !course && Boolean(label) && isWebLink(buttonUrl);
  const redirect = !course && isWebLink(redirectUrl) ? openable(redirectUrl) : null;
  const delay = Number(redirectDelay) || 0;

  useEffect(() => {
    document.title = course ? 'You’re in' : free ? 'You’re registered' : 'Payment successful';
  }, [free, course]);

  // Off to their redirect page after the delay, counting down
  const [left, setLeft] = useState(delay);
  useEffect(() => {
    if (!redirect) return undefined;
    if (left <= 0) {
      window.location.assign(redirect);
      return undefined;
    }
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [redirect, left]);

  // Start learning: signed in with what they gave at checkout, then the course
  const startLearning = (e) => {
    const who = order?.email ? { email: order.email } : order?.phone ? { phone: order.phone } : null;
    if (!who) return; // no order: the link's own address, the academy's sign-in
    e.preventDefault();
    signIn(who);
    window.location.assign(coursePlayerPath(course.id));
  };

  if (!contract) {
    return (
      <div className="co store-theme">
        <main className="co__notice">
          <span className="co__notice-icon" aria-hidden="true">
            <FileText size={26} />
          </span>
          <h1 className="co__notice-title">This page isn’t available</h1>
          <p className="co__notice-text">
            If you’ve paid, your receipt is in your email. Ask {creator.firstName} if anything’s missing.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="cc-done store-theme">
      {/* Their logo and business name, once branding's saved */}
      <BrandBar />
      <main className="cc-done__main">
        <div className="cc-done__top">
          <span className="cc-done__tick" aria-hidden="true">
            <Check size={32} strokeWidth={3} />
          </span>
          <h1 className="cc-done__title">{course ? 'You’re in' : free ? 'You’re registered' : 'Payment successful'}</h1>
          <p className="cc-done__sub">
            {course
              ? `${course.title} is ready for you.${order?.email ? ` We’ve sent the details to ${order.email}.` : ''}`
              : order?.email
                ? `We’ve sent the details to ${order.email}.`
                : `Thanks for signing up with ${creator.name}.`}
          </p>
        </div>

        <dl className="cc-done__card">
          <dt>For</dt>
          <dd>{course ? course.title : contract.title}</dd>
          <dt>{free ? 'Price' : 'Paid'}</dt>
          <dd>
            {free ? 'Free' : order ? moneyExact(order.total, order.currency) : '—'}
            {order?.gst && <small> incl. GST</small>}
          </dd>
          {order && (
            <>
              <dt>Order ID</dt>
              <dd>{order.id}</dd>
            </>
          )}
        </dl>

        {course && (
          <a className="cc-done__button" href={academyCoursesPath} onClick={startLearning}>
            Start learning
            <ArrowRight size={17} aria-hidden="true" />
          </a>
        )}

        {redirect && (
          <p className="cc-done__redirect" aria-live="polite">
            {left > 0
              ? `Taking you to ${shortLink(redirectUrl)} in ${left} second${left === 1 ? '' : 's'}…`
              : `Taking you to ${shortLink(redirectUrl)}…`}
            <a href={redirect}>Go now</a>
          </p>
        )}

        {showButton && (
          <a className="cc-done__button" href={openable(buttonUrl)}>
            {label}
            <ArrowUpRight size={17} aria-hidden="true" />
          </a>
        )}
      </main>
    </div>
  );
}