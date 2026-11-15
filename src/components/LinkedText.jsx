import './LinkedText.css';

// ------------------------------------------------------------
// Text a creator typed (a description), with its web links made
// clickable. Used wherever a description is shown: the contract
// checkout, a call's booking and checkout pages, and the contract
// preview.
//
// What counts as a link: anything starting with https://, http:// or
// www. Bare names like "notebooklm.com" are left as text on purpose, so
// "Node.js" or "Next.js" in a course description never turn into links.
// Punctuation right after a link ("see https://x.com/a.") stays outside
// it; a closing bracket stays inside only when the link opened one
// (Wikipedia-style links).
//
// Rendered as React elements, never as HTML, so nothing typed can run.
// Links open in a new tab, and tell search engines they're the
// creator's own (rel="ugc nofollow").
//
// text: the text
// live: false draws the links as links without making them clickable
//       (the preview, which is a picture of the page)
// ------------------------------------------------------------

const LINK = /(?:https?:\/\/|www\.)[^\s<>"]+/gi;
const TRAILING = /[.,;:!?'"’”)\]}]+$/;

// "https://x.com/a)." → "https://x.com/a", keeping brackets the link opened
function trimLink(raw) {
  let link = raw;
  for (;;) {
    const tail = link.match(TRAILING)?.[0];
    if (!tail) return link;
    // A ")" the link itself opened stays: "…/Thing_(film)"
    const last = link.slice(-1);
    if (last === ')' && (link.match(/\(/g)?.length ?? 0) >= (link.match(/\)/g)?.length ?? 0)) return link;
    link = link.slice(0, -1);
  }
}

// The text in pieces: [{ text }, { text, href }, ...]
export function splitLinks(text) {
  const source = String(text ?? '');
  const parts = [];
  let at = 0;
  for (const match of source.matchAll(LINK)) {
    const link = trimLink(match[0]);
    if (!link || /^(?:https?:\/\/|www\.)$/i.test(link)) continue;
    if (match.index > at) parts.push({ text: source.slice(at, match.index) });
    parts.push({ text: link, href: /^www\./i.test(link) ? `https://${link}` : link });
    at = match.index + link.length;
  }
  if (at < source.length) parts.push({ text: source.slice(at) });
  return parts;
}

export default function LinkedText({ text, live = true }) {
  return splitLinks(text).map((part, i) =>
    !part.href ? (
      part.text
    ) : live ? (
      <a key={i} className="linked-text__link" href={part.href} target="_blank" rel="noopener noreferrer ugc nofollow">
        {part.text}
      </a>
    ) : (
      <span key={i} className="linked-text__link">
        {part.text}
      </span>
    ),
  );
}