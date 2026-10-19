import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import ProfileExample from '../components/ProfileExample';
import './MyPageIntro.css';

// ------------------------------------------------------------
// The offerings page, the very first time: what it is, shown on
// a popular creator's real one, before any questions. A line
// points at her page with an arrow drawn from the words to her
// photo, measured live so it lands there at any window size.
// ------------------------------------------------------------

const GAP_START = 14; // space between the words and the arrow's tail
const GAP_END = 12;   // space between the arrowhead and her photo
const HEAD = 14;      // arrowhead length

// Where the arrow runs, in .mpi's own pixels: from the line "Meera's
// Offering Page" (just outside its dotted box) to the edge of her photo
// on the example. Null until the example has loaded.
function measureArrow(root, from, around) {
  const frame = root.querySelector('.pex__page');
  const photo = frame?.contentDocument?.querySelector('.cp__photo');
  if (!from || !frame || !photo) return null;

  const box = root.getBoundingClientRect();
  const page = frame.getBoundingClientRect();
  const scale = page.width / frame.offsetWidth; // the example is drawn scaled down
  const p = photo.getBoundingClientRect();      // inside the example, unscaled
  const f = from.getBoundingClientRect();
  const boxRight = around ? around.getBoundingClientRect().right : f.right;

  const photoLeft = page.left + p.left * scale;
  const photoMidY = page.top + (p.top + p.height / 2) * scale;

  return {
    start: { x: Math.max(f.right, boxRight) - box.left + GAP_START, y: f.top + f.height / 2 - box.top },
    end: { x: photoLeft - box.left - GAP_END, y: photoMidY - box.top },
  };
}

// A loose, hand-drawn swoop from start to end, and a head that follows its angle
function arrowPaths({ start: s, end: e }) {
  const dx = e.x - s.x;
  const dy = e.y - s.y;
  const c1 = { x: s.x + dx * 0.55, y: s.y + 18 };    // dips a little first
  const c2 = { x: e.x - dx * 0.35, y: e.y - dy * 0.05 };
  const angle = Math.atan2(e.y - c2.y, e.x - c2.x);
  const wing = (turn) => ({
    x: e.x - HEAD * Math.cos(angle + turn),
    y: e.y - HEAD * Math.sin(angle + turn),
  });
  const a = wing(0.5);
  const b = wing(-0.5);
  return {
    line: `M ${s.x} ${s.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${e.x} ${e.y}`,
    head: `M ${a.x} ${a.y} L ${e.x} ${e.y} L ${b.x} ${b.y}`,
  };
}

export default function MyPageIntro({ onStart }) {
  const rootRef = useRef(null);
  const fromRef = useRef(null);
  const aroundRef = useRef(null);
  const [arrow, setArrow] = useState(null);

  const update = useCallback(() => {
    if (rootRef.current) setArrow(measureArrow(rootRef.current, fromRef.current, aroundRef.current));
  }, []);

  // Re-measure when the window or layout changes size
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const ro = new ResizeObserver(update);
    ro.observe(root);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [update]);

  // The example loads on its own; keep checking until her photo is there,
  // then follow it if the example reflows
  useEffect(() => {
    let timer = 0;
    let observer = null;
    const tryMeasure = () => {
      const doc = rootRef.current?.querySelector('.pex__page')?.contentDocument;
      if (doc?.querySelector('.cp__photo')) {
        update();
        observer = new ResizeObserver(update);
        observer.observe(doc.body);
        doc.defaultView?.addEventListener('scroll', update);
        return;
      }
      timer = window.setTimeout(tryMeasure, 150);
    };
    tryMeasure();
    return () => {
      window.clearTimeout(timer);
      observer?.disconnect();
    };
  }, [update]);

  const paths = arrow ? arrowPaths(arrow) : null;

  return (
    <div className="mpi" ref={rootRef}>
      <div className="mpi__main">
        {/* One line when there's room; otherwise it breaks after the comma */}
        <h1 className="mpi__title">
          <span className="mpi__nowrap">Everything you offer,</span>{' '}
          <mark className="mpi__mark">in one link</mark>
        </h1>
        <p className="mpi__sub">Like your Topmate link, but on OpenSlate.</p>

        {/* The pointer and the button, together in a dotted box */}
        <div className="mpi__box" ref={aroundRef}>
          <p className="mpi__look">
            Check out Relationship Coach
            <br />
            <mark className="mpi__look-mark" ref={fromRef}>Meera’s Services Page</mark>
          </p>

          <button type="button" className="mpi__cta" onClick={onStart}>
            Build my services page <ArrowRight size={18} />
          </button>
        </div>
      </div>

      <aside className="mpi__aside">
        <ProfileExample tall />
      </aside>

      {/* Drawn over both columns, so it can reach her photo on the example */}
      {paths && (
        <svg className="mpi__arrow" aria-hidden="true">
          <g className="mpi__arrow-glow">
            {/* A pale outline underneath keeps it visible on any background */}
            <path className="mpi__arrow-halo" d={paths.line} />
            <path className="mpi__arrow-halo" d={paths.head} />
            <path className="mpi__arrow-line" d={paths.line} />
            <path className="mpi__arrow-line" d={paths.head} />
          </g>
        </svg>
      )}
    </div>
  );
}