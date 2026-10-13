import { Fragment, useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, ChevronRight, Clock, Copy, ExternalLink, Pencil, Plus, Radio, Rocket } from 'lucide-react';import PageThumbnail from '../components/PageThumbnail';
import { recommendedThemeId } from '../data/themes';
import { servicePrice } from '../data/mockServices';
import { joinSummary } from '../data/thankYouQuestions';
import { liveHref, liveSince } from '../utils/publish';
import './FunnelOverview.css';

// The thumbnail renders the page at this width (desktop layout),
// then scales it down to fit the card.

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

// Copies text to the clipboard. Falls back to a hidden textarea where the
// Clipboard API isn't allowed (http pages other than localhost, old browsers).
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

// The live link, with Copy and Open. Shown once the funnel is published.
function LiveLink({ href, onOpen, copyRef }) {
  const [state, setState] = useState('idle'); // 'idle' | 'copied' | 'failed'
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const handleCopy = async () => {
    const ok = await copyText(href);
    setState(ok ? 'copied' : 'failed');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), 2500);
  };

  return (
    <div className="overview__live">
      <span className="overview__live-url" title={href}>
        {href.replace(/^https?:\/\//i, '')}
      </span>
      <button
        ref={copyRef}
        type="button"
        className="overview__launch-primary overview__live-copy"
        onClick={handleCopy}
      >
        {state === 'copied' ? <Check size={16} strokeWidth={3} /> : <Copy size={16} />}
        {state === 'copied' ? 'Copied' : 'Copy link'}
      </button>
      <a
        className="overview__launch-secondary"
        href={href}
        target="_blank"
        rel="noopener"
        onClick={onOpen}
        aria-label="Open your live funnel (opens in a new tab)"
      >
        <ExternalLink size={16} /> Open
      </a>
      {/* Read out by screen readers; the button label already shows it visually */}
      <span className="overview__sr-only" aria-live="polite">
        {state === 'copied' && 'Link copied'}
      </span>
      {state === 'failed' && (
        <p className="overview__live-error" role="alert">
          Couldn't copy. Select the link above and copy it yourself.
        </p>
      )}
    </div>
  );
}

// done: ids of the pages they've finished, e.g. ['landing'].
// Empty on the first visit, so the screen looks as it always did.
export default function FunnelOverview({
  funnel,
  onStart,
  done = [],
  answers = {},
  themeId = null,
  previewHref = null, // address of the full-screen preview (opens in a new tab)
  onPreview,          // called just before it opens
  onEdit,
  service = null,     // the service picked as the registration page
  onChangeService,    // reopens the service picker
  onEditThankYou,     // reopens the thank you page questions
  publishedAt = null, // when it went live; null = not published
  onPublish,          // publishes it (once all pages are done)
}) {
  const { pages } = funnel;

  const doneCount = pages.filter((p) => done.includes(p.id)).length;
  const started = doneCount > 0;
  const pagesLeft = pages.length - doneCount;
  const lastDone = [...pages].reverse().find((p) => done.includes(p.id));
  const nextPage = pages.find((p) => !done.includes(p.id));
  const join = joinSummary(answers); // the group people join after signing up
  const published = Boolean(publishedAt);
  // Every page done: they can publish. A missing group link doesn't block it
  // (visitors are told the link comes by email instead; see ThankYouDesign).
  const ready = pagesLeft === 0;
  const liveLink = published ? liveHref(funnel) : null;

  // Publish removes the button they just pressed, so move keyboard focus
  // to Copy link (the next thing they'll want), not back to the top of the page
  const copyRef = useRef(null);
  const wasPublished = useRef(published);
  useEffect(() => {
    if (published && !wasPublished.current) copyRef.current?.focus();
    wasPublished.current = published;
  }, [published]);

  let title;
  if (published) title = 'Your funnel is live';
  else if (ready) title = 'Your funnel is ready to go live';
  else if (started) title = `Your ${lastDone.name.toLowerCase()} is done`;
  else title = `Your webinar funnel has ${pages.length} pages`;

  // The design they chose (falls back to the one recommended for their topic)
  const resolvedThemeId =
    themeId ?? recommendedThemeId(String(answers.category ?? '').trim());

  return (
    <div className="overview">
      {/* "All funnels" lives in the top bar */}
      <h1 className="overview__title">{title}</h1>
      <p className="overview__subtitle">
        {!started &&
          "Your customers go through them in this order. We'll fill them in together, one page at a time."}
        {!published && started && pagesLeft > 0 &&
          `${pagesLeft} more ${pagesLeft === 1 ? 'page' : 'pages'} and your funnel is ready.`}
        {!published && ready &&
          'Publish it to get a link you can share with your audience. You can still change anything afterwards.'}
        {published &&
          'Share this link with your audience. Any change you make shows up on it straight away.'}
      </p>

            {published && <LiveLink href={liveLink} onOpen={onPreview} copyRef={copyRef} />}

      {published ? null : started ? (
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

      {!published && ready && (
        <div className="overview__launch">
          <button type="button" className="overview__launch-primary" onClick={onPublish}>
            <Rocket size={16} /> Publish funnel
          </button>
          {previewHref && (
            <a
              className="overview__launch-secondary"
              href={previewHref}
              target="_blank"
              rel="noopener"
              onClick={onPreview}
              aria-label="Try your funnel as a visitor (opens in a new tab)"
            >
              <ExternalLink size={16} /> Try it as a visitor
            </a>
          )}
        </div>
      )}

      <div className="overview__flow">
        {pages.map((page, i) => {
          const isDone = done.includes(page.id);
          const isNext = page.id === nextPage?.id; // the page to fill in next is clickable
          return (
            <Fragment key={page.id}>
              {i > 0 && (
  <span className="overview__arrow" aria-hidden="true">
    <ChevronRight size={18} strokeWidth={2.5} />
    <ChevronRight size={18} strokeWidth={2.5} />
    <ChevronRight size={18} strokeWidth={2.5} />
  </span>
)}
              <div
                className={`overview__page ${isDone ? 'overview__page--done' : ''} ${isNext ? 'overview__page--next' : ''}`}
              >
                {isDone && (page.id === 'landing' || page.id === 'thank-you') ? (
                  <PageThumbnail answers={answers} themeId={resolvedThemeId} page={page.id} />
                ) : (
                  <PageSketch type={page.id} />
                )}

                {isNext && (
                  <span className="overview__badge overview__badge--pending">
                    <Clock size={14} strokeWidth={2.5} aria-hidden="true" /> Pending
                  </span>
                )}

                {isDone && (
                  <span className="overview__badge overview__badge--done">
                    {published ? (
                      <>
                        <span className="overview__badge-dot" aria-hidden="true" /> Live
                      </>
                    ) : (
                      <>
                        <Check size={14} strokeWidth={3} aria-hidden="true" /> Done
                      </>
                    )}
                  </span>
                )}

                <div className="overview__page-body">
                  <span className="overview__step">
                    Page {i + 1}
                  </span>
                  <h3 className="overview__page-name">{page.name}</h3>
                  <p className="overview__page-job">{page.job}</p>
                  {/* Covers the whole card (see .overview__page-cta::after), so a click anywhere starts this page */}
                  {isNext && (
                    <button type="button" className="overview__page-cta" onClick={() => onStart(page.id)}>
                      Build {page.name.toLowerCase()}
                      <ArrowRight size={16} className="overview__page-cta-arrow" />
                    </button>
                  )}
                  {isDone && page.id === 'registration' && (
                    <>
                      {service && (
                        <div className="overview__service">
                          <span className="overview__service-name">{service.title}</span>
                          <span className="overview__service-price">{servicePrice(service)}</span>
                        </div>
                      )}
                      <div className="overview__page-actions">
                        <button type="button" className="overview__page-action" onClick={onChangeService}>
                          <Pencil size={16} /> Change service
                        </button>
                      </div>
                    </>
                  )}
                  {isDone && page.id === 'thank-you' && (
                    <>
                      {join && (
                        <div className="overview__service">
                          <span className="overview__service-name">{join.label}</span>
                          {join.link && (
                            <span className="overview__service-link" title={join.link}>
                              {join.link.replace(/^https?:\/\//i, '')}
                            </span>
                          )}
                        </div>
                      )}
                      <div className="overview__page-actions">
                        <button type="button" className="overview__page-action" onClick={onEditThankYou}>
                          {join?.missing ? (
                            <>
                              <Plus size={16} /> Add community link
                            </>
                          ) : (
                            <>
                              <Pencil size={16} /> Edit
                            </>
                          )}
                        </button>
                        {previewHref && (
                          <a
                            className="overview__page-action overview__page-action--preview"
                            href={`${previewHref}&page=thank-you`}
                            target="_blank"
                            rel="noopener"
                            onClick={onPreview}
                            aria-label="Preview your thank you page (opens in a new tab)"
                          >
                            <ExternalLink size={16} /> Preview
                          </a>
                        )}
                      </div>
                    </>
                  )}
                  {isDone && page.id === 'landing' && (
                    <div className="overview__page-actions">
                      <button type="button" className="overview__page-action" onClick={onEdit}>
                        <Pencil size={16} /> Edit
                      </button>
                      {previewHref && (
                        <a
                          className="overview__page-action overview__page-action--preview"
                          href={previewHref}
                          target="_blank"
                          rel="noopener"
                          onClick={onPreview}
                          aria-label="Preview your landing page (opens in a new tab)"
                        >
                          <ExternalLink size={16} /> Preview
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}