import { Fragment, useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowRight, CalendarClock, Check, ChevronRight, Clock, Copy, ExternalLink, Pencil, Link2, Lock, Play, Plus, RefreshCw } from 'lucide-react';
import PageThumbnail from '../components/PageThumbnail';
import { recommendedThemeId } from '../data/themes';
import { servicePrice } from '../data/mockServices';
import { joinSummary } from '../data/thankYouQuestions';
import { canStart, isOnNow, lengthLabel, meetingHref, webinarEnd, webinarPrice, webinarWhen } from '../data/webinar';
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

// done: ids of the pages they've finished, e.g. ['landing'].
// Empty on the first visit, so the screen looks as it always did.
export default function FunnelOverview({
  funnel,
  webinarId,          // this webinar's id, for its live link
  webinarSlug = null, // its address name (every session shares it), for the same link
  nextRun = null,     // this webinar's newest later session, or null
  onOpenRun,          // opens that one: onOpenRun(id)
  onRunAgain,         // opens the Add another session pop-up
  onOpenDetails = null, // "Go to your webinar": its page (sign-ups, Join), once published
  onStart,
  done = [],
  answers = {},
  themeId = null,
  previewHref = null, // address of the full-screen preview (opens in a new tab)
  onPreview,          // called just before it opens
  onEdit,
  onChangeDate,       // opens the event details (date, time…) to change them
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
  const when = webinarWhen(answers);
  const length = lengthLabel(answers);
  const price = webinarPrice(answers);
  // Its session is over (and not run again yet), or about to start / on now
  const end = webinarEnd(answers);
  const ended = Boolean(publishedAt) && end !== null && end <= Date.now();
  // "Sat 7 Nov", for the button to its newer run
  const nextWhen = nextRun ? webinarWhen(nextRun.answers ?? {}) : null;
  const nextRunDay = nextWhen ? `${nextWhen.weekday} ${nextWhen.day} ${nextWhen.month}` : 'the new date';
  const startable = Boolean(publishedAt) && canStart(answers);
  const published = Boolean(publishedAt);
  // Every page done: they can publish. A missing group link doesn't block it
  // (visitors are told the link comes by email instead; see ThankYouDesign).
  const ready = pagesLeft === 0;
  // `funnel` is the type (its pages); the link needs this webinar's own id
  const liveLink = published ? liveHref({ id: webinarId, slug: webinarSlug }) : null;

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
      {/* "All funnels" lives in the top bar.
          Title and subtitle on the left, the session's date on the right. */}
      <div className="overview__head">
      <div className="overview__head-text">
      <h1 className="overview__title">{title}</h1>
      <p className="overview__subtitle">
        {!started &&
          "Your customers go through them in this order. We'll fill them in together, one page at a time."}
        {!published && started && pagesLeft > 0 &&
          `${pagesLeft} more ${pagesLeft === 1 ? 'page' : 'pages'} and your webinar is ready.`}
        {!published && ready &&
          'Check each page, then get your link below.'}
        {published && !ended &&
          'Any change you make shows up on your link straight away, and applies to every upcoming session.'}
        {ended && !nextRun &&
          'Add another session on a new date. Your link stays the same and opens the new session.'}
        {ended && nextRun &&
          `Your next session is on ${nextRunDay}. This one stays as it was, with the people who signed up for it.`}
      </p>
      </div>

      {/* The session itself, once the landing page has its details: top right */}
      {when && done.includes('landing') && (
        <p className="overview__when">
          <CalendarClock size={16} aria-hidden="true" />
          <span>
            {when.line}
            {length ? ` · ${length}` : ''} ·{' '}
            <span className={price.isFree ? 'overview__when-free' : 'overview__when-price'}>{price.label}</span>
          </span>
          {/* Shows the date isn't final. Not once it's over: that's Add another session. */}
          {onChangeDate && !ended && (
            <button type="button" className="overview__when-change" onClick={onChangeDate} aria-label="Change the date and time">
              Change
            </button>
          )}
        </p>
      )}
      </div>

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
                {/* A done page shows itself; one still to do, a grey sketch */}
                {isDone && ['landing', 'registration', 'thank-you'].includes(page.id) ? (
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
                      {/* The group people join: its link on the right, or "+ Add link"
                          when it's missing. Editing opens at the link question then. */}
                      {join && (
                        <div className="overview__service">
                          <span className="overview__service-name">{join.label}</span>
                          {join.link && (
                            <span className="overview__service-link" title={join.link}>
                              {join.link.replace(/^https?:\/\//i, '')}
                            </span>
                          )}
                          {join.missing && (
                            <button
                              type="button"
                              className="overview__service-add"
                              onClick={onEditThankYou}
                              aria-label={`Add your ${join.label} link`}
                            >
                              <Plus size={15} aria-hidden="true" /> Add link
                            </button>
                          )}
                        </div>
                      )}
                      {join?.missing && (
                        <p className="overview__service-warn">
                          <AlertCircle size={14} aria-hidden="true" />
                          People can’t join your group until you add the link.
                        </p>
                      )}
                      <div className="overview__page-actions">
                        <button type="button" className="overview__page-action" onClick={onEditThankYou}>
                          <Pencil size={16} /> Edit
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
                    // One way in: the preview tab, which has "Edit page" in its top bar
                    <div className="overview__page-actions">
                      {previewHref ? (
                        <a
                          className="overview__page-action overview__page-action--preview"
                          href={previewHref}
                          target="_blank"
                          rel="noopener"
                          onClick={onPreview}
                          aria-label="Preview and edit your landing page (opens in a new tab)"
                        >
                          <ExternalLink size={16} /> Preview &amp; edit
                        </a>
                      ) : (
                        <button type="button" className="overview__page-action" onClick={onEdit}>
                          <Pencil size={16} /> Edit
                        </button>
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
          link, start it or add another session. Below the cards so the pages read first. */}
      <div className="overview__actions">
        {/* Ended: the one thing to do next */}
        {ended && !nextRun && (
          <div className="overview__launch">
            <button type="button" className="overview__launch-primary" onClick={onRunAgain}>
              <RefreshCw size={16} aria-hidden="true" /> Add another session
            </button>
          </div>
        )}

        {/* A later session already: go to it first, add another second */}
        {ended && nextRun && (
          <div className="overview__launch">
            <button type="button" className="overview__launch-primary" onClick={() => onOpenRun(nextRun.id)}>
              Go to {nextRunDay} <ArrowRight size={16} aria-hidden="true" />
            </button>
            <button type="button" className="overview__launch-link" onClick={onRunAgain}>
              Add another session
            </button>
          </div>
        )}

        {/* About to start, or on now: start it from here */}
        {startable && (
          <div className="overview__start">
            <span className="overview__start-text">
              <span className="overview__start-dot" aria-hidden="true" />
              {isOnNow(answers) ? 'Your webinar is on now' : `Your webinar starts at ${when.line.split(', ')[1]}`}
            </span>
            <a
              className="overview__launch-primary"
              href={meetingHref(webinarId)}
              target="_blank"
              rel="noopener"
              aria-label={`${isOnNow(answers) ? 'Rejoin your webinar' : 'Start webinar'} in Zoom (opens in a new tab)`}
            >
              <Play size={16} aria-hidden="true" /> {isOnNow(answers) ? 'Rejoin' : 'Start webinar'}
            </a>
          </div>
        )}

              {/* Ended: nobody can sign up on it any more, so no prompt to share it */}
              {published && !ended && <LiveLink href={liveLink} onOpen={onPreview} copyRef={copyRef} />}

        {/* After copying the link, the next place to go: where sign-ups show
            up and the webinar is started. The hint names those two things in
            everyday words (a first-time coach doesn't know "sessions" yet).
            Outlined, so Copy link stays the one filled button. */}
        {published && !ended && onOpenDetails && (
          <div className="overview__next">
            <button type="button" className="overview__next-btn" onClick={onOpenDetails}>
              Go to your webinar <ArrowRight size={16} aria-hidden="true" />
            </button>
            <p className="overview__next-hint">See who signs up, and start your webinar on the day.</p>
          </div>
        )}

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