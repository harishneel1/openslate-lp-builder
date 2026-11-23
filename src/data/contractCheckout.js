import { getService, contractOf } from './mockServices';
import { ownerOf } from './tiedProducts';
import { accountHandle, mockAccount, offeringUrl } from './myPage';
import { CURRENCIES, GST_RATE, REGIONS, currencyOf, payAmount, priceFor } from './contractPricing';
import { initials } from '../utils/initials';

// ------------------------------------------------------------
// A contract's own checkout page: the link a coach shares to sell a
// course (or anything else a contract is made for).
//
//   /web/checkout/<contract id>             the page people pay on
//   /web/checkout/<contract id>/done?order= after they pay
//
// Like TagMango's, the address is the contract's id, never its title,
// so renaming a contract never breaks a link that's already been sent.
// main.jsx reads it before creator handles ("web" is kept back from
// handles in myPage.js, so no coach can take it).
//
// Contracts a 1:1 call or webinar owns already have a page of their own
// (the call's booking page, the webinar's sign-up page): their address
// sends people there instead, since a call needs a time picked first.
// A live class's contracts are sold here, on this page: buying one is how
// someone joins the class (there's no class page).
//
// Testing other countries: &region=IN, EU or ELSE on the address.
// ------------------------------------------------------------

export const contractCheckoutPath = (id) => `/web/checkout/${encodeURIComponent(id)}`;
export const contractCheckoutUrl = (id) => `${window.location.origin}${contractCheckoutPath(id)}`;
export const contractDonePath = (id, orderId) =>
  `${contractCheckoutPath(id)}/done${orderId ? `?order=${encodeURIComponent(orderId)}` : ''}`;

// The address bits after /web/checkout/: { contractId, done } or null
export function readCheckoutPath(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] !== 'web' || parts[1] !== 'checkout' || !parts[2]) return null;
  return { contractId: decodeURIComponent(parts[2]), done: parts[3] === 'done' };
}

// Where a contract can be seen live:
//   view   what ↗ on the Contracts page opens (a call's: its checkout as
//          a preview; anything else: the live page, the same as share)
//   share  the link to send people (what Copy link copies)
// → { view, share }
export function livePageOf(contract) {
  const home = `${window.location.origin}/`;
  const owner = ownerOf(contract);
  if (owner?.kind === 'call') {
    return {
      view: `${home}?mock=checkout&service=${encodeURIComponent(owner.id)}&preview=1`,
      share: offeringUrl(accountHandle(), owner.id),
    };
  }
  if (owner?.kind === 'webinar') {
    // This run's own sign-up page (its contract is this date's alone)
    const href = `${home}?preview=${encodeURIComponent(owner.id)}&page=signup`;
    return { view: href, share: href };
  }
  // The live page itself: the coach sees exactly what people they share it with see
  const href = contractCheckoutUrl(contract.id);
  return { view: href, share: href };
}

// Which prices a visitor sees, from where their device says they are:
// India → INR, Europe → EUR, anywhere else → USD (contractPricing.js)
export function regionOf(override) {
  if (REGIONS.some((r) => r.id === override)) return override;
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  if (zone === 'Asia/Kolkata' || zone === 'Asia/Calcutta') return 'IN';
  if (zone.startsWith('Europe/')) return 'EU';
  return 'ELSE';
}

// "₹14,999.00", "$49.00": for the summary and the pay button
export function moneyExact(amount, currency = 'INR') {
  const c = currencyOf(currency);
  const n = Number(amount) || 0;
  return `${c.symbol}${n.toLocaleString(c.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const round2 = (n) => Math.round(n * 100) / 100;

// The money for one price, with a coupon (percent off) and the contract's GST:
//   amount    what the price is before the coupon (the discounted price if it has one)
//   compare   the selling price, crossed out, when there's a discounted price
//   discount  the coupon's part
//   gst       { amount, included } on an INR price with GST on, else null
//             included: already inside the price; else added on top
//   total     what they pay
export function contractTotals(price, gst, couponPercent = 0) {
  const amount = payAmount(price);
  const compare = price?.discount != null && price.discount > 0 ? price.price : null;
  const discount = round2((amount * couponPercent) / 100);
  const taxable = round2(amount - discount);
  const applies = price?.currency === 'INR' && gst?.enabled;
  if (!applies) return { amount, compare, discount, gst: null, total: taxable };
  if (gst.included) {
    return { amount, compare, discount, gst: { amount: round2(taxable - taxable / (1 + GST_RATE)), included: true }, total: taxable };
  }
  const tax = round2(taxable * GST_RATE);
  return { amount, compare, discount, gst: { amount: tax, included: false }, total: round2(taxable + tax) };
}

// Who's selling: the coach whose account this is
export function checkoutCreator() {
  return { name: mockAccount.name, firstName: mockAccount.name.split(' ')[0], initials: initials(mockAccount.name) };
}

// Everything the page needs, read fresh:
//   status 'ok'         show the page
//          'missing'    no such contract (deleted, or a wrong link)
//          'closed'     it's been turned off (inactive): no new sign-ups
//          'elsewhere'  a call, webinar or batch owns it: send them to
//                       that page (href)
// For 'ok': contract (every field, contractOf), free, monthly, price
// (the one for their region), prices (all of them), gst.
export function buildContractCheckout({ contractId, region }) {
  const creator = checkoutCreator();
  const raw = getService(contractId);
  if (!raw) return { status: 'missing', creator };
  if (ownerOf(raw)) return { status: 'elsewhere', creator, title: raw.title, href: livePageOf(raw).share };
  if (raw.status === 'inactive') return { status: 'closed', creator, title: raw.title };

  const contract = contractOf(raw);
  const prices = contract.prices.filter((p) => p.price > 0 && CURRENCIES.some((c) => c.id === p.currency));
  const price = priceFor(prices, regionOf(region));
  const free = contract.type === 'free' || !price;
  return {
    status: 'ok',
    creator,
    contract,
    free,
    monthly: !free && contract.type === 'subscription',
    price: free ? null : price,
    gst: contract.gst,
  };
}