import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Download, FileText, RotateCcw, Search, ShoppingBag, SlidersHorizontal, TrendingUp } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import InfoTip from '../components/InfoTip';
import RowMenu from '../components/RowMenu';
import { usePanel } from '../components/DatePicker';
import { Pager, PeriodChoice, RangeButton, Segmented, Stat, Tile, useMoney } from './SalesShared';
import {
  CURRENCIES,
  ORDER_STATUSES,
  amountInput,
  clockTime,
  dayKey,
  filterOrders,
  money,
  moneyIn,
  offeringsOf,
  orderAmount,
  orderStatusLabel,
  orderTotals,
  ordersCsv,
  parseAmount,
  rangeLabel,
  refundCost,
  refundOrder,
  refundProblem,
  refundableOf,
  thisMonth,
} from '../data/earnings';
import './OfferingsHome.css'; // panels and buttons
import './SalesPage.css';

// ------------------------------------------------------------
// Sales → Transactions: TagMango's transactions page, in our UI, with as
// little on it as possible (data/earnings.js keeps the orders).
//
//   ┌──────────────────────────────────────┐
//   │ Total sales        Successful orders │
//   │ ₹38,998            24                │
//   └──────────────────────────────────────┘
//   ┌ Transactions ────────────────────────────────────────────────────┐
//   │ [🔍 Name, email or phone] [Filters 2]  [📅 1 Nov – 6 Nov 2026 ▾] [⤓ Download] │
//   │ Date        Customer              Offering              Amount   Status     │
//   │ 6 Nov 2026  Ameer Basha           AI Engineering …      $158.99ⓘ Completed ⋯│
//   │ 7:49 am     ameer227@gmail.com ⧉  WELCOME10 · 10% off                       │
//   │             +971 561 496 570 ⧉                                              │
//   │                          ‹ 1 2 3 ›                                          │
//   └──────────────────────────────────────────────────────────────────┘
//
//   - Two numbers for the period and filters: Total sales (rupees, after
//     refunds) and Successful orders (payments that went through and
//     weren't refunded in full).
//   - Search finds a name, an email or a phone number (any 3+ digits).
//   - Filters, in one small panel: Offering, Status (Completed, Refunded,
//     Failed), Currency (INR, USD, EUR) and Show free sign-ups (off to
//     start with: free sign-ups aren't money). The button shows how many
//     are on; Clear filters turns them all off.
//   - The period and Download work as on Withdrawals: the same period
//     button, and a pop-up with the period and status that downloads a
//     CSV of the orders (with the search and other filters as they are).
//   - Amount is what the buyer paid, in their currency ($158.99, €17);
//     for dollars and euros the ⓘ says what it came to in rupees. A free
//     sign-up says Free. A coupon shows under the offering.
//   - Each offering has its kind's tile (webinar orange, call blue,
//     product green), as Cloud Storage's files do. Status is a coloured
//     pill: Completed green, Refunded amber, Failed red (what happened
//     is in its ⓘ), Free sign-up grey.
//   - ⋯: Issue refund and Download invoice. Neither does anything for a
//     free sign-up or a failed payment, and refunding stops once all of it
//     was refunded; the menu says why under each.
//   - Issue refund opens a pop-up: Full or Part (an amount in the buyer's
//     currency), and what comes out of the coach's balance, in rupees.
//     All of it comes out of their balance: our fee isn't given back. It
//     can't be more than their whole balance. The row then says Refunded
//     or Part refunded, and the Withdrawals statement has the refund.
//   - Download invoice opens the invoice, in the coach's name, in a new
//     tab (InvoicePage.jsx), to save as a PDF.
//   - 20 a page. On a phone each order is a small card.
//
// webinars: every webinar session, for real sign-ups
// ------------------------------------------------------------

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [{ id: '', label: 'All' }, ...ORDER_STATUSES];
const CURRENCY_OPTIONS = [{ id: '', label: 'All' }, ...Object.keys(CURRENCIES).map((c) => ({ id: c, label: c }))];
const NO_FILTERS = { offering: '', status: '', currency: '', free: false };

