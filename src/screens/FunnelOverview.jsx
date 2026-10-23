import { Fragment, useEffect, useRef, useState } from 'react';
import { ArrowRight, CalendarClock, Check, ChevronRight, Clock, Copy, ExternalLink, Pencil, Link2, Lock, Play, Plus, RefreshCw } from 'lucide-react';
import PageThumbnail from '../components/PageThumbnail';
import { recommendedThemeId } from '../data/themes';
import { servicePrice } from '../data/mockServices';
import { joinSummary, meetingSummary } from '../data/thankYouQuestions';
import { canStart, isOnNow, lengthLabel, webinarEnd, webinarPrice, webinarWhen } from '../data/webinar';
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

// The webinar's link, once they've got it: what it's for (ads, bios,
// groups), then the link itself with Copy link and Open.
//
//   (🔗) Your webinar link                 [ openslate…/fix-the-vasthu ] [Copy link] [Open ↗]
//        Put it in your Meta ads, Instagram
//        bio or WhatsApp groups…
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
    <section className="share" aria-labelledby="share-title">
      <div className="share__text">
        <span className="share__icon" aria-hidden="true">
          <Link2 size={20} />
        </span>
        <div>
          <h2 className="share__title" id="share-title">
            Your webinar link
          </h2>
          <p className="share__help">
            Put it in your Meta ads, Instagram bio or WhatsApp groups. The link stays the same, even if you change the date later.
          </p>
        </div>
      </div>

      <div className="share__link">
        <span className="share__url" title={href}>
          {href.replace(/^https?:\/\//i, '')}
        </span>
        <button ref={copyRef} type="button" className="share__copy" onClick={handleCopy}>
          {state === 'copied' ? <Check size={16} strokeWidth={3} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
          {state === 'copied' ? 'Copied' : 'Copy link'}
        </button>
        <a
          className="share__open"
          href={href}
          target="_blank"
          rel="noopener"
          onClick={onOpen}
          aria-label="Open your webinar page (opens in a new tab)"
          title="Open"
        >
          <ExternalLink size={17} aria-hidden="true" />
        </a>
      </div>

      {/* Read out by screen readers; the button label already shows it visually */}
      <span className="overview__sr-only" aria-live="polite">
        {state === 'copied' && 'Link copied'}
      </span>
      {state === 'failed' && (
        <p className="share__error" role="alert">
          Couldn't copy. Select the link and copy it yourself.
        </p>
      )}
    </section>
  );
}

// "24 Oct, 10 Oct and 2 more"
function earlierList(sessions) {
  const dates = sessions.map((x) => {
    const d = new Date(`${x.date}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }).filter(Boolean);
  const shown = dates.slice(0, 3).join(', ');
  return dates.length > 3 ? `${shown} and ${dates.length - 3} more` : shown;
}

// done: ids of the pages they've finished, e.g. ['landing'].
// Empty on the first visit, so the screen looks as it always did.
export default function FunnelOverview({
  funnel,
  webinarId,          // this webinar's id, for its live link
  sessions = [],      // its earlier sessions, newest first (Run it again)
  onRunAgain,         // opens the Run it again pop-up
  onStart,
  done = [],
  answers = {},
  themeId = null,
  previewHref = null, // address of the full-screen preview (opens in a new tab)
  onPreview,          // called just before it opens
  onEdit,
  service = null,     // the sign-up page's contract (made from the event details)
  serviceIsOwn = true, // false: a contract picked by hand on an older webinar
  onChangeService,    // reopens the sign-up page step
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
  const meeting = meetingSummary(answers); // the link they join the session on
  const when = webinarWhen(answers);
  const length = lengthLabel(answers);
  const price = webinarPrice(answers);
  // Its session is over (and not run again yet), or about to start / on now
  const end = webinarEnd(answers);
  const ended = Boolean(publishedAt) && end !== null && end <= Date.now();
  const startable = Boolean(publishedAt) && canStart(answers);
  const published = Boolean(publishedAt);
  // Every page done: they can publish. A missing group link doesn't block it
  // (visitors are told the link comes by email instead; see ThankYouDesign).
  const ready = pagesLeft === 0;
  // `funnel` is the type (its pages); the link needs this webinar's own id
  const liveLink = published ? liveHref({ id: webinarId }) : null;

  // Publish removes the button they just pressed, so move keyboard focus
  // to Copy link (the next thing they'll want), not back to the top of the page
  const copyRef = useRef(null);
  const wasPublished = useRef(published);
  useEffect(() => {
    if (published && !wasPublished.current) copyRef.current?.focus();
    wasPublished.current = published;
  }, [published]);

  let title;
  if (ended) title = 'This session has ended';
  // "Live" and "publish" sound like it's announced to the world. It isn't:
  // they just get a link, and nobody sees anything until they share it.
  else if (published) title = 'Your link is ready';
  else if (ready) title = 'Your pages are ready';
  else if (started) title = `Your ${lastDone.name.toLowerCase()} is done`;
  else title = `Your webinar has ${pages.length} pages`;

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
          `${pagesLeft} more ${pagesLeft === 1 ? 'page' : 'pages'} and your webinar is ready.`}
        {!published && ready &&
          'Check each page, then get your link below.'}
        {published && !ended &&
          'Any change you make shows up on your link straight away.'}
        {ended &&
          'Run it again with a new date. Your pages and your link stay the same, so your ads keep working.'}
      </p>

      {sessions.length > 0 && (
        <p className="overview__earlier">
          Earlier sessions: {earlierList(sessions)}
        </p>
      )}

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

{/* Each page is just done; the link belongs to the whole webinar (the card under them) */}
{isDone && (
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
                      {serviceIsOwn || !service ? (
                        <div className="overview__service">
                          <span className="overview__service-name">From your event details</span>
                          <span className="overview__service-price">{price.label}</span>
                        </div>
                      ) : (
                        // An older webinar's hand-picked contract, until they confirm the new page
                        <div className="overview__service">
                          <span className="overview__service-name">{service.title}</span>
                          <span className="overview__service-price">{servicePrice(service)}</span>
                        </div>
                      )}
                      <div className="overview__page-actions">
                        {previewHref && (
                          <a
                            className="overview__page-action overview__page-action--preview"
                            href={`${previewHref}&page=signup`}
                            target="_blank"
                            rel="noopener"
                            onClick={onPreview}
                            aria-label="Preview your sign-up page (opens in a new tab)"
                          >
                            <ExternalLink size={16} /> Preview
                          </a>
                        )}
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

      {/* What to do with it, under the pages: publish, or once it's live the
          link, start it or run it again. Below the cards so the pages read first. */}
      <div className="overview__actions">
        {/* Ended: the one thing to do next */}
        {ended && (
          <div className="overview__launch">
            <button type="button" className="overview__launch-primary" onClick={onRunAgain}>
              <RefreshCw size={16} aria-hidden="true" /> Run it again
            </button>
          </div>
        )}

        {/* About to start, or on now: start it from here */}
        {startable && !meeting.missing && (
          <div className="overview__start">
            <span className="overview__start-text">
              <span className="overview__start-dot" aria-hidden="true" />
              {isOnNow(answers) ? 'Your webinar is on now' : `Your webinar starts at ${when.line.split(', ')[1]}`}
            </span>
            <a
              className="overview__launch-primary"
              href={meeting.link.startsWith('http') ? meeting.link : `https://${meeting.link}`}
              target="_blank"
              rel="noopener"
              aria-label={`Start webinar in ${meeting.app ?? 'your meeting app'} (opens in a new tab)`}
            >
              <Play size={16} aria-hidden="true" /> Start webinar
            </a>
          </div>
        )}

              {published && <LiveLink href={liveLink} onOpen={onPreview} copyRef={copyRef} />}

        {!published && ready && (
          <section className="overview__launch" aria-labelledby="overview-launch-title">
            {/* The same arrows that join the cards, pointing down: this is the step after them */}
            <span className="overview__arrow overview__arrow--down" aria-hidden="true">
              <ChevronRight size={18} strokeWidth={2.5} />
              <ChevronRight size={18} strokeWidth={2.5} />
              <ChevronRight size={18} strokeWidth={2.5} />
            </span>
            <h2 className="overview__launch-title" id="overview-launch-title">
              Last step: get your link to share
            </h2>
            <button type="button" className="overview__launch-primary" onClick={onPublish}>
              <Link2 size={16} aria-hidden="true" /> Get link to share
            </button>
            {/* The worry is "it'll be out in the world before the time is settled".
                Right under the button, so it's read at the moment of deciding. */}
            <p className="overview__launch-note">
              <Lock size={14} aria-hidden="true" />
              <span>Nobody sees it until you share the link. You can still change the date, time or anything else.</span>
            </p>
          </section>
        )}

      </div>
    </div>
  );
}