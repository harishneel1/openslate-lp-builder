import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Clock, Copy, FileText, Pencil, Plus, Send, Trash2, X, XCircle } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import RowMenu from '../components/RowMenu';
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
import { LIVE_CLASSES_SHOWN, MESSAGES } from '../data/whatsappMessages';
import {
  deleteTemplate,
  duplicateName,
  CHOICES_CHANGED_EVENT,
  isLegacy,
  isRetired,
  rejectionOf,
  usesOf,
  momentById,
  sampleValues,
  toMeta,
  useTemplates,
} from '../data/whatsappTemplates';
import './WhatsAppTemplates.css';

// ------------------------------------------------------------
// Settings → WhatsApp → Templates: every message WhatsApp can send, in
// one plain list, as AiSensy's Template Messages. Templates belong to the
// number (Meta reviews them per WhatsApp Business account), so they live
// here, beside the connection.
//
//   Templates                                   [+ Create template]
//   All 10 · Draft 1 · In review 1 · …      [All | 1:1 calls | Webinars]
//   Name                                  Status     Updated      Action
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
// Each row's ⋯ menu: Duplicate, and Delete for theirs. Duplicate opens
// the editor on a copy of everything, named <original>_duplicate, saved
// only when they save or submit it. A live class's ready-made message
// can't be duplicated (templates are for 1:1 calls and webinars), nor one
// of theirs made with the first editor (it has no message to copy).
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

// Our ready-made templates, each with its template name (call_24h_reminder)
// and what it's for, in words (1:1 call · 24 hours before)
const KIND_NAME = { call: '1:1 call', webinar: 'Webinar', batch: 'Live class' };
// (Live classes' only while they're in the sidebar: LIVE_CLASSES_SHOWN)
const READY_MADE = Object.entries(MESSAGES)
  .filter(([kind]) => kind !== 'batch' || LIVE_CLASSES_SHOWN)
  .flatMap(([kind, list]) =>
    list.map((message) => ({
      id: message.id,
      kind,
      message,
      name: message.template,
      about: `${KIND_NAME[kind]} · ${message.name}`,
    })),
  );

// What one of theirs is for, in words, or null (made with the first editor).
// One for a message we no longer send says so.
const aboutOf = (t) => {
  const m = momentById(t.moment);
  if (!m) return null;
  return `${KIND_NAME[t.product]} · ${m.name}${m.retired ? ' (no longer sent)' : ''}`;
};


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

// What it's for: every template, or only 1:1 calls' or webinars'
const PRODUCT_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'call', label: '1:1 calls' },
  { id: 'webinar', label: 'Webinars' },
];

const EMPTY = {
  draft: 'No drafts.',
  review: 'Nothing in review.',
  approved: 'Nothing approved yet.',
  rejected: 'Nothing needs action.',
};

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

// What can be duplicated: theirs (not ones made with the first editor:
// they have no message to copy; nor ones for a message we no longer send),
// and our 1:1 call and webinar messages
const canDuplicate = (row) =>
  row.own ? !isLegacy(row.template) && !isRetired(row.template) : ['call', 'webinar'].includes(row.readyMade?.kind);

// A copy, ready for the editor: everything as it was (which message it's
// for, the wording with its details), named <original>_duplicate. Nothing
// is saved until they save or submit it (copiedFrom names the original,
// for the editor's title).
const copyOf = (row, taken) => {
  const from = row.own
    ? { product: row.template.product, moment: row.template.moment, body: row.template.body }
    : { product: row.readyMade.kind, moment: row.readyMade.id, body: row.readyMade.message.body };
  return { ...from, name: duplicateName(row.name, taken), copiedFrom: row.name };
};

