import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Banknote, Download, Landmark, Wallet } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import InfoTip from '../components/InfoTip';
import { Pager, PeriodChoice, RangeButton, Segmented, Stat, Tile, useMoney } from './SalesShared';
import {
  BANK,
  MIN_WITHDRAWAL,
  PAYOUT_PROMISE,
  SETTLE_LABEL,
  bankLine,
  clockTime,
  dayKey,
  describe,
  money,
  parseRupees,
  rangeLabel,
  requestWithdrawal,
  rupeesInput,
  statementCsv,
  statementOf,
  statusOf,
  thisMonth,
  totalWithdrawnOf,
  withdrawProblem,
} from '../data/earnings';
import './OfferingsHome.css'; // panels and buttons
import './SalesPage.css';

// ------------------------------------------------------------
// Sales → Withdrawals: TagMango's withdrawals page, in our UI, with as
// little on it as possible (data/earnings.js keeps the money).
//
//   ┌──────────────────────────────────────────────────────────────────┐
//   │ Total balance    Withdrawable balance ⓘ   Total withdrawn  [Request withdrawal] │
//   │ ₹39,653.65       ₹27,020.55               ₹1,36,087                │
//   └──────────────────────────────────────────────────────────────────┘
//   ┌ Account statement ───────────────────────────────────────────────┐
//   │ [All|Credit|Debit] [Newest first ▾]   [📅 1 Nov – 6 Nov 2026 ▾] [⤓ Download statement] │
//   │ Date        Description               Debit   Credit  Balance  Status │
//   │ 6 Nov 2026  Payment from Sneha Iyer           +₹2,849 ₹34,659  Withdrawable Mon 9 Nov │
//   │ 1:35 pm     1:1 Vasthu Consultation · pay_…                          │
//   │                          ‹ 1 2 3 ›                                   │
//   └──────────────────────────────────────────────────────────────────┘
//
//   - Three numbers, nothing under them. Total balance is withdrawable
//     plus still settling; the ⓘ on Withdrawable balance says why some
//     of it isn't withdrawable yet, in one sentence. A withdrawal on its
//     way shows in the statement ("Processing"), not as a line here.
//   - Request withdrawal is greyed out, with the reason under it, while
//     less than the minimum (₹100) is withdrawable. It opens a pop-up:
//     the amount (everything withdrawable to start with), the bank, and
//     when it gets there.
//   - The statement: All / Credit / Debit and newest or oldest first on
//     the left; the period on the right, beside Download statement. The
//     period button (RangeButton) opens quick picks (This month, Last
//     month, Last 3 months, This financial year) and Custom: From and To
//     with our own date picker (DatePicker.jsx), not the browser's.
//   - Download statement opens a pop-up (DownloadDialog) that starts with
//     what the table shows: the period and All / Credit / Debit, both
//     changeable. It downloads a CSV Excel opens. When the choice has no
//     lines, Download is greyed out and says so.
//   - Descriptions say what happened in plain words ("Payment from Sneha
//     Iyer"); the reference is the small line under it. Credits are what
//     the coach receives: the page never talks about our fee.
//   - Each line has its kind's tile (payment green, refund amber,
//     withdrawal blue, TDS grey), and its status is a coloured pill:
//     Success green, Withdrawable Mon 9 Nov amber, Refunded amber,
//     Processing blue. The balances have tiles in the same colours.
//   - Balance is the coach's total with us after that line, whatever the
//     filter. 20 lines a page. On a phone each line is a small card.
//
// webinars: every webinar session, for real sign-ups' sales and refunds
// ------------------------------------------------------------

const PAGE_SIZE = 20;

const DIRECTIONS = [
  { id: 'all', label: 'All' },
  { id: 'credit', label: 'Credit' },
  { id: 'debit', label: 'Debit' },
];

export default function WithdrawalsTab({ webinars = [] }) {
  const ledger = useMoney(webinars);
  const [withdrawing, setWithdrawing] = useState(false);
  const [failed, setFailed] = useState(false);

  const confirmWithdraw = (paise) => {
    setWithdrawing(false);
    setFailed(!requestWithdrawal(paise, { webinars }));
  };

  return (
    <>
      <Balances ledger={ledger} failed={failed} onWithdraw={() => setWithdrawing(true)} />
      <Statement entries={ledger.entries} now={ledger.now} />

      {withdrawing && (
        <WithdrawDialog ready={ledger.ready} onCancel={() => setWithdrawing(false)} onConfirm={confirmWithdraw} />
      )}

    </>
  );
}

// ---------- The three balances ----------

