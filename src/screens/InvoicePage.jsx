import { Printer } from 'lucide-react';
import { amountInWords, clockTime, dayKey, invoiceFrom, moneyIn, ordersOf } from '../data/earnings';
import { loadSaved } from '../utils/storage';
import './InvoicePage.css';

// ------------------------------------------------------------
// One payment's invoice, in the coach's name: what Sales → Transactions'
// "Download invoice" opens in a new tab (/?mock=invoice&order=<id>).
// The prototype's PDF is the browser's print (Save as PDF); the real
// product makes the PDF on the server from this same layout.
//
// The seller's details come from Settings → Payment details → Your
// invoices (invoiceFrom in data/earnings.js): the name they chose, the
// business's legal name under it when that's different, the address, the
// GSTIN and state when the business is registered, and their note above
// the footer. "For …" is the legal name, as it's the one that signs.
//
//   [HN]  Harish Neel                                   INVOICE
//         7/4, 6th street, … Chennai 600024             6f63/2026/000534
//         Not registered for GST                        6 Nov 2026
//   ─────────────────────────────────────────────────────────────
//   Billed to                        Payment
//   Ameer Basha                      Paid on 6 Nov 2026, 7:49 am
//   ameer227@gmail.com               pay_XZC8RRCZCLS0T8
//   +971 561 496 570
//   ┌────────────────────────────────────────────────────────────┐
//   │ Description                       Qty  Price  Discount  Amount (USD) │
//   │ AI Engineering Accelerator (+ …)    1  176.66  17.67     158.99 │
//   └────────────────────────────────────────────────────────────┘
//                                       GST          Not charged
//                                       Total paid   $158.99
//   One Hundred Fifty Eight US Dollars and Ninety Nine Cents Only
//   ─────────────────────────────────────────────────────────────
//   Computer-generated invoice; no signature needed.   For Harish Neel
//                                           E. & O.E.
//
// Kept from TagMango's: the coach's name, logo and address at the top;
// invoice number <code>/<year>/<running number>; billed to with email and
// phone; one line with quantity, discount and amount in the buyer's
// currency; the total in words; "For <coach>, computer generated"; E. & O.E.
// Fixed: the offering's name as written (theirs drops "+" and brackets),
// the phone with its country code, one total instead of Total and Grand
// Total, GST that says why it's not charged, the coupon by name, and
// when and how it was paid (theirs doesn't say it was paid at all). A
// refund shows under the total.
//
// orderId: the order (ordersOf in data/earnings.js)
// ------------------------------------------------------------

// '2026-11-06' → '6 Nov 2026'
const dateLabel = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

// Plain numbers for the table, the currency named in its header, always
// with two decimals as invoices do: '1,499.00', '158.99'
const plain = (minor, currency) =>
  (Math.abs(minor) / 100).toLocaleString(currency === 'INR' ? 'en-IN' : 'en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function InvoicePage({ orderId }) {
  const webinars = (loadSaved().funnels ?? []).filter((f) => f.type === 'webinar');
  const order = ordersOf({ webinars }).find((o) => o.id === orderId && o.kind === 'paid');

  if (!order) {
    return (
      <main className="inv-page">
        <div className="inv inv--missing">
          <h1 className="inv-missing__title">This invoice can’t be found</h1>
          <p className="inv-missing__text">Open it again from Sales → Transactions.</p>
        </div>
      </main>
    );
  }

  const c = order.currency;
  const discount = order.listMinor - order.paidMinor;
  const time = clockTime(order.at);
  // The coach, or their verified business (Settings → Payment details)
  const BUSINESS = invoiceFrom();

  return (
    <main className="inv-page">
      <div className="inv-bar">
        <button type="button" className="inv-bar__btn" onClick={() => window.print()}>
          <Printer size={16} aria-hidden="true" /> Save as PDF
        </button>
        <p className="inv-bar__hint">In the print window, choose “Save as PDF”.</p>
      </div>

      <article className="inv" aria-label={`Invoice ${order.invoiceNo}`}>
        <header className="inv__head">
          <div className="inv__from">
            <span className="inv__logo" aria-hidden="true">
              {BUSINESS.initials}
            </span>
            <div>
              <p className="inv__business">{BUSINESS.name}</p>
              {BUSINESS.legalName && <p className="inv__muted">{BUSINESS.legalName}</p>}
              <p className="inv__muted">{BUSINESS.address}</p>
              <p className="inv__muted">
                {BUSINESS.gstin ? `GSTIN ${BUSINESS.gstin}, ${BUSINESS.gstState}` : 'Not registered for GST'}
              </p>
            </div>
          </div>
          <div className="inv__title-block">
            <h1 className="inv__title">Invoice</h1>
            <dl className="inv__meta">
              <div>
                <dt>Invoice no</dt>
                <dd>{order.invoiceNo}</dd>
              </div>
              <div>
                <dt>Date</dt>
                <dd>{dateLabel(dayKey(order.at))}</dd>
              </div>
            </dl>
          </div>
        </header>

        <section className="inv__parties">
          <div>
            <h2 className="inv__label">Billed to</h2>
            <p className="inv__strong">{order.name || '—'}</p>
            {order.email && <p>{order.email}</p>}
            {order.phone && <p>{order.phone}</p>}
          </div>
          <div>
            <h2 className="inv__label">Payment</h2>
            <p className="inv__strong">
              Paid on {dateLabel(dayKey(order.at))}, {time}
            </p>
            <p>Payment ID {order.ref}</p>
          </div>
        </section>

        <table className="inv__table">
          <thead>
            <tr>
              <th scope="col">Description</th>
              <th scope="col" className="inv__num">
                Qty
              </th>
              <th scope="col" className="inv__num">
                Price
              </th>
              <th scope="col" className="inv__num">
                Discount
              </th>
              <th scope="col" className="inv__num">
                Amount ({c})
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                {order.offering}
                {order.coupon && (
                  <span className="inv__coupon">
                    Coupon {order.coupon.code}, {order.coupon.percent}% off
                  </span>
                )}
              </td>
              <td className="inv__num">1</td>
              <td className="inv__num">{plain(order.listMinor, c)}</td>
              <td className="inv__num">{plain(discount, c)}</td>
              <td className="inv__num">{plain(order.paidMinor, c)}</td>
            </tr>
          </tbody>
        </table>

        <dl className="inv__totals">
          <div>
            <dt>GST</dt>
            <dd>{BUSINESS.gstin ? 'Included' : 'Not charged'}</dd>
          </div>
          <div className="inv__total">
            <dt>Total paid</dt>
            <dd>{moneyIn(order.paidMinor, c)}</dd>
          </div>
          {order.refundedMinor > 0 && (
            <div>
              <dt>Refunded</dt>
              <dd>{moneyIn(-order.refundedMinor, c)}</dd>
            </div>
          )}
        </dl>
        <p className="inv__words">{amountInWords(order.paidMinor, c)}</p>

        {BUSINESS.note && <p className="inv__note">{BUSINESS.note}</p>}

        <footer className="inv__foot">
          <p className="inv__muted">This is a computer-generated invoice and needs no signature.</p>
          <div className="inv__sign">
            <p className="inv__strong">For {BUSINESS.legalName ?? BUSINESS.name}</p>
            <p className="inv__muted">Authorised signatory</p>
          </div>
          <p className="inv__eoe">E. &amp; O.E.</p>
        </footer>
      </article>
    </main>
  );
}