// startCreate: { product, moment } to open straight on a new template for
//   that message (a reminder's "Create a new template")
export default function WhatsAppTemplates({ connection, onConnect, startCreate = null }) {
  useChoicesVersion(); // "Used on …" follows reminders' picks
  const own = useTemplates();
  const [filter, setFilter] = useState('all');
  const [product, setProduct] = useState('all'); // PRODUCT_FILTERS
  const [menu, setMenu] = useState(null); // the row whose ⋯ menu is open
  const [open, setOpen] = useState(null); // a row's key
  const [editing, setEditing] = useState(() => (startCreate ? { initial: { ...startCreate } } : null)); // { initial } while the editor's open
  const [removing, setRemoving] = useState(null); // one of theirs, to delete
  const connected = hasNumber(connection);
  const sender = connected ? connection.name : DEFAULT_NAME;

  // Every row: theirs (newest first), then ours
  const rows = [
    ...own.map((t) => ({
      key: t.id,
      own: true,
      template: t,
      product: t.product,
      name: t.name,
      about: aboutOf(t),
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
        product: r.kind,
        name: r.name,
        about: r.about,
        category: 'UTILITY',
        status: connected ? messageStatus(connection, r.id) : 'draft',
        dates,
        updated: dates.decided ?? dates.sent,
      };
    }),
  ];
  // Every name in use, and whose it is in words (for the editor's
  // "already used by …"): ours, then theirs. The one being edited isn't
  // taken by itself.
  const takenExcept = (id) => [
    ...READY_MADE.map((r) => ({ name: r.name, whose: `our ready-made template for ${r.about}` })),
    ...own
      .filter((t) => t.id !== id)
      .map((t) => ({ name: t.name, whose: aboutOf(t) ? `your template for ${aboutOf(t)}` : 'one of your templates' })),
  ];
  const taken = takenExcept(null);

  // The product picked first, then the status: the status counts are the product's
  const ofProduct = rows.filter((r) => product === 'all' || r.product === product);
  const counts = Object.fromEntries(FILTERS.map((f) => [f.id, 0]));
  ofProduct.forEach((r) => {
    counts.all += 1;
    counts[r.status] += 1;
  });
  const shown = ofProduct.filter((r) => filter === 'all' || r.status === filter);
  const opened = rows.find((r) => r.key === open);

  const duplicate = (row) => {
    setOpen(null);
    setMenu(null);
    setEditing({ initial: copyOf(row, taken) });
  };

  // ---------- The editor, in place of the list ----------
  if (editing) {
    return (
      <WhatsAppTemplateEditor
        initial={editing.initial}
        connected={connected}
        sender={sender}
        taken={takenExcept(editing.initial?.id)}
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

        <div className="wtp-bar">
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

          <div className="wtp-kinds" role="group" aria-label="For">
            {PRODUCT_FILTERS.map((p) => (
              <button
                key={p.id}
                type="button"
                className="wtp-kind"
                aria-pressed={product === p.id}
                onClick={() => setProduct(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {shown.length === 0 ? (
          <p className="wtp-empty">{filter === 'all' ? 'No templates here yet.' : EMPTY[filter]}</p>
        ) : (
          <div className="wtp-scroll">
            <table className="wtp-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
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
                      {r.about && <span className="wtp-about">{r.about}</span>}
                      {r.own && <UsedOn id={r.template.id} />}
                    </td>
                    <td>
                      <span className={`wa-badge wtp-badge--${STATUS[r.status].badge}`}>{STATUS[r.status].label}</span>
                    </td>
                    <td className="wtp-muted wtp-date">{fmtDay(r.updated)}</td>
                    {/* The row's own buttons: a click here doesn't open the template */}
                    <td className="wtp-actions" onClick={(e) => e.stopPropagation()}>
                      <RowMenu
                        title={r.name}
                        open={menu === r.key}
                        onOpenChange={(o) => setMenu(o ? r.key : null)}
                        items={[
                          ...(canDuplicate(r) ? [{ label: 'Duplicate', icon: Copy, onSelect: () => duplicate(r) }] : []),
                          ...(r.own
                            ? [
                                {
                                  label: 'Delete',
                                  icon: Trash2,
                                  danger: true,
                                  onSelect: () => {
                                    setMenu(null);
                                    setRemoving(r.template);
                                  },
                                },
                              ]
                            : []),
                        ]}
                      />
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
          onDuplicate={canDuplicate(opened) ? () => duplicate(opened) : null}
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
          {usesOf(removing.id).length > 0 && (
            <p>
              It’s sent by {listOf(usesOf(removing.id))}. Those reminders will go back to our default wording.
            </p>
          )}
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

// "Discovery call, Coaching session and Yoga basics"
const listOf = (names) =>
  names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;

// Where one of theirs is sent from: "Used on Discovery call", or nothing
function UsedOn({ id }) {
  const names = usesOf(id);
  if (!names.length) return null;
  return <span className="wtp-used">Used on {listOf(names)}</span>;
}

// Re-render when a reminder's pick changes anywhere
function useChoicesVersion() {
  const [, setN] = useState(0);
  useEffect(() => {
    const bump = () => setN((n) => n + 1);
    window.addEventListener(CHOICES_CHANGED_EVENT, bump);
    window.addEventListener('storage', bump);
    return () => {
      window.removeEventListener(CHOICES_CHANGED_EVENT, bump);
      window.removeEventListener('storage', bump);
    };
  }, []);
}