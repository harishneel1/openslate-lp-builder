import { useEffect, useRef } from 'react';
import { CheckCircle2, Clock, Copy, FileText, Pencil, Send, Trash2, X, XCircle } from 'lucide-react';
import { AutoReplyPhone, PhoneMessage } from '../components/WhatsAppMessages';
import TemplatePhone from './TemplatePhone';
import { MOCK_MESSAGE_REJECTION, hasNumber, messageDates, messageStatus } from '../data/whatsappConnection';
import { AUTO_REPLY } from '../data/whatsappMessages';
import {
  isLegacy,
  isRetired,
  momentById,
  rejectionOf,
  sampleValues,
  toMeta,
  usesOf,
} from '../data/whatsappTemplates';
import './WhatsAppTemplates.css';

// ------------------------------------------------------------
// One WhatsApp template in a pop-up: its journey with Meta, and the
// message on a phone. Opened from Settings → WhatsApp → Templates' list
// (WhatsAppTemplates.jsx), and, for the automatic reply, from Connection's
// "View message" (WhatsAppConnected.jsx). Its styles are the list's.
// ------------------------------------------------------------

export const STATUS = {
  draft: { label: 'Draft', badge: 'draft' },
  review: { label: 'In review', badge: 'wait' },
  approved: { label: 'Approved', badge: 'good' },
  rejected: { label: 'Not approved', badge: 'bad' },
};

const fmtWhen = (iso) =>
  new Date(iso).toLocaleString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

// "Discovery call, Coaching session and Yoga basics"
export const listOf = (names) =>
  names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;

// One of our ready-made templates, as a row of the list (and for its pop-up).
// Before connecting, ours are drafts: they go to Meta as the number connects.
//   r: { id, kind, message, name, about }
export function readyMadeRow(r, connection) {
  const connected = hasNumber(connection);
  const dates = connected ? messageDates(connection, r.id) : {};
  return {
    key: r.id,
    own: false,
    readyMade: r,
    product: r.kind,
    name: r.name,
    about: r.about,
    category: 'UTILITY',
    status: connected ? messageStatus(connection, r.id) : 'draft',
    dates,
    updated: dates.decided ?? dates.sent,
  };
}

// The automatic reply, as a row for its pop-up (Connection's "View message")
export const autoReplyRow = (connection) =>
  readyMadeRow(
    { id: AUTO_REPLY.id, kind: 'reply', message: AUTO_REPLY, name: AUTO_REPLY.template, about: AUTO_REPLY.name },
    connection,
  );

