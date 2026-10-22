import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarPlus, Check, ExternalLink, Link2, MonitorPlay, Pencil, Play, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useCopy } from './OfferingsHome';
import RowMenu from '../components/RowMenu';
import ConfirmDialog from '../components/ConfirmDialog';
import { funnelTypes } from '../data/funnelTypes';
import { funnelName } from '../utils/funnelName';
import { liveHref } from '../utils/publish';
import {
  canStart,
  earlierSessions,
  lengthLabel,
  needsMeetingLink,
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
//   Webinars                                    [+ Create a webinar]
//   ┌ Upcoming 2 ───────────────────────────────────────────────────┐
//   │ [NOV 7] Fix the Vasthu mistakes…  [Copy link] [Edit] [↗] [⋯] │
//   │         Sat 7 Nov, 7:00 pm IST · 60 min · ₹499                │
//   │         ● Live · Starts in 16 days                            │
//   ├ Drafts 1 ─────────────────────────────────────────────────────┤
//   │ [ — ]   Untitled webinar · 1 of 3 pages done  [Continue]  [⋯] │
//   └ Past ─────────────────────────────────────────────────────────┘
//
// Upcoming: published, soonest first. Drafts: not published, last edited
// first. Past: every session that's over, latest first, one row each.
// A webinar run three times shows three rows there, all opening the same
// webinar; only one that hasn't been run again offers Run it again.
// Empty groups don't show.
//
// webinars: the saved records (App.jsx)
// onCreate(), onOpen(id), onDelete(id), onRunAgain(id)
// ------------------------------------------------------------

const TYPE = funnelTypes.find((t) => t.id === 'webinar');

export default function WebinarsPage({ webinars = [], onCreate, onOpen, onDelete, onRunAgain }) {
  const [menuFor, setMenuFor] = useState(null);
  const [deleting, setDeleting] = useState(null); // { id, name } while the pop-up asks
  const [said, setSaid] = useState(''); // for screen readers: what just changed

  useEffect(() => {
    document.title = 'Webinars';
  }, []);

  const groups = useMemo(() => {
    const now = Date.now();
    const by = { upcoming: [], draft: [], past: [] };
    webinars.forEach((w) => by[webinarStatus(w, now)].push(w));
    const startOf = (w) => webinarStart(w.answers) ?? Infinity;
    by.upcoming.sort((a, b) => startOf(a) - startOf(b));
    by.draft.sort((a, b) => b.updatedAt - a.updatedAt);
    // Past: webinars whose session is over, and every earlier session of any webinar
    const past = [
      ...by.past.map((w) => ({ key: w.id, webinar: w, session: null, at: startOf(w) })),
      ...webinars.flatMap((w) =>
        earlierSessions(w).map((x) => ({ key: `${w.id}:${x.id}`, webinar: w, session: x, at: webinarStart(x) ?? -Infinity })),
      ),
    ].sort((a, b) => b.at - a.at);
    const rows = (list) => list.map((w) => ({ key: w.id, webinar: w, session: null }));
    return [
      { id: 'upcoming', title: 'Upcoming', list: rows(by.upcoming) },
      { id: 'draft', title: 'Drafts', list: rows(by.draft) },
      { id: 'past', title: 'Past', list: past },
    ].filter((g) => g.list.length > 0);
  }, [webinars]);

  const confirmDelete = () => {
    onDelete(deleting.id);
    setSaid(`${deleting.name} deleted.`);
    setDeleting(null);
  };

  const rowProps = ({ key, webinar: w, session }) => ({
    webinar: w,
    session,
    menuOpen: menuFor === key,
    onMenu: (open) => setMenuFor(open ? key : null),
    onOpen: () => onOpen(w.id),
    onRunAgain: () => {
      setMenuFor(null);
      onRunAgain(w.id);
    },
    onDelete: () => {
      setMenuFor(null);
      setDeleting({ id: w.id, name: funnelName(w, TYPE), live: Boolean(w.publishedAt) });
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
                {g.list.map((row) => (
                  <WebinarRow key={row.key} {...rowProps(row)} />
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
  if (done === pages.length) return 'Ready to publish';
  return `${done} of ${pages.length} pages done`;
}

// One webinar, as a full-width row like a 1:1 call: date, what it is and
// where it's at on the left; what you can do on the right.
// session: an earlier session of this webinar (shown in Past), or null for its current one
function WebinarRow({ webinar, session, menuOpen, onMenu, onOpen, onDelete, onRunAgain }) {
  // An earlier session shows its own date, length and price; the rest is the webinar's
  const answers = session ? { ...webinar.answers, ...session } : webinar.answers;
  const name = funnelName(webinar, TYPE);
  const status = session ? 'past' : webinarStatus(webinar);
  const earlier = earlierSessions(webinar).length;
  const startNow = status === 'upcoming' && canStart(answers) && !needsMeetingLink(webinar) && Boolean(answers.meetingLink);
  const meetingHref = startNow ? (/^https?:\/\//i.test(answers.meetingLink) ? answers.meetingLink : `https://${answers.meetingLink}`) : null;
  const when = webinarWhen(answers);
  const price = webinarPrice(answers);
  const length = lengthLabel(answers);
  const landingDone = webinar.donePages.includes('landing');
  const url = status === 'draft' ? null : liveHref(webinar);
  const [copy, copyLink] = useCopy();

  // Draft: the details only once there are some (a brand-new one has none)
  const details = [when?.line, length].filter(Boolean).join(' · ');
  const showPrice = landingDone || status !== 'draft';

  const menuItems = [
    // Start takes Copy link's place on the row, so Copy link moves in here
    ...(startNow ? [{ label: 'Copy link', icon: Link2, onSelect: () => { onMenu(false); copyLink(url); } }] : []),
    ...(landingDone
      ? [
          {
            label: 'Preview',
            icon: ExternalLink,
            onSelect: () => {
              onMenu(false);
              window.open(`?preview=${encodeURIComponent(webinar.id)}`, '_blank', 'noopener');
            },
          },
        ]
      : []),
    { label: 'Delete', icon: Trash2, danger: true, onSelect: onDelete },
  ];

  return (
    <li className={`oh-row wb-row ${status === 'past' ? 'wb-row--past' : ''} ${menuOpen ? 'oh-row--menu' : ''}`}>
      <DateTile when={when} />

      <div className="oh-row__text">
        <h3 className="oh-row__name">{name}</h3>
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
                <span className="wb-badge__dot" aria-hidden="true" /> Live
              </span>
              <span>{startsIn(answers)}</span>
            </>
          )}
          {status === 'draft' && (
            <>
              <span className="wb-badge">Draft</span>
              <span>{draftProgress(webinar)}</span>
            </>
          )}
          {status === 'past' && <span className="wb-badge">Ended</span>}
          {status === 'upcoming' && earlier > 0 && (
            <span>
              Run {earlier} {earlier === 1 ? 'time' : 'times'} before
            </span>
          )}
        </p>
      </div>

      <div className="oh-row__actions">
        {session ? (
          // An earlier session: it's a record, so the webinar is where things happen
          <button type="button" className="oh__edit" onClick={onOpen} aria-label={`Open ${name}`}>
            Open webinar
          </button>
        ) : status === 'past' ? (
          <>
            <button type="button" className="oh__edit wb-row__again" onClick={onRunAgain} aria-label={`Run ${name} again`}>
              <RefreshCw size={15} aria-hidden="true" /> Run it again
            </button>
            <button type="button" className="oh__edit" onClick={onOpen} aria-label={`Edit ${name}`}>
              <Pencil size={15} aria-hidden="true" /> Edit
            </button>
          </>
        ) : status === 'draft' ? (
          <button type="button" className="oh__edit wb-row__continue" onClick={onOpen} aria-label={`Continue setting up ${name}`}>
            Continue setting up <ArrowRight size={15} aria-hidden="true" />
          </button>
        ) : (
          <>
            {startNow && (
              <a className="oh__add wb-row__start" href={meetingHref} target="_blank" rel="noopener" aria-label={`Start ${name} (opens your meeting in a new tab)`}>
                <Play size={15} aria-hidden="true" /> Start webinar
              </a>
            )}
            {status === 'upcoming' && !startNow && (
              <button type="button" className="oh-card__copy" onClick={() => copyLink(url)} aria-label={`Copy link to ${name}`}>
                {copy === 'copied' ? <Check size={16} strokeWidth={3} aria-hidden="true" /> : <Link2 size={16} aria-hidden="true" />}
                {copy === 'copied' ? 'Copied' : 'Copy link'}
              </button>
            )}
            <button type="button" className="oh__edit" onClick={onOpen} aria-label={`Edit ${name}`}>
              <Pencil size={15} aria-hidden="true" /> Edit
            </button>
          </>
        )}
        {!session && <RowMenu title={name} open={menuOpen} onOpenChange={onMenu} items={menuItems} />}
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