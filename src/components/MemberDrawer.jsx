import { Copy, IndianRupee, Mail, MessageCircle, Phone, UserCheck, UserX } from 'lucide-react';
import Drawer from './Drawer';
import GuestInitials from './GuestInitials';
import { NEEDS_ACTION, nextRenewal, shortDate, statusWords } from '../data/batchMembers';
import { rejoinHref, reminderHref } from '../data/renewalMessage';
import { formatMoney } from '../data/contractPricing';
import { whatsappHref } from '../utils/whatsapp';
import { todayIn } from '../utils/slots';
import './BookingDrawer.css'; // the same panel sections as a booking's
import './MemberDrawer.css';

// ------------------------------------------------------------
// One batch member, in a panel from the right: opened by a click on
// their row on the batch's page, as a booking opens from a 1:1 call.
//
//   (RK) Ravi Kumar                                        ✕
//   [💬] [✉] [📞]                      (ways to reach them)
//   ┌ [Payment pending] 3 days late                       ┐
//   │ [💬 Remind on WhatsApp]   Reminded 3 Dec            │
//   └─────────────────────────────────────────────────────┘
//   About Ravi        email, phone, joined
//   Their answer      the batch's questions
//   Payment cycles    the next one (not paid yet), then every one paid
//     4 Dec – 4 Jan   Due 4 Dec                 ₹2,000
//     4 Nov – 4 Dec   Paid when they joined     ₹2,000
//   ─────────────────────────────────────────────────────
//   [₹ Mark as paid] [Copy payment link]       [Remove from batch]
//
// member: from membersOf (batchMembers.js). batch: its batch.
// onReminded(): they pressed Remind (the WhatsApp chat opens itself)
// onAsk(kind): 'paid' | 'remove' | 'restore', asked first by the page
// onCopyLink(): copy their payment link
// onSentRejoin(): a removed member's payment link was sent on WhatsApp
// ------------------------------------------------------------

const METHOD_WORDS = {
  join: 'Paid when they joined',
  link: 'Paid on the batch page',
  marked: 'Marked paid by you',
  restore: 'Paid you directly, restored',
  rejoin: 'Paid on the batch page to rejoin',
};

const telHref = (phone) => `tel:${String(phone ?? '').replace(/\s/g, '')}`;

