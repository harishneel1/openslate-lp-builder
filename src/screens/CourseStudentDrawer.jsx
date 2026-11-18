import { FileText, Mail, MessageCircle, Phone, RotateCcw } from 'lucide-react';
import Drawer from '../components/Drawer';
import GuestInitials from '../components/GuestInitials';
import { moneyIn } from '../data/earnings';
import { whatsappHref } from '../utils/whatsapp';
import '../components/BookingDrawer.css'; // the same panel sections as a booking's and a batch member's
import './CourseStudents.css';

// ------------------------------------------------------------
// One course student, in a panel from the right: opened by a click on
// their row on the Students tab (CourseStudents.jsx), as a batch member's
// opens (MemberDrawer.jsx).
//
//   (PR) Priya Raman                                        ✕
//   [💬] [✉] [📞]                      (ways to reach them)
//   ┌ [Paid] Joined 12 Nov 2026                            ┐
//   │ ▓▓▓▓░░░░ 4 of 12 lessons                             │
//   │ Last opened: Setting up your workspace               │
//   └──────────────────────────────────────────────────────┘
//   About Priya       email, phone, joined
//   Payment           what they paid, line by line:
//     Price ₹2,499 · Coupon WELCOME10 −₹250 · GST · Total ₹2,249
//     Paid 12 Nov 2026, 7:49 pm · Payment ID pay_… · [Invoice ↗]
//     Refunded ₹2,249 on 14 Nov 2026     (once refunded)
//   Their answers     the checkout's questions
//   ─────────────────────────────────────────────────────────
//   [↺ Refund]                         (a payment that can be refunded)
//
// Once refunded, the box at the top says they don't have the course any
// more. Refund opens Sales' pop-up (onRefund, asked by the Students tab).
// A student who paid more than once has a block for each payment, newest
// first.
//
// student: from studentsOfCourse (courseStudents.js); course
// orderOf(signupId) → the payment's order in Sales, or null: Refund and
//   the invoice need it
// onClose(), onRefund(signupId)
// ------------------------------------------------------------

// '12 Nov 2026'
export const joinedDay = (ms) =>
  ms ? new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const telHref = (phone) => `tel:${String(phone ?? '').replace(/\s/g, '')}`;
const minorOf = (amount) => Math.round((Number(amount) || 0) * 100);
const when = (ms) => {
  const d = new Date(ms);
  return `${joinedDay(ms)}, ${d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }).toLowerCase()}`;
};

const STATUS = {
  paid: { cls: 'completed', label: 'Paid' },
  free: { cls: 'free', label: 'Free' },
  refunded: { cls: 'refunded', label: 'Refunded' },
};

