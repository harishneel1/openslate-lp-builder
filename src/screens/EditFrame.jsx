import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, Check, ChevronDown, ExternalLink } from 'lucide-react';
import './EditFrame.css';

// ------------------------------------------------------------
// Shared by every edit screen (a call, their profile), so they all
// behave the same:
//   useEditDraft  keeps changes on screen until Save
//   EditFrame     back link, title, "Leave without saving?", save bar
//   EditPanel     one white section with a heading
//   EditSection   the same, collapsed to a one-line summary until opened
// ------------------------------------------------------------

// saved: what's saved now. fields: the answer ids this screen may change.
// Returns the draft (saved + changes) and everything the frame needs.
export function useEditDraft(saved, fields) {
  const [edits, setEdits] = useState({}); // only what they've changed since the last save
  const [formKey, setFormKey] = useState(0); // bumped on Discard, so the form starts afresh
  const [justSaved, setJustSaved] = useState(false); // "Changes saved" until they edit again
  const [leaving, setLeaving] = useState(false); // "Leave without saving?" showing

  const draft = useMemo(() => ({ ...saved, ...edits }), [saved, edits]);
  const changed = fields.filter((id) => id in edits && edits[id] !== saved[id]);
  const dirty = changed.length > 0;

  return {
    draft,
    dirty,
    formKey,
    justSaved,
    leaving,
    setLeaving,
    // The changed answers, ready to save
    changes: () => Object.fromEntries(changed.map((id) => [id, edits[id]])),
    handleChange: (value, id) => {
      if (!fields.includes(id)) return;
      setEdits((prev) => ({ ...prev, [id]: value }));
      setJustSaved(false);
      setLeaving(false);
    },
    discard: () => {
      setEdits({});
      setFormKey((k) => k + 1);
      setLeaving(false);
    },
    // Call after saving: the draft is now what's saved
    saved: () => {
      setEdits({});
      setJustSaved(true);
    },
  };
}

// edit: from useEditDraft.
// problem: what's stopping a save (shown in the bar), or null.
// onSave: the screen's own save (it calls edit.saved() once done).
// viewHref: their live page, linked after saving.
// confirm: { title, body, confirmLabel, onConfirm, onCancel } to ask before saving
//          (shown as a pop-up), or null.
// createLabel: set when making something new ("Add to your page"). The bar
//          then always shows Cancel and this button (disabled while there's
//          a problem), and leaving asks before dropping what they've filled in.
// message: a note in the bar that doesn't stop saving (e.g. a failed try).
// backLabel: the back link's words (where it goes).
// aside: shown beside the form on wide screens (a live preview), or null.
// leaveNew: what "Leave without adding it?" says first, when making something new.
// bar: false for no bar at all (a screen with its own buttons, like the
//      contract's steps); otherwise the usual Save / Discard / Done.
export default function EditFrame({
  edit,
  title,
  sub,
  onBack,
  onSave,
  problem = null,
  message = null,
  viewHref,
  confirm = null,
  createLabel = null,
  backLabel = 'Your storefront',
  aside = null,
  leaveNew = 'This isn’t on your page yet.',
  bar = null,
  children,
}) {
  const { dirty, justSaved, leaving, setLeaving } = edit;
  const creating = Boolean(createLabel);

  // Closing the tab with unsaved changes: the browser asks first
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const back = () => (dirty ? setLeaving(true) : onBack());

  return (
    <div className={`es ${aside ? 'es--aside' : ''}`}>
      <div className="es__content">
        {aside && <aside className="es__aside">{aside}</aside>}
        <button type="button" className="es__back" onClick={back}>
          <ArrowLeft size={16} aria-hidden="true" /> {backLabel}
        </button>
        <h1 className="es__title">{title}</h1>
        {sub && <p className="es__sub">{sub}</p>}

        {/* Back pressed with unsaved changes */}
        {leaving && (
          <div className="es__leave" role="alert">
            <p>
              {creating ? (
                <>
                  <strong>{leaveNew}</strong> Leave without adding it?
                </>
              ) : (
                <>
                  <strong>You have unsaved changes.</strong> Leave without saving them?
                </>
              )}
            </p>
            <div className="es__leave-actions">
              <button type="button" className="es__btn es__btn--quiet" onClick={() => setLeaving(false)}>
                Keep editing
              </button>
              <button type="button" className="es__btn es__btn--danger" onClick={onBack}>
                {creating ? 'Leave without adding' : 'Leave without saving'}
              </button>
            </div>
          </div>
        )}

        {children}
      </div>

      {/* ---------- Save bar: full width, pinned to the bottom of the window ---------- */}
      {bar !== false && (
      <div className="es__bar">
        <div className="es__bar-inner">
          <p className="es__status" aria-live="polite">
            {message ? (
              <span className="es__message">{message}</span>
            ) : creating ? (
              problem
            ) : (
              dirty && (problem ?? 'You have unsaved changes')
            )}
            {/* Saved: say so, and offer a look at the live page */}
            {!creating && !dirty && justSaved && (
              <>
                <span className="es__saved">
                  <Check size={16} strokeWidth={3} aria-hidden="true" /> Changes saved
                </span>
                {viewHref && (
                  <a className="es__view" href={viewHref} target="_blank" rel="noopener">
                    View your page
                    <ExternalLink size={14} aria-hidden="true" />
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                )}
              </>
            )}
          </p>
          {/* Unsaved changes: Discard and Save. Nothing to save: Done, back to the offerings home. */}
          <div className="es__bar-actions">
            {creating ? (
              <>
                <button type="button" className="es__btn es__btn--quiet" onClick={back}>
                  Cancel
                </button>
                <button type="button" className="es__btn es__btn--primary" onClick={onSave} disabled={Boolean(problem)}>
                  {createLabel}
                </button>
              </>
            ) : dirty ? (
              <>
                <button type="button" className="es__btn es__btn--quiet" onClick={edit.discard}>
                  Discard changes
                </button>
                <button type="button" className="es__btn es__btn--primary" onClick={onSave} disabled={Boolean(problem)}>
                  Save changes
                </button>
              </>
            ) : (
              <button type="button" className="es__btn es__btn--primary" onClick={onBack}>
                Done
              </button>
            )}
          </div>
        </div>
      </div>
      )}

      {confirm && <ConfirmDialog {...confirm} />}
    </div>
  );
}