export default function MemberDrawer({ member: m, batch, onClose, onReminded, onAsk, onCopyLink, onSentRejoin }) {
  const name = m.name || 'Member';
  const first = name.split(/\s+/)[0];
  const phone = m.phone?.number ? `${m.phone.code ?? ''} ${m.phone.number}`.trim() : null;
  const words = statusWords(m, batch.timeZone);
  const needs = NEEDS_ACTION.includes(m.status);
  const remind = needs ? reminderHref(m, batch) : null;
  const removed = m.status === 'removed';
  const answers = (m.answers ?? []).filter((a) => a.question);
  const next = m.renewsOn ? nextRenewal(m.renewsOn, m.payDay) : null;

  const reach = [
    phone && { label: `WhatsApp ${name}`, href: whatsappHref(phone, `Hi ${first}, `), external: true, icon: <MessageCircle size={18} aria-hidden="true" /> },
    m.email && { label: `Email ${name}`, href: `mailto:${m.email}`, icon: <Mail size={18} aria-hidden="true" /> },
    phone && { label: `Call ${name}`, href: telHref(phone), icon: <Phone size={18} aria-hidden="true" /> },
  ].filter(Boolean);

  const footer = (
    <div className="mdr__foot">
      {removed ? (
        <>
          <button type="button" className="bk-btn bk-btn--secondary" onClick={onCopyLink}>
            <Copy size={16} aria-hidden="true" /> Copy payment link
          </button>
          <button type="button" className="bk-btn bk-btn--secondary" onClick={() => onAsk('restore')}>
            <UserCheck size={16} aria-hidden="true" /> Paid by cash or UPI? Restore
          </button>
        </>
      ) : (
        <>
          {needs && (
            <button type="button" className="bk-btn bk-btn--primary" onClick={() => onAsk('paid')}>
              <IndianRupee size={16} aria-hidden="true" /> Mark as paid (cash or UPI)
            </button>
          )}
          <button type="button" className="bk-btn bk-btn--secondary" onClick={onCopyLink}>
            <Copy size={16} aria-hidden="true" /> Copy payment link
          </button>
          <button type="button" className="bk-btn bk-btn--danger-outline mdr__remove" onClick={() => onAsk('remove')}>
            <UserX size={16} aria-hidden="true" /> Remove
          </button>
        </>
      )}
    </div>
  );

  return (
    <Drawer
      title={name}
      media={<GuestInitials name={name} size="lg" />}
      extra={
        reach.length > 0 && (
          <div className="bkd__reach">
            {reach.map((r) => (
              <a
                key={r.label}
                className="bkd__contact"
                href={r.href}
                {...(r.external ? { target: '_blank', rel: 'noreferrer' } : {})}
                aria-label={r.label}
                data-tip={r.label}
              >
                {r.icon}
              </a>
            ))}
          </div>
        )
      }
      onClose={onClose}
      footer={footer}
      className="bkd mdr"
    >
      {/* Where they are on their fee, and the one thing to do about it */}
      <div className={`mdr__status mdr__status--${words.tone}`}>
        <p className="mdr__status-line">
          <span className={`bov__pill bov__pill--${words.tone}`}>{words.pill}</span>
          <span className="mdr__status-detail">{words.detail}</span>
        </p>
        {words.tone === 'late' && (
          <p className="mdr__status-note">
            {first} hasn’t paid for {m.daysLate} days. Remove them from the batch, or mark them as paid if they paid you by
            cash or UPI.
          </p>
        )}
        {removed && (
          <>
            <p className="mdr__status-note">
              {first} can’t join this batch’s classes. To bring them back, send their payment link. Once they pay, they
              come back automatically. If they’ve paid you by cash or UPI, restore them instead.
            </p>
            {rejoinHref(m, batch) ? (
              <div className="mdr__remind-row">
                <a className="bov__remind" href={rejoinHref(m, batch)} target="_blank" rel="noopener noreferrer" onClick={onSentRejoin}>
                  <MessageCircle size={15} aria-hidden="true" /> Send payment link on WhatsApp
                </a>
                {m.lastRejoinLink && (
                  <span className="mdr__reminded">Link sent {shortDate(todayIn(batch.timeZone, m.lastRejoinLink.at))}</span>
                )}
              </div>
            ) : (
              <p className="mdr__status-note">No phone number, so copy their payment link and send it another way.</p>
            )}
          </>
        )}
        {needs &&
          (remind ? (
            <div className="mdr__remind-row">
              <a className="bov__remind" href={remind} target="_blank" rel="noopener noreferrer" onClick={onReminded}>
                <MessageCircle size={15} aria-hidden="true" /> Remind on WhatsApp
              </a>
              {m.lastReminder && (
                <span className="mdr__reminded">Reminded {shortDate(todayIn(batch.timeZone, m.lastReminder.at))}</span>
              )}
            </div>
          ) : (
            <p className="mdr__status-note">No phone number, so you can’t remind them on WhatsApp. Copy their payment link and send it another way.</p>
          ))}
      </div>

      <section className="bkd__section">
        <h3 className="bkd__heading">About {first}</h3>
        <dl className="bkd__facts">
          <div>
            <dt>Email</dt>
            <dd>{m.email ? <a href={`mailto:${m.email}`}>{m.email}</a> : '—'}</dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd>{phone ? <a href={telHref(phone)}>{phone}</a> : '—'}</dd>
          </div>
          <div>
            <dt>Joined</dt>
            <dd>{m.joinedOn ? shortDate(m.joinedOn) : '—'}</dd>
          </div>
        </dl>
      </section>

      {answers.length > 0 && (
        <section className="bkd__section">
          <h3 className="bkd__heading">{answers.length === 1 ? 'Their answer' : 'Their answers'}</h3>
          <dl className="bkd__answers">
            {answers.map(({ question, answer }) => (
              <div key={question}>
                <dt>{question}</dt>
                <dd className={answer ? '' : 'bkd__no-answer'}>{answer || 'No answer'}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section className="bkd__section">
        <h3 className="bkd__heading">Payment cycles</h3>
        <ul className="mdr__cycles">
          {/* The next cycle, not paid yet (none once they're removed) */}
          {!removed && m.renewsOn && (
            <li className="mdr__cycle mdr__cycle--next">
              <span className="mdr__cycle-dates">
                {shortDate(m.renewsOn)} – {shortDate(next)}
              </span>
              <span className={`mdr__cycle-state mdr__cycle-state--${words.tone}`}>
                {m.status === 'paid' || m.status === 'soon' ? `Due ${shortDate(m.renewsOn)}` : `Not paid · ${words.detail.toLowerCase()}`}
              </span>
              <span className="mdr__cycle-fee">{formatMoney(batch.price, 'INR')}</span>
            </li>
          )}
          {[...m.payments].reverse().map((p) => (
            <li key={`${p.at}-${p.from}`} className="mdr__cycle">
              <span className="mdr__cycle-dates">
                {shortDate(p.from)} – {shortDate(p.to)}
              </span>
              <span className="mdr__cycle-state">{METHOD_WORDS[p.method] ?? 'Paid'}</span>
              <span className="mdr__cycle-fee">{formatMoney(p.amount, 'INR')}</span>
            </li>
          ))}
        </ul>
      </section>
    </Drawer>
  );
}