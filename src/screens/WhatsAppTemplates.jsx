import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Clock, Copy, FileText, Pencil, Plus, Send, Trash2, X, XCircle } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import { PhoneMessage } from '../components/WhatsAppMessages';
import TemplatePhone from './TemplatePhone';
import WhatsAppTemplateEditor from './WhatsAppTemplateEditor';
import {
  DEFAULT_NAME,
  MOCK_MESSAGE_REJECTION,
  hasNumber,
  messageDates,
  messageStatus,
} from '../data/whatsappConnection';
import { MESSAGES } from '../data/whatsappMessages';
import { MOCK_TEMPLATE_REJECTION, deleteTemplate, useTemplates } from '../data/whatsappTemplates';
import './WhatsAppTemplates.css';

// ------------------------------------------------------------
// Settings → WhatsApp → Templates: every message WhatsApp can send, in
// one plain list, as AiSensy's Template Messages. Templates belong to the
// number (Meta reviews them per WhatsApp Business account), so they live
// here, beside the connection.
//
//   Templates                                   [+ Create template]
//   All 10 · Draft 1 · In review 1 · Approved 7 · Needs action 1
//   Name                       Category  Status     Updated      Action
//   session_reminder_tamil     Utility   Draft      8 Nov 2026   ⧉ 🗑
//   1:1 call · 24 hours before Utility   Approved   8 Nov 2026   ⧉
//   …
//
// Two kinds in the one list:
//   theirs       made with Create template (WhatsAppTemplateEditor.jsx),
//                newest first, kept in whatsappTemplates.js
//   ready-made   ours (whatsappMessages.js): can't be edited or deleted,
//                only duplicated, so they're always there as the fallback
//
// A click on a row opens the template: its journey with Meta on the left,
// the message on a phone on the right, and what can be done with it
// (Edit for a draft or one Meta rejected, Duplicate, Delete for theirs).
// Duplicate opens the editor with a copy.
//
// Statuses, with Meta's own words in brackets:
//   Draft         not sent to Meta yet (ready-made ones, until connected)
//   In review     (pending)
//   Approved
//   Not approved  (rejected); its filter says Needs action, since it does
//
// connection: the saved connection, or null
// onConnect(): go to the Connection tab
// ------------------------------------------------------------

// Our ready-made templates, named so each stands alone
const KIND_NAME = { call: '1:1 call', webinar: 'Webinar', batch: 'Live class' };
const READY_MADE = Object.entries(MESSAGES).flatMap(([kind, list]) =>
  list.map((message) => ({ id: message.id, kind, message, name: `${KIND_NAME[kind]} · ${message.name}` })),
);

const CATEGORY = { UTILITY: 'Utility', MARKETING: 'Marketing' };

const STATUS = {
  draft: { label: 'Draft', badge: 'draft' },
  review: { label: 'In review', badge: 'wait' },
  approved: { label: 'Approved', badge: 'good' },
  rejected: { label: 'Not approved', badge: 'bad' },
};

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Draft' },
  { id: 'review', label: 'In review' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Needs action' },
];

const EMPTY = {
  draft: 'No drafts.',
  review: 'Nothing in review.',
  approved: 'Nothing approved yet.',
  rejected: 'Nothing needs action.',
};

// What the sample booking fills in, on a ready-made template
const sampleValues = (kind, sender) => ({
  first_name: 'Priya',
  host: sender,
  call: 'Discovery call',
  webinar: 'Grow your practice',
  batch: 'Morning yoga',
  date: 'Thu 12 Nov',
  next: 'Thu 19 Nov',
  time: kind === 'call' ? '4:00 pm' : '7:00 pm',
});

const fmtDay = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const fmtWhen = (iso) =>
  new Date(iso).toLocaleString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

// A name Meta allows, not already taken: "1:1 call · 24 hours before" → call_24_hours_before
function freeName(base, taken) {
  const clean =
    base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/^1_1_/, '') || 'template';
  let name = clean;
  for (let n = 2; taken.includes(name); n += 1) name = `${clean}_${n}`;
  return name;
}

