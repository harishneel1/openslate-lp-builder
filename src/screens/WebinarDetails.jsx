import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarClock,
  Check,
  Copy,
  Download,
  ExternalLink,
  Link2,
  MessageCircle,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import RowMenu from '../components/RowMenu';
import { useCopy } from './OfferingsHome';
import { MeetingButton, useNow } from './WebinarsPage';
import { funnelTypes } from '../data/funnelTypes';
import {
  durationMins,
  laterRuns,
  lengthLabel,
  meetingHref,
  meetingState,
  startsIn,
  webinarEnd,
  webinarPrice,
  webinarStart,
  webinarStatus,
  webinarWhen,
} from '../data/webinar';
import { onSignupsChange, peopleCsv, peopleOf } from '../data/webinarSignups';
import { funnelName } from '../utils/funnelName';
import { liveHref } from '../utils/publish';
import { whatsappHref } from '../utils/whatsapp';
import './OfferingsHome.css'; // panels and buttons
import './CallsPage.css'; // the empty state
import './WebinarsPage.css'; // the meeting button and badges, as on the list
import './WebinarDetails.css';

// ------------------------------------------------------------
// One published webinar: where the coach comes back to run it. Drafts
// open the setup screen instead (App.jsx). Every run is its own webinar,
// so everything here is about this one date.
//
//   [Starts in 4 hr 32 min]       [Join meeting] [✎ Edit webinar pages] [⋯]
//   Fix the Vasthu mistakes that block money…
//   📅 Sat 31 Oct, 8:30 pm IST · 60 min · Free · in 7 days
//   Landing Page URL
//   [🔗 localhost:5173/fix-the-vasthu-mistakes ↗ | Copy]
//   ┌ People 12 ───────────────── [🔍 Search…] [⬇ Download Excel] ┐
//   │ Name          Email            Phone            Registered    💬 │
//   └────────────────────────────────────────────────────────────────┘
//
// Kept calm on purpose:
// - The title is shown once (the top bar leaves it out on this page).
// - On the day, a small countdown tag above the title ("Starts in 4 hr
//   32 min", "Live · 18 min in"). Other days: "in 7 days" on the date
//   line, a Tomorrow or Ended tag.
// - The link sits in a small box with Copy attached, so it can't be
//   mistaken for the Zoom link. Hidden once it has ended.
// - Rare actions live in ⋯: Change date & time, Run again, Delete.
//
// The meeting button changes with the clock, as on the list (Join
// meeting → Start webinar → Live now). Once it has ended: Run again on a
// new date, or, if it's been run again, Go to <that date>.
//
// webinar: its saved record; webinars: all of them (for its newer run)
// onEditPages(), onChangeDate(), onRunAgain(), onOpenRun(id), onDelete()
// ------------------------------------------------------------

const TYPE = funnelTypes.find((t) => t.id === 'webinar');

