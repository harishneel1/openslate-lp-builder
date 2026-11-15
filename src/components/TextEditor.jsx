import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extensions';
import { Bold, Italic, Link2, List, ListOrdered, Unlink } from 'lucide-react';
import { readLink } from '../data/courses';
import './TextEditor.css';

// ------------------------------------------------------------
// A lesson's text: a small rich text editor (TipTap), and the same text
// shown read-only (TextView).
//
//   [Normal ▾] [B] [I] [• list] [1. list] [🔗 Link]
//   ┌──────────────────────────────────────────────────────────┐
//   │ Write this lesson here…                                  │
//   └──────────────────────────────────────────────────────────┘
//   Unsaved changes                              [Cancel] [Save]
//
// Normal text, two heading sizes (Heading, Subheading), bold, italic,
// bulleted and numbered lists, and links. Nothing else, on purpose: the
// lesson reads cleanly, and pasted text from anywhere comes in as just
// these. Usual shortcuts work (⌘B, ⌘I, "- " starts a list, "# " a heading).
//
// Link: with words selected, they become the link; with none, the link
// is put in as its own words. In a link, Link changes it and Remove link
// takes it off. Links open in a new tab for students.
//
// Save is there once something's changed and there's some text; Cancel
// asks first if there are changes. The page hears about unsaved changes
// (onDirtyChange), so leaving the lesson can ask too.
//
// initialHtml: the text as saved ('' for none)
// onSave(html) → true if it saved; onCancel()
// onDirtyChange(dirty)
// ------------------------------------------------------------

// The same set of things the editor and the read-only view understand
export function textExtensions({ forView = false } = {}) {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      blockquote: false,
      code: false,
      codeBlock: false,
      horizontalRule: false,
      strike: false,
      underline: false,
      link: {
        openOnClick: forView,
        autolink: true,
        defaultProtocol: 'https',
        HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer nofollow' },
      },
    }),
    ...(forView ? [] : [Placeholder.configure({ placeholder: 'Write this lesson here…' })]),
  ];
}

export default function TextEditor({ initialHtml = '', onSave, onCancel, onDirtyChange, onAskDiscard }) {
  const baseline = useRef(null); // the html as it started, as the editor writes it
  const [dirty, setDirty] = useState(false);
  const [linking, setLinking] = useState(false);

  const editor = useEditor({
    extensions: textExtensions(),
    content: initialHtml,
    autofocus: initialHtml ? false : 'end',
    editorProps: {
      attributes: { class: 'tte__content', 'aria-label': 'Lesson text', 'aria-multiline': 'true' },
    },
    onCreate: ({ editor: e }) => {
      baseline.current = e.getHTML();
    },
    onUpdate: ({ editor: e }) => setDirty(e.getHTML() !== baseline.current),
  });

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            bold: e.isActive('bold'),
            italic: e.isActive('italic'),
            bullet: e.isActive('bulletList'),
            ordered: e.isActive('orderedList'),
            link: e.isActive('link'),
            style: e.isActive('heading', { level: 2 }) ? 'h2' : e.isActive('heading', { level: 3 }) ? 'h3' : 'p',
            empty: e.isEmpty,
          }
        : null,
  });

  // The page knows while there are unsaved changes, and stops knowing when this goes
  useEffect(() => onDirtyChange?.(dirty), [dirty]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onDirtyChange?.(false), []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!editor || !state) return null;

  const run = (fn) => fn(editor.chain().focus()).run();

  const setStyle = (style) =>
    run((c) => (style === 'p' ? c.setParagraph() : c.setHeading({ level: style === 'h2' ? 2 : 3 })));

  const save = () => {
    if (!dirty || state.empty) return;
    if (onSave(editor.getHTML())) {
      baseline.current = editor.getHTML();
      setDirty(false);
    }
  };

  const cancel = () => (dirty ? onAskDiscard(onCancel) : onCancel());

  return (
    <div className="tte">
      <div className="tte__bar" role="toolbar" aria-label="Text formatting">
        <label className="tte__sr" htmlFor="tte-style">
          Text style
        </label>
        <select id="tte-style" className="tte__style" value={state.style} onChange={(e) => setStyle(e.target.value)}>
          <option value="p">Normal text</option>
          <option value="h2">Heading</option>
          <option value="h3">Subheading</option>
        </select>
        <span className="tte__sep" aria-hidden="true" />
        <ToolButton label="Bold" on={state.bold} onClick={() => run((c) => c.toggleBold())}>
          <Bold size={17} />
        </ToolButton>
        <ToolButton label="Italic" on={state.italic} onClick={() => run((c) => c.toggleItalic())}>
          <Italic size={17} />
        </ToolButton>
        <span className="tte__sep" aria-hidden="true" />
        <ToolButton label="Bulleted list" on={state.bullet} onClick={() => run((c) => c.toggleBulletList())}>
          <List size={18} />
        </ToolButton>
        <ToolButton label="Numbered list" on={state.ordered} onClick={() => run((c) => c.toggleOrderedList())}>
          <ListOrdered size={18} />
        </ToolButton>
        <span className="tte__sep" aria-hidden="true" />
        <ToolButton label={state.link ? 'Change link' : 'Add link'} on={linking} onClick={() => setLinking((v) => !v)} wide>
          <Link2 size={17} /> Link
        </ToolButton>
        {state.link && (
          <ToolButton label="Remove link" onClick={() => run((c) => c.extendMarkRange('link').unsetLink())} wide>
            <Unlink size={17} /> Remove link
          </ToolButton>
        )}
      </div>

      {linking && (
        <LinkBar
          editor={editor}
          current={state.link ? editor.getAttributes('link').href : ''}
          onDone={() => setLinking(false)}
        />
      )}

      <EditorContent editor={editor} className="tte__box" />

      <div className="tte__foot">
        <p className="tte__status" aria-live="polite">
          {dirty ? (state.empty ? 'Write something to save' : 'Unsaved changes') : ''}
        </p>
        <button type="button" className="crs-btn crs-btn--quiet crs-btn--small" onClick={cancel}>
          Cancel
        </button>
        <button type="button" className="crs-btn crs-btn--primary crs-btn--small" onClick={save} disabled={!dirty || state.empty}>
          Save text
        </button>
      </div>
    </div>
  );
}

