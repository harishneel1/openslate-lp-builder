import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  Landmark,
  Package,
  Receipt,
  RotateCcw,
  Users,
  Video,
} from 'lucide-react';
import DatePicker, { usePanel } from '../components/DatePicker';
import {
  PERIODS,
  SETTLE_LABEL,
  STATEMENT_START,
  addSampleSale,
  finishWithdrawalsNow,
  settleAllNow,
  showingDemo,
  startEmpty,
  startOver,
  dayKey,
  ledgerOf,
  onEarningsChange,
  ordersOf,
  periodOf,
  periodRange,
  rangeLabel,
} from '../data/earnings';
import '../components/PrototypeControls.css'; // the Prototype controls panel, as on a batch's page

// ------------------------------------------------------------
// What Sales' two tabs (TransactionsTab.jsx, WithdrawalsTab.jsx) share:
// the money, kept up to date; the period button and its picks; the
// All / Credit / Debit kind of control; page buttons; and the Prototype
// controls under both tabs. Styles are in
// SalesPage.css.
// ------------------------------------------------------------

// The money now: the ledger (balances, statement) and every order.
// Re-reads when it changes (here or in another tab) and every 15 seconds,
// so payments become withdrawable and withdrawals arrive by themselves.
export function useMoney(webinars) {
  const [tick, setTick] = useState(0);
  useEffect(() => onEarningsChange(() => setTick((n) => n + 1)), []);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(id);
  }, []);
  return useMemo(() => {
    const now = Date.now();
    return { now, ...ledgerOf({ webinars, now }), orders: ordersOf({ webinars, now }) };
  }, [webinars, tick]); // eslint-disable-line react-hooks/exhaustive-deps
}

// A coloured tile, as Cloud Storage's files have: an icon on its kind's
// tint (SalesPage.css). The kinds and their colours, the same everywhere
// in Sales:
//   webinar  orange (our primary)   call  blue   product  green
//   sale     green (money in)       refund  amber
//   withdrawal  blue (to your bank) tax  grey
const TILE_ICONS = {
  webinar: Video,
  call: Users,
  product: Package,
  sale: ArrowDownLeft,
  refund: RotateCcw,
  withdrawal: Landmark,
  tax: Receipt,
};

export function Tile({ kind, icon, size = 'md' }) {
  const Icon = icon ?? TILE_ICONS[kind] ?? Receipt;
  return (
    <span className={`sx-tile sx-tile--${kind} sx-tile--${size}`} aria-hidden="true">
      <Icon size={size === 'lg' ? 20 : 16} />
    </span>
  );
}

// One number over a list, with its tile: Total sales, Withdrawable balance
export function Stat({ kind, icon, label, children }) {
  return (
    <div className="wd-stat">
      <Tile kind={kind} icon={icon} size="lg" />
      <div className="wd-stat__text">
        <h2 className="wd-stat__label">{label}</h2>
        <p className="wd-stat__value">{children}</p>
      </div>
    </div>
  );
}

// One control of a few choices, the chosen one filled white:
// [All | Credit | Debit]. options: [{ id, label }]
export function Segmented({ options, value, onChange, label }) {
  return (
    <div className="wd-seg" role="group" aria-label={label}>
      {options.map((d) => (
        <button
          key={d.id}
          type="button"
          className="wd-seg__btn"
          aria-pressed={value === d.id}
          onClick={() => onChange(d.id)}
        >
          {d.label}
        </button>
      ))}
    </div>
  );
}

// ---------- The period ----------

