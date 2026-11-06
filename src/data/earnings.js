import { peopleOf, onSignupsChange } from './webinarSignups';
import { loadBookings, onBookingsChange } from './bookingsStore';
import { funnelTypes } from './funnelTypes';
import { webinarWhen } from './webinar';
import { coachZone } from './buildBookingsJson';
import { funnelName } from '../utils/funnelName';
import { onPayoutsChange, verifiedBank } from './payouts';

// ------------------------------------------------------------
// Earnings: the coach's money with us, as one ledger (Sales → Withdrawals,
// screens/WithdrawalsTab.jsx). Like TagMango, the
// money people pay lands in the coach's account with us (a wallet), and
// the coach withdraws it to their bank when they choose. Nothing is paid
// out automatically.
//
// Every line that moves money is an entry, newest first on the page:
//   sale        someone paid: +what the coach keeps (net), after our fee
//   refund      money given back to a buyer: −what they got back
//   withdrawal  the coach moved money to their bank: −the amount
//   tax         TDS we deducted for a month's sales: −the amount
//
// All amounts are in paise (whole numbers), so ₹14,174.50 is 1417450.
// Never rupees with decimals: 0.1 + 0.2 isn't 0.3 in JavaScript.
//
// Our fee (COMMISSION_RATE, 5%) comes off each sale as it's made, so the
// ledger only ever shows the coach's own money. The sale's side panel
// shows what the buyer paid, our fee and what the coach keeps.
//
// The balance, worked out from the entries and the clock, never stored:
//   ready     money that has settled: withdraw it any time
//   arriving  sales still settling (SETTLE_MS, 72 hours after each sale,
//             the payment gateway's settlement time), with the day each
//             becomes ready
//   total     ready + arriving: what's theirs with us
// Refunds, withdrawals and tax come off what's ready at once. If they
// ever come to more than what's ready, ready shows ₹0 rather than a
// negative number, and the rest comes off what's arriving.
//
// Withdrawing (requestWithdrawal): any amount from MIN_WITHDRAWAL up to
// what's ready, to their verified bank account (data/payouts.js). It's 'processing' until
// it reaches the bank, then 'paid', with the bank's reference (UTR).
// The prototype pretends that takes PAYOUT_MS; in the real product the
// payout service tells the server.
//
// Where entries come from:
//   - this browser's real sign-ups and bookings: every paid webinar
//     sign-up (webinarSignups.js) and paid call booking (bookingsStore.js)
//     is a sale, and every refunded sign-up is a refund, so the money
//     matches the webinar and call pages
//   - demo history: about 80 days of sample sales, withdrawals, a refund
//     and monthly TDS, made once (seedDemoEarnings) so the page has
//     something real-looking in it. Remove for production.
//   - sample sales and withdrawals made on the page (Prototype controls)
// Call bookings that are cancelled stay sales: cancelling a call doesn't
// refund it (BookingDrawer.jsx). Refunding one by hand is round 2.
//
// Not yet (later rounds): refunding from a sale, invoices, GST, TCS,
// month summaries, failed withdrawals, changing the bank account.
// TDS is only in the demo history; real sales get none in the prototype.
//
// Orders (Sales → Transactions, ordersOf): every sale, plus what never
// reaches the ledger: free sign-ups and failed payments. A sale paid in
// USD or EUR keeps what the buyer paid in their currency (paidMinor:
// cents) and the rate it became rupees at; its gross and everything in
// the ledger are rupees. Refunding from a payment (refundOrder) takes the
// whole refund out of the coach's balance: our fee isn't given back.
// Each paid order has an invoice in the coach's name (BUSINESS), numbered
// <code>/<year>/<running number> like TagMango's.
//
// Kept in this browser (localStorage) under KEY:
//   { version, seededAt, demo: [entry], demoOrders: [free or failed order],
//     samples: [sale entry], withdrawals: [withdrawal], refunds: [refund],
//     settledBefore, finishedBefore, hideDemo }
//   refunds:        made from Transactions: { id, saleId, at, minor }, minor
//                   in the payment's own currency
//   settledBefore:  Prototype controls' "Make everything ready now": sales
//                   made before it count as settled (ms), or null
//   finishedBefore: "Finish withdrawals now": withdrawals made before it
//                   count as reached the bank (ms), or null
//   hideDemo:       "Start empty": leave the demo history out
// ------------------------------------------------------------

const KEY = 'pagebuilder:earnings';
const CHANGED_EVENT = 'earnings-changed';

// Our fee on every sale. Change it here: everything follows.
export const COMMISSION_RATE = 0.05;
export const COMMISSION_LABEL = '5%';

// How long a sale takes to settle before it can be withdrawn
export const SETTLE_MS = 72 * 3_600_000;
export const SETTLE_LABEL = '3 days';

// The smallest withdrawal, in paise (₹100)
export const MIN_WITHDRAWAL = 100_00;

// How long a withdrawal takes to reach the bank. Short in the prototype,
// so the whole cycle can be seen; PAYOUT_PROMISE is what we tell coaches.
export const PAYOUT_MS = 3 * 60_000;
export const PAYOUT_PROMISE = 'within 1 working day';

// TDS under section 194-O, deducted on each month's sales (gross)
export const TDS_RATE = 0.001;
export const TDS_LABEL = '0.1%';

// The demo history's bank account: where its past withdrawals went
export const BANK = { name: 'HDFC Bank', last4: '4521', holder: 'Harish Neel' };

// Where withdrawals go now: their verified account (data/payouts.js), or
// null when they haven't added one or it isn't verified yet
export const currentBank = (now = Date.now()) => verifiedBank(now);

export const bankLine = (bank = currentBank() ?? BANK) => `${bank.name} ••${bank.last4}`;

// The coach's business, as it goes on their invoices. Fixed here until
// a settings screen for it is designed. gstin: null when they aren't
// registered for GST.
export const BUSINESS = {
  name: 'Harish Neel',
  initials: 'HN',
  address: '7/4, 6th street, 1st cross, Dr. Subbarayan nagar, Kodambakkam, Chennai 600024',
  gstin: null,
  invoiceCode: '6f63', // the first part of every invoice number
};