export default function TransactionsTab({ webinars = [] }) {
  const { orders, total, now } = useMoney(webinars);
  const [range, setRange] = useState(() => thisMonth(now));
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState(NO_FILTERS);
  const [page, setPage] = useState(1);
  const [menuFor, setMenuFor] = useState(null);
  const [refunding, setRefunding] = useState(null);
  const [downloading, setDownloading] = useState(false);

  const rows = useMemo(() => filterOrders(orders, { ...range, query, ...filters }), [orders, range, query, filters]);
  const totals = useMemo(() => orderTotals(rows), [rows]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const at = Math.min(page, pages);
  const shown = rows.slice((at - 1) * PAGE_SIZE, at * PAGE_SIZE);

  // Any change to what's shown starts again from page 1
  useEffect(() => setPage(1), [range.from, range.to, query, filters]);

  const refundingOrder = refunding ? orders.find((o) => o.id === refunding) : null;

  return (
    <>
      <section className="oh__panel wd-bal" aria-label="Totals">
        <div className="wd-bal__grid tx-totals">
          <Stat kind="sale" icon={TrendingUp} label="Total sales">
            {money(totals.sales)}
          </Stat>
          <Stat kind="webinar" icon={ShoppingBag} label="Successful orders">
            {totals.count}
          </Stat>
        </div>
      </section>

      <section className="oh__panel" aria-labelledby="tx-title">
        <div className="oh__panel-head wd-st__head">
          <h2 className="oh__panel-title" id="tx-title">
            Transactions
          </h2>

          <div className="wd-st__tools">
            <div className="wd-st__group tx-left">
              <label className="tx-search">
                <Search size={16} aria-hidden="true" />
                <span className="oh__sr-only">Search transactions</span>
                <input
                  type="search"
                  value={query}
                  placeholder="Name, email or phone"
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
                />
              </label>
              <FiltersButton filters={filters} offerings={offeringsOf(orders)} onChange={setFilters} />
            </div>

            <div className="wd-st__group wd-st__group--end">
              <RangeButton range={range} now={now} onChange={setRange} />
              <button type="button" className="oh__edit wd-st__download" onClick={() => setDownloading(true)}>
                <Download size={15} aria-hidden="true" /> Download
              </button>
            </div>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="oh__panel-body">
            <p className="wd-st__empty">
              {orders.length === 0
                ? 'No transactions yet. Payments for your webinars and 1:1 calls show up here.'
                : query.trim()
                  ? `No one matching “${query.trim()}” in ${rangeLabel(range)}.`
                  : `No transactions in ${rangeLabel(range)}${countOn(filters) ? ' with these filters' : ''}.`}
            </p>
          </div>
        ) : (
          <>
            <div className="wd-table__wrap">
              <table className="wd-table tx-table">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Customer</th>
                    <th scope="col">Offering</th>
                    <th scope="col" className="wd-num">
                      Amount
                    </th>
                    <th scope="col">Status</th>
                    <th scope="col">
                      <span className="oh__sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((o) => (
                    <OrderRow
                      key={o.id}
                      order={o}
                      menuOpen={menuFor === o.id}
                      onMenu={(open) => setMenuFor(open ? o.id : null)}
                      onRefund={() => {
                        setMenuFor(null);
                        setRefunding(o.id);
                      }}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="wd-pager">
              <p className="wd-pager__count">
                {pages === 1
                  ? `${rows.length} ${rows.length === 1 ? 'transaction' : 'transactions'}`
                  : `${(at - 1) * PAGE_SIZE + 1}–${Math.min(at * PAGE_SIZE, rows.length)} of ${rows.length} transactions`}
              </p>
              {pages > 1 && <Pager at={at} pages={pages} onPage={setPage} />}
            </div>
          </>
        )}
      </section>

      {refundingOrder && (
        <RefundDialog
          order={refundingOrder}
          balance={total}
          onCancel={() => setRefunding(null)}
          onConfirm={(minor) => {
            refundOrder(refundingOrder.id, minor, { webinars });
            setRefunding(null);
          }}
        />
      )}

      {downloading && (
        <DownloadDialog
          orders={orders}
          now={now}
          start={{ range, query, filters }}
          onClose={() => setDownloading(false)}
        />
      )}
    </>
  );
}

const countOn = (f) => [f.offering, f.status, f.currency, f.free].filter(Boolean).length;