// A pop-up that asks before a save that can't be quietly undone (a new link).
// The browser's own <dialog>: it sits above everything, dims the page,
// keeps the keyboard inside, and Escape cancels. Cancel has focus first,
// so pressing Enter by habit doesn't change anything.
function ConfirmDialog({ title, body, confirmLabel, onConfirm, onCancel }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.open && dialog.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className="es-dialog"
      aria-labelledby="es-dialog-title"
      onCancel={(e) => {
        e.preventDefault(); // Escape: we close it ourselves
        onCancel();
      }}
      // A click on the dimmed page around it cancels too
      onClick={(e) => e.target === ref.current && onCancel()}
    >
      <h2 className="es-dialog__title" id="es-dialog-title">
        {title}
      </h2>
      <div className="es-dialog__body">{body}</div>
      <div className="es-dialog__actions">
        <button type="button" className="es__btn es__btn--quiet" onClick={onCancel} autoFocus>
          Cancel
        </button>
        <button type="button" className="es__btn es__btn--primary" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}

// One white section with a heading and a line under it
export function EditPanel({ id, title, sub, className = '', children }) {
  return (
    <section className="es__panel" aria-labelledby={id}>
      <div className="es__panel-head">
        <h2 className="es__panel-title" id={id}>
          {title}
        </h2>
        {sub && <p className="es__panel-sub">{sub}</p>}
      </div>
      <div className={`es__panel-body ${className}`}>{children}</div>
    </section>
  );
}

// A section that starts as one line: its title and a summary of what's set.
// The whole head opens and closes it. Closing keeps any changes (they only
// go when the save bar's Discard is pressed), and "Edited" marks a section
// with unsaved changes so they're easy to spot while it's closed.
// The body stays mounted while closed, so nothing in it resets.
//
// Design: each section has its own icon, so it can be found by shape
// without reading. The open section is ringed as one card (head and body
// together), its icon turns solid, and the closed ones fade back, so it's
// clear which one you're in. Opening one scrolls it to the top.
//
// icon: a lucide icon component for this section (optional)
// summary: what's set, shown while closed (sub shows while open)
// warn: something here needs fixing; the summary shows it in amber
// edited: unsaved changes in this section
export function EditSection({
  id,
  icon: Icon = null,
  title,
  sub,
  summary,
  warn = false,
  edited = false,
  open,
  onToggle,
  className = '',
  children,
}) {
  const bodyId = `${id}-body`;
  const line = open ? sub : summary;

  // Just opened: bring the whole section to the top, so its fields are in
  // view and nothing above it (a section that just closed) moves it away
  const ref = useRef(null);
  const wasOpen = useRef(open);
  useEffect(() => {
    if (open && !wasOpen.current) {
      const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      ref.current?.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
    }
    wasOpen.current = open;
  }, [open]);

  return (
    <section
      ref={ref}
      className={`es__panel es-sec ${open ? 'es-sec--open' : ''} ${!open && warn ? 'es-sec--warn' : ''}`}
      aria-label={title}
    >
      <h2 className="es-sec__heading">
        <button
          type="button"
          id={id}
          className="es-sec__toggle"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={onToggle}
        >
          {Icon && (
            <span className="es-sec__icon" aria-hidden="true">
              <Icon size={20} strokeWidth={2} />
            </span>
          )}
          <span className="es-sec__text">
            <span className="es-sec__title">
              {title}
              {edited && <span className="es-sec__edited">Edited</span>}
            </span>
            {line && (
              <span className={`es-sec__line ${!open && warn ? 'es-sec__line--warn' : ''}`}>
                {!open && warn && <AlertTriangle size={14} aria-hidden="true" />}
                <span className="es-sec__line-text">{line}</span>
              </span>
            )}
          </span>
          <span className="es-sec__action" aria-hidden="true">
            {open ? 'Hide' : 'Edit'}
            <ChevronDown size={16} className="es-sec__chevron" />
          </span>
        </button>
      </h2>
      <div id={bodyId} className={`es__panel-body es-sec__body ${className}`} hidden={!open}>
        {children}
      </div>
    </section>
  );
}

// The "Add a new offering" placeholder and any other simple page in the same frame
// children: an optional next step under the words (a button, say)
export function EditPlaceholder({ title, sub, onBack, backLabel = 'Your storefront', children = null }) {
  return (
    <div className="es">
      <div className="es__content">
        <button type="button" className="es__back" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" /> {backLabel}
        </button>
        <h1 className="es__title">{title}</h1>
        <p className="es__sub">{sub}</p>
        {children && <div className="es__placeholder-next">{children}</div>}
      </div>
    </div>
  );
}