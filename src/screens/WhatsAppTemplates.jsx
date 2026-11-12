import { useEffect, useState } from 'react';
import { Copy, Plus, Trash2, X } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import RowMenu from '../components/RowMenu';
import TemplateDialog, { STATUS, listOf, readyMadeRow } from './TemplateDialog';
import WhatsAppTemplateEditor from './WhatsAppTemplateEditor';
import { DEFAULT_NAME, hasNumber, markTemplatesIntroSeen } from '../data/whatsappConnection';
import { AUTO_REPLY, LIVE_CLASSES_SHOWN, MESSAGES } from '../data/whatsappMessages';
import {
  deleteTemplate,
  duplicateName,
  CHOICES_CHANGED_EVENT,
  isLegacy,
  isRetired,
  usesOf,
  momentById,
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
//   Your custom templates
//   session_reminder_tamil     Utility   Draft      8 Nov 2026   ⧉ 🗑
//   Default templates
//   1:1 call · 24 hours before Utility   Approved   8 Nov 2026   ⧉
//   …
//
// Our ready-made ones include the automatic reply (AUTO_REPLY), last: it
// can't be edited, duplicated or deleted, so its row has no ⋯ menu.
//
// Two kinds in the one list, each under its own heading row (GROUPS), so
// it's clear which ones we submitted and which they made. A heading only
// shows when its group has rows (none of theirs yet, or none matching the
// filters, and it's left out):
//   theirs       made with Create template (WhatsAppTemplateEditor.jsx),
//                newest first, kept in whatsappTemplates.js
//   ready-made   ours (whatsappMessages.js): can't be edited or deleted,
//                only duplicated, so they're always there as the fallback
//
// A click on a row opens the template (TemplateDialog.jsx, shared with
// Connection): its journey with Meta on the left,
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
const KIND_NAME = { call: '1:1 call', webinar: 'Webinar', batch: 'Live class', reply: 'Automatic reply' };
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
  )
  // Last, the automatic reply to students who message the no-reply number.
  // For neither 1:1 calls nor webinars, so those filters leave it out.
  .concat({ id: AUTO_REPLY.id, kind: 'reply', message: AUTO_REPLY, name: AUTO_REPLY.template, about: KIND_NAME.reply });

// What one of theirs is for, in words, or null (made with the first editor).
// One for a message we no longer send says so.
const aboutOf = (t) => {
  const m = momentById(t.moment);
  if (!m) return null;
  return `${KIND_NAME[t.product]} · ${m.name}${m.retired ? ' (no longer sent)' : ''}`;
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

// The list's two groups, in order: theirs first (what they're working on),
// then our default ones
const GROUPS = [
  { id: 'own', label: 'Your custom templates', has: (r) => r.own },
  { id: 'default', label: 'Default templates', has: (r) => !r.own },
];

// startCreate: { product, moment } to open straight on a new template for
//   that message (a reminder's "Create a new template")
// onAddContact(): go to Connection with its contact number panel open
//   (the automatic reply's pop-up, while there's no contact number)
export default function WhatsAppTemplates({ connection, onConnect, onAddContact, startCreate = null }) {
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

  // The note about our default messages: on the first visit after
  // connecting, marked seen as it shows, and there for this visit until closed
  const [introOpen, setIntroOpen] = useState(() => connected && connection.templatesIntro === false);
  useEffect(() => {
    if (connected && connection.templatesIntro === false) markTemplatesIntroSeen();
  }, [connected, connection?.templatesIntro]);

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
    ...READY_MADE.map((r) => readyMadeRow(r, connection)),
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

  // A row's ⋯ menu: Duplicate, where it can be, and Delete for theirs
  const menuItems = (r) => [
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
  ];

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
        {introOpen && (
          <div className="wtp-note wtp-intro" role="status">
            <p>These are default reminder messages we submitted for you. You can write your own versions any time.</p>
            <button type="button" className="wtp-intro__close" onClick={() => setIntroOpen(false)} aria-label="Close">
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        )}
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
              {/* One tbody per group, its heading row first */}
              {GROUPS.map((g) => {
                const inGroup = shown.filter(g.has);
                if (inGroup.length === 0) return null;
                return (
                  <tbody key={g.id}>
                    <tr className="wtp-group">
                      <th scope="rowgroup" colSpan={4}>
                        <span className="wtp-group__band">{g.label}</span>
                      </th>
                    </tr>
                    {inGroup.map((r) => (
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
                          {/* Only when there's something in it: the automatic reply has nothing */}
                          {menuItems(r).length > 0 && (
                            <RowMenu
                              title={r.name}
                              open={menu === r.key}
                              onOpenChange={(o) => setMenu(o ? r.key : null)}
                              items={menuItems(r)}
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                );
              })}
            </table>
          </div>
        )}
      </div>

      {opened && (
        <TemplateDialog
          row={opened}
          sender={sender}
          contactNumber={connection?.contactNumber ?? null}
          // Only once connected: the contact number is added on the connected screen
          onAddContact={connected ? onAddContact : null}
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