// What buyers can pay in, and what a unit was worth in rupees (made-up
// rates for the prototype; the payment gateway gives the real one)
export const CURRENCIES = {
  INR: { symbol: '₹', locale: 'en-IN', rate: 1, words: ['Rupees', 'Paise'] },
  USD: { symbol: '$', locale: 'en-US', rate: 84.2, words: ['US Dollars', 'Cents'] },
  EUR: { symbol: '€', locale: 'en-IE', rate: 91.4, words: ['Euros', 'Cents'] },
};

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

// ---------- Money ----------

// 1417450 → '₹14,174.50', 1417400 → '₹14,174' (paise only when there are some)
// sign: true → '+₹14,174' and '−₹39,686'
export function money(paise, { sign = false } = {}) {
  const n = Math.round(Number(paise) || 0);
  const abs = Math.abs(n);
  const whole = abs % 100 === 0;
  const text = (abs / 100).toLocaleString('en-IN', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  });
  const prefix = n < 0 ? '−' : sign && n > 0 ? '+' : '';
  return `${prefix}₹${text}`;
}

// What they typed in the amount box → paise, or NaN.
// '14,174.5', '₹ 14174.50', '14174' are all fine; more than two decimals isn't.
export function parseRupees(text) {
  const clean = String(text ?? '').replace(/[₹,\s]/g, '');
  if (!/^\d+(\.\d{0,2})?$/.test(clean)) return NaN;
  return Math.round(Number(clean) * 100);
}

// paise → what goes in the amount box: '14174.5' → '14174.50', '14174'
export const rupeesInput = (paise) => (paise % 100 === 0 ? String(paise / 100) : (paise / 100).toFixed(2));