// A ready-made template, as the start of their own: our {details} become
// numbered variables, with the sample booking's values as their examples
function copyOfReadyMade(row, sender, taken) {
  const values = sampleValues(row.kind, sender);
  const order = [];
  const body = row.message.body.replace(/\{(\w+)\}/g, (all, key) => {
    if (!order.includes(key)) order.push(key);
    return `{{${order.indexOf(key) + 1}}}`;
  });
  const buttons = row.message.buttons.map((b) => {
    const kinds = {
      call: { manage: 'Manage booking', join: 'Join call' },
      webinar: { details: 'View details', join: 'Join webinar' },
    };
    return { type: 'url', text: kinds[row.kind]?.[b] ?? 'Open', url: '', phone: '' };
  });
  return {
    name: freeName(`${row.name} copy`, taken),
    category: 'UTILITY',
    language: 'English',
    body,
    samples: Object.fromEntries(order.map((key, i) => [i + 1, values[key] ?? ''])),
    footer: '',
    action: buttons.length ? 'cta' : 'none',
    buttons,
  };
}

// One of theirs, as the start of another
const copyOfOwn = (t, taken) => {
  const { id, status, createdAt, sentAt, decidedAt, reviewEndsAt, outcome, ...rest } = t;
  return { ...rest, name: freeName(`${t.name}_copy`, taken) };
};

export default function WhatsAppTemplates({ connection, onConnect }) {
  const own = useTemplates();
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState(null); // a row's key
  const [editing, setEditing] = useState(null); // { initial } while the editor's open
  const [removing, setRemoving] = useState(null); // one of theirs, to delete
  const connected = hasNumber(connection);
  const sender = connected ? connection.name : DEFAULT_NAME;

  // Every row: theirs (newest first), then ours
  const rows = [
    ...own.map((t) => ({
      key: t.id,
      own: true,
      template: t,
      name: t.name,
      category: t.category,
      status: t.status,
      updated: t.decidedAt ?? t.sentAt ?? t.createdAt,
    })),
    ...READY_MADE.map((r) => {
      const dates = connected ? messageDates(connection, r.id) : {};
      return {
        key: r.id,
        own: false,
        readyMade: r,
        name: r.name,
        category: 'UTILITY',
        status: connected ? messageStatus(connection, r.id) : 'draft',
        dates,
        updated: dates.decided ?? dates.sent,
      };
    }),
  ];
  const taken = own.map((t) => t.name);

  const counts = Object.fromEntries(FILTERS.map((f) => [f.id, 0]));
  rows.forEach((r) => {
    counts.all += 1;
    counts[r.status] += 1;
  });
  const shown = rows.filter((r) => filter === 'all' || r.status === filter);
  const opened = rows.find((r) => r.key === open);

  const duplicate = (row) => {
    setOpen(null);
    setEditing({ initial: row.own ? copyOfOwn(row.template, taken) : copyOfReadyMade(row.readyMade, sender, taken) });
  };

  // ---------- The editor, in place of the list ----------
  if (editing) {
    return (
      <WhatsAppTemplateEditor
        initial={editing.initial}
        connected={connected}
        sender={sender}
        takenNames={taken.filter((n) => n !== editing.initial?.name || !editing.initial?.id)}
        onDone={() => setEditing(null)}
      />
    );
  }

  return (
    <>
      <div className="oh__panel-head wtp__head">
        <div>
          <h2 className="oh__panel-title">Templates</h2>
          <p className="oh__panel-sub">
            The messages WhatsApp sends for you. Meta checks each one before it can go out.
          </p>
        </div>
        <button type="button" className="oh__add wtp__create" onClick={() => setEditing({ initial: null })}>
          <Plus size={18} aria-hidden="true" />
          Create template
        </button>
      </div>

      <div className="settings__body wtp">
        {!connected && (
          <div className="wtp-note">
            <p>Templates go to Meta for review once your WhatsApp number is connected.</p>
            <button type="button" className="wtp-link" onClick={onConnect}>
              Connect WhatsApp
            </button>
          </div>
        )}

        <div className="wtp-filters" role="group" aria-label="Show">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className="wtp-filter"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
              <span className="wtp-filter__count">{counts[f.id]}</span>
            </button>
          ))}
        </div>

        {shown.length === 0 ? (
          <p className="wtp-empty">{EMPTY[filter]}</p>
        ) : (
          <div className="wtp-scroll">
            <table className="wtp-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Category</th>
                  <th scope="col">Status</th>
                  <th scope="col">Updated</th>
                  <th scope="col">
                    <span className="wtp-action-head">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.key} className="wtp-tr" onClick={() => setOpen(r.key)}>
                    <td>
                      <button
                        type="button"
                        className="wtp-name"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpen(r.key);
                        }}
                      >
                        {r.name}
                      </button>
                    </td>
                    <td className="wtp-muted">{CATEGORY[r.category]}</td>
                    <td>
                      <span className={`wa-badge wtp-badge--${STATUS[r.status].badge}`}>{STATUS[r.status].label}</span>
                    </td>
                    <td className="wtp-muted wtp-date">{fmtDay(r.updated)}</td>
                    {/* The row's own buttons: a click here doesn't open the template */}
                    <td className="wtp-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="wtp-icon"
                        onClick={() => duplicate(r)}
                        aria-label={`Duplicate ${r.name}`}
                        title="Duplicate"
                      >
                        <Copy size={17} aria-hidden="true" />
                      </button>
                      {r.own && (
                        <button
                          type="button"
                          className="wtp-icon wtp-icon--danger"
                          onClick={() => setRemoving(r.template)}
                          aria-label={`Delete ${r.name}`}
                          title="Delete"
                        >
                          <Trash2 size={17} aria-hidden="true" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {opened && (
        <TemplateDialog
          row={opened}
          sender={sender}
          onClose={() => setOpen(null)}
          onEdit={() => {
            setOpen(null);
            setEditing({ initial: opened.template });
          }}
          onDuplicate={() => duplicate(opened)}
          onDelete={() => setRemoving(opened.template)}
        />
      )}

      {removing && (
        <ConfirmDialog
          title="Delete this template?"
          confirmLabel="Delete template"
          danger
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            deleteTemplate(removing.id);
            setRemoving(null);
            setOpen(null);
          }}
        >
          <p>“{removing.name}” will be removed from your templates. This can’t be undone.</p>
        </ConfirmDialog>
      )}
    </>
  );
}