function Balances({ ledger, failed, onWithdraw }) {
  const { ready, total, entries } = ledger;
  const canWithdraw = ready >= MIN_WITHDRAWAL;
  const why = canWithdraw
    ? null
    : ready > 0
      ? `You can withdraw once ${money(MIN_WITHDRAWAL)} is withdrawable.`
      : 'Nothing is withdrawable yet.';

  return (
    <section className="oh__panel wd-bal" aria-label="Balances">
      <div className="wd-bal__grid">
        <Stat kind="webinar" icon={Wallet} label="Total balance">
          {money(total)}
        </Stat>

        <Stat
          kind="sale"
          icon={Banknote}
          label={
            <>
              Withdrawable balance
              <InfoTip
                label="What is Withdrawable balance?"
                text={`Payments become withdrawable ${SETTLE_LABEL} after they’re made.`}
              />
            </>
          }
        >
          {money(ready)}
        </Stat>

        <Stat kind="withdrawal" icon={Landmark} label="Total withdrawn">
          {money(totalWithdrawnOf(entries))}
        </Stat>

        <div className="wd-bal__action">
          <button
            type="button"
            className="oh__add wd-bal__withdraw"
            aria-disabled={!canWithdraw || undefined}
            aria-describedby={why ? 'wd-why' : undefined}
            onClick={() => canWithdraw && onWithdraw()}
          >
            Request withdrawal
          </button>
          {why && (
            <p className="wd-bal__why" id="wd-why">
              {why}
            </p>
          )}
        </div>
      </div>

      {failed && (
        <p className="wd-bal__line wd-bal__line--error" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>That withdrawal couldn’t be made, and nothing left your balance. Try again.</span>
        </p>
      )}
    </section>
  );
}

// ---------- The account statement ----------

// 'YYYY-MM-DD' → '1 Nov 2026'
const dateLabel = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

function Statement({ entries, now }) {
  const [direction, setDirection] = useState('all');
  const [range, setRange] = useState(() => thisMonth(now));
  const [order, setOrder] = useState('newest');
  const [page, setPage] = useState(1);
  const [downloading, setDownloading] = useState(false);

  const rows = useMemo(
    () => statementOf(entries, { from: range.from, to: range.to, direction, order }),
    [entries, range.from, range.to, direction, order],
  );

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const at = Math.min(page, pages);
  const shown = rows.slice((at - 1) * PAGE_SIZE, at * PAGE_SIZE);

  // Any change to what's shown starts again from page 1
  useEffect(() => setPage(1), [direction, range.from, range.to, order]);

  return (
    <section className="oh__panel" aria-labelledby="wd-st-title">
      <div className="oh__panel-head wd-st__head">
        <h2 className="oh__panel-title" id="wd-st-title">
          Account statement
        </h2>

        <div className="wd-st__tools">
          <div className="wd-st__group">
            <Segmented options={DIRECTIONS} value={direction} onChange={setDirection} label="Show" />
            <label className="wd-sort">
              <span className="oh__sr-only">Order</span>
              <select value={order} onChange={(e) => setOrder(e.target.value)}>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </label>
          </div>

          <div className="wd-st__group wd-st__group--end">
            <RangeButton range={range} now={now} onChange={setRange} />
            <button type="button" className="oh__edit wd-st__download" onClick={() => setDownloading(true)}>
              <Download size={15} aria-hidden="true" /> Download statement
            </button>
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="oh__panel-body">
          <p className="wd-st__empty">
            {entries.length === 0
              ? 'Nothing here yet. Payments for your webinars and 1:1 calls show up here.'
              : `Nothing ${direction === 'credit' ? 'came in' : direction === 'debit' ? 'went out' : 'happened'} in ${rangeLabel(range)}.`}
          </p>
        </div>
      ) : (
        <>
          <div className="wd-table__wrap">
            <table className="wd-table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Description</th>
                  <th scope="col" className="wd-num">
                    Debit
                  </th>
                  <th scope="col" className="wd-num">
                    Credit
                  </th>
                  <th scope="col" className="wd-num">
                    Balance
                  </th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((e) => (
                  <Row key={e.id} entry={e} now={now} />
                ))}
              </tbody>
            </table>
          </div>

          <div className="wd-pager">
            <p className="wd-pager__count">
              {pages === 1
                ? `${rows.length} ${rows.length === 1 ? 'line' : 'lines'}`
                : `${(at - 1) * PAGE_SIZE + 1}–${Math.min(at * PAGE_SIZE, rows.length)} of ${rows.length} lines`}
            </p>
            {pages > 1 && <Pager at={at} pages={pages} onPage={setPage} />}
          </div>
        </>
      )}

      {downloading && (
        <DownloadDialog
          entries={entries}
          now={now}
          start={{ range, direction }}
          onClose={() => setDownloading(false)}
        />
      )}
    </section>
  );
}

