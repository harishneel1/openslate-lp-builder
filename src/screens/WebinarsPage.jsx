import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarPlus, Check, Link2, MonitorPlay, Pencil, Plus, RefreshCw, Trash2, Video } from 'lucide-react';
import { useCopy } from './OfferingsHome';
import ConfirmDialog from '../components/ConfirmDialog';
import { funnelTypes } from '../data/funnelTypes';
import { funnelName } from '../utils/funnelName';
import { liveHref } from '../utils/publish';
import {
  laterRuns,
  lengthLabel,
  meetingHref,
  meetingState,
  startsIn,
  webinarPrice,
  webinarStart,
  webinarStatus,
  webinarWhen,
} from '../data/webinar';
import './OfferingsHome.css'; // the same panels, rows and buttons as 1:1 calls
import './CallsPage.css'; // the empty state
import './WebinarsPage.css';

// ------------------------------------------------------------
// The Webinars tab: every webinar the coach has, as the thing they think
// in ("my session on the 7th"), not as a funnel. Creating one opens the
// same steps as before (landing page → sign-up page → thank you page →
// publish); this is where they come back to.
//
//   Webinars                                                [+ Create a webinar]
//   ┌ Upcoming 2 ───────────────────────────────────────────────────────────────┐
//   │ [NOV 7] Fix the Vasthu mistakes…  [Join meeting] [Copy link] [Edit pages] [🗑] │
//   │         Sat 7 Nov, 7:00 pm IST · 60 min · ₹499                            │
//   │         ● Link ready · Starts in 16 days                                  │
//   ├ Drafts 1 ─────────────────────────────────────────────────────┤
//   │ [ — ]   Untitled webinar · 1 of 3 pages done  [Continue]  [🗑] │
//   ├ Past 1 ───────────────────────────────────────────────────────────────────┤
//   │ [OCT 31] Fix the Vasthu mistakes…   [Run again on a new date] [Edit pages] [🗑] │
//   │          ● Ended · Ran again on Sat 7 Nov →                                │
//   └────────────────────────────────────────────────────────────────────────────┘
//
// Upcoming: published, soonest first. Drafts: not published, last edited
// first. Past: published and over, latest first. Empty groups don't show.
//
// Every run is its own webinar: Run again makes a copy on a new date with
// its own link (App.jsx), so the same name can show in Past and Upcoming.
// The date tile tells them apart, and a past one links to its newer run.
//
// A click anywhere on a row opens the webinar (App.jsx: its details page
// once it's published, the setup screen while it's a draft). Edit pages
// opens the three page cards, where every page is edited.
//
// Every upcoming webinar has its meeting button, always in the same place
// (Zoom is built in, so there's always a meeting). It changes with the clock:
//   Join meeting       more than 15 minutes away (quiet, outlined)
//   ● Start webinar    from 15 minutes before (orange, pulsing dot)
//   ● Live now         while it's on
// Copy link is a full button until then, and an icon beside Start/Live.
// The list re-reads the clock every 30 seconds, so the button, the
// "Starts in" line and the groups move on while the page sits open.
//
// webinars: the saved records (App.jsx)
// onCreate(), onOpen(id) (where they left off: Continue setting up),
// onOpenOverview(id) (a click on the row), onEditPages(id), onDelete(id), onRunAgain(id)
// ------------------------------------------------------------

const TYPE = funnelTypes.find((t) => t.id === 'webinar');

// The time now, updated every `every` ms (also used by WebinarDetails)
export function useNow(every = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(timer);
  }, [every]);
  return now;
}

