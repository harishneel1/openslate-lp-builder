import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { DETAILS } from '../data/whatsappTemplates';

// ------------------------------------------------------------
// The message of a WhatsApp template, as the coach writes it
// (WhatsAppTemplateEditor.jsx). Plain text in WhatsApp's own formatting
// (*bold*, _italic_, ~strike~, new lines), with each detail as a tag the
// coach can't type into or change, as in the reminder emails' editor
// (ReminderEditor.jsx):
//
//   Hi [First name], your *[Call name]* with [Your name] starts in 1 hour.
//
// A tag is one piece: the cursor steps over it, Backspace or Delete takes
// all of it, and hovering says what it fills in. Tags only come from
// "+ Insert detail" (insertDetail). Braces can't be typed or pasted, so
// a detail can't be half-written by hand.
//
// What comes out (onChange) is the body as it's kept: details as {key}
// ('Hi {first_name}, …'), new lines as \n, no trailing space or lines.
// The box fills itself once from `initial`; after that the browser owns
// it. To fill it again (Use our wording again), give it a new key.
//
// initial:  the body to start from, details as {key}
// product:  'call' | 'webinar': which details there are
// onChange(body)
// labelledBy, describedBy, invalid: for screen readers and the error state
// The parent can call, through the ref:
//   wrap('*')           put a format mark either side of the selection
//   insertDetail(key)   put a tag where the cursor was
// ------------------------------------------------------------

const escapeHtml = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// One tag: the detail's name, its hint on hover
function chipHtml(key, product) {
  const d = (DETAILS[product] ?? []).find((x) => x.key === key);
  if (!d) return escapeHtml(`{${key}}`);
  return `<span class="wte-chip" contenteditable="false" data-field="${key}" data-tip="${escapeHtml(d.hint)}">${escapeHtml(d.label)}</span>`;
}

// The kept body → what the box shows
const toHtml = (body, product) =>
  String(body ?? '')
    .split(/(\{\w+\})/g)
    .map((part) => {
      const key = part.match(/^\{(\w+)\}$/)?.[1];
      return key ? chipHtml(key, product) : escapeHtml(part).replace(/\n/g, '<br>');
    })
    .join('');

// The character just after a cursor, '' at the end of a line or the box
function nextChar(r) {
  const node = r.startContainer;
  if (node.nodeType === Node.TEXT_NODE) {
    if (r.startOffset < node.length) return node.textContent[r.startOffset];
    let after = node.nextSibling;
    while (after && after.nodeType === Node.TEXT_NODE && !after.length) after = after.nextSibling;
    if (!after || after.tagName === 'BR') return '';
    return after.nodeType === Node.TEXT_NODE ? after.textContent[0] : 'x';
  }
  const after = node.childNodes[r.startOffset];
  if (!after || after.tagName === 'BR') return '';
  return after.nodeType === Node.TEXT_NODE ? after.textContent[0] ?? '' : 'x';
}

// What the box shows → the kept body. New lines come as <br> (ours) or as
// <div>/<p> blocks (a browser's own, now and then): both become \n.
function read(el) {
  let out = '';
  const walk = (node) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        out += child.textContent.replace(/\u00a0/g, ' ').replace(/[{}]/g, '');
        return;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) return;
      if (child.dataset?.field) {
        out += `{${child.dataset.field}}`;
        return;
      }
      if (child.tagName === 'BR') {
        out += '\n';
        return;
      }
      const block = child.tagName === 'DIV' || child.tagName === 'P';
      if (block && out && !out.endsWith('\n')) out += '\n';
      walk(child);
    });
  };
  walk(el);
  // No spaces at line ends, no empty lines at the end
  return out
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\s+$/, '');
}