// ---------- One template: its journey with Meta, and the message ----------
// The browser's own <dialog>: dims the page, keeps the keyboard inside,
// closes on Escape, ✕ or a click outside.
//   row             a row of Templates' list (readyMadeRow for ours)
//   sender          the business name on the phone
//   contactNumber   the coach's contact number, for the automatic reply's
//                   preview (null: not added yet)
//   onAddContact    for the automatic reply while there's no contact number:
//                   where to add it (Templates' list; Connection has its
//                   own way, right on the page). null: no prompt
//   onEdit, onDuplicate, onDelete   what can be done with it (Templates'
//                   list); null where it can't
export default function TemplateDialog({
  row,
  sender,
  contactNumber = null,
  onAddContact = null,
  onClose,
  onEdit,
  onDuplicate,
  onDelete,
}) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.open && dialog.close();
  }, []);

  const t = row.template;
  const autoReply = !row.own && row.readyMade.kind === 'reply';
  const status = row.status;
  const sent = row.own ? t.sentAt : row.dates?.sent;
  const decided = row.own ? t.decidedAt : row.dates?.decided;
  const why = row.own ? rejectionOf(t) : MOCK_MESSAGE_REJECTION;
  const legacy = row.own && isLegacy(t);
  // One for a message we no longer send can't be changed: there's nothing to send it for
  const canEdit = row.own && !legacy && !isRetired(t) && (status === 'draft' || status === 'rejected');
  // What it's for, in a line: "1:1 call · 2 hours before", and when it goes
  // (for one we no longer send: what replaced it)
  const when = row.own ? momentById(t.moment)?.when : row.readyMade.message.when;
  const about = legacy
    ? 'Made with the old editor'
    : `${row.own ? '' : 'Ready-made · '}${row.about}${when ? ` · ${when}` : ''}`;

  return (
    <dialog
      ref={ref}
      className="wtp-dialog"
      aria-labelledby="wtp-dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onMouseDown={(e) => e.target === ref.current && onClose()}
    >
      <div className="wtp-dialog__head">
        <h2 id="wtp-dialog-title" className="wtp-dialog__title">
          {row.name}
        </h2>
        <span className={`wa-badge wtp-badge--${STATUS[status].badge}`}>{STATUS[status].label}</span>
        <button type="button" className="wtp-dialog__close" onClick={onClose} aria-label="Close">
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <div className="wtp-dialog__body">
        <section className="wtp-journey" aria-labelledby="wtp-journey-title">
          <h3 id="wtp-journey-title" className="wtp-journey__title">
            Template journey
          </h3>
          <p className="wtp-journey__when">{about}</p>
          {row.own && usesOf(t.id).length > 0 && (
            <p className="wtp-journey__when wtp-used">Used on {listOf(usesOf(t.id))}</p>
          )}
          <ol className="wtp-steps">
            {row.own && <Step icon={FileText} tone="done" title="Created" text={fmtWhen(t.createdAt)} />}
            {status === 'draft' && (
              <Step
                icon={FileText}
                tone="draft"
                title="Draft"
                text={row.own ? 'Not sent to Meta yet.' : 'Goes to Meta once your number is connected.'}
              />
            )}
            {status !== 'draft' && sent && <Step icon={Send} tone="done" title="Sent to Meta" text={fmtWhen(sent)} />}
            {status === 'review' && (
              <Step
                icon={Clock}
                tone="wait"
                title="In review"
                text="Meta is checking it. Usually a few minutes, up to 24 hours."
              />
            )}
            {status === 'approved' && (
              <Step icon={CheckCircle2} tone="good" title="Approved" text={decided && fmtWhen(decided)} />
            )}
            {status === 'rejected' && (
              <Step icon={XCircle} tone="bad" title="Not approved" text={decided && fmtWhen(decided)} why={why} />
            )}
          </ol>

          {/* The automatic reply needs the contact number it points students to */}
          {autoReply && !contactNumber && onAddContact && (
            <div className="wtp-note wtp-note--ask">
              <p>Add your contact number so students know where to reach you.</p>
              <button
                type="button"
                className="wtp-link"
                onClick={() => {
                  onClose();
                  onAddContact();
                }}
              >
                Add number
              </button>
            </div>
          )}

          <div className="wtp-dialog__actions">
            {canEdit && (
              <button type="button" className="oh__add" onClick={onEdit}>
                <Pencil size={16} aria-hidden="true" />
                {status === 'rejected' ? 'Edit and resubmit' : 'Edit'}
              </button>
            )}
            {onDuplicate && (
              <button type="button" className="es__btn es__btn--quiet" onClick={onDuplicate}>
                <Copy size={16} aria-hidden="true" />
                Duplicate
              </button>
            )}
            {row.own && (
              <button type="button" className="wtp-delete" onClick={onDelete}>
                <Trash2 size={16} aria-hidden="true" />
                Delete
              </button>
            )}
          </div>
        </section>

        <div className="wtp-dialog__phone">
          {row.own ? (
            <TemplatePhone template={toMeta(t, sender)} sender={sender} />
          ) : autoReply ? (
            <AutoReplyPhone sender={sender} values={sampleValues('call', sender)} contactNumber={contactNumber} />
          ) : (
            <PhoneMessage
              message={row.readyMade.message}
              kind={row.readyMade.kind}
              sender={sender}
              values={sampleValues(row.readyMade.kind, sender)}
              links={null}
            />
          )}
        </div>
      </div>
    </dialog>
  );
}

function Step({ icon: Icon, tone, title, text, why }) {
  return (
    <li className={`wtp-step wtp-step--${tone}`}>
      <span className="wtp-step__icon" aria-hidden="true">
        <Icon size={18} />
      </span>
      <div className="wtp-step__words">
        <span className="wtp-step__title">{title}</span>
        {text && <span className="wtp-step__text">{text}</span>}
        {why && <span className="wtp-step__why">{why}</span>}
      </div>
    </li>
  );
}