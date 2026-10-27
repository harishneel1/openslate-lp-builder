import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, CalendarPlus, Eye, MonitorPlay, Pencil, Plus, Share2, Trash2, Users, Video } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import MetaPixelRow from '../components/MetaPixelRow';
import { usePixel } from '../components/MetaPixelDrawer';
import RowMenu from '../components/RowMenu';
import ShareDialog from '../components/ShareDialog';
import { funnelTypes } from '../data/funnelTypes';
import { funnelName } from '../utils/funnelName';
import { liveHref } from '../utils/publish';
import { webinarShareMessage } from '../utils/shareMessage';
import { onSignupsChange, peopleOf } from '../data/webinarSignups';
import {
  currentRun,
  runsOf,
  seriesIdOf,
  meetingHref,
  meetingState,
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
//   ┌───────────────────────────────────────────────────────────────────────────┐
//   │ Meta Pixel   Not set up                                          [Set up] │
//   │              Running Facebook or Instagram ads? …                         │
//   └───────────────────────────────────────────────────────────────────────────┘
//   ┌ Upcoming 2 ───────────────────────────────────────────────────────────────┐
//   │ [NOV 7] Fix the Vasthu…  [Join meeting] [Share] [Edit webinar] [⋯]         │
//   │         [📅 Sat 7 Nov, 7:00 pm IST]  👥 23 signed up  ₹499                │
//   ├ Drafts 1 ─────────────────────────────────────────────────────┤
//   │ [ — ]   Untitled webinar             [Continue setting up]  [⋯] │
//   │         [Draft]  1 of 3 pages done                            │
//   ├ Past 1 ───────────────────────────────────────────────────────────────────┤
//   │ [OCT 31] Fix the Vasthu mistakes…   [Add another session] [Edit webinar] [⋯] │
//   │          [📅 Sat 31 Oct, 7:00 pm IST]  👥 41 signed up  ₹499              │
//   └────────────────────────────────────────────────────────────────────────────┘
//
// One row per webinar, however many times it has run. Run again makes a
// copy on a new date (App.jsx), and all of them share one link: a series
// (data/webinar.js). The row shows the date that link opens (currentRun:
// on now, else the soonest to come, else the latest that's over), so a
// webinar sits in Upcoming while it has a date to come and in Past once
// all its dates are over. The row shows one session (only one is ever
// coming up at a time); the others are on its page (WebinarDetails).
//
// Under the name, one line: the session's date and time in a grey pill,
// then how many signed up and the price, in small grey text. No
// "Starts in…" or "Ended": the date and the group (Upcoming / Past)
// already say it.
//
// Upcoming: soonest first. Drafts: not published, last edited first.
// Past: latest first. Empty groups don't show.
//
// Meta Pixel (MetaPixelRow): a setting for every webinar, so it sits above
// them, like Google Calendar above the calls on 1:1 calls. It shows once
// a webinar has a link (ads need one), or once a pixel is saved.
//
// A click anywhere on a row opens the date it shows (App.jsx: its details
// page once it's published, the setup screen while it's a draft). Edit
// webinar opens the same details page. Share (upcoming only: a past
// webinar's link just says it has ended) opens a pop-up with WhatsApp and
// the link (ShareDialog), its message ready-made (utils/shareMessage.js).
// ⋯ holds the less common actions: Preview (the in-app preview with
// Mobile/Desktop, in a new tab; not on drafts, whose pages aren't done)
// and Delete webinar, which removes the whole webinar, every date (one
// date is deleted from its own page).
//
// Every upcoming webinar has its meeting button, always in the same place
// (Zoom is built in, so there's always a meeting). It changes with the clock:
//   Join meeting       more than 15 minutes away (quiet, outlined)
//   ● Start webinar    from 15 minutes before (orange, pulsing dot)
//   ● Live now         while it's on
// The landing page link is behind Share, in a pop-up that names it, so
// it's never mistaken for the meeting link.
// The list re-reads the clock every 30 seconds, so the button and the
// groups move on while the page sits open.
//
// webinars: the saved records (App.jsx)
// onCreate(), onOpen(id) (where they left off: Continue setting up),
// onOpenOverview(id) (a click on the row, and Edit webinar),
// onDelete(ids) (every date of one webinar), onRunAgain(id),
// onPreview() (just before a preview tab opens: App saves first)
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

// Re-renders when someone registers (here or in another tab), so the
// "signed up" counts stay right
function useSignupsTick() {
  const [tick, setTick] = useState(0);
  useEffect(() => onSignupsChange(() => setTick((n) => n + 1)), []);
  return tick;
}

export default function WebinarsPage({ webinars = [], onCreate, onOpen, onOpenOverview = onOpen, onDelete, onRunAgain, onPreview }) {
  const [deleting, setDeleting] = useState(null); // { ids, name, dates, live } while the pop-up asks
  const [said, setSaid] = useState(''); // for screen readers: what just changed
  const [sharing, setSharing] = useState(null); // the webinar (the date its row shows) while Share is open
  const [menuId, setMenuId] = useState(null); // the row whose ⋯ menu is open
  const now = useNow();
  useSignupsTick();
  const pixel = usePixel();
  const showPixel = Boolean(pixel) || webinars.some((w) => w.publishedAt);

  useEffect(() => {
    document.title = 'Webinars';
  }, []);

  // One entry per webinar: { webinar: the date its row shows, runs: all its dates }.
  // Drafts aren't in a series yet (nothing's published), so each is its own.
  const entries = useMemo(() => {
    const out = [];
    const seen = new Set();
    webinars.forEach((w) => {
      if (!w.publishedAt) {
        out.push({ webinar: w, runs: [w] });
        return;
      }
      const series = seriesIdOf(w, webinars);
      if (seen.has(series)) return;
      seen.add(series);
      out.push({ webinar: currentRun(series, webinars, now) ?? w, runs: runsOf(w, webinars) });
    });
    return out;
  }, [webinars, now]);

  const groups = useMemo(() => {
    const by = { upcoming: [], draft: [], past: [] };
    entries.forEach((e) => by[webinarStatus(e.webinar, now)].push(e));
    const startOf = (e) => webinarStart(e.webinar.answers) ?? Infinity;
    by.upcoming.sort((a, b) => startOf(a) - startOf(b));
    by.draft.sort((a, b) => b.webinar.updatedAt - a.webinar.updatedAt);
    // Past: latest first
    by.past.sort((a, b) => startOf(b) - startOf(a));
    return [
      { id: 'upcoming', title: 'Upcoming', list: by.upcoming },
      { id: 'draft', title: 'Drafts', list: by.draft },
      { id: 'past', title: 'Past', list: by.past },
    ].filter((g) => g.list.length > 0);
  }, [entries, now]);

  const confirmDelete = () => {
    onDelete(deleting.ids);
    setSaid(`${deleting.name} deleted.`);
    setDeleting(null);
  };

  const rowProps = ({ webinar: w, runs }) => ({
    webinar: w,
    now,
    menuOpen: menuId === w.id,
    onMenu: (open) => setMenuId(open ? w.id : null),
    onPreview: () => {
      setMenuId(null);
      onPreview?.();
      window.open(`?preview=${encodeURIComponent(w.id)}`, '_blank', 'noopener');
    },
    people: w.publishedAt ? peopleOf(w.id).length : null,
    onOpen: () => onOpen(w.id),
    onOpenOverview: () => onOpenOverview(w.id),
    onShare: () => setSharing(w),
    onRunAgain: () => onRunAgain(w.id),
    onDelete: () => {
      setMenuId(null);
      setDeleting({
        ids: runs.map((r) => r.id),
        name: funnelName(w, TYPE),
        dates: runs.length,
        live: Boolean(w.publishedAt),
      });
    },
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

      {/* Settings for every webinar */}
      {showPixel && (
        <section className="oh__panel wb-settings" aria-label="Settings for all your webinars">
          <MetaPixelRow />
        </section>
      )}

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
                {g.list.map((e) => (
                  <WebinarRow key={e.webinar.id} {...rowProps(e)} />
                ))}
              </ul>
            </div>
          </section>
        ))
      )}

      <p className="oh__sr-only" aria-live="polite">
        {said}
      </p>

      {sharing && <WebinarShare webinar={sharing} onClose={() => setSharing(null)} />}

      {deleting && (
        <ConfirmDialog
          title="Delete this webinar?"
          confirmLabel="Delete webinar"
          danger
          onCancel={() => setDeleting(null)}
          onConfirm={confirmDelete}
        >
          <p>
            <strong>“{deleting.name}”</strong> will be deleted with{' '}
            {deleting.dates > 1 ? `all ${deleting.dates} sessions, their pages and the people who signed up` : 'its pages'}
            {deleting.live ? ', and its link will stop working' : ''}. This can’t be undone.
          </p>
          {deleting.dates > 1 && <p>To delete just one session, open the webinar, pick the session and use its ⋯.</p>}
        </ConfirmDialog>
      )}
    </div>
  );
}

