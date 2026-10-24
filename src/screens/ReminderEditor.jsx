import { useEffect, useMemo, useRef, useState } from 'react';
import { Bold, Check, ChevronDown, Italic, Link2, List, RotateCcw, Send, Video } from 'lucide-react';
import InboxPreview from '../components/InboxPreview';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  FIELDS,
  emailOf,
  fieldHint,
  fieldLabel,
  fieldValues,
  fillIn,
  reminderById,
  timeline,
  emailStatus,
} from '../data/reminders';
import './ReminderEditor.css';

// ------------------------------------------------------------
// The email editor for one automatic email: a full page, opened from
// the Emails tab's pencil. It starts with our template (data/
// reminders.js), or the coach's own version once they've saved one.
// Nothing here is written by AI: the template is fixed text with the
// webinar's details slotted in.
//
//   ← Emails
//   Confirmation email after registering   Reset to template  [Send me a test]  [Save changes]
//   Goes to each person as they register. Changes only affect this webinar.
//   ┌ the email (wider: the thing you work on) ┐   How Priya will see it
//   │ Subject  [You're in: (Webinar title)]    │  ╭━━━━━━━━━ • ━━━━━━━━━━╮
//   │ B I 🔗 •                 + Insert detail │  ┃ ┌──────────────────┐ ┃
//   │ Hi (First name), …                       │  ┃ │ the inbox, on a  │ ┃
//   │ [ Join webinar ]                         │  ┃ │ tablet's screen  │ ┃
//   └──────────────────────────────────────────┘  ┃ └──────────────────┘ ┃
//                                                 ╰━━━━━━━━━━━━━━━━━━━━━━╯
//
// For laptops and desktops only (the tool isn't used on phones).
// - Which webinar this email belongs to (title and date) is in the app's
//   top bar (App.jsx passes `when`); each webinar keeps its own copy of
//   these emails, and the status line says so.
// - Left: the email with placeholders: fill-in fields are chips with
//   their name ("First name"); hovering says what they fill in. Saved as
//   markers ({{first_name}}); the sending system fills them in.
// - Right: the email as it lands in a desktop inbox (InboxPreview.jsx),
//   filled in for an example person (SAMPLE: Harish), never a real
//   registrant: everyone gets the same email, only the first name
//   changes, and the page says so. Updates with every keystroke. It sits on the screen of a dark tablet, a
//   little smaller, so it reads as a picture of someone's device rather
//   than a second form. Who sent it shows there
//   only: the editor has no From row, since it can't be changed.
// - Subject: one line. Body: bold, italic, link and bullet list only.
// - The Join webinar button (a link to that person's Zoom join address)
//   is a fixed block, so it can't be deleted from the emails that need it.
// - Save changes is greyed out until something changes; Ctrl/⌘+S saves
//   too. Saving goes back to the Emails list (App does that).
// - Send me a test sits beside it, always: an address box, filled with
//   the last one used. It sends what's on screen, saved or not.
// - Reset to template is a quiet text button, shown only once the text
//   differs from the template; it asks first.
// - Pasting brings in plain text only.
// The text boxes use the browser's own editing (contentEditable); a
// real build would likely swap in an editor library (e.g. TipTap) that
// saves the same thing: subject + simple HTML with {{markers}}.
//
// ended: the webinar is over. Every email stays editable: for one that
//        has already gone out, a note says the changes are used when
//        the webinar is run again.
// guardRef: App asks it before leaving (the top bar's ← Emails):
//           returns false, and asks the coach, when there are changes
// onSave({ subject, body }), onClose()
// ------------------------------------------------------------

const TEST_KEY = 'pagebuilder:test-email'; // the last address a test went to

// The example person the preview (and a test) is filled in for. Not a
// real registrant: with hundreds, any one name is arbitrary, changes as
// people sign up, and shows an attendee's name on a page coaches share.
const SAMPLE = { name: 'Harish', email: 'harish@gmail.com' };

// ---------- Between saved text and what's on screen ----------

