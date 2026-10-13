import { Fragment } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, Check, Clock, ExternalLink, Pencil, Plus } from 'lucide-react';
import PageThumbnail from '../components/PageThumbnail';
import { recommendedThemeId } from '../data/themes';
import { servicePrice } from '../data/mockServices';
import { joinSummary } from '../data/thankYouQuestions';
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


// done: ids of the pages they've finished, e.g. ['landing'].
// Empty on the first visit, so the screen looks as it always did.
export default function FunnelOverview({
  funnel,
  onBack,
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
}) {
  const { pages } = funnel;

  const doneCount = pages.filter((p) => done.includes(p.id)).length;
  const started = doneCount > 0;
  const pagesLeft = pages.length - doneCount;
  const lastDone = [...pages].reverse().find((p) => done.includes(p.id));
  const nextPage = pages.find((p) => !done.includes(p.id));
  const join = joinSummary(answers); // the group people join after signing up
  // Thank you page finished with "I'll add it later": done, but the funnel isn't ready
  const linkMissing = done.includes('thank-you') && join?.missing;

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
          : `Your webinar funnel has ${pages.length} pages`}
      </h1>
      <p className="overview__subtitle">
        {!started &&
          "Your customers go through them in this order. We'll fill them in together, one page at a time."}
        {started && pagesLeft > 0 &&
          `${pagesLeft} more ${pagesLeft === 1 ? 'page' : 'pages'} and your funnel is ready.`}
        {started && pagesLeft === 0 && linkMissing &&
          `Add your ${join.label} link and your funnel is ready.`}
        {started && pagesLeft === 0 && !linkMissing && 'All your pages are done. Your funnel is ready.'}
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
          const needsLink = isDone && page.id === 'thank-you' && linkMissing;
          const isNext = page.id === nextPage?.id; // the page to fill in next is clickable
          return (
            <Fragment key={page.id}>
              {i > 0 && <ArrowRight size={20} className="overview__arrow" />}
              <div
                className={`overview__page ${isDone && !needsLink ? 'overview__page--done' : ''} ${needsLink ? 'overview__page--warning' : ''} ${isNext ? 'overview__page--next' : ''}`}
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

                {needsLink && (
                  <span className="overview__badge overview__badge--warning">
                    <AlertCircle size={14} strokeWidth={2.5} aria-hidden="true" /> Needs link
                  </span>
                )}

                {isDone && !needsLink && (
                  <span className="overview__badge overview__badge--done">
                    <Check size={14} strokeWidth={3} aria-hidden="true" /> Done
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
                          {join.missing && <span className="overview__service-missing">Link missing</span>}
                        </div>
                      )}
                      <div className="overview__page-actions">
                        <button type="button" className="overview__page-action" onClick={onEditThankYou}>
                          {join?.missing ? (
                            <>
                              <Plus size={16} /> Add link
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