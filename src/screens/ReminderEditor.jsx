import { useEffect, useMemo, useRef, useState } from 'react';
import { Bold, Check, ChevronDown, Italic, Link2, List, RotateCcw, Send, Video } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  FIELDS,
  emailOf,
  fieldLabel,
  fieldValues,
  fillIn,
  reminderById,
  timeline,
  whenLabel,
} from '../data/reminders';
import './ReminderEditor.css';

// ------------------------------------------------------------
// The email editor for one reminder: a full page, opened from the
// Reminders tab's Edit email. It starts with our template (data/
// reminders.js), or the coach's own version once they've saved one.
// Nothing here is written by AI: the template is fixed text with the
// webinar's details slotted in.
//
//   Reminder email 1 hour before webinar   [Send me a test] [Save]
//   Goes out Today at 3:00 pm
//   ┌ Subject ───────────────────────────┐   ┌ Preview ──────┐
//   │ Starting in 1 hour: [Webinar title]│   │ (phone)       │
//   ├ [B] [I] [🔗] [•]   [+ Insert detail]│   │               │
//   │ Hi [First name], …                 │   │ Hi Priya, …   │
//   │ [ Join webinar ]  always included  │   │ [Join webinar]│
//   └────────────────────────────────────┘   └───────────────┘
//                         Reset to template
//
// Kept simple on purpose, for the developer who builds the real one:
// - Subject: one line. Body: bold, italic, link and bullet list only.
// - "Insert detail" adds a fill-in field as a grey chip ([First name]).
//   Saved as a marker ({{first_name}}); the sending system fills it in.
// - The Join webinar button is a fixed block, not part of the text, so
//   it can't be deleted from the emails that need it.
// - The preview fills the fields in with a real person who registered
//   (or a sample one) and follows every keystroke.
// - Pasting brings in plain text only, so no stray styles come along.
// The text boxes use the browser's own editing (contentEditable); a
// real build would likely swap in an editor library (e.g. TipTap) that
// saves the same thing: subject + simple HTML with {{markers}}.
//
// ended: the webinar is over. Every email stays editable: for one that
//        has already gone out, a note says the changes are used when
//        the webinar is run again.
// guardRef: App asks it before leaving (the top bar's ← Reminders):
//           returns false, and asks the coach, when there are changes
// onSave({ subject, body }), onClose()
// ------------------------------------------------------------

// ---------- Between saved text and what's on screen ----------

const escapeHtml = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// {{first_name}} → a grey chip the coach can't type inside
const chipHtml = (key) =>
  `<span class="re-chip" contenteditable="false" data-field="${key}">${escapeHtml(fieldLabel(key))}</span>`;

const withChips = (saved) => String(saved ?? '').replace(/\{\{(\w+)\}\}/g, (all, key) => chipHtml(key));

// The subject is plain text with markers: escape it, then add chips
const subjectToHtml = (subject) => withChips(escapeHtml(subject));

// What the browser's editing made → our simple, safe HTML
const KEEP = { P: 'p', DIV: 'p', BR: 'br', B: 'b', STRONG: 'b', I: 'i', EM: 'i', A: 'a', UL: 'ul', OL: 'ol', LI: 'li' };

function clean(node, { singleLine = false } = {}) {
  let out = '';
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      out += escapeHtml(child.textContent.replace(/\u00a0/g, ' '));
      return;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return;
    if (child.dataset?.field) {
      out += `{{${child.dataset.field}}}`;
      return;
    }
    const inner = clean(child, { singleLine });
    const tag = singleLine ? null : KEEP[child.tagName];
    if (!tag) {
      out += inner; // anything else: keep its text, drop the tag
      return;
    }
    if (tag === 'br') {
      out += '<br>';
      return;
    }
    if (tag === 'a') {
      const href = child.getAttribute('href') ?? '';
      const safe = /^(https?:|mailto:)/i.test(href) || /^\{\{\w+\}\}$/.test(href);
      out += safe ? `<a href="${escapeHtml(href)}">${inner}</a>` : inner;
      return;
    }
    out += `<${tag}>${inner}</${tag}>`;
  });
  return out;
}

// The subject: one line of text with markers (no HTML)
function readSubject(el) {
  const holder = document.createElement('div');
  holder.innerHTML = clean(el, { singleLine: true });
  return holder.textContent.replace(/\s+/g, ' ').trim();
}