const escapeHtml = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// {{first_name}} → a placeholder chip ("First name") the coach can't
// type inside; its hint says what it fills in. The preview shows the
// real values.
const chipHtml = (key) =>
  `<span class="re-chip" contenteditable="false" data-field="${key}" data-tip="${escapeHtml(fieldHint(key))}">${escapeHtml(fieldLabel(key))}</span>`;

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
  const [test, setTest] = useState(null); // Send me a test: { to, sent }

  const dirty = draft.subject !== saved.subject || draft.body !== saved.body;
  const row = timeline(webinar, people, now).find((x) => x.id === id);
  // The preview's person: always the example, the same for every webinar
  const values = useMemo(() => fieldValues(webinar, SAMPLE, hostName), [webinar, hostName]);

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

  // Ctrl/⌘+S saves
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (dirty && !emptyNow()) save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const emptyNow = () => !readSubject(subjectEl.current);

  // Send me a test: the address box, filled with the last one used
  const openTest = () => {
    let last = '';
    try {
      last = localStorage.getItem(TEST_KEY) ?? '';
    } catch {
      // no storage: start empty
    }
    setTest({ to: last, sent: null, error: null });
  };
  const sendTest = () => {
    const to = test.to.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      setTest({ ...test, error: 'Enter an email address, like you@gmail.com' });
      return;
    }
    try {
      localStorage.setItem(TEST_KEY, to);
    } catch {
      // fine: it just won't be remembered
    }
    // The real app sends what's on screen now (even unsaved), with the
    // fields filled in for SAMPLE, so it matches the preview.
    setTest({ to, sent: to, error: null });
  };

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

  // When it goes out, and who it went to: the same words as the Emails
  // list's hover hint (emailStatus in data/reminders.js)
  const status = emailStatus(row, webinar.answers, now).full;

  // Already gone out for this date: say where changes will be used
  const usedLater = ended
    ? 'This webinar has ended. Your changes will be used when you run it again.'
    : row.past && row.at !== null && !row.skipped
      ? 'Already sent for this date. Your changes will be used when you run this webinar again.'
      : null;

  const isTemplate = draft.subject === reminder.subject && draft.body === reminder.body;
  const emptySubject = !draft.subject;


  return (
    <div className="re">
      <header className="re__head">
        <div className="re__intro">
          <h1 className="re__title">{reminder.name}</h1>
          <p className="re__status">{status}. Changes only affect this webinar.</p>
        </div>
        <div className="re__actions">
          {!isTemplate && (
            <button type="button" className="re__reset" onClick={() => setAsk('reset')}>
              <RotateCcw size={14} aria-hidden="true" /> Reset to template
            </button>
          )}
          <button
            type="button"
            className="oh__edit re__btn"
            onClick={openTest}
            aria-expanded={Boolean(test)}
            aria-controls="re-test"
          >
            <Send size={15} aria-hidden="true" /> Send me a test
          </button>
          <button
            type="button"
            className="oh__add re__btn re__save"
            onClick={save}
            disabled={!dirty || emptySubject}
          >
            Save changes
          </button>
        </div>
      </header>

      {usedLater && <p className="re__note">{usedLater}</p>}

      {test && (
        <div className="re__test" id="re-test">
          {test.sent ? (
            <p className="re__test-done" role="status">
              <Check size={15} strokeWidth={3} aria-hidden="true" /> Test sent to <b>{test.sent}</b>
            </p>
          ) : (
            <>
              <label className="re__test-label" htmlFor="re-test-to">
                Send a test to
              </label>
              <input
                id="re-test-to"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@gmail.com"
                value={test.to}
                autoFocus
                aria-invalid={Boolean(test.error) || undefined}
                aria-describedby={test.error ? 're-test-error' : undefined}
                onChange={(e) => setTest({ ...test, to: e.target.value, error: null })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') sendTest();
                  if (e.key === 'Escape') setTest(null);
                }}
              />
              <button type="button" className="oh__add re__btn" onClick={sendTest}>
                <Send size={15} aria-hidden="true" /> Send
              </button>
            </>
          )}
          <button type="button" className="re__test-close" onClick={() => setTest(null)}>
            {test.sent ? 'Done' : 'Cancel'}
          </button>
          {test.error && (
            <p className="re__error re__test-error" id="re-test-error">
              {test.error}
            </p>
          )}
        </div>
      )}

      <div className="re__grid">
      {/* ---------- Left: the email, with placeholders ---------- */}
      <section className="re__card" aria-label="Email">
        <div className="re__line re__line--subject">
          <span className="re__line-label" id="re-subject-label">
            Subject
          </span>
          <div className="re__subject-wrap">
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
                    <span className="re__menu-eg">{f.hint}</span>
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

        {/* The button, as it will look in the email: a link to their Zoom join address */}
        {reminder.join && (
          <div className="re__join">
            <span className="re__join-btn" data-tip="Opens Zoom for each person" data-tip-align="start">
              <Video size={15} aria-hidden="true" /> Join webinar
            </span>
          </div>
        )}

      </section>

      {/* ---------- Right: how it lands in their inbox ---------- */}
      <section className="re__preview" aria-label="Preview">
        <div className="re__preview-caption">
          <p className="re__preview-title">How it will look in their inbox</p>
          <p className="re__preview-note">
            Everyone gets this same email with their own first name. {SAMPLE.name} is an example.
          </p>
        </div>
        <div className="re__tablet">
          <span className="re__tablet-camera" aria-hidden="true" />
          <div className="re__screen">
            <InboxPreview
              subject={fillIn(draft.subject, values)}
              bodyHtml={fillIn(draft.body, values, { html: true })}
              fromName={values.your_name}
              toEmail={SAMPLE.email}
              time={new Date(now).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              join={reminder.join ? { label: 'Join webinar', href: values.join_link } : null}
              footer={`You’re getting this because you registered for ${values.webinar_title}.`}
            />
          </div>
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