// "Today, 7:42 pm", "Yesterday, 9:05 am", "24 Oct, 7:42 pm"
function registeredWhen(ms, now) {
  const d = new Date(ms);
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
  const day = (x) => new Date(x).setHours(0, 0, 0, 0);
  const daysAgo = Math.round((day(now) - day(ms)) / 86_400_000);
  if (daysAgo === 0) return `Today, ${time}`;
  if (daysAgo === 1) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${time}`;
}

// The tag above the title, or null. Today and Live now get the
// countdown card instead, so they need no tag.
function badgeOf(ended, answers, now) {
  if (ended) return { label: 'Ended', tone: '' };
  if (startsIn(answers, now) === 'Starts tomorrow') return { label: 'Tomorrow', tone: 'wd__badge--soon' };
  return null;
}

// "in 14 days" on the date line, from 2 days away
function daysAway(answers, now) {
  const m = /^Starts in (\d+) days$/.exec(startsIn(answers, now) ?? '');
  return m ? `in ${m[1]} days` : null;
}

// ---------- The webinar's own clock ----------
// Times shown in the webinar's time zone (IST for most coaches), worked
// out from its date and time, so they match the date line.
function zoneShift(answers) {
  const start = webinarStart(answers);
  const asIfUtc = Date.parse(`${answers.date}T${answers.time ?? '19:00'}:00Z`);
  return start === null ? 0 : asIfUtc - start; // add to a moment to get the zone's clock
}

// "2026-10-24" for a moment, in the webinar's zone
const dateIn = (ms, shift) => new Date(ms + shift).toISOString().slice(0, 10);

// "4 hr 32 min", "1 hr", "32 min", "less than a minute"
function countdown(mins) {
  if (mins < 1) return 'less than a minute';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!h) return `${m} min`;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

// The countdown tag above the title on the day, or null when it isn't
// the day (or it's over)
//   phase: 'today' (more than 15 min away), 'soon' (from 15 min before), 'live'
//   text:  "Starts in 4 hr 32 min", "Live · 18 min in"
//   at:    how far along (0 to 1), drawn as a thin line along the tag's bottom
//          edge: through the day towards the start (from 6 am), then
//          through the webinar itself once it's live
function dayOf(answers, now) {
  const start = webinarStart(answers);
  const end = webinarEnd(answers);
  if (start === null || now >= end) return null;

  if (now >= start) {
    const mins = Math.floor((now - start) / 60_000);
    return {
      phase: 'live',
      text: mins < 1 ? 'Live · just started' : `Live · ${countdown(mins)} in`,
      at: (now - start) / (end - start),
    };
  }

  const shift = zoneShift(answers);
  if (dateIn(now, shift) !== answers.date) return null; // not the day yet

  const sixAm = Date.parse(`${answers.date}T06:00:00Z`) - shift;
  const from = Math.min(sixAm, now, start - 30 * 60_000);
  const mins = Math.ceil((start - now) / 60_000);
  return {
    phase: mins <= 15 ? 'soon' : 'today',
    text: `Starts in ${countdown(mins)}`,
    at: (now - from) / (start - from),
  };
}

// The address without "https://", easier to read
const shortLink = (url) => url.replace(/^https?:\/\//, '');

// The people, kept up to date as they register (here or in another tab)
function usePeople(webinarId) {
  const [people, setPeople] = useState(() => peopleOf(webinarId));
  useEffect(() => {
    setPeople(peopleOf(webinarId));
    return onSignupsChange(() => setPeople(peopleOf(webinarId)));
  }, [webinarId]);
  return people;
}

export default function WebinarDetails({ webinar, webinars = [], onEditPages, onChangeDate, onRunAgain, onOpenRun, onDelete }) {
  const now = useNow(15_000); // the countdown moves on every minute
  const { answers } = webinar;
  const name = funnelName(webinar, TYPE);
  const status = webinarStatus(webinar, now); // 'upcoming' or 'past' here
  const ended = status === 'past';
  const meeting = ended ? null : meetingState(answers, now);
  const when = webinarWhen(answers);
  const length = lengthLabel(answers);
  const price = webinarPrice(answers);
  const url = liveHref(webinar);
  const nextRun = ended ? laterRuns(webinar, webinars, now)[0]?.webinar ?? null : null;
  const nextWhen = nextRun ? webinarWhen(nextRun.answers) : null;
  const nextDay = nextWhen ? `${nextWhen.weekday} ${nextWhen.day} ${nextWhen.month}` : 'the new date';
  const badge = badgeOf(ended, answers, now);
  const today = ended ? null : dayOf(answers, now); // the countdown tag, on the day
  const away = ended || today ? null : daysAway(answers, now);
  const people = usePeople(webinar.id);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    document.title = name;
  }, [name]);

  // ⋯: what's rarely needed. "Run again" is left out when it's already
  // the big button (ended, not run again yet).
  const pick = (fn) => () => {
    setMenuOpen(false);
    fn();
  };
  const menuItems = [
    !ended && { label: 'Change date & time', icon: CalendarClock, onSelect: pick(onChangeDate) },
    !(ended && !nextRun) && { label: 'Run again on a new date', icon: RefreshCw, onSelect: pick(onRunAgain) },
    { label: 'Delete webinar', icon: Trash2, danger: true, onSelect: pick(() => setDeleting(true)) },
  ].filter(Boolean);

  return (
    <div className="oh wd">
      <header className="wd__head">
        <div className="wd__intro">
          {today && <Countdown day={today} />}
          {!today && badge && (
            <p className="wd__status">
              <span className={`wb-badge ${badge.tone}`}>
                {badge.dot && <span className="wb-badge__dot" aria-hidden="true" />}
                {badge.label}
              </span>
            </p>
          )}
          <h1 className="wd__title">{name}</h1>
          {when && (
            <p className="wd__when">
              <CalendarClock size={16} aria-hidden="true" />
              <span>
                {when.line}
                {length ? ` · ${length}` : ''} ·{' '}
                <span className={price.isFree ? 'wd__free' : 'wd__price'}>{price.label}</span>
                {away && <span className="wd__away"> · {away}</span>}
              </span>
            </p>
          )}
          {!ended && <LandingLink webinar={webinar} url={url} />}
        </div>

        <div className="wd__actions">
          {!ended && <MeetingButton state={meeting} href={meetingHref(webinar.id)} name={name} />}
          {ended && !nextRun && (
            <button type="button" className="oh__add wd__primary" onClick={onRunAgain}>
              <RefreshCw size={16} aria-hidden="true" /> Run again on a new date
            </button>
          )}
          {ended && nextRun && (
            <button type="button" className="oh__add wd__primary" onClick={() => onOpenRun(nextRun.id)}>
              Go to {nextDay} <ArrowRight size={16} aria-hidden="true" />
            </button>
          )}
          <button type="button" className="oh__edit" onClick={onEditPages}>
            <Pencil size={15} aria-hidden="true" /> Edit webinar pages
          </button>
          <RowMenu title={name} open={menuOpen} onOpenChange={setMenuOpen} items={menuItems} />
        </div>
      </header>

      <People webinar={webinar} people={people} name={name} ended={ended} paid={!price.isFree} now={now} />

      {deleting && (
        <ConfirmDialog
          title="Delete this webinar?"
          confirmLabel="Delete webinar"
          danger
          onCancel={() => setDeleting(false)}
          onConfirm={() => {
            setDeleting(false);
            onDelete();
          }}
        >
          <p>
            <strong>“{name}”</strong> will be deleted with its pages and the people who registered
            {ended ? '' : ', and its link will stop working'}. This can’t be undone.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}

// ---------- On the day: the countdown tag ----------
// A small pill above the title, where Tomorrow and Ended go on other
// days. It warms up as the time comes, like the meeting button:
//   grey     Starts in 4 hr 32 min    (more than 15 min away)
//   orange   Starts in 12 min         (from 15 min before)
//   orange ● Live · 18 min in         (while it's on, dot pulsing)
// A thin line fills along its bottom edge: the calendar's now line in
// miniature, through the day towards the start, then through the webinar.
function Countdown({ day }) {
  const at = Math.min(Math.max(day.at, 0), 1);
  return (
    <p className="wd__status">
      <span className={`wd__count wd__count--${day.phase}`}>
        {day.phase === 'live' && <span className="wd__count-dot" aria-hidden="true" />}
        {day.text}
        <span className="wd__count-fill" style={{ width: `${at * 100}%` }} aria-hidden="true" />
      </span>
    </p>
  );
}

// ---------- The landing page link ----------
// A small box under the date, like a read-only field with Copy attached
// (the "copy invite link" pattern people know from Google Meet). The box
// makes it one thing you act on; "Copy" in words says what it does.
//
//   Landing Page URL
//   ┌──────────────────────────────────┬──────┐
//   │ 🔗 localhost:5173/fix-the-vasthu ↗ │ Copy │
//   └──────────────────────────────────┴──────┘
//
// It shows the short address (the page's name), easier to read than the
// preview code. Copy and ↗ use the working link. When real hosting
// arrives, liveHref() becomes the short address and the two are the same.
function LandingLink({ webinar, url }) {
  const [copy, copyLink] = useCopy();
  const copied = copy === 'copied';
  const shown = webinar.slug ? `${window.location.host}/${webinar.slug}` : shortLink(url);
  return (
    <div className="wd__share">
      <span className="wd__share-label" id="wd-share-label">
        Landing Page URL
      </span>
      <div className="wd__share-box" role="group" aria-labelledby="wd-share-label">
        <Link2 size={16} aria-hidden="true" className="wd__share-icon" />
        <span className="wd__share-url" title={url}>
          {shown}
        </span>
        <a
          className="wd__share-open"
          href={url}
          target="_blank"
          rel="noopener"
          aria-label="Open the landing page in a new tab"
          data-tip="Open"
        >
          <ExternalLink size={15} aria-hidden="true" />
        </a>
        <button
          type="button"
          className={`wd__share-copy ${copied ? 'wd__share-copy--done' : ''}`}
          onClick={() => copyLink(url)}
          aria-label={copied ? 'Landing page URL copied' : 'Copy landing page URL'}
        >
          {copied ? <Check size={15} strokeWidth={3} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <span className="oh__sr-only" aria-live="polite">
        {copied && 'Landing page URL copied'}
      </span>
      {copy === 'failed' && (
        <p className="oh__copy-error wd__copy-error" role="alert">
          Couldn’t copy. Open the page and copy the address from the browser.
        </p>
      )}
    </div>
  );
}

// ---------- People ----------
function People({ webinar, people, name, ended, paid, now }) {
  const [query, setQuery] = useState('');

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;
    const digits = q.replace(/\D/g, '');
    return people.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        (digits.length >= 3 && p.phone.replace(/\D/g, '').includes(digits)),
    );
  }, [people, query]);

  const download = () => {
    const blob = new Blob([peopleCsv(people, { paid })], { type: 'text/csv;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = `${webinar.slug ?? 'webinar'}-people.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  };

  return (
    <section className="oh__panel wd__people" aria-labelledby="wd-people-title">
      <div className="oh__panel-head wd__people-head">
        <h2 className="oh__panel-title" id="wd-people-title">
          People <span className="oh__count">{people.length}</span>
        </h2>
        {people.length > 0 && (
          <div className="wd__tools">
            <label className="wd__search">
              <Search size={16} aria-hidden="true" />
              <span className="oh__sr-only">Search people</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, email or phone"
              />
            </label>
            <button type="button" className="oh__edit" onClick={download}>
              <Download size={15} aria-hidden="true" /> Download Excel
            </button>
          </div>
        )}
      </div>

      <div className="oh__panel-body wd__people-body">
        {people.length === 0 ? (
          <div className="calls__empty">
            <span className="calls__empty-icon" aria-hidden="true">
              <Users size={22} />
            </span>
            <h3 className="calls__empty-title">{ended ? 'No one registered for this date' : 'No one has registered yet'}</h3>
            {!ended && (
              <p className="calls__empty-text">
                Share your landing page link. People who register will show up here.
              </p>
            )}
          </div>
        ) : shown.length === 0 ? (
          <div className="calls__empty">
            <h3 className="calls__empty-title">No one matches “{query.trim()}”</h3>
            <button type="button" className="oh__edit" onClick={() => setQuery('')}>
              <X size={15} aria-hidden="true" /> Clear search
            </button>
          </div>
        ) : (
          <div className="wd__table-wrap">
            <table className="wd__table">
              <caption className="oh__sr-only">People who registered for {name}</caption>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Phone</th>
                  <th scope="col">Registered</th>
                  {paid && <th scope="col">Paid</th>}
                  <th scope="col">
                    <span className="oh__sr-only">WhatsApp</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => {
                  const first = p.name.split(/\s+/)[0] || p.name;
                  const chat = whatsappHref(p.phone, `Hi ${first}, `);
                  return (
                    <tr key={p.id}>
                      <td data-label="Name" className="wd__name">
                        {p.name}
                      </td>
                      <td data-label="Email">
                        <a className="wd__email" href={`mailto:${p.email}`}>
                          {p.email}
                        </a>
                      </td>
                      <td data-label="Phone" className="wd__phone">
                        {p.phone}
                      </td>
                      <td data-label="Registered" className="wd__muted">
                        {registeredWhen(p.registeredAt, now)}
                      </td>
                      {paid && (
                        <td data-label="Paid">{p.amount > 0 ? `₹${p.amount.toLocaleString('en-IN')}` : '—'}</td>
                      )}
                      <td className="wd__chat">
                        {chat && (
                          <a
                            className="wd__wa"
                            href={chat}
                            target="_blank"
                            rel="noopener"
                            aria-label={`Message ${p.name} on WhatsApp`}
                            data-tip="WhatsApp"
                            data-tip-align="end"
                          >
                            <MessageCircle size={17} aria-hidden="true" />
                            <span className="wd__wa-text">WhatsApp</span>
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}