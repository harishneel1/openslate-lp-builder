import { useLayoutEffect, useRef, useState } from 'react';
import { Info } from 'lucide-react';
import { referenceImage, referenceAnnotations } from '../data/referenceAnnotations';
import './ExamplePreview.css';

// ---------- Layout (pixels) ----------
const PAD = 10;            // space between the content and the dashed box
const LABEL_H = 30;        // height of the "This is your headline" pill
const LABEL_GAP = 26;      // room for the arrow between the pill and the box
const TIP_W = 260;         // width of the teaching bubble
const TIP_H = 84;          // its rough height (2–3 lines), for fitting only
const TIP_GAP = 34;        // room for the arrow between the box and the bubble
const EDGE = 12;           // keep bubbles this far from the panel edges

const ABOVE = LABEL_H + LABEL_GAP;  // everything that sits above the box

const clamp = (v, min, max) => Math.max(min, Math.min(v, max));

// Right-hand panel on the landing questions: a finished example page,
// scrolled to the part this question fills in. That part gets a dashed
// box, a pill naming it, and a bubble saying why it matters.
// Returns null when the question has no annotation.
export default function ExamplePreview({ questionId }) {
  const note = referenceAnnotations[questionId];
  const viewportRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  // Everything is worked out in pixels, so track the panel's size
  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!note) return null;

  const { w, h } = size;
  const stageH = (w * referenceImage.height) / referenceImage.width;

  // The dashed box: the measured area plus a little breathing room
  const box = {
    left: Math.max(2, (note.box.x / 100) * w - PAD),
    top: (note.box.y / 100) * stageH - PAD,
    width: (note.box.w / 100) * w + PAD * 2,
    height: (note.box.h / 100) * stageH + PAD * 2,
  };
  box.width = Math.min(box.width, w - 2 - box.left);
  const boxRight = box.left + box.width;
  const boxBottom = box.top + box.height;

  // Where the bubble's top goes: just under the box, or further down when
  // the annotation says (tipY: hero parts, so the bubble sits below the
  // hero instead of covering it)
  const tipTop = note.tipY != null ? Math.max(boxBottom + TIP_GAP, (note.tipY / 100) * stageH) : boxBottom + TIP_GAP;
  const below = tipTop - boxBottom + TIP_H; // everything under the box

  // Short boxes: pill above, bubble below, all three centred in the panel.
  // Tall boxes (long lists): pill above, box starts near the top, and the
  // bubble sits over the bottom of the panel, inside the box.
  const fits = ABOVE + box.height + below + EDGE * 2 <= h;
  const blockTop = box.top - ABOVE;
  const offset = fits
    ? blockTop - (h - (ABOVE + box.height + below)) / 2
    : blockTop - EDGE;
  const scroll = clamp(offset, 0, Math.max(0, stageH - h));

  // Pill: above the box, lined up with its left edge
  const label = {
    left: clamp(box.left, EDGE, w - EDGE - 200),
    top: box.top - ABOVE,
  };

  // Bubble: below the box, lined up with its right edge
  const tipLeft = clamp(boxRight - TIP_W, EDGE, w - EDGE - TIP_W);
  // A hero part on a short screen: the hero is too tall for the bubble to
  // fit below it, and inside the frame it would cover the hero again. It
  // goes under the frame instead, with no arrow.
  const outside = note.tipY != null && !fits;
  const tip = fits
    ? { left: tipLeft, top: tipTop }
    : { left: tipLeft, top: scroll + h - EDGE, inside: true }; // anchored by its bottom

  // Arrows: gentle curves from each bubble to the box edge
  const labelFrom = { x: label.left + 22, y: label.top + LABEL_H + 2 };
  const labelTo = { x: label.left + 46, y: box.top - 4 };
  const tipFrom = { x: tip.left + TIP_W - 48, y: tip.top - 2 };
  const tipTo = { x: tip.left + TIP_W - 84, y: boxBottom + 4 };
  const curve = (a, b, bend) =>
    `M ${a.x} ${a.y} Q ${(a.x + b.x) / 2 + bend} ${(a.y + b.y) / 2} ${b.x} ${b.y}`;

  return (
    <div className="ex">
      <p className="ex__caption">Example of a finished page</p>
      <p className="ex__note">
        <Info size={14} /> Your answer goes in the highlighted spot. You'll pick your own design later.
      </p>

      <div className={`ex__frame ${outside ? 'ex__frame--short' : ''}`}>
        <div className="ex__browserbar" aria-hidden="true">
          <span className="ex__dots"><span /><span /><span /></span>
        </div>

        <div className="ex__viewport" ref={viewportRef}>
          {w > 0 && (
            <div className="ex__stage" style={{ height: stageH, transform: `translateY(${-scroll}px)` }}>
              <img
                className="ex__image"
                src={referenceImage.src}
                alt="An example webinar landing page"
                draggable="false"
                onLoad={(e) => {
                  // The boxes were measured on one exact screenshot; warn if this isn't it
                  const { naturalWidth: nw, naturalHeight: nh } = e.currentTarget;
                  const expected = referenceImage.height / referenceImage.width;
                  if (Math.abs(nh / nw - expected) > 0.01) {
                    console.warn(
                      `Example image is ${nw}×${nh}, but the boxes were measured on ` +
                        `${referenceImage.width}×${referenceImage.height}. Highlights will be in the wrong place.`
                    );
                  }
                }}
              />

              {/* Gently dims the rest of the page; slides between questions */}
              <div className="ex__spot" style={box} />

              {/* Box, arrows and bubbles fade in once the page has moved */}
              <div className="ex__marks" key={questionId}>
                <svg className="ex__svg" width={w} height={stageH} aria-hidden="true">
                  <defs>
                    <marker
                      id="ex-arrowhead"
                      viewBox="0 0 10 10"
                      refX="7"
                      refY="5"
                      markerWidth="7"
                      markerHeight="7"
                      orient="auto-start-reverse"
                    >
                      <path d="M 1 1 L 8 5 L 1 9" className="ex__arrowhead" />
                    </marker>
                  </defs>
                  <rect
                    className="ex__box"
                    x={box.left}
                    y={box.top}
                    width={box.width}
                    height={box.height}
                    rx="12"
                  />
                  <path className="ex__arrow" d={curve(labelFrom, labelTo, 14)} markerEnd="url(#ex-arrowhead)" />
                  {!tip.inside && !outside && (
                    <path className="ex__arrow" d={curve(tipFrom, tipTo, -18)} markerEnd="url(#ex-arrowhead)" />
                  )}
                </svg>

                <p className="ex__label" style={{ left: label.left, top: label.top }}>
                  {note.label}
                </p>
                {!outside && (
                  <p
                    className={`ex__tip ${tip.inside ? 'ex__tip--inside' : ''}`}
                    style={{ left: tip.left, top: tip.top, width: TIP_W }}
                  >
                    {note.tip}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {outside && (
        <p className="ex__tip ex__tip--below" key={questionId}>
          {note.tip}
        </p>
      )}
    </div>
  );
}