// Share webinar: the pop-up for one webinar. Its link is the one for
// every session; the date in it is the one the row shows.
function WebinarShare({ webinar, onClose }) {
  const name = funnelName(webinar, TYPE);
  const url = liveHref(webinar);
  const when = webinarWhen(webinar.answers ?? {});
  const meta = [when?.line, webinarPrice(webinar.answers ?? {}).label].filter(Boolean).join(' · ');
  return (
    <ShareDialog
      heading="Share webinar"
      name={name}
      meta={meta}
      url={url}
      message={webinarShareMessage(webinar, name, url)}
      onClose={onClose}
    />
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
// webinar: the date this row shows (the one its link opens)
// people: how many signed up for that date, or null for a draft
// menuOpen / onMenu(open): its ⋯ menu (the page keeps which one is open)
function WebinarRow({ webinar, now, people, menuOpen, onMenu, onOpen, onOpenOverview, onShare, onPreview, onDelete, onRunAgain }) {
  const { answers } = webinar;
  const name = funnelName(webinar, TYPE);
  const status = webinarStatus(webinar, now);
  // 'join', 'start' or 'live' (data/webinar.js); only upcoming webinars have the button
  const meeting = status === 'upcoming' ? meetingState(answers, now) : null;
  const when = webinarWhen(answers);
  const price = webinarPrice(answers);

  // The webinar's details page (same place a click on the row goes)
  const editWebinar = (
    <button type="button" className="oh__edit" onClick={onOpenOverview} aria-label={`Edit ${name}`}>
      <Pencil size={15} aria-hidden="true" /> Edit webinar
    </button>
  );

  // ⋯: Preview once it's published, and Delete
  const menuItems = [
    status !== 'draft' && { label: 'Preview', icon: Eye, onSelect: onPreview },
    { label: 'Delete webinar', icon: Trash2, danger: true, onSelect: onDelete },
  ].filter(Boolean);

  return (
    <li className={`oh-row wb-row ${status === 'past' ? 'wb-row--past' : ''} ${menuOpen ? 'oh-row--menu' : ''}`}>
      <DateTile when={when} />

      <div className="oh-row__text">
        <h3 className="oh-row__name">
          {/* Covers the whole row (see .wb-row__open::after): a click anywhere opens the overview */}
          <button type="button" className="wb-row__open" onClick={onOpenOverview}>
            {name}
          </button>
        </h3>

        {/* One line: [📅 date] then people and price (the date already says when;
            on the day, the meeting button turns into Start webinar) */}
        <p className="wb-row__status">
          {status === 'draft' ? (
            <>
              <span className="wb-badge">Draft</span>
              <span>{draftProgress(webinar)}</span>
            </>
          ) : (
            <>
              {when && (
                <span className="wb-badge wb-badge--when">
                  <CalendarDays size={13} aria-hidden="true" /> {when.line}
                </span>
              )}
              {people !== null && (
                <span className="wb-row__fact">
                  <Users size={14} aria-hidden="true" /> {people} signed up
                </span>
              )}
              <span className="wb-row__price">{price.label}</span>
            </>
          )}
        </p>
      </div>

      <div className="oh-row__actions">
        {status === 'past' ? (
          <>
            {/* The next thing to do once every date is over */}
            <button
              type="button"
              className="oh__edit wb-row__again"
              onClick={onRunAgain}
              aria-label={`Add another session of ${name}`}
            >
              <Plus size={15} aria-hidden="true" /> Add another session
            </button>
            {editWebinar}
          </>
        ) : status === 'draft' ? (
          <button type="button" className="oh__edit wb-row__continue" onClick={onOpen} aria-label={`Continue setting up ${name}`}>
            Continue setting up <ArrowRight size={15} aria-hidden="true" />
          </button>
        ) : (
          <>
            <MeetingButton state={meeting} href={meetingHref(webinar.id)} name={name} />
            <button type="button" className="oh__edit" onClick={onShare} aria-label={`Share ${name}`}>
              <Share2 size={15} aria-hidden="true" /> Share
            </button>
            {editWebinar}
          </>
        )}
        <RowMenu title={name} open={menuOpen} onOpenChange={onMenu} items={menuItems} />
      </div>
    </li>
  );
}

// The coach's way into their Zoom meeting (a new tab). Always the first
// button on an upcoming row, so it's where they expect it on the day.
// Also in the details page's header (WebinarDetails).
// state: 'join' | 'start' | 'live' (meetingState in data/webinar.js)
// liveLabel: the words while it's on ('Live now' on the list; the details
//            page says 'Rejoin meeting', as its tag already says it's live)
export function MeetingButton({ state, href, name, liveLabel = 'Live now' }) {
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
          {state === 'live' ? liveLabel : 'Start webinar'}
        </>
      )}
    </a>
  );
}