// The body: simple HTML with markers; empty paragraphs dropped
const readBody = (el) =>
  clean(el)
    .replace(/<p>(\s|<br>)*<\/p>/g, '')
    .trim();

// ---------- The editor ----------
export default function ReminderEditor({ webinar, id, people = [], hostName, now, ended = false, guardRef, onSave, onClose }) {
  const reminder = reminderById(id);
  const saved = emailOf(webinar, id); // what's saved now (or the template)
  const subjectEl = useRef(null);
  const bodyEl = useRef(null);
  const range = useRef(null); // where the cursor last was, in either box
  const [draft, setDraft] = useState({ subject: saved.subject, body: saved.body });
  const [menu, setMenu] = useState(false); // Insert detail
  const [linking, setLinking] = useState(null); // the link box: { href }
  const [ask, setAsk] = useState(null); // 'leave' | 'reset'
  const [test, setTest] = useState(false);

  const dirty = draft.subject !== saved.subject || draft.body !== saved.body;
  const row = timeline(webinar, people, now).find((x) => x.id === id);
  const sample = people[0] ?? null; // the preview's person
  const values = useMemo(() => fieldValues(webinar, sample, hostName), [webinar, sample, hostName]);

  // Fill the boxes once (after that the browser owns them)
  const fill = (subject, body) => {
    if (subjectEl.current) subjectEl.current.innerHTML = subjectToHtml(subject);
    if (bodyEl.current) bodyEl.current.innerHTML = withChips(body);
  };
  useEffect(() => {
    // A new page: start at the top (the Reminders tab may have been scrolled)
    document.querySelector('.app__main')?.scrollTo?.(0, 0);
    window.scrollTo(0, 0);
    fill(saved.subject, saved.body);
    try {
      document.execCommand('defaultParagraphSeparator', false, 'p');
    } catch {
      // older browsers: new lines become <div>, which clean() turns into <p>
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const read = () => setDraft({ subject: readSubject(subjectEl.current), body: readBody(bodyEl.current) });

  // Remember the cursor, so the toolbar and Insert detail act where it was
  useEffect(() => {
    const onSelect = () => {
      const sel = window.getSelection();
      if (!sel?.rangeCount) return;
      const r = sel.getRangeAt(0);
      if (subjectEl.current?.contains(r.startContainer) || bodyEl.current?.contains(r.startContainer)) {
        range.current = r.cloneRange();
      }
    };
    document.addEventListener('selectionchange', onSelect);
    return () => document.removeEventListener('selectionchange', onSelect);
  }, []);

  const restore = (fallback = bodyEl.current) => {
    const sel = window.getSelection();
    if (range.current) {
      sel.removeAllRanges();
      sel.addRange(range.current);
      return range.current.startContainer;
    }
    fallback?.focus();
    const r = document.createRange();
    r.selectNodeContents(fallback);
    r.collapse(false);
    sel.removeAllRanges();
    sel.addRange(r);
    return fallback;
  };

  const inBody = () => Boolean(range.current && bodyEl.current?.contains(range.current.startContainer));

  // Bold, italic, list: only in the body
  const format = (command) => {
    if (!inBody()) bodyEl.current.focus();
    else restore();
    document.execCommand(command);
    read();
  };

  // Insert a fill-in field where the cursor was (subject or body). Done
  // by hand rather than with insertHTML, which Chrome sometimes puts
  // outside the paragraph when the cursor is at its end.
  const insertField = (key) => {
    setMenu(false);
    restore();
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const r = sel.getRangeAt(0);
    r.deleteContents();
    const holder = document.createElement('span');
    holder.innerHTML = chipHtml(key);
    const chip = holder.firstChild;
    const space = document.createTextNode('\u00a0');
    r.insertNode(space);
    r.insertNode(chip);
    // The cursor goes after the space, ready to keep typing
    const after = document.createRange();
    after.setStartAfter(space);
    after.collapse(true);
    sel.removeAllRanges();
    sel.addRange(after);
    range.current = after.cloneRange();
    read();
  };

  // Links: a small box under the toolbar, for the address
  const openLink = () => {
    if (!inBody()) restore(bodyEl.current);
    setLinking({ href: 'https://' });
  };
  const addLink = () => {
    const href = linking.href.trim();
    setLinking(null);
    if (!/^(https?:\/\/|mailto:).+/i.test(href)) return;
    restore();
    const sel = window.getSelection();
    if (sel.isCollapsed) document.execCommand('insertHTML', false, `<a href="${escapeHtml(href)}">${escapeHtml(href)}</a>`);
    else document.execCommand('createLink', false, href);
    read();
  };

  // Plain text only when pasting; one line in the subject
  const onPaste = (single) => (e) => {
    e.preventDefault();
    let text = e.clipboardData.getData('text/plain');
    if (single) text = text.replace(/\s+/g, ' ');
    document.execCommand('insertText', false, text);
  };

  // Leaving with changes asks first: here (the top bar) and on refresh
  useEffect(() => {
    if (!guardRef) return undefined;
    guardRef.current = () => {
      if (!dirty) return true;
      setAsk('leave');
      return false;
    };
    return () => {
      guardRef.current = null;
    };
  }, [dirty, guardRef]);

  useEffect(() => {
    if (!dirty) return undefined;
    const onUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [dirty]);

  const save = () => {
    const subject = readSubject(subjectEl.current);
    if (!subject) {
      subjectEl.current.focus();
      return;
    }
    onSave({ subject, body: readBody(bodyEl.current) });
  };

  const reset = () => {
    fill(reminder.subject, reminder.body);
    setDraft({ subject: reminder.subject, body: reminder.body });
    setAsk(null);
  };

  // When it goes out, and who it went to: here rather than in the list
  const when = row.at === null ? null : whenLabel(row.at, webinar.answers, now).replace(', ', ' at ');
  const n = (count) => `${count} ${count === 1 ? 'person' : 'people'}`;
  let status;
  if (row.at === null) status = row.on ? `Goes to each person as they register · sent to ${n(row.sentTo)} so far` : 'Off: this email won’t be sent';
  else if (!row.past) status = row.on ? `Goes out ${when}` : 'Off: this email won’t be sent';
  else if (!row.on) status = `Was off at ${when}, so it wasn’t sent`;
  else status = row.sentTo ? `Sent to ${n(row.sentTo)} · ${when}` : `Went out ${when}, before anyone registered`;

  // Already gone out for this date: say where changes will be used
  const usedLater = ended
    ? 'This webinar has ended. Your changes will be used when you run it again.'
    : row.past && row.at !== null
      ? 'Already sent for this date. Your changes will be used when you run this webinar again.'
      : null;

  const isTemplate = draft.subject === reminder.subject && draft.body === reminder.body;
  const emptySubject = !draft.subject;

  return (
    <div className="re">
      <header className="re__head">
        <div>
          <p className="re__kicker">Automatic email</p>
          <h1 className="re__title">{reminder.name}</h1>
          <p className="re__status">{status}</p>
        </div>
        <div className="re__actions">
          <button type="button" className="oh__edit re__btn" onClick={() => setTest(true)}>
            {test ? <Check size={15} strokeWidth={3} aria-hidden="true" /> : <Send size={15} aria-hidden="true" />}
            {test ? 'Test sent' : 'Send me a test'}
          </button>
          <button type="button" className="oh__add re__btn re__save" onClick={save} disabled={!dirty || emptySubject}>
            Save
          </button>
        </div>
      </header>

      {test && (
        <p className="re__note" role="status">
          In the real app, this email goes to your inbox so you can check it. Nothing is sent in this preview.
        </p>
      )}
      {usedLater && <p className="re__note">{usedLater}</p>}

      <div className="re__grid">
        {/* ---------- The email ---------- */}
        <section className="re__card" aria-label="Email">
          <div className="re__field">
            <span className="re__label" id="re-subject-label">
              Subject
            </span>
            <div
              ref={subjectEl}
              className="re__subject"
              role="textbox"
              aria-labelledby="re-subject-label"
              aria-invalid={emptySubject || undefined}
              contentEditable
              suppressContentEditableWarning
              onInput={read}
              onPaste={onPaste(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.preventDefault(); // one line
              }}
            />
            {emptySubject && <p className="re__error">Add a subject, so people know what it’s about.</p>}
          </div>

          <div className="re__toolbar" role="toolbar" aria-label="Format the email">
            <ToolButton label="Bold" onClick={() => format('bold')}>
              <Bold size={16} />
            </ToolButton>
            <ToolButton label="Italic" onClick={() => format('italic')}>
              <Italic size={16} />
            </ToolButton>
            <ToolButton label="Link" onClick={openLink}>
              <Link2 size={16} />
            </ToolButton>
            <ToolButton label="Bullet list" onClick={() => format('insertUnorderedList')}>
              <List size={16} />
            </ToolButton>

            <div className="re__insert">
              <button
                type="button"
                className="re__insert-btn"
                aria-haspopup="menu"
                aria-expanded={menu}
                onMouseDown={(e) => e.preventDefault()} // keep the cursor where it is
                onClick={() => setMenu((m) => !m)}
              >
                + Insert detail <ChevronDown size={14} aria-hidden="true" />
              </button>
              {menu && (
                <div className="re__menu" role="menu" onKeyDown={(e) => e.key === 'Escape' && setMenu(false)}>
                  {FIELDS.map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      role="menuitem"
                      className="re__menu-item"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insertField(f.key)}
                    >
                      {f.label}
                      <span className="re__menu-eg">{values[f.key]}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {linking && (
            <div className="re__linkbox">
              <label className="oh__sr-only" htmlFor="re-link">
                Link address
              </label>
              <input
                id="re-link"
                type="url"
                value={linking.href}
                autoFocus
                onChange={(e) => setLinking({ href: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addLink();
                  if (e.key === 'Escape') setLinking(null);
                }}
              />
              <button type="button" className="oh__add re__btn" onClick={addLink}>
                Add link
              </button>
              <button type="button" className="oh__edit re__btn" onClick={() => setLinking(null)}>
                Cancel
              </button>
            </div>
          )}

          <div
            ref={bodyEl}
            className="re__body"
            role="textbox"
            aria-multiline="true"
            aria-label="Email text"
            contentEditable
            suppressContentEditableWarning
            onInput={read}
            onPaste={onPaste(false)}
          />

          {reminder.join && (
            <div className="re__join">
              <span className="re__join-btn" aria-hidden="true">
                <Video size={15} /> Join webinar
              </span>
              <span className="re__join-note">Always included: takes them straight into your Zoom meeting.</span>
            </div>
          )}

          {!isTemplate && (
            <div className="re__foot">
              <button type="button" className="re__reset" onClick={() => setAsk('reset')}>
                <RotateCcw size={14} aria-hidden="true" /> Reset to template
              </button>
            </div>
          )}
        </section>

        {/* ---------- The preview, as it lands on a phone ---------- */}
        <section className="re__preview" aria-label="Preview">
          <p className="re__label">
            Preview{sample ? `, as ${values.first_name} will see it` : ''}
          </p>
          <div className="re__phone">
            <div className="re__mail-head">
              <span className="re__avatar" aria-hidden="true">
                {values.your_name.charAt(0).toUpperCase()}
              </span>
              <span className="re__from">
                <b>{values.your_name}</b>
                <span>to {sample?.email ?? 'priya@gmail.com'}</span>
              </span>
            </div>
            <p className="re__mail-subject">{fillIn(draft.subject, values) || 'No subject'}</p>
            <div
              className="re__mail-body"
              // Our own clean() output, with escaped values filled in
              dangerouslySetInnerHTML={{ __html: fillIn(draft.body, values, { html: true }) }}
            />
            {reminder.join && (
              <a className="re__mail-join" href={values.join_link} target="_blank" rel="noopener">
                Join webinar
              </a>
            )}
            <p className="re__mail-foot">You’re getting this because you registered for {values.webinar_title}.</p>
          </div>
        </section>
      </div>

      {ask === 'leave' && (
        <ConfirmDialog
          title="Leave without saving?"
          confirmLabel="Leave without saving"
          cancelLabel="Keep editing"
          danger
          onCancel={() => setAsk(null)}
          onConfirm={() => {
            setAsk(null);
            onClose();
          }}
        >
          <p>Your changes to this email will be lost.</p>
        </ConfirmDialog>
      )}
      {ask === 'reset' && (
        <ConfirmDialog
          title="Go back to the template?"
          confirmLabel="Use the template"
          cancelLabel="Keep my version"
          onCancel={() => setAsk(null)}
          onConfirm={reset}
        >
          <p>Your changes to this email will be replaced with the original text. Nothing is saved until you press Save.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}

// A toolbar button that keeps the cursor in the text
function ToolButton({ label, onClick, children }) {
  return (
    <button
      type="button"
      className="re__tool"
      aria-label={label}
      data-tip={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}