function ToolButton({ label, on, onClick, wide, children }) {
  return (
    <button
      type="button"
      className={`tte__btn ${wide ? 'tte__btn--wide' : ''} ${on ? 'tte__btn--on' : ''}`}
      aria-pressed={on === undefined ? undefined : Boolean(on)}
      aria-label={wide ? undefined : label}
      title={label}
      onMouseDown={(e) => e.preventDefault()} // keeps the words selected
      onClick={onClick}
    >
      {children}
    </button>
  );
}

// "Paste a link" under the toolbar: Apply makes the selected words a
// link, or puts the link in as its own words
function LinkBar({ editor, current, onDone }) {
  const [text, setText] = useState(current);
  const [error, setError] = useState(false);

  const apply = (e) => {
    e.preventDefault();
    const url = readLink(text);
    if (!url) {
      setError(true);
      return;
    }
    const { empty } = editor.state.selection;
    if (empty && !editor.isActive('link')) {
      editor
        .chain()
        .focus()
        .insertContent({ type: 'text', text: url, marks: [{ type: 'link', attrs: { href: url } }] })
        .insertContent(' ')
        .run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
    onDone();
  };

  return (
    <form className="tte__linkbar" onSubmit={apply}>
      <label className="tte__sr" htmlFor="tte-link">
        Link
      </label>
      <input
        id="tte-link"
        className="crs-input tte__link-input"
        value={text}
        placeholder="Paste a link, e.g. https://example.com"
        autoComplete="off"
        autoFocus // eslint-disable-line jsx-a11y/no-autofocus
        aria-invalid={error || undefined}
        onChange={(e) => {
          setText(e.target.value);
          setError(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            onDone();
            editor.commands.focus();
          }
        }}
      />
      <button type="submit" className="crs-btn crs-btn--primary crs-btn--small">
        Apply
      </button>
      <button type="button" className="crs-btn crs-btn--quiet crs-btn--small" onClick={onDone}>
        Cancel
      </button>
      {error && <p className="tte__link-error">That doesn’t look like a link. Check it and try again.</p>}
    </form>
  );
}

// The text as students will read it, read-only: links open in a new tab
export function TextView({ html }) {
  const editor = useEditor({
    extensions: textExtensions({ forView: true }),
    content: html,
    editable: false,
    editorProps: { attributes: { class: 'tte__content tte__content--view' } },
  });
  useEffect(() => {
    if (editor && html !== editor.getHTML()) editor.commands.setContent(html);
  }, [editor, html]);
  return <EditorContent editor={editor} />;
}