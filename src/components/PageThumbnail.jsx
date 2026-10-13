import { useEffect, useMemo, useRef, useState } from 'react';
import SimpleDesign from './designs/SimpleDesign';
import ThankYouDesign from './designs/ThankYouDesign';
import { buildPageJson } from '../data/buildPageJson';
import { getTheme, recommendedThemeId } from '../data/themes';
import './PageThumbnail.css';

// The page is drawn at this width (desktop layout), then scaled down to fit
const THUMB_WIDTH = 1100;

// A small picture of one of their pages in their design.
// page: 'landing' (default) or 'thank-you'.
// Only a picture: hidden from screen readers, can't be clicked.
// Used on the funnel overview, the "Your funnels" cards and the building step.
export default function PageThumbnail({ answers, themeId, page: pageId = 'landing' }) {
  const boxRef = useRef(null);
  const [scale, setScale] = useState(0.3);

  // Fit the full-width page into the box, whatever the box's width
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      setScale(entry.contentRect.width / THUMB_WIDTH);
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  // No design picked yet → the one recommended for their topic
  const resolvedId = themeId ?? recommendedThemeId(String(answers.category ?? '').trim());
  const page = useMemo(() => buildPageJson(answers, resolvedId), [answers, resolvedId]);

  return (
    <div className="thumb" ref={boxRef} aria-hidden="true">
      <div className="thumb__page" style={{ width: THUMB_WIDTH, transform: `scale(${scale})` }}>
        {pageId === 'thank-you' ? (
          <ThankYouDesign answers={answers} theme={getTheme(resolvedId)} />
        ) : (
          <SimpleDesign page={page} theme={getTheme(resolvedId)} />
        )}
      </div>
    </div>
  );
}