// An amount in its own currency, from cents/paise: '$158.99', '€19', '₹1,499'
export function moneyIn(minor, currency = 'INR') {
  if (currency === 'INR') return money(minor);
  const c = CURRENCIES[currency] ?? CURRENCIES.USD;
  const n = Math.abs(Math.round(minor));
  const text = (n / 100).toLocaleString(c.locale, {
    minimumFractionDigits: n % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${minor < 0 ? '−' : ''}${c.symbol}${text}`;
}

// What they typed in an amount box, in any currency → minor units, or NaN
export const parseAmount = parseRupees;
export const amountInput = rupeesInput;

// An amount in words, for the invoice: 'One Thousand Four Hundred Ninety
// Nine Rupees Only', 'One Hundred Fifty Eight US Dollars and Ninety Nine
// Cents Only'. Rupees count in lakhs and crores.
export function amountInWords(minor, currency = 'INR') {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
    'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const upTo99 = (n) => (n < 20 ? ones[n] : `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ''}`);
  const upTo999 = (n) =>
    [n >= 100 ? `${ones[Math.floor(n / 100)]} Hundred` : '', upTo99(n % 100)].filter(Boolean).join(' ');
  const indian = (n) => {
    const parts = [];
    const crore = Math.floor(n / 1e7);
    const lakh = Math.floor((n % 1e7) / 1e5);
    const thousand = Math.floor((n % 1e5) / 1e3);
    if (crore) parts.push(`${indian(crore)} Crore`);
    if (lakh) parts.push(`${upTo99(lakh)} Lakh`);
    if (thousand) parts.push(`${upTo99(thousand)} Thousand`);
    if (n % 1000) parts.push(upTo999(n % 1000));
    return parts.join(' ');
  };
  const western = (n) => {
    const parts = [];
    const million = Math.floor(n / 1e6);
    const thousand = Math.floor((n % 1e6) / 1e3);
    if (million) parts.push(`${upTo999(million)} Million`);
    if (thousand) parts.push(`${upTo999(thousand)} Thousand`);
    if (n % 1000) parts.push(upTo999(n % 1000));
    return parts.join(' ');
  };
  const c = CURRENCIES[currency] ?? CURRENCIES.INR;
  const whole = Math.floor(Math.abs(minor) / 100);
  const fraction = Math.abs(minor) % 100;
  const words = currency === 'INR' ? indian : western;
  const main = `${whole ? words(whole) : 'Zero'} ${c.words[0]}`;
  return `${main}${fraction ? ` and ${upTo99(fraction)} ${c.words[1]}` : ''} Only`;
}

// ---------- Dates, on the coach's clock ----------

const zone = () => coachZone() || 'Asia/Kolkata';
const fmt = (ms, opts, locale = 'en-GB') => new Intl.DateTimeFormat(locale, { timeZone: zone(), ...opts }).format(ms);

// '2026-11-06'
export const dayKey = (ms) => fmt(ms, { year: 'numeric', month: '2-digit', day: '2-digit' }, 'en-CA');

// 'Mon 9 Nov'
export const shortDay = (ms) => fmt(ms, { weekday: 'short', day: 'numeric', month: 'short' });

// '7:49 am'
export const clockTime = (ms) =>
  fmt(ms, { hour: 'numeric', minute: '2-digit' }, 'en-US').replace(' AM', ' am').replace(' PM', ' pm');

// 'Fri 6 Nov 2026, 7:49 am'
export const fullWhen = (ms) => `${shortDay(ms)} ${fmt(ms, { year: 'numeric' })}, ${clockTime(ms)}`;

// 'September 2026'
export const monthLabel = (ms) => fmt(ms, { month: 'long', year: 'numeric' });

// A day's heading in the list: 'Today', 'Yesterday', 'Friday 30 October',
// with the year only when it isn't this year
export function dayHeading(ms, now = Date.now()) {
  const key = dayKey(ms);
  if (key === dayKey(now)) return 'Today';
  if (key === dayKey(now - DAY)) return 'Yesterday';
  const label = fmt(ms, { weekday: 'long', day: 'numeric', month: 'long' });
  return fmt(ms, { year: 'numeric' }) === fmt(now, { year: 'numeric' }) ? label : `${label} ${fmt(ms, { year: 'numeric' })}`;
}

// A day, in words: 'today', 'tomorrow', 'Mon 9 Nov' (several sales
// becoming ready over one day: no single time fits them all)
export function readyDay(ms, now = Date.now()) {
  if (dayKey(ms) === dayKey(now)) return 'today';
  if (dayKey(ms) === dayKey(now + DAY)) return 'tomorrow';
  return shortDay(ms);
}

// When one thing will be ready, in words: 'today at 4:10 pm',
// 'tomorrow at 9:00 am', 'Mon 9 Nov'
export function readyWhen(ms, now = Date.now()) {
  if (dayKey(ms) === dayKey(now)) return `today at ${clockTime(ms)}`;
  if (dayKey(ms) === dayKey(now + DAY)) return `tomorrow at ${clockTime(ms)}`;
  return shortDay(ms);
}

// ---------- References ----------

// A steady, made-up reference from an id: 'pay_N3X8KQ2LM0ZR4T'
function refFor(prefix, seed, length = 14) {
  let h = 2166136261;
  let out = '';
  const s = String(seed);
  for (let i = 0; out.length < length; i += 1) {
    h ^= s.charCodeAt(i % s.length) + i;
    h = Math.imul(h, 16777619) >>> 0;
    out += '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'[h % 34];
  }
  return `${prefix}${out}`;
}

// ---------- Entries ----------

// A sale: gross (what they paid), our fee, what the coach keeps (net)
// currency / paidMinor / rate: what the buyer paid, in their currency
// (cents for USD), and what one unit was in rupees. gross is in rupees.
// listMinor and coupon ({ code, percent }) when a coupon took money off.
function saleEntry({
  id,
  at,
  gross,
  name,
  email = '',
  phone = '',
  offering,
  offeringKind,
  offeringWhen = null,
  source,
  currency = 'INR',
  paidMinor = null,
  rate = 1,
  coupon = null,
  listMinor = null,
}) {
  const paid = paidMinor ?? gross;
  const inr = currency === 'INR' ? paid : Math.round(paid * rate);
  const fee = Math.round(inr * COMMISSION_RATE);
  gross = inr;
  return {
    currency,
    paidMinor: paid,
    rate: currency === 'INR' ? 1 : rate,
    coupon,
    listMinor: listMinor ?? paid,
    id,
    kind: 'sale',
    at,
    amount: gross - fee,
    gross,
    fee,
    name: String(name ?? '').trim(),
    email,
    phone,
    offering,
    offeringKind, // 'webinar' | 'call' | 'product'
    offeringWhen, // 'Sat 7 Nov', the session or call it was for, or null
    source, // 'demo' | 'sample' | 'signup' | 'booking'
    ref: refFor('pay_', id),
  };
}

// refunded: rupees out of the balance; minor: what the buyer got back,
// in the currency they paid in (the same as refunded for rupees)
function refundEntry({ id, at, refunded, sale, why = null, minor = null }) {
  return {
    id,
    kind: 'refund',
    at,
    amount: -refunded,
    gross: refunded,
    minor: minor ?? refunded,
    currency: sale.currency ?? 'INR',
    name: sale.name,
    email: sale.email,
    offering: sale.offering,
    offeringKind: sale.offeringKind,
    saleId: sale.id,
    why, // 'cancelled' | 'removed' | null
    ref: refFor('rfnd_', id),
  };
}

function withdrawalEntry(w) {
  return {
    id: w.id,
    kind: 'withdrawal',
    at: w.at,
    amount: -w.amount,
    gross: w.amount,
    bank: w.bank ?? BANK,
    paidAt: Number.isFinite(w.paidAt) ? w.paidAt : null, // demo ones are already paid
    ref: w.ref,
  };
}

function taxEntry({ id, at, base, monthAt }) {
  const amount = Math.round(base * TDS_RATE);
  return { id, kind: 'tax', at, amount: -amount, gross: amount, base, month: monthLabel(monthAt), ref: refFor('tds_', id, 10) };
}

// ---------- The store ----------

// Bump when the demo history changes shape: older saved histories are made again
const VERSION = 2;

const EMPTY = {
  version: VERSION,
  seededAt: null,
  demo: [],
  demoOrders: [],
  samples: [],
  withdrawals: [],
  refunds: [],
  settledBefore: null,
  finishedBefore: null,
  hideDemo: false,
};

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (!saved || typeof saved !== 'object') return { ...EMPTY };
    return {
      version: Number.isFinite(saved.version) ? saved.version : 1,
      seededAt: Number.isFinite(saved.seededAt) ? saved.seededAt : null,
      demo: Array.isArray(saved.demo) ? saved.demo : [],
      demoOrders: Array.isArray(saved.demoOrders) ? saved.demoOrders : [],
      refunds: Array.isArray(saved.refunds) ? saved.refunds.filter((r) => r && Number.isFinite(r.minor)) : [],
      samples: Array.isArray(saved.samples) ? saved.samples : [],
      withdrawals: Array.isArray(saved.withdrawals) ? saved.withdrawals.filter((w) => w && Number.isFinite(w.amount)) : [],
      settledBefore: Number.isFinite(saved.settledBefore) ? saved.settledBefore : null,
      finishedBefore: Number.isFinite(saved.finishedBefore) ? saved.finishedBefore : null,
      hideDemo: saved.hideDemo === true,
    };
  } catch {
    return { ...EMPTY };
  }
}

function save(next) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(CHANGED_EVENT));
    return true;
  } catch {
    return false;
  }
}

const update = (change) => save({ ...load(), ...change(load()) });

// Anything that can change the ledger: its own store, sign-ups, bookings
// (here or in another tab). Returns the unsubscribe.
export function onEarningsChange(callback) {
  const fromOtherTab = (e) => {
    if (e.key === KEY || e.key === null) callback();
  };
  window.addEventListener(CHANGED_EVENT, callback);
  window.addEventListener('storage', fromOtherTab);
  const offSignups = onSignupsChange(callback);
  const offBookings = onBookingsChange(callback);
  const offPayouts = onPayoutsChange(callback);
  return () => {
    offPayouts();
    window.removeEventListener(CHANGED_EVENT, callback);
    window.removeEventListener('storage', fromOtherTab);
    offSignups();
    offBookings();
  };
}

// ---------- Real sales: sign-ups and bookings ----------

function liveEntries(webinars = []) {
  const out = [];
  const webinarType = funnelTypes.find((t) => t.id === 'webinar');
  webinars.forEach((w) => {
    const title = webinarType ? funnelName(w, webinarType) : 'Webinar';
    const when = webinarWhen(w.answers ?? {});
    peopleOf(w.id).forEach((p) => {
      if (!(p.amount > 0) || !Number.isFinite(p.registeredAt)) return;
      const sale = saleEntry({
        id: `sale-${p.id}`,
        at: p.registeredAt,
        gross: p.amount * 100,
        name: p.name,
        email: p.email,
        phone: p.phone,
        offering: title,
        offeringKind: 'webinar',
        offeringWhen: when ? `${when.weekday} ${when.day} ${when.month}` : null,
        source: 'signup',
      });
      out.push(sale);
      if (Number.isFinite(p.refundedAt) && p.refunded > 0) {
        out.push(
          refundEntry({
            id: `refund-${p.id}`,
            at: p.refundedAt,
            refunded: Math.min(p.amount, p.refunded) * 100,
            sale,
            why: Number.isFinite(p.removedAt) ? 'removed' : 'cancelled',
          }),
        );
      }
    });
  });
  loadBookings().forEach((b) => {
    const at = Date.parse(b.createdAt);
    if (!(b.paid > 0) || !Number.isFinite(at)) return;
    const start = Date.parse(b.start);
    out.push(
      saleEntry({
        id: `sale-${b.id}`,
        at,
        gross: Math.round(b.paid * 100),
        name: b.guest?.name,
        email: b.guest?.email ?? '',
        phone: b.guest?.phone ?? '',
        offering: b.title,
        offeringKind: 'call',
        offeringWhen: Number.isFinite(start) ? shortDay(start) : null,
        source: 'booking',
      }),
    );
  });
  return out;
}

// ---------- The balance ----------

// When a sale can be withdrawn, counting "Make everything ready now"
const readyTimeOf = (sale, settledBefore) =>
  settledBefore !== null && sale.at <= settledBefore ? Math.min(sale.at + SETTLE_MS, settledBefore) : sale.at + SETTLE_MS;

// Ready, arriving and total at moment t, from everything up to t
function balanceAt(entries, t, settledBefore = null) {
  let settled = 0;
  let pending = 0;
  let debits = 0;
  entries.forEach((e) => {
    if (e.at > t) return;
    if (e.kind === 'sale') {
      if (readyTimeOf(e, settledBefore) <= t) settled += e.amount;
      else pending += e.amount;
    } else {
      debits -= e.amount; // their amounts are negative
    }
  });
  const total = settled + pending - debits;
  const ready = Math.max(0, Math.min(total, settled - debits));
  return { ready, arriving: total - ready, total };
}

// Everything the page shows, worked out now:
//   entries:     newest first, each with balanceAfter (the total after it)
//                and, by kind, readyAt / arriving / refunded / refundId
//                (sales) or status / paidAt (withdrawals)
//   ready, arriving, total (paise)
//   releases:    [{ key, at, amount }] what becomes ready, by day, soonest first
//   processing:  withdrawals on their way to the bank
export function ledgerOf({ webinars = [], now = Date.now() } = {}) {
  const s = load();
  const base = [...(s.hideDemo ? [] : s.demo), ...s.samples, ...liveEntries(webinars)];
  // Refunds made from Transactions, in rupees at the payment's own rate
  const manual = s.refunds
    .map((r) => {
      const sale = base.find((e) => e.id === r.saleId && e.kind === 'sale');
      if (!sale) return null;
      const refunded = sale.currency && sale.currency !== 'INR' ? Math.round(r.minor * sale.rate) : r.minor;
      return refundEntry({ id: r.id, at: r.at, refunded, minor: r.minor, sale });
    })
    .filter(Boolean);
  const raw = [...base, ...manual, ...s.withdrawals.map(withdrawalEntry)].filter(
    (e) => e && Number.isFinite(e.at) && e.at <= now,
  );

  const entries = raw.map((e) => {
    if (e.kind === 'sale') {
      const readyAt = readyTimeOf(e, s.settledBefore);
      return { ...e, readyAt, arriving: readyAt > now };
    }
    if (e.kind === 'withdrawal') {
      const paidAt =
        e.paidAt ??
        (s.finishedBefore !== null && e.at <= s.finishedBefore ? Math.min(e.at + PAYOUT_MS, s.finishedBefore) : e.at + PAYOUT_MS);
      const paid = paidAt <= now;
      return { ...e, paidAt: paid ? paidAt : null, status: paid ? 'paid' : 'processing', utr: paid ? refFor('', e.id, 12) : null };
    }
    return e;
  });

  // Each sale knows what was refunded of it, and the refund's id
  entries
    .filter((e) => e.kind === 'refund')
    .forEach((r) => {
      const sale = entries.find((e) => e.id === r.saleId);
      if (!sale) return;
      sale.refunded = (sale.refunded ?? 0) + r.gross;
      sale.refundedMinor = (sale.refundedMinor ?? 0) + (r.minor ?? r.gross);
      sale.refundId = r.id;
    });

  // Oldest first for the running balance; ties keep money in before money out
  entries.sort((a, b) => a.at - b.at || b.amount - a.amount);
  let running = 0;
  entries.forEach((e) => {
    running += e.amount;
    e.balanceAfter = running;
  });
  entries.reverse();

  const { ready, arriving, total } = balanceAt(entries, now, s.settledBefore);

  const byDay = new Map();
  entries
    .filter((e) => e.kind === 'sale' && e.arriving)
    .forEach((e) => {
      const key = dayKey(e.readyAt);
      const day = byDay.get(key) ?? { key, at: e.readyAt, amount: 0 };
      day.at = Math.min(day.at, e.readyAt);
      day.amount += e.amount;
      byDay.set(key, day);
    });
  const releases = [...byDay.values()].sort((a, b) => a.at - b.at);

  return {
    entries,
    ready,
    arriving,
    total,
    releases,
    processing: entries.filter((e) => e.kind === 'withdrawal' && e.status === 'processing'),
  };
}

// ---------- The account statement (Sales → Withdrawals) ----------

// Everything ever withdrawn, on its way or reached the bank (paise)
export const totalWithdrawnOf = (entries) =>
  entries.filter((e) => e.kind === 'withdrawal').reduce((sum, e) => sum + e.gross, 0);

// 'YYYY-MM-DD' for the first day of this month and today, on the coach's clock
export function thisMonth(now = Date.now()) {
  const today = dayKey(now);
  return { from: `${today.slice(0, 8)}01`, to: today };
}

// The quick picks for a statement's period. Each ends today, except
// Last month. The financial year starts on 1 April.
export const PERIODS = [
  { id: 'this-month', label: 'This month' },
  { id: 'last-month', label: 'Last month' },
  { id: 'last-3-months', label: 'Last 3 months' },
  { id: 'this-fy', label: 'This financial year' },
];

// The earliest day a period can start (DatePicker's min)
export const STATEMENT_START = '2020-01-01';

const pad2 = (n) => String(n).padStart(2, '0');

// A quick pick → { from, to } ('YYYY-MM-DD', on the coach's clock)
export function periodRange(id, now = Date.now()) {
  const today = dayKey(now);
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7)); // 1–12
  const first = (yy, mm) => {
    const d = new Date(Date.UTC(yy, mm - 1, 1));
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-01`;
  };
  switch (id) {
    case 'last-month': {
      const from = first(y, m - 1);
      const last = new Date(Date.UTC(y, m - 1, 0)); // day 0 of this month
      return { from, to: `${last.getUTCFullYear()}-${pad2(last.getUTCMonth() + 1)}-${pad2(last.getUTCDate())}` };
    }
    case 'last-3-months':
      return { from: first(y, m - 2), to: today };
    case 'this-fy':
      return { from: `${m >= 4 ? y : y - 1}-04-01`, to: today };
    default:
      return thisMonth(now);
  }
}

