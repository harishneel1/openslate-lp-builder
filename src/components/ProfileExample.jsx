import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Info, Lock } from 'lucide-react';
import { getMockProfile } from '../data/mockProfile';
import { PAGE_DOMAIN } from '../data/myPage';
import { profileAnnotations } from '../data/profileAnnotations';
import './ProfileExample.css';

// ---------- The example page ----------
// The real profile page in a frame, laid out as on a laptop and scaled
// down to fit. Inside a frame its desktop layout and screen-height
// panels work as they do for visitors.
const PAGE_W = 1280; // default laptop width; the intro passes a narrower one to show it larger
const EXAMPLE_SRC = `${window.location.pathname}?mock=profile`;
const MINE_SRC = `${window.location.pathname}?mock=profile&source=mine`;
const BOOK_SRC = `${window.location.pathname}?mock=book&service=call-discovery`;
const EXAMPLE_CREATOR = getMockProfile().creator;
const EXAMPLE_LINK = `${PAGE_DOMAIN}/${EXAMPLE_CREATOR.handle}`;
const BOOK_LINK = `${EXAMPLE_LINK}/discovery-call`;

// ---------- Marks (pixels) ----------
const PAD = 8;         // space between the part and the dashed box
const LABEL_H = 30;    // height of the "This is your link" pill
const LABEL_W = 220;   // room kept for the pill at the right edge
const LABEL_GAP = 24;  // room for the arrow between the pill and the box
const TIP_W = 260;     // width of the teaching bubble
const TIP_H = 84;      // its rough height (2–3 lines), for fitting only
const TIP_GAP = 30;    // room for the arrow between the box and the bubble
const EDGE = 12;       // keep bubbles this far from the frame edges

