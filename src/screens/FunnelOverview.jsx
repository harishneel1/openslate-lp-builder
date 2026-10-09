import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Clock } from 'lucide-react';
import SimpleDesign from '../components/designs/SimpleDesign';
import { buildPageJson } from '../data/buildPageJson';
import { getTheme, recommendedThemeId } from '../data/themes';
import './FunnelOverview.css';

// The thumbnail renders the page at this width (desktop layout),
// then scales it down to fit the card.
const THUMB_WIDTH = 1100;

function PageSketch({ type }) {
  return (
    <div className="sketch">
      {type === 'landing' && (
        <>
          <div className="sketch__hero" />
          <div className="sketch__line" />
          <div className="sketch__line sketch__line--short" />
          <div className="sketch__button" />
        </>
      )}
      {type === 'registration' && (
        <>
          <div className="sketch__line sketch__line--short" />
          <div className="sketch__field" />
          <div className="sketch__field" />
          <div className="sketch__button" />
        </>
      )}
      {type === 'thank-you' && (
        <>
          <div className="sketch__check" />
          <div className="sketch__line" />
          <div className="sketch__line sketch__line--short" />
        </>
      )}
    </div>
  );
}

// A small picture of their finished page in the design they chose.
// Only a picture: hidden from screen readers, can't be clicked.
function PageThumbnail({ answers, themeId }) {
  const boxRef = useRef(null);
  const [scale, setScale] = useState(0.3);

  // Fit the full-width page into the card, whatever the card's width
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      setScale(entry.contentRect.width / THUMB_WIDTH);
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  const page = useMemo(() => buildPageJson(answers, themeId), [answers, themeId]);

  return (
    <div className="overview__thumb" ref={boxRef} aria-hidden="true">
      <div
        className="overview__thumb-page"
        style={{ width: THUMB_WIDTH, transform: `scale(${scale})` }}
      >
        <SimpleDesign page={page} theme={getTheme(themeId)} />
      </div>
    </div>
  );
}

// done: ids of the pages they've finished, e.g. ['landing'].
// Empty on the first visit, so the screen looks as it always did.
export default function FunnelOverview({
  funnel,
  onBack,
  onStart,
  done = [],
  answers = {},
  themeId = null,
}) {
  const { pages } = funnel;

  const doneCount = pages.filter((p) => done.includes(p.id)).length;
  const started = doneCount > 0;
  const pagesLeft = pages.length - doneCount;
  const lastDone = [...pages].reverse().find((p) => done.includes(p.id));
  const nextPage = pages.find((p) => !done.includes(p.id));

  // The design they chose (falls back to the one recommended for their topic)
  const resolvedThemeId =
    themeId ?? recommendedThemeId(String(answers.category ?? '').trim());

  return (
    <div className="overview">
      <button type="button" className="overview__back" onClick={onBack}>
        <ArrowLeft size={16} /> All funnels
      </button>

      <h1 className="overview__title">
        {started
          ? `Your ${lastDone.name.toLowerCase()} is done`
          : `Your funnel has ${pages.length} pages`}
      </h1>
      <p className="overview__subtitle">
        {!started &&
          "Your customers go through them in this order. We'll fill them in together, one page at a time."}
        {started && pagesLeft > 0 &&
          `${pagesLeft} more ${pagesLeft === 1 ? 'page' : 'pages'} and your funnel is ready.`}
        {started && pagesLeft === 0 && 'All your pages are done. Your funnel is ready.'}
      </p>

      {started ? (
        <div className="overview__progress">
          <div className="overview__progress-bar" aria-hidden="true">
            <span style={{ width: `${(doneCount / pages.length) * 100}%` }} />
          </div>
          <p className="overview__progress-label">
            {doneCount} of {pages.length} pages done
          </p>
        </div>
      ) : (
        <p className="overview__meta">
          <Clock size={16} /> About 10 minutes. You can change anything later.
        </p>
      )}

      <div className="overview__flow">
        {pages.map((page, i) => {
          const isDone = done.includes(page.id);
          return (
            <Fragment key={page.id}>
              {i > 0 && <ArrowRight size={20} className="overview__arrow" />}
              <div className={`overview__page ${isDone ? 'overview__page--done' : ''}`}>
                {isDone && page.id === 'landing' ? (
                  <PageThumbnail answers={answers} themeId={resolvedThemeId} />
                ) : (
                  <PageSketch type={page.id} />
                )}

                {isDone && (
                  <span className="overview__tick" aria-hidden="true">
                    <Check size={16} strokeWidth={3} />
                  </span>
                )}

                <div className="overview__page-body">
                  <span className="overview__step">
                    Page {i + 1}
                    {isDone && <span className="overview__step-done"> · Done</span>}
                  </span>
                  <h3 className="overview__page-name">{page.name}</h3>
                  <p className="overview__page-job">{page.job}</p>
                </div>
              </div>
            </Fragment>
          );
        })}
      </div>

      {nextPage && (
        <button type="button" className="overview__start" onClick={onStart}>
          {started
            ? `Continue to your ${nextPage.name.toLowerCase()}`
            : `Start with your ${pages[0].name.toLowerCase()}`}{' '}
          <ArrowRight size={18} />
        </button>
      )}
    </div>
  );
}