// Which quick pick a range is, or 'custom'
export function periodOf({ from, to }, now = Date.now()) {
  const match = PERIODS.find((p) => {
    const r = periodRange(p.id, now);
    return r.from === from && r.to === to;
  });
  return match ? match.id : 'custom';
}

// A range in words: '1 Nov – 6 Nov 2026', '1 Oct 2026 – 6 Jan 2027',
// '6 Nov 2026' (one day). Earlier day first, whichever way it was picked.
export function rangeLabel({ from, to }) {
  const [a, b] = from <= to ? [from, to] : [to, from];
  const words = (key, withYear) => {
    const [yy, mm, dd] = key.split('-').map(Number);
    const opts = { day: 'numeric', month: 'short', timeZone: 'UTC', ...(withYear ? { year: 'numeric' } : {}) };
    return new Date(Date.UTC(yy, mm - 1, dd)).toLocaleDateString('en-GB', opts);
  };
  if (a === b) return words(a, true);
  return `${words(a, a.slice(0, 4) !== b.slice(0, 4))} – ${words(b, true)}`;
}

// The statement's lines: between two days (inclusive, 'YYYY-MM-DD' on the
// coach's clock), money in ('credit'), out ('debit') or both ('all'),
// newest or oldest first. Each keeps its balanceAfter from the ledger,
// so the Balance column is the same whatever is filtered.
export function statementOf(entries, { from, to, direction = 'all', order = 'newest' }) {
  const lo = from && to && from > to ? to : from;
  const hi = from && to && from > to ? from : to;
  const rows = entries.filter((e) => {
    const key = dayKey(e.at);
    if (lo && key < lo) return false;
    if (hi && key > hi) return false;
    if (direction === 'credit') return e.amount > 0;
    if (direction === 'debit') return e.amount < 0;
    return true;
  });
  return order === 'oldest' ? [...rows].reverse() : rows;
}