// ---------- One template: its journey with Meta, and the message ----------
// The browser's own <dialog>: dims the page, keeps the keyboard inside,
// closes on Escape, ✕ or a click outside.
function TemplateDialog({ row, sender, onClose, onEdit, onDuplicate, onDelete }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.open && dialog.close();
  }, []);

  const t = row.template;
  const status = row.status;
  const sent = row.own ? t.sentAt : row.dates?.sent;
  const decided = row.own ? t.decidedAt : row.dates?.decided;
  const why = row.own ? MOCK_TEMPLATE_REJECTION : MOCK_MESSAGE_REJECTION;
  const canEdit = row.own && (status === 'draft' || status === 'rejected');

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
          <p className="wtp-journey__when">
            {row.own ? `${CATEGORY[t.category]} · ${t.language}` : `Ready-made · ${row.readyMade.message.when}`}
          </p>
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

          <div className="wtp-dialog__actions">
            {canEdit && (
              <button type="button" className="oh__add" onClick={onEdit}>
                <Pencil size={16} aria-hidden="true" />
                {status === 'rejected' ? 'Edit and resubmit' : 'Edit'}
              </button>
            )}
            <button type="button" className="es__btn es__btn--quiet" onClick={onDuplicate}>
              <Copy size={16} aria-hidden="true" />
              Duplicate
            </button>
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
            <TemplatePhone template={t} sender={sender} />
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

// Something here needs the coach: a template Meta didn't approve, ours
// or theirs. For the dot on the Templates tab.
export const templatesNeedAttention = (connection, own = []) =>
  (hasNumber(connection) && READY_MADE.some((r) => messageStatus(connection, r.id) === 'rejected')) ||
  own.some((t) => t.status === 'rejected');