const WhatsAppMessageBox = forwardRef(function WhatsAppMessageBox(
  { initial, product, onChange, labelledBy, describedBy, invalid },
  ref,
) {
  const box = useRef(null);
  const range = useRef(null); // where the cursor last was in the box

  // Fill once (after that the browser owns it)
  useEffect(() => {
    box.current.innerHTML = toHtml(initial, product);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Remember the cursor, so the toolbar and Insert detail act where it was
  useEffect(() => {
    const onSelect = () => {
      const sel = window.getSelection();
      if (!sel?.rangeCount) return;
      const r = sel.getRangeAt(0);
      if (box.current?.contains(r.startContainer)) range.current = r.cloneRange();
    };
    document.addEventListener('selectionchange', onSelect);
    return () => document.removeEventListener('selectionchange', onSelect);
  }, []);

  const changed = () => onChange(read(box.current));

  // Put the cursor back where it was, or at the end
  const restore = () => {
    const el = box.current;
    el.focus();
    const sel = window.getSelection();
    let r = range.current;
    if (!r || !el.contains(r.startContainer)) {
      r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(false);
    }
    sel.removeAllRanges();
    sel.addRange(r);
    return r;
  };

  const placeAfter = (node) => {
    const r = document.createRange();
    r.setStartAfter(node);
    r.collapse(true);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
    range.current = r.cloneRange();
  };

  useImperativeHandle(ref, () => ({
    // *, _ or ~ either side of what's selected (or a pair to type between)
    wrap(mark) {
      const r = restore();
      const end = document.createTextNode(mark);
      const start = document.createTextNode(mark);
      const after = r.cloneRange();
      after.collapse(false);
      after.insertNode(end);
      r.insertNode(start);
      const sel = window.getSelection();
      const inside = document.createRange();
      inside.setStartAfter(start);
      inside.setEndBefore(end);
      sel.removeAllRanges();
      sel.addRange(inside);
      range.current = inside.cloneRange();
      changed();
    },

    // A tag where the cursor was. A space after it only when there's
    // nothing after it yet (to keep typing) or a word starts right there,
    // so a comma or full stop still sits against it: "Priya, your …".
    // By hand rather than insertHTML, which Chrome sometimes puts in the
    // wrong place at the end of a line.
    insertDetail(key) {
      const r = restore();
      r.deleteContents();
      const holder = document.createElement('span');
      holder.innerHTML = chipHtml(key, product);
      const chip = holder.firstChild;
      const next = nextChar(r);
      if (next === '' || /[\p{L}\p{N}]/u.test(next)) {
        const space = document.createTextNode('\u00a0');
        r.insertNode(space);
        r.insertNode(chip);
        placeAfter(space);
      } else {
        r.insertNode(chip);
        placeAfter(chip);
      }
      changed();
    },
  }));

  // A new line, not a new paragraph: one <br>, as WhatsApp has one \n
  const lineBreak = () => {
    document.execCommand('insertLineBreak');
    changed();
  };

  return (
    <div
      ref={box}
      id="wte-body"
      className="wte__box"
      role="textbox"
      aria-multiline="true"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      contentEditable
      suppressContentEditableWarning
      spellCheck
      onInput={changed}
      // A click on a tag puts the cursor beside it, on the side clicked
      onMouseDown={(e) => {
        const chip = e.target.closest?.('.wte-chip');
        if (!chip) return;
        e.preventDefault();
        box.current.focus();
        const { left, width } = chip.getBoundingClientRect();
        const r = document.createRange();
        if (e.clientX < left + width / 2) r.setStartBefore(chip);
        else r.setStartAfter(chip);
        r.collapse(true);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
        range.current = r.cloneRange();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          lineBreak();
        }
      }}
      // No braces by hand: details only come as tags
      onBeforeInput={(e) => {
        if (/[{}]/.test(e.data ?? '')) e.preventDefault();
      }}
      // Plain text only, without braces; its lines as line breaks
      onPaste={(e) => {
        e.preventDefault();
        const lines = e.clipboardData.getData('text/plain').replace(/[{}]/g, '').split(/\r?\n/);
        lines.forEach((line, i) => {
          if (i > 0) document.execCommand('insertLineBreak');
          if (line) document.execCommand('insertText', false, line);
        });
        changed();
      }}
      onDrop={(e) => e.preventDefault()}
    />
  );
});

export default WhatsAppMessageBox;