// ---------- Download statement ----------
// Starts with what the table shows; the period and All / Credit / Debit
// can change. A CSV that Excel opens.
function DownloadDialog({ entries, now, start, onClose }) {
  const [range, setRange] = useState(start.range);
  const [direction, setDirection] = useState(start.direction);
  const rows = useMemo(() => statementOf(entries, { ...range, direction, order: 'newest' }), [entries, range, direction]);

  const download = () => {
    const blob = new Blob([statementCsv(rows, now)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const [from, to] = range.from <= range.to ? [range.from, range.to] : [range.to, range.from];
    a.href = url;
    a.download = `statement-${from}-to-${to}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    onClose();
  };

  return (
    <ConfirmDialog
      form
      title="Download statement"
      confirmLabel="Download"
      confirmDisabled={rows.length === 0}
      onCancel={onClose}
      onConfirm={download}
    >
      <div className="wd-dl">
        <p className="wd-dl__label" id="wd-dl-period">
          Period
        </p>
        <PeriodChoice range={range} now={now} idPrefix="wd-dl" onPick={(next) => setRange(next)} />

        <p className="wd-dl__label">Include</p>
        <Segmented options={DIRECTIONS} value={direction} onChange={setDirection} label="Include" />

        {rows.length === 0 && (
          <p className="wd-dl__empty" role="status">
            Nothing to download for {rangeLabel(range)}.
          </p>
        )}
      </div>
    </ConfirmDialog>
  );
}

function Row({ entry: e, now }) {
  const { title, detail } = describe(e);
  const status = statusOf(e, now);
  const [y, m, d] = dayKey(e.at).split('-');
  return (
    <tr className="wd-row">
      <td className="wd-row__date" data-label="Date">
        <span>{dateLabel(`${y}-${m}-${d}`)}</span>
        <span className="wd-row__time">{clockTime(e.at)}</span>
      </td>
      <td className="wd-row__desc" data-label="Description">
        <div className="sx-with-tile">
          <Tile kind={e.kind} />
          <div className="sx-with-tile__text">
            <span className="wd-row__title">{title}</span>
            <span className="wd-row__detail">{detail}</span>
          </div>
        </div>
      </td>
      <td className="wd-num wd-row__debit" data-label="Debit">
        {e.amount < 0 ? money(e.amount) : <span className="wd-dash">–</span>}
      </td>
      <td className="wd-num wd-row__credit" data-label="Credit">
        {e.amount > 0 ? money(e.amount, { sign: true }) : <span className="wd-dash">–</span>}
      </td>
      <td className="wd-num wd-row__balance" data-label="Balance">
        {money(e.balanceAfter)}
      </td>
      <td className="wd-row__status" data-label="Status">
        <span className={`sx-pill sx-pill--${status.tone}`}>{status.text}</span>
      </td>
    </tr>
  );
}

// ---------- Request withdrawal ----------
// The amount (everything withdrawable, to start with), where it goes, and
// when it gets there. Enter withdraws when the amount is fine.
function WithdrawDialog({ ready, onCancel, onConfirm }) {
  const [text, setText] = useState(() => rupeesInput(ready));
  const [touched, setTouched] = useState(false);
  const input = useRef(null);
  const paise = parseRupees(text);
  const problem = withdrawProblem(paise, ready);

  // The amount box gets the keyboard once the pop-up has opened
  // (ConfirmDialog puts it on Cancel first)
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.select();
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const confirm = () => {
    setTouched(true);
    if (!problem) onConfirm(paise);
  };

  return (
    <ConfirmDialog
      form
      title="Request withdrawal"
      confirmLabel={problem ? 'Withdraw' : `Withdraw ${money(paise)}`}
      confirmDisabled={Boolean(problem)}
      onCancel={onCancel}
      onConfirm={confirm}
    >
      <div className="wd-dlg">
        <label className="wd-dlg__label" htmlFor="wd-dlg-amount">
          Amount
        </label>
        <div className={`wd-dlg__box ${touched && problem ? 'wd-dlg__box--error' : ''}`}>
          <span aria-hidden="true">₹</span>
          <input
            ref={input}
            id="wd-dlg-amount"
            inputMode="decimal"
            autoComplete="off"
            value={text}
            aria-invalid={(touched && Boolean(problem)) || undefined}
            aria-describedby="wd-dlg-hint wd-dlg-error"
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
        <p className="wd-dlg__hint" id="wd-dlg-hint">
          {money(ready)} withdrawable
          {paise !== ready && (
            <>
              {' · '}
              <button
                type="button"
                className="wd-dlg__all"
                onClick={() => {
                  setText(rupeesInput(ready));
                  input.current?.focus();
                }}
              >
                Withdraw all
              </button>
            </>
          )}
        </p>
        <p className="wd-dlg__error" id="wd-dlg-error" role="alert">
          {touched && problem}
        </p>

        <div className="wd-dlg__to">
          <span className="wd-dlg__bank-icon" aria-hidden="true">
            <Landmark size={16} />
          </span>
          <div>
            <p className="wd-dlg__bank">{bankLine()}</p>
            <p className="wd-dlg__holder">{BANK.holder}</p>
          </div>
        </div>
        <p className="wd-dlg__note">It usually reaches your bank {PAYOUT_PROMISE}.</p>
      </div>
    </ConfirmDialog>
  );
}