// ---------- Filters ----------
// One button, a small panel under it. Every change applies at once.
function FiltersButton({ filters, offerings, onChange }) {
  const { open, setOpen, close, wrapRef, triggerRef, onPanelKeyDown } = usePanel();
  const on = countOn(filters);
  const set = (change) => onChange({ ...filters, ...change });

  return (
    <div className="wd-rng" ref={wrapRef}>
      <button
        type="button"
        ref={triggerRef}
        className="wd-rng__btn"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <SlidersHorizontal size={16} aria-hidden="true" />
        Filters
        {on > 0 && (
          <span className="tx-count" aria-label={`${on} on`}>
            {on}
          </span>
        )}
      </button>

      {open && (
        <div className="wd-rng__panel tx-filters" role="dialog" aria-label="Filters" onKeyDown={onPanelKeyDown}>
          <label className="tx-filters__label" htmlFor="tx-offering">
            Offering
          </label>
          <div className="wd-sort tx-filters__select">
            <select id="tx-offering" value={filters.offering} onChange={(e) => set({ offering: e.target.value })}>
              <option value="">All offerings</option>
              {offerings.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <p className="tx-filters__label">Status</p>
          <Segmented options={STATUS_OPTIONS} value={filters.status} onChange={(status) => set({ status })} label="Status" />

          <p className="tx-filters__label">Currency</p>
          <Segmented
            options={CURRENCY_OPTIONS}
            value={filters.currency}
            onChange={(currency) => set({ currency })}
            label="Currency"
          />

          <label className="tx-switch">
            <span>Show free sign-ups</span>
            <input type="checkbox" role="switch" checked={filters.free} onChange={(e) => set({ free: e.target.checked })} />
            <span className="tx-switch__track" aria-hidden="true" />
          </label>

          {on > 0 && (
            <button type="button" className="tx-filters__clear" onClick={() => onChange(NO_FILTERS)}>
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- One order ----------

// 'YYYY-MM-DD' → '6 Nov 2026'
const dateLabel = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

function OrderRow({ order: o, menuOpen, onMenu, onRefund }) {
  const left = refundableOf(o);
  const noMoney = o.kind === 'free' ? 'It was a free sign-up.' : o.kind === 'failed' ? 'The payment didn’t go through.' : null;
  const items = [
    {
      label: 'Issue refund',
      icon: RotateCcw,
      disabled: Boolean(noMoney) || left === 0,
      hint: noMoney ?? (left === 0 ? 'It was refunded in full.' : undefined),
      onSelect: onRefund,
    },
    {
      label: 'Download invoice',
      icon: FileText,
      disabled: Boolean(noMoney),
      hint: noMoney ? 'No payment, so no invoice.' : undefined,
      onSelect: () => {
        onMenu(false);
        window.open(`/?mock=invoice&order=${encodeURIComponent(o.id)}`, '_blank', 'noopener');
      },
    },
  ];

  return (
    <tr className="wd-row tx-row">
      <td className="wd-row__date" data-label="Date">
        <span>{dateLabel(dayKey(o.at))}</span>
        <span className="wd-row__time">{clockTime(o.at)}</span>
      </td>
      <td className="tx-row__who">
        <span className="wd-row__title">{o.name || 'No name given'}</span>
        {o.email && <CopyLine text={o.email} label="email" />}
        {o.phone && <CopyLine text={o.phone} label="phone number" />}
      </td>
      <td className="tx-row__what">
        <div className="sx-with-tile">
          <Tile kind={o.offeringKind === 'call' || o.offeringKind === 'product' ? o.offeringKind : 'webinar'} />
          <div className="sx-with-tile__text">
            <span>{o.offering}</span>
            {o.coupon && (
              <span className="tx-coupon">
                {o.coupon.code} · {o.coupon.percent}% off
              </span>
            )}
          </div>
        </div>
      </td>
      <td className="wd-num tx-row__amount">
        <span className={`tx-amount ${o.kind === 'failed' ? 'tx-amount--failed' : ''}`}>{orderAmount(o)}</span>
        {o.kind === 'paid' && o.currency !== 'INR' && (
          <InfoTip label={`${orderAmount(o)} in rupees`} text={`${money(o.inr)} in rupees`} align="end" />
        )}
      </td>
      <td className="tx-row__status">
        <span className={`sx-pill sx-pill--${o.kind === 'free' ? 'free' : o.status}`}>
          {o.kind === 'free' ? 'Free sign-up' : orderStatusLabel(o)}
        </span>
        {o.kind === 'failed' && o.why && <InfoTip label="Why it failed" text={o.why} align="end" />}
      </td>
      <td className="tx-row__menu">
        <RowMenu title={`${o.name || 'this order'}’s order`} open={menuOpen} onOpenChange={onMenu} items={items} />
      </td>
    </tr>
  );
}

// An email or phone number with a copy button beside it
function CopyLine({ text, label }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return undefined;
    const id = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(id);
  }, [copied]);
  return (
    <span className="tx-copy">
      <span className="tx-copy__text">{text}</span>
      <button
        type="button"
        className="tx-copy__btn"
        aria-label={copied ? 'Copied' : `Copy ${label}`}
        onClick={() => navigator.clipboard?.writeText(text).then(() => setCopied(true), () => {})}
      >
        {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
      </button>
    </span>
  );
}

// ---------- Issue refund ----------
// Full or part, in the buyer's currency; what comes out of the balance,
// in rupees. Enter refunds when the amount is fine.
function RefundDialog({ order, balance, onCancel, onConfirm }) {
  const left = refundableOf(order);
  const [mode, setMode] = useState('full');
  const [text, setText] = useState(() => amountInput(left));
  const [touched, setTouched] = useState(false);
  const input = useRef(null);

  const minor = mode === 'full' ? left : parseAmount(text);
  const problem = refundProblem(order, minor, balance);
  const symbol = CURRENCIES[order.currency]?.symbol ?? '₹';

  useEffect(() => {
    if (mode !== 'part') return undefined;
    const id = requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.select();
    });
    return () => cancelAnimationFrame(id);
  }, [mode]);

  const confirm = () => {
    setTouched(true);
    if (!problem) onConfirm(minor);
  };

  return (
    <ConfirmDialog
      form
      title={`Refund ${order.name || 'this buyer'}`}
      confirmLabel={problem ? 'Refund' : `Refund ${moneyIn(minor, order.currency)}`}
      confirmDisabled={Boolean(problem)}
      onCancel={onCancel}
      onConfirm={confirm}
    >
      <div className="wd-dlg">
        <p className="tx-refund__what">
          {order.offering} · paid {moneyIn(order.paidMinor, order.currency)} on {dateLabel(dayKey(order.at))}
          {order.refundedMinor > 0 && ` · ${moneyIn(order.refundedMinor, order.currency)} already refunded`}
        </p>

        <Segmented
          options={[
            { id: 'full', label: order.refundedMinor > 0 ? 'The rest' : 'Full refund' },
            { id: 'part', label: 'Part of it' },
          ]}
          value={mode}
          onChange={setMode}
          label="How much"
        />

        {mode === 'part' && (
          <>
            <label className="wd-dlg__label tx-refund__label" htmlFor="tx-refund-amount">
              Amount
            </label>
            <div className={`wd-dlg__box ${touched && problem ? 'wd-dlg__box--error' : ''}`}>
              <span aria-hidden="true">{symbol}</span>
              <input
                ref={input}
                id="tx-refund-amount"
                inputMode="decimal"
                autoComplete="off"
                value={text}
                aria-invalid={(touched && Boolean(problem)) || undefined}
                aria-describedby="tx-refund-error"
                onChange={(e) => {
                  setText(e.target.value);
                  setTouched(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    confirm();
                  }
                }}
              />
            </div>
          </>
        )}

        <p className="wd-dlg__error" id="tx-refund-error" role="alert">
          {(touched || mode === 'full') && problem}
        </p>

        {!problem && (
          <p className="tx-refund__cost">
            {money(refundCost(order, minor))} comes out of your balance.
          </p>
        )}
        <p className="wd-dlg__note">They usually get it back in 5 to 7 working days.</p>
      </div>
    </ConfirmDialog>
  );
}

// ---------- Download ----------
// The period and status, starting with what the list shows; the search
// and the other filters stay as they are. A CSV that Excel opens.
function DownloadDialog({ orders, now, start, onClose }) {
  const [range, setRange] = useState(start.range);
  const [status, setStatus] = useState(start.filters.status);
  const rows = useMemo(
    () => filterOrders(orders, { ...range, query: start.query, ...start.filters, status }),
    [orders, range, status, start],
  );

  const download = () => {
    const blob = new Blob([ordersCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const [from, to] = range.from <= range.to ? [range.from, range.to] : [range.to, range.from];
    a.href = url;
    a.download = `transactions-${from}-to-${to}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    onClose();
  };

  return (
    <ConfirmDialog
      form
      title="Download transactions"
      confirmLabel="Download"
      confirmDisabled={rows.length === 0}
      onCancel={onClose}
      onConfirm={download}
    >
      <div className="wd-dl">
        <p className="wd-dl__label">Period</p>
        <PeriodChoice range={range} now={now} idPrefix="tx-dl" onPick={(next) => setRange(next)} />

        <p className="wd-dl__label">Status</p>
        <Segmented options={STATUS_OPTIONS} value={status} onChange={setStatus} label="Status" />

        {rows.length === 0 && (
          <p className="wd-dl__empty" role="status">
            Nothing to download for {rangeLabel(range)}.
          </p>
        )}
      </div>
    </ConfirmDialog>
  );
}