export default function CourseStudentDrawer({ student: s, orderOf, onClose, onRefund }) {
  const name = s.name || 'Student';
  const first = name.split(/\s+/)[0];
  const status = STATUS[s.status];
  const refundOrder = s.refundable ? orderOf(s.refundable.id) : null;
  const lastRefund = s.payments.find((p) => Number.isFinite(p.refundedAt)) ?? null;

  const reach = [
    s.phone && { label: `WhatsApp ${name}`, href: whatsappHref(s.phone, `Hi ${first}, `), external: true, icon: MessageCircle },
    s.email && { label: `Email ${name}`, href: `mailto:${s.email}`, icon: Mail },
    s.phone && { label: `Call ${name}`, href: telHref(s.phone), icon: Phone },
  ].filter((r) => r && r.href);

  const footer = refundOrder ? (
    <div className="cst-drawer__foot">
      <button type="button" className="bk-btn bk-btn--danger-outline" onClick={() => onRefund(s.refundable.id)}>
        <RotateCcw size={16} aria-hidden="true" /> Refund
      </button>
      <span className="cst-drawer__foot-note">Full or part. Either way, they lose the course.</span>
    </div>
  ) : null;

  return (
    <Drawer
      title={name}
      media={<GuestInitials name={name} size="lg" />}
      extra={
        reach.length > 0 && (
          <div className="bkd__reach">
            {reach.map(({ label, href, external, icon: Icon }) => (
              <a
                key={label}
                className="bkd__contact"
                href={href}
                {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
                aria-label={label}
                data-tip={label}
              >
                <Icon size={18} aria-hidden="true" />
              </a>
            ))}
          </div>
        )
      }
      onClose={onClose}
      footer={footer}
      className="bkd cst-drawer"
    >
      {/* Where they are: their access and how far they've got */}
      <div className={`cst-drawer__status ${s.hasAccess ? '' : 'cst-drawer__status--gone'}`}>
        <p className="cst-drawer__status-line">
          <span className={`sx-pill sx-pill--${status.cls}`}>{status.label}</span>
          <span className="cst-drawer__status-detail">Joined {joinedDay(s.joinedAt)}</span>
        </p>
        {s.hasAccess ? (
          <>
            <Progress progress={s.progress} wide />
            {s.progress.lastLesson && <p className="cst-drawer__note">Last opened: {s.progress.lastLesson}</p>}
            {s.progress.done === 0 && !s.progress.lastLesson && (
              <p className="cst-drawer__note">
                Their progress shows once they sign in to your academy and open a lesson.
              </p>
            )}
          </>
        ) : (
          <p className="cst-drawer__note">
            {first} was refunded{lastRefund ? ` on ${joinedDay(lastRefund.refundedAt)}` : ''}, so they don’t have the course any
            more.
          </p>
        )}
      </div>

      <section className="bkd__section">
        <h3 className="bkd__heading">About {first}</h3>
        <dl className="bkd__facts">
          <div>
            <dt>Email</dt>
            <dd>{s.email ? <a href={`mailto:${s.email}`}>{s.email}</a> : '—'}</dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd>{s.phone ? <a href={telHref(s.phone)}>{s.phone}</a> : '—'}</dd>
          </div>
          <div>
            <dt>Joined</dt>
            <dd>{joinedDay(s.joinedAt)}</dd>
          </div>
        </dl>
      </section>

      <section className="bkd__section">
        <h3 className="bkd__heading">{s.payments.length === 1 ? 'Payment' : 'Payments'}</h3>
        {s.payments.map((p) => (
          <Payment key={p.id} payment={p} order={orderOf(p.id)} />
        ))}
      </section>

      {s.answers.length > 0 && (
        <section className="bkd__section">
          <h3 className="bkd__heading">{s.answers.length === 1 ? 'Their answer' : 'Their answers'}</h3>
          <dl className="bkd__answers">
            {s.answers.map(({ question, answer }) => (
              <div key={question}>
                <dt>{question}</dt>
                <dd className={answer ? '' : 'bkd__no-answer'}>{answer || 'No answer'}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </Drawer>
  );
}

// One payment, as a short bill: what it cost, the coupon, GST, what they
// paid; then when, its payment ID and the invoice; then any refund
function Payment({ payment: p, order }) {
  const at = Date.parse(p.createdAt) || 0;
  const cur = p.currency ?? 'INR';
  const show = (amount) => moneyIn(minorOf(amount), cur);

  if (p.free || !(Number(p.total) > 0)) {
    return (
      <div className="cst-pay">
        <p className="cst-pay__line">
          <span>Joined for free</span>
          <span>{when(at)}</span>
        </p>
      </div>
    );
  }

  const lines = [
    { label: 'Price', value: show(p.price) },
    p.coupon && Number(p.discount) > 0 && { label: `Coupon ${p.coupon.code} (${p.coupon.percent}% off)`, value: `−${show(p.discount)}` },
    p.gst && { label: p.gst.included ? 'GST (included)' : 'GST', value: p.gst.included ? show(p.gst.amount) : `+${show(p.gst.amount)}` },
  ].filter(Boolean);

  return (
    <div className="cst-pay">
      <dl className="cst-pay__bill">
        {lines.map((l) => (
          <div key={l.label} className="cst-pay__line">
            <dt>{l.label}</dt>
            <dd>{l.value}</dd>
          </div>
        ))}
        <div className="cst-pay__line cst-pay__line--total">
          <dt>Total paid</dt>
          <dd>{show(p.total)}</dd>
        </div>
      </dl>

      <p className="cst-pay__meta">
        Paid {when(at)}
        {p.paymentId && (
          <>
            {' · '}
            <span className="cst-pay__id">{p.paymentId}</span>
          </>
        )}
      </p>
      {p.gstDetails?.gstin && (
        <p className="cst-pay__meta">
          GST bill to {p.gstDetails.business} · {p.gstDetails.gstin}
        </p>
      )}

      {Number.isFinite(p.refundedAt) && (
        <p className="cst-pay__refund">
          <RotateCcw size={14} aria-hidden="true" />
          Refunded {show(p.refunded)} on {joinedDay(p.refundedAt)}
        </p>
      )}

      {order && (
        <a
          className="cst-pay__invoice"
          href={`/?mock=invoice&order=${encodeURIComponent(order.id)}`}
          target="_blank"
          rel="noopener"
        >
          <FileText size={14} aria-hidden="true" /> Download invoice
          <span className="oh__sr-only"> (opens in a new tab)</span>
        </a>
      )}
    </div>
  );
}

// '▓▓▓░░░ 4 of 12 lessons', or 'Not started'
export function Progress({ progress: p, gone = false, wide = false }) {
  const at = p.total > 0 ? Math.round((p.done / p.total) * 100) : 0;
  const words = gone ? 'No access' : p.done === 0 ? 'Not started' : p.done >= p.total ? 'Finished' : `${p.done} of ${p.total} lessons`;
  return (
    <span className={`cst-progress ${wide ? 'cst-progress--wide' : ''}`}>
      {/* No access: just the words, no empty bar */}
      {!gone && (
        <span
          className="cst-progress__bar"
          role="progressbar"
          aria-label="Lessons done"
          aria-valuemin={0}
          aria-valuemax={p.total}
          aria-valuenow={p.done}
        >
          <span className="cst-progress__fill" style={{ width: `${at}%` }} />
        </span>
      )}
      <span className="cst-progress__text">{words}</span>
    </span>
  );
}