// What a line says, in plain words: { title, detail } (the detail
// carries the reference, so the title can lead with what happened)
export function describe(e) {
  switch (e.kind) {
    case 'sale':
      return { title: `Payment from ${e.name || 'a buyer'}`, detail: [e.offering, e.ref].filter(Boolean).join(' · ') };
    case 'refund':
      return { title: `Refund to ${e.name || 'a buyer'}`, detail: [e.offering, e.ref].filter(Boolean).join(' · ') };
    case 'withdrawal':
      return {
        title: `Withdrawal to ${bankLine(e.bank)}`,
        detail: e.utr ? `UTR ${e.utr} · ${e.ref}` : e.ref,
      };
    case 'tax':
      return { title: `TDS for ${e.month}`, detail: `Section 194-O · ${e.ref}` };
    default:
      return { title: 'Entry', detail: e.ref ?? '' };
  }
}

// A line's status: { text, tone }. tone is its pill's colour: 'done'
// (green), 'wait' (amber: still settling), 'refund' (amber: refunded) or
// 'processing' (blue: on its way to the bank)
export function statusOf(e, now = Date.now()) {
  if (e.kind === 'sale' && e.refunded) return { text: e.refunded >= e.gross ? 'Refunded' : 'Part refunded', tone: 'refund' };
  if (e.kind === 'sale' && e.arriving) return { text: `Withdrawable ${readyDay(e.readyAt, now)}`, tone: 'wait' };
  if (e.kind === 'withdrawal' && e.status === 'processing') return { text: 'Processing', tone: 'processing' };
  return { text: 'Success', tone: 'done' };
}