const clamp = (v, min, max) => Math.max(min, Math.min(v, max));
const prefersLessMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// A popular creator's finished page, shown beside the page setup screens.
// With a questionId: the part that question fills in is boxed, named and
// explained, and the page stays still.
// Without one (the intro): the page is shown clean, and they can scroll it,
// switch the filters and read more, but nothing takes them away.
// mine: show the creator's own page instead (the reveal), at `link`.
// answer: this question's answer, for annotations that depend on it.
// pageWidth: the width it's laid out at (narrower → bigger on screen).
// tall: use nearly the full window height (the intro).
export default function ProfileExample({
  questionId = null,
  answer,
  mine = false,
  link = null,
  pageWidth = PAGE_W,
  tall = false,
}) {
  // Kept stable between renders, so the marks only move when this changes
  const note = useMemo(() => {
    const entry = questionId ? profileAnnotations[questionId] : null;
    return typeof entry === 'function' ? entry(answer) : entry;
  }, [questionId, answer]);
  const explore = !questionId;
  const frameRef = useRef(null);
  const viewRef = useRef(null);
  const iframeRef = useRef(null);
  const urlRef = useRef(null);

  const [size, setSize] = useState({ w: 0, h: 0 }); // the page area, below the bar
  const [loaded, setLoaded] = useState(false);

  // Which page to show: theirs, Meera's booking page, or her offerings page
  const booking = !mine && note?.page === 'book';
  const src = mine ? MINE_SRC : booking ? BOOK_SRC : EXAMPLE_SRC;
  const shownLink = mine ? link : booking ? BOOK_LINK : EXAMPLE_LINK;

  // A different page loads afresh: no marks until it has
  useEffect(() => setLoaded(false), [src]);
  const [rect, setRect] = useState(null);           // the part, in frame pixels

  const scale = size.w ? size.w / pageWidth : 0;
  const pageH = scale ? size.h / scale : 0;         // the example's own window height

  // Everything is worked out in pixels, so track the page area's size
  useLayoutEffect(() => {
    const el = viewRef.current;
    if (!el) return undefined;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Where the part sits right now, relative to the frame
  const measure = useCallback(() => {
    const frame = frameRef.current;
    if (!note || !frame) return setRect(null);
    const origin = frame.getBoundingClientRect();
    const ox = origin.left + frame.clientLeft;
    const oy = origin.top + frame.clientTop;

    if (note.target === 'link') {
      const r = urlRef.current?.getBoundingClientRect();
      return setRect(r ? { left: r.left - ox, top: r.top - oy, width: r.width, height: r.height } : null);
    }

    const el = loaded && iframeRef.current?.contentDocument?.querySelector(note.target);
    if (!el || !scale) return setRect(null);
    const r = el.getBoundingClientRect(); // inside the example, before scaling
    const top = viewRef.current.offsetTop;
    return setRect({
      left: r.left * scale,
      top: top + r.top * scale,
      width: r.width * scale,
      height: r.height * scale,
    });
  }, [note, loaded, scale]);

  // A new question: bring its part into view if it's off screen, then measure
  useEffect(() => {
    const win = loaded ? iframeRef.current?.contentWindow : null;
    if (win && note && pageH) {
      const behavior = prefersLessMotion() ? 'auto' : 'smooth';
      const el = note.target === 'link' ? null : win.document.querySelector(note.target);
      if (!el) {
        win.scrollTo({ top: 0, behavior });
      } else {
        const r = el.getBoundingClientRect();
        if (r.top < 16 || r.bottom > pageH - 16) {
          const top = win.scrollY + r.top - Math.max(16, (pageH - r.height) / 2);
          win.scrollTo({ top: Math.max(0, top), behavior });
        }
      }
    }
    measure();
  }, [loaded, note?.target, pageH, measure]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the marks on the part while the example scrolls or reflows
  useEffect(() => {
    const win = loaded ? iframeRef.current?.contentWindow : null;
    if (!win) return undefined;
    let raf = 0;
    const later = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    win.addEventListener('scroll', later);
    const ro = new ResizeObserver(later);
    ro.observe(win.document.body);
    return () => {
      cancelAnimationFrame(raf);
      win.removeEventListener('scroll', later);
      ro.disconnect();
    };
  }, [loaded, measure]);

  // Annotated: the page stays still. Exploring: it scrolls (without a
  // scrollbar), but links like "Pick a time" don't open anything.
  const handleLoad = () => {
    const doc = iframeRef.current?.contentDocument;
    if (doc) {
      if (explore) {
        const style = doc.createElement('style');
        style.textContent =
          'html { scrollbar-width: none; } html::-webkit-scrollbar { display: none; } a { cursor: default; }';
        doc.head.appendChild(style);
        doc.addEventListener(
          'click',
          (e) => {
            if (e.target.closest?.('a')) e.preventDefault();
          },
          true
        );
      } else {
        doc.documentElement.style.overflow = 'hidden';
      }
    }
    setLoaded(true);
  };

  if (questionId && !note) return null;

  // ---------- Placing the box, pill and bubble ----------
  const frameW = size.w;
  const frameH = (viewRef.current?.offsetTop ?? 0) + size.h;
  let marks = null;

  if (rect && frameW) {
    const box = {
      left: Math.max(2, rect.left - PAD),
      top: Math.max(2, rect.top - PAD),
      width: rect.width + PAD * 2,
      height: rect.height + PAD * 2,
    };
    box.width = Math.min(box.width, frameW - 2 - box.left);
    const boxRight = box.left + box.width;
    const boxBottom = box.top + box.height;

    const viewTop = viewRef.current?.offsetTop ?? 0;

    // Pinned to the top of the page, when the note asks for it and the box
    // sits far enough down to leave room for the arrow
    const pinTop = note.labelAt === 'top' && box.top - (viewTop + EDGE + LABEL_H) >= LABEL_GAP;

    // Otherwise above the box when there's room (there isn't for the link, at the very top)
    const labelAbove = !pinTop && box.top - LABEL_GAP - LABEL_H >= EDGE;
    const label = pinTop
      ? { left: EDGE, top: viewTop + EDGE }
      : {
          left: clamp(box.left, EDGE, frameW - EDGE - LABEL_W),
          top: labelAbove ? box.top - LABEL_GAP - LABEL_H : boxBottom + LABEL_GAP,
        };

    // Bubble below everything, lined up with the box's right edge.
    // No room below: it sits at the bottom of the frame, over the box.
    let tip = null;
    if (note.tip) {
      const below = (pinTop || labelAbove ? boxBottom : label.top + LABEL_H) + TIP_GAP;
      const inside = below + TIP_H > frameH - EDGE;
      tip = {
        left: clamp(boxRight - TIP_W, EDGE, frameW - EDGE - TIP_W),
        top: inside ? frameH - EDGE : below,
        inside,
      };
    }

    // Gentle curves from the pill and the bubble to the box
    const curve = (a, b, bend) =>
      `M ${a.x} ${a.y} Q ${(a.x + b.x) / 2 + bend} ${(a.y + b.y) / 2} ${b.x} ${b.y}`;
    let labelArrow;
    if (pinTop) {
      // Straight down the left edge, then a hook into the box's side,
      // so it crosses nothing on the page
      const a = { x: label.left + 14, y: label.top + LABEL_H + 2 };
      const b = { x: box.left - 3, y: box.top + 22 };
      labelArrow = `M ${a.x} ${a.y} C ${a.x} ${a.y + (b.y - a.y) * 0.7}, ${b.x - 18} ${b.y}, ${b.x} ${b.y}`;
    } else if (labelAbove) {
      labelArrow = curve({ x: label.left + 22, y: label.top + LABEL_H + 2 }, { x: label.left + 46, y: box.top - 4 }, 14);
    } else {
      labelArrow = curve({ x: label.left + 22, y: label.top - 2 }, { x: label.left + 46, y: boxBottom + 4 }, 14);
    }
    // With the pill below the box, the bubble reads as part of it: no second arrow
    const tipArrow =
      tip && (pinTop || labelAbove) && !tip.inside
        ? curve({ x: tip.left + TIP_W - 48, y: tip.top - 2 }, { x: tip.left + TIP_W - 84, y: boxBottom + 4 }, -18)
        : null;

    marks = { box, label, tip, labelArrow, tipArrow };
  }

  return (
    <div className="pex">
      {/* The intro introduces Meera on its left side instead */}
      {note && (
        <>
          <div className="pex__whose">
            <p className="pex__caption">A popular creator’s offerings page</p>
            <p className="pex__creator">{EXAMPLE_CREATOR.name}, {EXAMPLE_CREATOR.headline.toLowerCase()}</p>
          </div>
          <p className="pex__note">
            <Info size={14} /> Your answer goes in the highlighted spot.
          </p>
        </>
      )}

      <div className={`pex__frame ${tall ? 'pex__frame--tall' : ''}`} ref={frameRef}>
        <div className="pex__bar" aria-hidden="true">
          <span className="pex__dots"><span /><span /><span /></span>
          <span className="pex__url" ref={urlRef}>
            <Lock size={11} /> {shownLink}
          </span>
        </div>

        <div className="pex__view" ref={viewRef}>
          {scale > 0 && (
            <iframe
              key={src}
              ref={iframeRef}
              className={`pex__page ${explore ? 'pex__page--explore' : ''}`}
              src={src}
              title={mine ? 'Your services page' : `${EXAMPLE_CREATOR.name}’s page`}
              tabIndex={explore ? 0 : -1}
              onLoad={handleLoad}
              style={{ width: pageWidth, height: pageH, transform: `scale(${scale})` }}
            />
          )}
        </div>

        {marks && (
          <>
            {/* Gently dims the rest of the page; slides between questions */}
            <div className="pex__spot" style={marks.box} />

            {/* Box, arrows and bubbles fade in once the spot has moved */}
            <div className="pex__marks" key={note.target}>
              <svg className="pex__svg" aria-hidden="true">
                <defs>
                  <marker
                    id="pex-arrowhead"
                    viewBox="0 0 10 10"
                    refX="7"
                    refY="5"
                    markerWidth="7"
                    markerHeight="7"
                    orient="auto-start-reverse"
                  >
                    <path d="M 1 1 L 8 5 L 1 9" className="pex__arrowhead" />
                  </marker>
                </defs>
                <rect
                  className="pex__box"
                  x={marks.box.left}
                  y={marks.box.top}
                  width={marks.box.width}
                  height={marks.box.height}
                  rx="10"
                />
                <path className="pex__arrow" d={marks.labelArrow} markerEnd="url(#pex-arrowhead)" />
                {marks.tipArrow && (
                  <path className="pex__arrow" d={marks.tipArrow} markerEnd="url(#pex-arrowhead)" />
                )}
              </svg>

              <p className="pex__label" style={{ left: marks.label.left, top: marks.label.top }}>
                {note.label}
              </p>
              {marks.tip && (
                <p
                  className={`pex__tip ${marks.tip.inside ? 'pex__tip--inside' : ''}`}
                  style={{ left: marks.tip.left, top: marks.tip.top, width: TIP_W }}
                >
                  {note.tip}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}