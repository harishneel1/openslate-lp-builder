import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Check, FileText } from 'lucide-react';
import { contractOf, getService } from '../data/mockServices';
import { checkoutCreator, moneyExact } from '../data/contractCheckout';
import { getContractSignup } from '../data/contractSignupsStore';
import { academyCoursesPath } from '../data/courses';
import { mockAccount } from '../data/myPage';
import { isWebLink, shortLink, withScheme } from '../utils/links';
import '../styles/storeTheme.css';
import './CheckoutPage.css';
import './ContractCheckoutPage.css';

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
  const free = order ? order.free : contract?.type === 'free';

  const { buttonLabel, buttonUrl, redirectUrl, redirectDelay } = contract?.success ?? {};
  const label = String(buttonLabel ?? '').trim();
  const showButton = Boolean(label) && isWebLink(buttonUrl);
  const redirect = isWebLink(redirectUrl) ? openable(redirectUrl) : null;
  const delay = Number(redirectDelay) || 0;

  useEffect(() => {
    document.title = free ? 'You’re registered' : 'Payment successful';
  }, [free]);

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
      <main className="cc-done__main">
        <div className="cc-done__top">
          <span className="cc-done__tick" aria-hidden="true">
            <Check size={32} strokeWidth={3} />
          </span>
          <h1 className="cc-done__title">{free ? 'You’re registered' : 'Payment successful'}</h1>
          <p className="cc-done__sub">
            {order?.email
              ? `We’ve sent the details to ${order.email}.`
              : `Thanks for signing up with ${creator.name}.`}
          </p>
        </div>

        <dl className="cc-done__card">
          <dt>For</dt>
          <dd>{contract.title}</dd>
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