// Quick picks, then Custom with From and To (our date picker, past days
// only). Used in the period button's panel and in the download pop-up.
// onPick(range, { quick }) : quick is true for a quick pick
export function PeriodChoice({ range, now, onPick, idPrefix }) {
  const current = periodOf(range, now);
  const [custom, setCustom] = useState(current === 'custom');
  const today = dayKey(now);
  const choose = (id) => {
    setCustom(false);
    onPick(periodRange(id, now), { quick: true });
  };
  return (
    <div className="wd-period">
      <div className="wd-period__picks" role="group" aria-label="Period">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            className="wd-period__pick"
            aria-pressed={!custom && current === p.id}
            onClick={() => choose(p.id)}
          >
            {p.label}
            {!custom && current === p.id && <Check size={15} aria-hidden="true" />}
          </button>
        ))}
        <button
          type="button"
          className="wd-period__pick"
          aria-pressed={custom || current === 'custom'}
          onClick={() => setCustom(true)}
        >
          Custom
          {(custom || current === 'custom') && <Check size={15} aria-hidden="true" />}
        </button>
      </div>

      {(custom || current === 'custom') && (
        <div className="wd-period__custom">
          <div className="wd-period__field">
            <label className="wd-period__label" htmlFor={`${idPrefix}-from`}>
              From
            </label>
            <DatePicker
              id={`${idPrefix}-from`}
              value={range.from}
              min={STATEMENT_START}
              max={today}
              className="wd-period__date"
              onChange={(from) => onPick(from > range.to ? { from: range.to, to: from } : { ...range, from }, { quick: false })}
            />
          </div>
          <div className="wd-period__field">
            <label className="wd-period__label" htmlFor={`${idPrefix}-to`}>
              To
            </label>
            <DatePicker
              id={`${idPrefix}-to`}
              value={range.to}
              min={STATEMENT_START}
              max={today}
              className="wd-period__date"
              onChange={(to) => onPick(to < range.from ? { from: to, to: range.from } : { ...range, to }, { quick: false })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// The period beside Download statement: '📅 1 Nov – 6 Nov 2026 ▾'. A quick
// pick closes it; Custom stays open while both days are picked.
export function RangeButton({ range, now, onChange }) {
  const { open, setOpen, close, wrapRef, triggerRef, onPanelKeyDown } = usePanel();
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
        <CalendarDays size={16} aria-hidden="true" />
        <span className="oh__sr-only">Period: </span>
        <span className="wd-rng__label">{rangeLabel(range)}</span>
        <ChevronDown size={16} aria-hidden="true" className="wd-rng__chevron" />
      </button>
      {open && (
        <div className="wd-rng__panel" role="dialog" aria-label="Choose a period" onKeyDown={onPanelKeyDown}>
          <PeriodChoice
            range={range}
            now={now}
            idPrefix="wd-rng"
            onPick={(next, { quick }) => {
              onChange(next);
              if (quick) close();
            }}
          />
        </div>
      )}
    </div>
  );
}

// ‹ 1 2 … 7 8 9 … 14 › : the first, last and two around the current page
export function Pager({ at, pages, onPage }) {
  const nums = [];
  for (let n = 1; n <= pages; n += 1) {
    if (n === 1 || n === pages || Math.abs(n - at) <= 1) nums.push(n);
    else if (nums[nums.length - 1] !== '…') nums.push('…');
  }
  return (
    <nav className="wd-pager__nav" aria-label="Statement pages">
      <button type="button" className="wd-pager__btn" disabled={at === 1} onClick={() => onPage(at - 1)} aria-label="Previous page">
        <ChevronLeft size={16} aria-hidden="true" />
      </button>
      {nums.map((n, i) =>
        n === '…' ? (
          <span key={`gap-${i}`} className="wd-pager__gap">
            …
          </span>
        ) : (
          <button
            key={n}
            type="button"
            className="wd-pager__btn"
            aria-current={n === at ? 'page' : undefined}
            onClick={() => onPage(n)}
          >
            {n}
          </button>
        ),
      )}
      <button
        type="button"
        className="wd-pager__btn"
        disabled={at === pages}
        onClick={() => onPage(at + 1)}
        aria-label="Next page"
      >
        <ChevronRight size={16} aria-hidden="true" />
      </button>
    </nav>
  );
}

// ---------- Prototype controls: not part of the product ----------
// The same panel as on a batch's page (PrototypeControls.css)
const OPEN_KEY = 'pagebuilder:sales-controls-open';

export function SalesTestControls() {
  const [open, setOpen] = useState(() => {
    try {
      return sessionStorage.getItem(OPEN_KEY) === '1';
    } catch {
      return false;
    }
  });
  const toggle = () =>
    setOpen((o) => {
      try {
        sessionStorage.setItem(OPEN_KEY, o ? '0' : '1');
      } catch {
        // fine: it just won't be remembered
      }
      return !o;
    });
  const demo = showingDemo();

  return (
    <section className={`proto wd-proto ${open ? 'proto--open' : ''}`} aria-label="Prototype controls">
      <button type="button" className="proto__head" aria-expanded={open} onClick={toggle}>
        <FlaskConical size={16} aria-hidden="true" />
        <span className="proto__title">Prototype controls</span>
        <span className="proto__tag">For testing, not part of the product</span>
        <ChevronDown size={16} className="proto__chevron" aria-hidden="true" />
      </button>

      {open && (
        <div className="proto__body">
          <div className="proto__row">
            <span className="proto__label">Payments</span>
            <div className="proto__controls">
              <button type="button" className="proto__btn" onClick={() => addSampleSale()}>
                Add a payment now
              </button>
              <button type="button" className="proto__btn" onClick={() => settleAllNow()}>
                Make everything withdrawable
              </button>
              <p className="proto__note">
                A payment becomes withdrawable {SETTLE_LABEL} after it’s made. “Make everything withdrawable” skips that
                wait for every payment so far.
              </p>
            </div>
          </div>
          <div className="proto__row">
            <span className="proto__label">Withdrawals</span>
            <div className="proto__controls">
              <button type="button" className="proto__btn" onClick={() => finishWithdrawalsNow()}>
                Reach the bank now
              </button>
              <p className="proto__note">In the prototype a withdrawal reaches the bank 3 minutes after it’s made.</p>
            </div>
          </div>
          <div className="proto__row">
            <span className="proto__label">History</span>
            <div className="proto__controls">
              <button type="button" className="proto__btn" aria-pressed={!demo} onClick={() => startEmpty()}>
                Start empty
              </button>
              <button type="button" className="proto__btn" onClick={() => startOver()}>
                Start over with sample history
              </button>
              <p className="proto__note">
                {demo ? 'Showing about 80 days of sample history. ' : 'Showing a new account. '}
                Real webinar sign-ups and call bookings made in this browser always show.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}