export default function WebinarsPage({ webinars = [], onCreate, onOpen, onOpenOverview = onOpen, onEditPages = onOpenOverview, onDelete, onRunAgain }) {
  const [deleting, setDeleting] = useState(null); // { id, name } while the pop-up asks
  const [said, setSaid] = useState(''); // for screen readers: what just changed
  const now = useNow();

  useEffect(() => {
    document.title = 'Webinars';
  }, []);

  const groups = useMemo(() => {
    const by = { upcoming: [], draft: [], past: [] };
    webinars.forEach((w) => by[webinarStatus(w, now)].push(w));
    const startOf = (w) => webinarStart(w.answers) ?? Infinity;
    by.upcoming.sort((a, b) => startOf(a) - startOf(b));
    by.draft.sort((a, b) => b.updatedAt - a.updatedAt);
    // Past: latest first
    by.past.sort((a, b) => startOf(b) - startOf(a));
    return [
      { id: 'upcoming', title: 'Upcoming', list: by.upcoming },
      { id: 'draft', title: 'Drafts', list: by.draft },
      { id: 'past', title: 'Past', list: by.past },
    ].filter((g) => g.list.length > 0);
  }, [webinars, now]);

  const confirmDelete = () => {
    onDelete(deleting.id);
    setSaid(`${deleting.name} deleted.`);
    setDeleting(null);
  };

  const rowProps = (w) => ({
    webinar: w,
    now,
    // Its newest later run, for "Ran again on …" (Past only)
    nextRun: webinarStatus(w, now) === 'past' ? laterRuns(w, webinars, now)[0]?.webinar ?? null : null,
    onOpen: () => onOpen(w.id),
    onOpenOverview: () => onOpenOverview(w.id),
    onEditPages: () => onEditPages(w.id),
    onOpenRun: (id) => onOpenOverview(id),
    onRunAgain: () => onRunAgain(w.id),
    onDelete: () => setDeleting({ id: w.id, name: funnelName(w, TYPE), live: Boolean(w.publishedAt) }),
  });

  return (
    <div className="oh webinars">
      <div className="webinars__head">
        <div>
          <h1 className="oh__title">Webinars</h1>
          <p className="calls__lead">Plan, publish and run your webinars.</p>
        </div>
        {webinars.length > 0 && (
          <button type="button" className="oh__add" onClick={onCreate}>
            <Plus size={16} strokeWidth={2.5} aria-hidden="true" /> Create a webinar
          </button>
        )}
      </div>

      {webinars.length === 0 ? (
        <section className="oh__panel" aria-label="Your webinars">
          <div className="oh__panel-body">
            <div className="calls__empty">
              <span className="calls__empty-icon" aria-hidden="true">
                <MonitorPlay size={22} />
              </span>
              <h2 className="calls__empty-title">No webinars yet</h2>
              <p className="calls__empty-text webinars__empty-text">
                We’ll ask you simple questions, one at a time, and build your landing page, sign-up page
                and thank you page.
              </p>
              <button type="button" className="oh__add" onClick={onCreate}>
                <Plus size={16} strokeWidth={2.5} aria-hidden="true" /> Create a webinar
              </button>
            </div>
          </div>
        </section>
      ) : (
        groups.map((g) => (
          <section key={g.id} className="oh__panel" aria-labelledby={`webinars-${g.id}`}>
            <div className="oh__panel-head">
              <h2 className="oh__panel-title" id={`webinars-${g.id}`}>
                {g.title} <span className="oh__count">{g.list.length}</span>
              </h2>
            </div>
            <div className="oh__panel-body">
              <ul className="oh__rows">
                {g.list.map((w) => (
                  <WebinarRow key={w.id} {...rowProps(w)} />
                ))}
              </ul>
            </div>
          </section>
        ))
      )}

      <p className="oh__sr-only" aria-live="polite">
        {said}
      </p>

      {deleting && (
        <ConfirmDialog
          title="Delete this webinar?"
          confirmLabel="Delete webinar"
          danger
          onCancel={() => setDeleting(null)}
          onConfirm={confirmDelete}
        >
          <p>
            <strong>“{deleting.name}”</strong> will be deleted with its pages
            {deleting.live ? ', and its link will stop working' : ''}. This can’t be undone.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}

// The date as a little calendar page; dashed when there's no date yet
function DateTile({ when }) {
  if (!when) {
    return (
      <span className="wb-tile wb-tile--none" aria-hidden="true">
        <CalendarPlus size={20} />
      </span>
    );
  }
  return (
    <span className="wb-tile" aria-hidden="true">
      <span className="wb-tile__month">{when.month}</span>
      <span className="wb-tile__day">{when.day}</span>
    </span>
  );
}

// "1 of 3 pages done", or the page they're on
function draftProgress(webinar) {
  const pages = TYPE.pages;
  const done = pages.filter((p) => webinar.donePages.includes(p.id)).length;
  if (done === pages.length) return 'All pages done';
  return `${done} of ${pages.length} pages done`;
}

// One webinar, as a full-width row like a 1:1 call: date, what it is and
// where it's at on the left; what you can do on the right.
// nextRun: on a past one, the newest webinar made from it with Run again, or null
function WebinarRow({ webinar, now, nextRun, onOpen, onOpenOverview, onEditPages, onOpenRun, onDelete, onRunAgain }) {
  const { answers } = webinar;
  const name = funnelName(webinar, TYPE);
  const status = webinarStatus(webinar, now);
  const nextWhen = nextRun ? webinarWhen(nextRun.answers) : null;
  // 'join', 'start' or 'live' (data/webinar.js); only upcoming webinars have the button
  const meeting = status === 'upcoming' ? meetingState(answers, now) : null;
  const when = webinarWhen(answers);
  const price = webinarPrice(answers);
  const length = lengthLabel(answers);
  const landingDone = webinar.donePages.includes('landing');
  const url = status === 'draft' ? null : liveHref(webinar);
  const [copy, copyLink] = useCopy();

  // Draft: the details only once there are some (a brand-new one has none)
  const details = [when?.line, length].filter(Boolean).join(' · ');
  const showPrice = landingDone || status !== 'draft';

  // The three page cards, where each page is edited
  const editPages = (
    <button type="button" className="oh__edit" onClick={onEditPages} aria-label={`Edit the pages of ${name}`}>
      <Pencil size={15} aria-hidden="true" /> Edit pages
    </button>
  );

  return (
    <li className={`oh-row wb-row ${status === 'past' ? 'wb-row--past' : ''}`}>
      <DateTile when={when} />

      <div className="oh-row__text">
        <h3 className="oh-row__name">
          {/* Covers the whole row (see .wb-row__open::after): a click anywhere opens the overview */}
          <button type="button" className="wb-row__open" onClick={onOpenOverview}>
            {name}
          </button>
        </h3>
        {(details || showPrice) && (
          <p className="oh-row__detail">
            {details}
            {details && showPrice && ' · '}
            {showPrice && (
              <span className={price.isFree ? 'oh-row__price oh-row__price--free' : 'oh-row__price'}>{price.label}</span>
            )}
          </p>
        )}

        <p className="wb-row__status">
          {status === 'upcoming' && (
            <>
              <span className="wb-badge wb-badge--live">
                <span className="wb-badge__dot" aria-hidden="true" /> Link ready
              </span>
              <span>{startsIn(answers, now)}</span>
            </>
          )}
          {status === 'draft' && (
            <>
              <span className="wb-badge">Draft</span>
              <span>{draftProgress(webinar)}</span>
            </>
          )}
          {status === 'past' && <span className="wb-badge">Ended</span>}
          {/* Run again already: which one, so they can follow it */}
          {nextRun && (
            <button type="button" className="wb-row__next" onClick={() => onOpenRun(nextRun.id)}>
              Ran again on {nextWhen ? `${nextWhen.weekday} ${nextWhen.day} ${nextWhen.month}` : 'a new date'}
              <ArrowRight size={13} aria-hidden="true" />
            </button>
          )}
        </p>
      </div>

      <div className="oh-row__actions">
        {status === 'past' ? (
          <>
            {/* The next thing to do on one that's over, until it's been run again */}
            <button
              type="button"
              className={nextRun ? 'oh__edit' : 'oh__edit wb-row__again'}
              onClick={onRunAgain}
              aria-label={`Run ${name} again on a new date`}
            >
              <RefreshCw size={15} aria-hidden="true" /> Run again on a new date
            </button>
            {editPages}
          </>
        ) : status === 'draft' ? (
          <button type="button" className="oh__edit wb-row__continue" onClick={onOpen} aria-label={`Continue setting up ${name}`}>
            Continue setting up <ArrowRight size={15} aria-hidden="true" />
          </button>
        ) : (
          <>
            <MeetingButton state={meeting} href={meetingHref(webinar.id)} name={name} />
            {/* Once Start is the thing to press, Copy link shrinks to an icon beside it */}
            {meeting !== 'join' && url && (
              <button
                type="button"
                className="wb-row__icon"
                onClick={() => copyLink(url)}
                aria-label={copy === 'copied' ? 'Link copied' : `Copy link to ${name}`}
                data-tip={copy === 'copied' ? 'Copied' : 'Copy link'}
              >
                {copy === 'copied' ? <Check size={17} strokeWidth={3} aria-hidden="true" /> : <Link2 size={17} aria-hidden="true" />}
              </button>
            )}
            {meeting === 'join' && (
              <button type="button" className="oh-card__copy" onClick={() => copyLink(url)} aria-label={`Copy link to ${name}`}>
                {copy === 'copied' ? <Check size={16} strokeWidth={3} aria-hidden="true" /> : <Link2 size={16} aria-hidden="true" />}
                {copy === 'copied' ? 'Copied' : 'Copy link'}
              </button>
            )}
            {editPages}
          </>
        )}
        {/* Delete was the only thing left in the ⋯ menu, so it's its own button */}
        <button
          type="button"
          className="wb-row__icon wb-row__icon--delete"
          onClick={onDelete}
          aria-label={`Delete ${name}`}
          data-tip="Delete"
          data-tip-align="end"
        >
          <Trash2 size={17} aria-hidden="true" />
        </button>
      </div>

      <span className="oh__sr-only" aria-live="polite">
        {copy === 'copied' && `Link to ${name} copied`}
      </span>
      {copy === 'failed' && (
        <p className="oh__copy-error oh-row__error" role="alert">
          Couldn’t copy. Select the link and copy it yourself: <span className="oh-card__url">{url}</span>
        </p>
      )}
    </li>
  );
}

// The coach's way into their Zoom meeting (a new tab). Always the first
// button on an upcoming row, so it's where they expect it on the day.
// Also in the details page's header (WebinarDetails).
// state: 'join' | 'start' | 'live' (meetingState in data/webinar.js)
export function MeetingButton({ state, href, name }) {
  const look = {
    join: { className: 'oh__edit wb-row__join', label: `Join the meeting for ${name}` },
    start: { className: 'oh__add wb-row__start', label: `Start ${name}` },
    live: { className: 'oh__add wb-row__start wb-row__start--live', label: `Join ${name}, live now` },
  }[state];
  return (
    <a className={look.className} href={href} target="_blank" rel="noopener" aria-label={`${look.label} (opens Zoom in a new tab)`}>
      {state === 'join' ? (
        <>
          <Video size={15} aria-hidden="true" /> Join meeting
        </>
      ) : (
        <>
          <span className="wb-row__pulse" aria-hidden="true" />
          {state === 'live' ? 'Live now' : 'Start webinar'}
        </>
      )}
    </a>
  );
}