// The statement as a CSV file Excel opens: one row per line. The first
// character (a byte-order mark) makes Excel read ₹ and non-English names.
// Amounts are plain rupees with two decimals, so they add up in Excel.
export function statementCsv(rows, now = Date.now()) {
  const cell = (v) => {
    const text = String(v ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const rupees = (paise) => (paise / 100).toFixed(2);
  const lines = [
    ['Date', 'Time', 'Description', 'Details', 'Debit (₹)', 'Credit (₹)', 'Balance (₹)', 'Status'],
    ...rows.map((e) => {
      const { title, detail } = describe(e);
      return [
        dayKey(e.at),
        clockTime(e.at),
        title,
        detail,
        e.amount < 0 ? rupees(-e.amount) : '',
        e.amount > 0 ? rupees(e.amount) : '',
        rupees(e.balanceAfter),
        statusOf(e, now).text,
      ];
    }),
  ];
  return `\uFEFF${lines.map((r) => r.map(cell).join(',')).join('\r\n')}`;
}

// ---------- Orders (Sales → Transactions) ----------

// Free sign-ups and free call bookings made in this browser
function liveFreeOrders(webinars = []) {
  const out = [];
  const webinarType = funnelTypes.find((t) => t.id === 'webinar');
  webinars.forEach((w) => {
    const title = webinarType ? funnelName(w, webinarType) : 'Webinar';
    peopleOf(w.id).forEach((p) => {
      if (p.amount > 0 || !Number.isFinite(p.registeredAt)) return;
      out.push({
        id: `free-${p.id}`,
        kind: 'free',
        at: p.registeredAt,
        name: p.name,
        email: p.email,
        phone: p.phone,
        offering: title,
        offeringKind: 'webinar',
        currency: 'INR',
        paidMinor: 0,
      });
    });
  });
  loadBookings().forEach((b) => {
    const at = Date.parse(b.createdAt);
    if (b.paid > 0 || !Number.isFinite(at)) return;
    out.push({
      id: `free-${b.id}`,
      kind: 'free',
      at,
      name: b.guest?.name,
      email: b.guest?.email ?? '',
      phone: b.guest?.phone ?? '',
      offering: b.title,
      offeringKind: 'call',
      currency: 'INR',
      paidMinor: 0,
    });
  });
  return out;
}

// Every order, newest first:
//   { id, kind: 'paid' | 'free' | 'failed', at, name, email, phone,
//     offering, offeringKind, currency, paidMinor (what they paid, in their
//     currency), inr (the same in rupees), listMinor, coupon,
//     refundedMinor, status: 'completed' | 'part-refunded' | 'refunded' |
//     'failed', ref, invoiceNo (paid orders), why (failed: what happened) }
export function ordersOf({ webinars = [], now = Date.now() } = {}) {
  const s = load();
  const { entries } = ledgerOf({ webinars, now });
  const paid = entries
    .filter((e) => e.kind === 'sale')
    .map((e) => {
      const paidMinor = e.paidMinor ?? e.gross;
      const refundedMinor = e.refundedMinor ?? 0;
      return {
        id: e.id,
        kind: 'paid',
        at: e.at,
        name: e.name,
        email: e.email,
        phone: e.phone,
        offering: e.offering,
        offeringKind: e.offeringKind,
        currency: e.currency ?? 'INR',
        rate: e.rate ?? 1,
        paidMinor,
        listMinor: e.listMinor ?? paidMinor,
        coupon: e.coupon ?? null,
        inr: e.gross,
        refundedMinor,
        status: refundedMinor >= paidMinor ? 'refunded' : refundedMinor > 0 ? 'part-refunded' : 'completed',
        ref: e.ref,
      };
    });

  // Invoice numbers: <code>/<year>/<running number in that year>, in the
  // order the payments came in
  const perYear = {};
  [...paid]
    .sort((a, b) => a.at - b.at)
    .forEach((o) => {
      const year = dayKey(o.at).slice(0, 4);
      perYear[year] = (perYear[year] ?? 0) + 1;
      o.invoiceNo = `${BUSINESS.invoiceCode}/${year}/${String(perYear[year]).padStart(6, '0')}`;
    });

  const other = [...(s.hideDemo ? [] : s.demoOrders), ...liveFreeOrders(webinars)]
    .filter((o) => o && Number.isFinite(o.at) && o.at <= now)
    .map((o) => ({
      coupon: null,
      listMinor: o.paidMinor,
      inr: 0,
      refundedMinor: 0,
      rate: 1,
      ref: null,
      ...o,
      status: o.kind === 'failed' ? 'failed' : 'completed',
    }));

  return [...paid, ...other].sort((a, b) => b.at - a.at);
}

export const ORDER_STATUSES = [
  { id: 'completed', label: 'Completed' },
  { id: 'refunded', label: 'Refunded' },
  { id: 'failed', label: 'Failed' },
];

// What the Status column says
export const orderStatusLabel = (o) =>
  ({ completed: 'Completed', 'part-refunded': 'Part refunded', refunded: 'Refunded', failed: 'Failed' })[o.status] ??
  'Completed';

// The amount, in words on the row: '$158.99', '₹1,499' or 'Free'
export const orderAmount = (o) => (o.kind === 'free' ? 'Free' : moneyIn(o.paidMinor, o.currency));

// Orders between two days and matching the filters, newest first.
// filters: { query, offering ('' for all), status ('' | 'completed' |
// 'refunded' | 'failed'), currency ('' | 'INR' | 'USD' | 'EUR'), free (show
// free sign-ups) }. 'refunded' includes part refunds.
export function filterOrders(orders, { from, to, query = '', offering = '', status = '', currency = '', free = false }) {
  const lo = from && to && from > to ? to : from;
  const hi = from && to && from > to ? from : to;
  const needle = query.trim().toLowerCase();
  const digits = needle.replace(/\D/g, '');
  return orders.filter((o) => {
    const key = dayKey(o.at);
    if (lo && key < lo) return false;
    if (hi && key > hi) return false;
    if (!free && o.kind === 'free') return false;
    if (offering && o.offering !== offering) return false;
    if (status === 'refunded' && !(o.status === 'refunded' || o.status === 'part-refunded')) return false;
    if (status && status !== 'refunded' && o.status !== status) return false;
    if (currency && (o.kind === 'free' || o.currency !== currency)) return false;
    if (needle) {
      const hay = [o.name, o.email].join(' ').toLowerCase();
      const phone = String(o.phone ?? '').replace(/\D/g, '');
      if (!hay.includes(needle) && !(digits.length >= 3 && phone.includes(digits))) return false;
    }
    return true;
  });
}

// The two numbers over the list: what came in (rupees, after refunds)
// and how many payments went through
export function orderTotals(orders) {
  const ok = orders.filter((o) => o.kind === 'paid');
  const sales = ok.reduce((sum, o) => sum + o.inr - Math.round((o.refundedMinor ?? 0) * (o.currency === 'INR' ? 1 : o.rate)), 0);
  return { sales, count: ok.filter((o) => o.status !== 'refunded').length };
}

// Every offering that has orders, for the Offering filter
export const offeringsOf = (orders) => [...new Set(orders.map((o) => o.offering).filter(Boolean))].sort();

// The orders as a CSV file Excel opens
export function ordersCsv(rows) {
  const cell = (v) => {
    const text = String(v ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [
    ['Date', 'Time', 'Customer', 'Email', 'Phone', 'Offering', 'Currency', 'Amount', 'Amount (₹)', 'Coupon', 'Status', 'Payment ID', 'Invoice no'],
    ...rows.map((o) => [
      dayKey(o.at),
      clockTime(o.at),
      o.name,
      o.email,
      o.phone,
      o.offering,
      o.kind === 'free' ? '' : o.currency,
      o.kind === 'free' ? '0' : (o.paidMinor / 100).toFixed(2),
      o.kind === 'paid' ? (o.inr / 100).toFixed(2) : '',
      o.coupon ? `${o.coupon.code} (${o.coupon.percent}% off)` : '',
      o.kind === 'free' ? 'Free' : orderStatusLabel(o),
      o.ref ?? '',
      o.invoiceNo ?? '',
    ]),
  ];
  return `\uFEFF${lines.map((r) => r.map(cell).join(',')).join('\r\n')}`;
}

// ---------- Refunding a payment ----------

// What can still be refunded, in the payment's currency
export const refundableOf = (o) => (o.kind === 'paid' ? Math.max(0, o.paidMinor - (o.refundedMinor ?? 0)) : 0);

// What a refund takes out of the balance, in rupees
export const refundCost = (o, minor) => (o.currency === 'INR' ? minor : Math.round(minor * o.rate));

// What's wrong with refunding this much, or null when it's fine.
// total: the coach's whole balance (withdrawable and settling), in rupees
export function refundProblem(o, minor, total) {
  const left = refundableOf(o);
  if (!Number.isFinite(minor)) return 'Enter an amount, like 500 or 500.50.';
  if (minor <= 0) return 'Enter an amount to refund.';
  if (minor > left) return `You can refund up to ${moneyIn(left, o.currency)}.`;
  if (refundCost(o, minor) > total)
    return `Your balance is ${money(total)}, less than this refund. It can be refunded once more money comes in.`;
  return null;
}

// Refunds the buyer. Returns the refund's id, or null.
export function refundOrder(orderId, minor, { webinars = [], now = Date.now() } = {}) {
  const order = ordersOf({ webinars, now }).find((o) => o.id === orderId);
  const { total } = ledgerOf({ webinars, now });
  if (!order || refundProblem(order, minor, total)) return null;
  const id = `rf-${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const ok = update((st) => ({ refunds: [...st.refunds, { id, saleId: orderId, at: now, minor }] }));
  return ok ? id : null;
}

// ---------- Withdrawing ----------

// What's wrong with this amount, or null when it's fine to withdraw
export function withdrawProblem(paise, ready) {
  if (!Number.isFinite(paise)) return 'Enter an amount in rupees, like 5000 or 5000.50.';
  if (paise <= 0) return 'Enter an amount to withdraw.';
  if (paise > ready) return `You have ${money(ready)} ready to withdraw.`;
  if (paise < MIN_WITHDRAWAL) return `The smallest withdrawal is ${money(MIN_WITHDRAWAL)}.`;
  return null;
}

// Starts a withdrawal to their bank. Returns its id, or null if the
// amount isn't allowed or it couldn't be saved.
// Only to a verified bank account.
export function requestWithdrawal(paise, { webinars = [], now = Date.now() } = {}) {
  const { ready } = ledgerOf({ webinars, now });
  const bank = currentBank(now);
  if (!bank || withdrawProblem(paise, ready)) return null;
  const id = `wd-${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const ok = save({ ...load(), withdrawals: [...load().withdrawals, { id, at: now, amount: paise, bank, ref: refFor('pout_', id) }] });
  return ok ? id : null;
}

// ---------- Demo history (remove for production) ----------

// A steady random sequence, so the demo is the same for everyone
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DEMO_DAYS = 80;
const IST = 5.5 * HOUR; // the demo is made on India time

// usd: the price abroad, in dollars (euros are a little less)
const DEMO_OFFERINGS = [
  { title: 'Fix the Vasthu Mistakes That Block Money – Live Webinar', kind: 'webinar', price: 499, usd: 9, weight: 45 },
  { title: 'Money Corner Masterclass', kind: 'webinar', price: 1499, usd: 19, weight: 25 },
  { title: '1:1 Vasthu Consultation for Your Home', kind: 'call', price: 2999, usd: 39, weight: 20 },
  { title: 'Home Energy Reset – 21 Day Program', kind: 'product', price: 4999, usd: 59, weight: 10 },
];

// The free one, for free sign-ups
const DEMO_FREE = { title: 'Vasthu Basics – Free Live Q&A', kind: 'webinar' };

const DEMO_COUPONS = [
  { code: 'WELCOME10', percent: 10 },
  { code: 'FRIEND20', percent: 20 },
];

// What someone pays for an offering: rupees mostly, now and then dollars
// or euros, sometimes with a coupon
function demoPrice(rand, offering) {
  const r = rand();
  const currency = r < 0.08 ? 'USD' : r < 0.11 ? 'EUR' : 'INR';
  const list = currency === 'INR' ? offering.price * 100 : currency === 'USD' ? offering.usd * 100 : (offering.usd - 2) * 100;
  const coupon = rand() < 0.12 ? pick(rand, DEMO_COUPONS) : null;
  const paid = coupon ? Math.round((list * (100 - coupon.percent)) / 100) : list;
  return { currency, listMinor: list, paidMinor: paid, coupon, rate: CURRENCIES[currency].rate };
}

const DEMO_PEOPLE = [
  'Ananya Rao', 'Rohit Mehta', 'Priya Sharma', 'Karthik Subramanian', 'Sneha Iyer', 'Vikram Desai', 'Lakshmi Narayanan',
  'Arjun Nair', 'Divya Menon', 'Suresh Kumar', 'Meena Krishnan', 'Rahul Verma', 'Pooja Gupta', 'Aditya Joshi',
  'Kavya Reddy', 'Nikhil Shetty', 'Shalini Pillai', 'Manoj Patil', 'Revathi Srinivasan', 'Imran Shaikh',
  'Deepa Bhat', 'Sanjay Malhotra', 'Harini Venkatesh', 'Gautam Chopra', 'Nandini Rajan', 'Farhan Ali',
];

const pick = (rand, list) => list[Math.floor(rand() * list.length)];
const pickWeighted = (rand, list) => {
  let r = rand() * list.reduce((sum, x) => sum + x.weight, 0);
  return list.find((x) => (r -= x.weight) < 0) ?? list[list.length - 1];
};
const emailOf = (name) => `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@gmail.com`;
const abroadPhoneOf = (rand) =>
  `${pick(rand, ['+1', '+44', '+971', '+65'])} ${String(Math.floor(rand() * 1e9)).padStart(9, '0').replace(/(\d{3})(\d{3})(\d{3})$/, '$1 $2 $3')}`;
const phoneOf = (rand) => `+91 9${String(Math.floor(rand() * 1e9)).padStart(9, '0').replace(/(\d{4})(\d{5})$/, '$1 $2')}`;

// Start of the India day that `ms` falls on
const istDayStart = (ms) => Math.floor((ms + IST) / DAY) * DAY - IST;

function makeDemo(now) {
  const rand = seeded(20261106);
  const today = istDayStart(now);

  // Sales: 0 to 3 a day, between 9 am and 10 pm, a few in the last days
  // so some are still arriving
  const sales = [];
  for (let k = DEMO_DAYS; k >= 0; k -= 1) {
    const dayStart = today - k * DAY;
    const r = rand();
    let n = r < 0.3 ? 0 : r < 0.65 ? 1 : r < 0.9 ? 2 : 3;
    if (k <= 2 && n === 0) n = 1;
    for (let i = 0; i < n; i += 1) {
      const at = Math.round(dayStart + (9 + rand() * 13) * HOUR);
      const offering = pickWeighted(rand, DEMO_OFFERINGS);
      const name = pick(rand, DEMO_PEOPLE);
      const price = demoPrice(rand, offering);
      const phone = price.currency === 'INR' ? phoneOf(rand) : abroadPhoneOf(rand);
      if (at > now - 15 * 60_000) continue; // nothing in the future
      sales.push(
        saleEntry({
          id: `demo-sale-${k}-${i}`,
          at,
          gross: null,
          ...price,
          name,
          email: emailOf(name),
          phone,
          offering: offering.title,
          offeringKind: offering.kind,
          source: 'demo',
        }),
      );
    }
  }

  // Free sign-ups and failed payments: orders, but no money moved
  const orders = [];
  for (let k = DEMO_DAYS; k >= 0; k -= 1) {
    const dayStart = today - k * DAY;
    if (rand() < 0.45) {
      const at = Math.round(dayStart + (8 + rand() * 14) * HOUR);
      const name = pick(rand, DEMO_PEOPLE);
      if (at <= now - 15 * 60_000) {
        orders.push({
          id: `demo-free-${k}`,
          kind: 'free',
          at,
          name,
          email: emailOf(name),
          phone: phoneOf(rand),
          offering: DEMO_FREE.title,
          offeringKind: DEMO_FREE.kind,
          currency: 'INR',
          paidMinor: 0,
        });
      }
    }
    if (rand() < 0.07) {
      const at = Math.round(dayStart + (9 + rand() * 13) * HOUR);
      const offering = pickWeighted(rand, DEMO_OFFERINGS);
      const name = pick(rand, DEMO_PEOPLE);
      if (at <= now - 15 * 60_000) {
        orders.push({
          id: `demo-failed-${k}`,
          kind: 'failed',
          at,
          name,
          email: emailOf(name),
          phone: phoneOf(rand),
          offering: offering.title,
          offeringKind: offering.kind,
          currency: 'INR',
          paidMinor: offering.price * 100,
          ref: refFor('pay_', `demo-failed-${k}`),
          why: pick(rand, ['The bank declined the card.', 'The UPI payment timed out.', 'They closed the payment page.']),
        });
      }
    }
  }

  // One refund: the sale closest to three weeks ago, two days later
  const others = [];
  const target = now - 21 * DAY;
  const refunded = sales
    .filter((s) => s.gross >= 1499 * 100 && s.currency === 'INR')
    .sort((a, b) => Math.abs(a.at - target) - Math.abs(b.at - target))[0];
  if (refunded && refunded.at + 2 * DAY < now) {
    others.push(refundEntry({ id: 'demo-refund-1', at: refunded.at + 2 * DAY, refunded: refunded.gross, sale: refunded }));
  }

  // TDS: each month's sales, deducted on the 7th of the next month, 11 am
  const months = new Map();
  sales.forEach((s) => {
    const d = new Date(s.at + IST);
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    const m = months.get(key) ?? { y: d.getUTCFullYear(), m: d.getUTCMonth(), base: 0, at: s.at };
    m.base += s.gross;
    months.set(key, m);
  });
  months.forEach((m, key) => {
    const at = Date.UTC(m.y, m.m + 1, 7, 5, 30); // 11:00 am in India
    if (at <= now && m.base > 0) others.push(taxEntry({ id: `demo-tds-${key}`, at, base: m.base, monthAt: m.at }));
  });

  // Withdrawals: every nine days at 11 am, everything ready in whole
  // rupees (so a few paise stay behind, as they do in real life)
  const withdrawals = [];
  for (let k = DEMO_DAYS - 10; k >= 6; k -= 9) {
    const at = today - k * DAY + 11 * HOUR;
    const { ready } = balanceAt([...sales, ...others, ...withdrawals], at);
    const amount = Math.floor(ready / 100) * 100;
    if (amount < MIN_WITHDRAWAL) continue;
    const id = `demo-wd-${k}`;
    withdrawals.push(
      withdrawalEntry({ id, at, amount, bank: BANK, paidAt: at + 20 * HOUR + Math.round(rand() * 3 * HOUR), ref: refFor('pout_', id) }),
    );
  }

  return { ledger: [...sales, ...others, ...withdrawals], orders };
}

// Makes the demo history once, the first time (App.jsx calls it)
// (and again for a history saved before VERSION)
export function seedDemoEarnings(now = Date.now()) {
  const s = load();
  if (s.seededAt !== null && s.version === VERSION) return;
  const demo = makeDemo(now);
  save({ ...EMPTY, hideDemo: s.version === VERSION && s.hideDemo, seededAt: now, demo: demo.ledger, demoOrders: demo.orders });
}

// ---------- Prototype controls (not part of the product) ----------

// A made-up sale, just now
export function addSampleSale(now = Date.now()) {
  const rand = Math.random;
  const offering = pickWeighted(rand, DEMO_OFFERINGS);
  const name = pick(rand, DEMO_PEOPLE);
  const price = demoPrice(rand, offering);
  const sale = saleEntry({
    id: `sample-sale-${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    at: now,
    gross: null,
    ...price,
    name,
    email: emailOf(name),
    phone: price.currency === 'INR' ? phoneOf(rand) : abroadPhoneOf(rand),
    offering: offering.title,
    offeringKind: offering.kind,
    source: 'sample',
  });
  return update((s) => ({ samples: [...s.samples, sale] }));
}

// Every sale so far counts as settled, skipping the 72 hours
export const settleAllNow = (now = Date.now()) => update(() => ({ settledBefore: now }));

// Every withdrawal so far counts as having reached the bank
export const finishWithdrawalsNow = (now = Date.now()) => update(() => ({ finishedBefore: now }));

// A new account: no demo history, samples or withdrawals. Real sign-ups
// and bookings still show, since they're real.
export const startEmpty = () =>
  update(() => ({ hideDemo: true, samples: [], withdrawals: [], refunds: [], settledBefore: null, finishedBefore: null }));

// Back to the demo history, made fresh for today
export function startOver(now = Date.now()) {
  const demo = makeDemo(now);
  return save({ ...EMPTY, seededAt: now, demo: demo.ledger, demoOrders: demo.orders });
}

export const showingDemo = () => !load().hideDemo;