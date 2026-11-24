import { useEffect, useRef, useState } from 'react';
import { Minus, Plus, Lock } from 'lucide-react';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import { loadBlob } from '../data/fileBlobs';
import './PdfViewer.css';

GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

// ------------------------------------------------------------
// A PDF lesson, read inside the course player (CoursePlayerPage.jsx).
// Always protected: there's no setting for it.
//
//   ┌ 3 / 12 ─────────────────────────────── [−] 100% [+] ┐
//   │                ┌──────────────┐                     │
//   │                │   page 3     │   pages scroll      │
//   │                └──────────────┘   one under another │
//   └─────────────────────────────────────────────────────┘
//
// Each page is drawn as a picture (pdf.js onto a canvas), so there's no
// text to select or copy, and no file to save: no Download, the right-click
// menu is off in it, ⌘P / ⌘S do nothing while it's open, and printing
// the page prints a note instead of the PDF. Nothing in a browser can
// stop a screenshot.
//
// Zoom: − and +, from 50% to 300%; 100% fills the width. Pages are drawn
// as they come into view, so long PDFs open fast.
//
// The file comes from fileBlobs.js (kept when it was uploaded). A PDF
// with no file kept (a demo file, or one uploaded before files were
// kept) says it can't be shown.
//
// fileId: the lesson's Cloud Storage file ('file:f-…' or 'f-…')
// name: the file's name, for screen readers
// ------------------------------------------------------------

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];

export default function PdfViewer({ fileId, name }) {
  const [doc, setDoc] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | missing | broken
  const [zoom, setZoom] = useState(2); // index in ZOOMS: 100%
  const [page, setPage] = useState(1);
  const [width, setWidth] = useState(0);
  const scrollRef = useRef(null);

  // The file, then the PDF in it
  useEffect(() => {
    let alive = true;
    let task = null;
    setState('loading');
    setDoc(null);
    loadBlob(String(fileId ?? '').replace(/^file:/, ''))
      .then((blob) => {
        if (!alive) return null;
        if (!blob) {
          setState('missing');
          return null;
        }
        return blob.arrayBuffer().then((data) => {
          if (!alive) return;
          task = getDocument({ data });
          return task.promise.then((pdf) => {
            if (!alive) return;
            setDoc(pdf);
            setPage(1);
            setState('ready');
          });
        });
      })
      .catch(() => alive && setState('broken'));
    return () => {
      alive = false;
      task?.destroy?.();
    };
  }, [fileId]);

  // The width the pages fill at 100%
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const measure = () => setWidth(Math.max(200, el.clientWidth - 48));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [state]);

  // Which page is in view, for "3 / 12"
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !doc) return undefined;
    const onScroll = () => {
      const mid = el.scrollTop + el.clientHeight / 3;
      const pages = el.querySelectorAll('.pdfv__page');
      let at = 1;
      pages.forEach((p, i) => {
        if (p.offsetTop <= mid) at = i + 1;
      });
      setPage(at);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [doc]);

  // No saving or printing from the keyboard while it's open
  useEffect(() => {
    const block = (e) => {
      const key = e.key?.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && (key === 'p' || key === 's')) e.preventDefault();
    };
    window.addEventListener('keydown', block, true);
    return () => window.removeEventListener('keydown', block, true);
  }, []);

  if (state === 'missing' || state === 'broken') {
    return (
      <div className="pdfv pdfv--note">
        <p className="pdfv__note-title">{state === 'missing' ? 'This PDF can’t be shown yet' : 'This PDF couldn’t be opened'}</p>
        <p className="pdfv__note-text">
          {state === 'missing'
            ? 'The file wasn’t kept when it was uploaded. Upload it to the lesson again to show it here.'
            : 'The file may be damaged. Check back soon.'}
        </p>
      </div>
    );
  }

  const scale = ZOOMS[zoom];
  return (
    <div
      className="pdfv"
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      role="region"
      aria-label={`${name}, PDF`}
    >
      <div className="pdfv__bar">
        <span className="pdfv__pages" aria-live="polite">
          {doc ? `${page} / ${doc.numPages}` : 'Opening…'}
        </span>
        <span className="pdfv__lock" title="This PDF can be read here, not downloaded">
          <Lock size={13} aria-hidden="true" /> Read only
        </span>
        <div className="pdfv__zoom">
          <button type="button" className="pdfv__btn" aria-label="Zoom out" disabled={zoom === 0} onClick={() => setZoom((z) => z - 1)}>
            <Minus size={16} aria-hidden="true" />
          </button>
          <button type="button" className="pdfv__level" title="Fit to width" onClick={() => setZoom(2)}>
            {Math.round(scale * 100)}%
          </button>
          <button
            type="button"
            className="pdfv__btn"
            aria-label="Zoom in"
            disabled={zoom === ZOOMS.length - 1}
            onClick={() => setZoom((z) => z + 1)}
          >
            <Plus size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="pdfv__scroll" ref={scrollRef}>
        {doc && width > 0
          ? Array.from({ length: doc.numPages }, (_, i) => (
              <Page key={i} doc={doc} number={i + 1} width={width * scale} root={scrollRef} />
            ))
          : <p className="pdfv__loading">Opening the PDF…</p>}
      </div>

      <p className="pdfv__print-note">This PDF can only be read in the course.</p>
    </div>
  );
}

// One page: its place kept at its size from the start, drawn once it
// comes near the view, and again when the zoom changes
function Page({ doc, number, width, root }) {
  const holder = useRef(null);
  const canvas = useRef(null);
  const [ratio, setRatio] = useState(1.294); // height / width; A4 until known
  const [near, setNear] = useState(number <= 2);

  useEffect(() => {
    const el = holder.current;
    if (!el || near) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setNear(true);
      },
      { root: root.current, rootMargin: '800px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [near, root]);

  useEffect(() => {
    if (!near) return undefined;
    let alive = true;
    let task = null;
    doc.getPage(number).then((pg) => {
      if (!alive) return;
      const base = pg.getViewport({ scale: 1 });
      setRatio(base.height / base.width);
      const dpr = window.devicePixelRatio || 1;
      const view = pg.getViewport({ scale: (width / base.width) * dpr });
      const c = canvas.current;
      if (!c) return;
      c.width = Math.floor(view.width);
      c.height = Math.floor(view.height);
      task = pg.render({ canvasContext: c.getContext('2d'), viewport: view });
      task.promise.catch(() => {});
    });
    return () => {
      alive = false;
      task?.cancel?.();
    };
  }, [doc, number, width, near]);

  return (
    <div className="pdfv__page" ref={holder} style={{ width, height: width * ratio }} aria-label={`Page ${number}`}>
      <canvas ref={canvas} className="pdfv__canvas" aria-hidden="true" />
    </div>
  );
}
