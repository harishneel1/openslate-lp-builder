import { useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  Check,
  ChevronRight,
  Download,
  Eye,
  Link2,
  Share2,
  Lock,
  MessageCircle,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import Drawer from '../components/Drawer';
import PageThumbnail from '../components/PageThumbnail';
import ShareDialog from '../components/ShareDialog';
import { useCopy } from './OfferingsHome';
import WebinarReminders from './WebinarReminders';
import { MeetingButton, useNow } from './WebinarsPage';
import { funnelTypes } from '../data/funnelTypes';
import {
  currentRun,
  durationMins,
  isOnNow,
  runsOf,
  seriesIdOf,
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
import { webinarShareMessage } from '../utils/shareMessage';
import { whatsappHref } from '../utils/whatsapp';
import './OfferingsHome.css'; // panels and buttons
import './CallsPage.css'; // the empty state
import './WebinarsPage.css'; // the meeting button and badges, as on the list
import './WebinarDetails.css';

// ------------------------------------------------------------
// One published webinar: where the coach comes back to run it. Drafts
// open the setup screen instead (App.jsx). A webinar runs in sessions:
// each session (a run, data/webinar.js) has its own date and people, and
// all of them share one link.
//
//   ════ white band, the width of the page ══════════════════════════════
//   Fix the Vasthu mistakes that block     ┌ ● ● ● 🔒 site/slug        👁 ┐
//   money in your home…                    │                             │
//                                          │  their landing page, as on  │
//   [↗ Share webinar]  [🔗 Copy link]      │  a laptop, under a wash     │
//                                          │                             │
//   ┌ Next session ─────────────────────┐  │                             │
//   │ Sat 31 Oct, 2:00 pm IST           │  │                             │
//   │ Starts in 7 days                  │  │   [✎ Edit webinar pages]    │
//   │ 23 signed up · See people >  [Join meeting] │                     │
//   └───────────────────────────────────┘  └─────────────────────────────┘
//   ══════════════════════════════════════════════════════════════════════
//   (grey from here)
//   ┌ Sessions 2 | Emails ──────────────────────────────────────────────┐
//   │ Session             Status                  Signed up             │
//   │ Sat 31 Oct 2:00 pm  ● Coming up  🔗 link        0    See people > │
//   │ Sat 24 Oct 2:00 pm  Ended                       2    See people > │
//   │ + Add another session                                             │
//   └───────────────────────────────────────────────────────────────────┘
//
// One page for the whole webinar, whichever session App opened it on.
// The next session gets its own card (it's what coaches check every
// day). Every session is a row; a click opens its people in a side panel
// (SessionDrawer), where that session's own actions are too.
//
// The header is a white band across the page: the webinar's name, its
// link and its next session on the left, its landing page on the right.
// The next session is the one light-orange card, with the one filled
// orange button (Join meeting); it looks the same every day. Below the
// band, on grey: Sessions and Emails.
// On the right, the landing page as it looks on a laptop (LandingThumb).
// A click on it opens the three page cards; 👁 opens the preview in a new
// tab (with its Mobile/Desktop switch). Deleting the whole webinar is on
// the Webinars list.
//
// Edit webinar pages and Emails open the next session (what the link
// shows), or the latest once every session is over. There's one set of
// pages, price and emails: a change goes to every session still to come
// (withSharedChanges in data/webinar.js), so the coach edits once.
//
// webinar: any session of it (the one App has open); webinars: all of them
// tab: 'sessions' or 'reminders' (the Emails tab; App keeps it, so coming
//      back from the email editor lands on it); onTab(tab)
// onEditPages(id), onChangeDate(id), onRunAgain(id) (copies that session),
// onDelete(id) (one session), onPreview() (just before the preview tab opens)
// onToggleReminder(sessionId, id, on), onEditReminder(sessionId, id): the Emails tab
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

export default function WebinarDetails({
  webinar,
  webinars = [],
  tab = 'sessions',
  onTab,
  onEditPages,
  onChangeDate,
  onRunAgain,
  onDelete,
  onPreview,
  onToggleReminder,
  onEditReminder,
}) {
  const now = useNow(15_000); // the countdown moves on every minute
  useSignupsTick(); // counts follow sign-ups, here or in another tab
  const name = funnelName(webinar, TYPE);
  const url = liveHref(webinar);
  // Every session of this webinar, and the one its link opens now
  const found = runsOf(webinar, webinars);
  const sessions = found.length > 0 ? found : [webinar];
  const linkRun = currentRun(seriesIdOf(webinar, webinars), webinars, now) ?? webinar;
  const next = webinarStatus(linkRun, now) !== 'past' ? linkRun : null; // null once every session is over
  const latest = sessions[sessions.length - 1]; // "Add another session" copies the latest
  // Pages and emails: the next session's (what the link shows), else the latest's
  const current = next ?? latest;
  const currentWhen = webinarWhen(current.answers ?? {});
  const currentDay = currentWhen ? `${currentWhen.weekday} ${currentWhen.day} ${currentWhen.month}` : 'the next session';
  const emailPeople = usePeople(current.id);
  const shownTab = tab === 'reminders' ? 'reminders' : 'sessions';

  const [openId, setOpenId] = useState(null); // the session whose people are open in the side panel
  const opened = sessions.find((r) => r.id === openId) ?? null;
  const [deleting, setDeleting] = useState(null); // the session being deleted
  const [sharing, setSharing] = useState(false); // the Share webinar pop-up

  useEffect(() => {
    document.title = name;
  }, [name]);

  return (
    <div className="oh wd">
      {/* The whole webinar: its name, its one link, its pages */}
      <header className="wd__head">
        <div className="wd__intro">
          <h1 className="wd__title">{name}</h1>
          <LinkActions url={url} onShare={next ? () => setSharing(true) : null} />
          <NextSession run={next} name={name} now={now} onOpen={() => setOpenId(next.id)} onAdd={() => onRunAgain(latest.id)} />
        </div>
        <LandingThumb
          run={current}
          address={webinar.slug ? `${window.location.host}/${webinar.slug}` : shortLink(url)}
          name={name}
          onEdit={() => onEditPages(current.id)}
          previewHref={`?preview=${encodeURIComponent(current.id)}`}
          onPreview={onPreview}
        />
      </header>

      <section className="oh__panel wd__main" aria-label={shownTab === 'reminders' ? 'Emails' : 'Sessions'}>
        <div className="oh__panel-head wd__people-head">
          <Tabs tab={shownTab} onTab={onTab} sessions={sessions.length} />
        </div>
        {shownTab === 'sessions' ? (
          <div id="wd-panel-sessions" role="tabpanel" aria-labelledby="wd-tab-sessions">
            <SessionsTable sessions={sessions} linkRunId={next?.id ?? null} now={now} onOpen={setOpenId} onAdd={() => onRunAgain(latest.id)} />
          </div>
        ) : (
          <div id="wd-panel-reminders" role="tabpanel" aria-labelledby="wd-tab-reminders">
            <WebinarReminders
              webinar={current}
              people={emailPeople}
              now={now}
              onToggle={(id, on) => onToggleReminder(current.id, id, on)}
              onEdit={(id) => onEditReminder(current.id, id)}
            />
          </div>
        )}
      </section>

      {opened && (
        <SessionDrawer
          run={opened}
          name={name}
          now={now}
          onClose={() => setOpenId(null)}
          onChangeDate={() => onChangeDate(opened.id)}
          onDelete={sessions.length > 1 ? () => setDeleting(opened) : null}
        />
      )}

      {sharing && next && (
        <ShareDialog
          heading="Share webinar"
          name={name}
          meta={[webinarWhen(next.answers ?? {})?.line, webinarPrice(next.answers ?? {}).label].filter(Boolean).join(' · ')}
          url={url}
          message={webinarShareMessage(next, name, url)}
          onClose={() => setSharing(false)}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete this session?"
          confirmLabel="Delete session"
          danger
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            const id = deleting.id;
            setDeleting(null);
            setOpenId(null);
            onDelete(id);
          }}
        >
          <p>
            The session on <strong>{dayOfRun(deleting) ?? 'this date'}</strong> will be deleted with its pages and the
            people who signed up for it. This can’t be undone.
          </p>
          <p>Your link and the other sessions stay as they are.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}

// 'Sat 7 Nov' for a session, or null before it has a date
function dayOfRun(run) {
  const w = webinarWhen(run.answers ?? {});
  return w ? `${w.weekday} ${w.day} ${w.month}` : null;
}

// '2:00 pm IST' for a session, or null
function timeOfRun(run) {
  const w = webinarWhen(run.answers ?? {});
  return w ? w.line.split(', ').slice(1).join(', ') : null;
}

// Re-renders when someone signs up, here or in another tab
function useSignupsTick() {
  const [, setTick] = useState(0);
  useEffect(() => onSignupsChange(() => setTick((n) => n + 1)), []);
}

// ---------- The next session: a card in the header, under the link ----------
// Light orange, the same every day: the one thing coaches check daily.
// Join meeting is the one filled orange button in the header (the button
// itself turns into Start webinar / Live now near the time, as on the list).
//
//   ┌ Next session ────────────────────────────────┐
//   │ Sat 31 Oct, 2:00 pm IST                      │
//   │ Starts in 7 days                             │
//   │ ──────────────────────────────────────────── │
//   │ 23 signed up · See people >   [Join meeting] │
//   └──────────────────────────────────────────────┘
//
// With nothing coming up, the same card says so and offers to add a session.
function NextSession({ run, name, now, onOpen, onAdd }) {
  if (!run) {
    return (
      <section className="wd__next wd__next--none" aria-labelledby="wd-next-title">
        <h2 className="wd__next-title" id="wd-next-title">
          No session coming up
        </h2>
        <p className="wd__next-text">Your link tells visitors this webinar has ended. Add a session to open sign-ups again.</p>
        <div className="wd__next-foot">
          <span />
          <button type="button" className="oh__add" onClick={onAdd}>
            <Plus size={16} aria-hidden="true" /> Add another session
          </button>
        </div>
      </section>
    );
  }
  const answers = run.answers ?? {};
  const today = dayOf(answers, now);
  const count = peopleOf(run.id).length;
  return (
    <section className="wd__next" aria-labelledby="wd-next-title">
      <p className="wd__next-label">Next session</p>
      <h2 className="wd__next-title" id="wd-next-title">
        {dayOfRun(run) ?? 'No date yet'}
        {timeOfRun(run) ? `, ${timeOfRun(run)}` : ''}
      </h2>
      {today ? (
        <div className="wd__next-count-down">
          <Countdown day={today} />
        </div>
      ) : (
        <p className="wd__next-text wd__next-text--soon">{startsIn(answers, now)}</p>
      )}
      <div className="wd__next-foot">
        {/* The count is a button: it opens this session's people */}
        <button type="button" className="wd__next-people" onClick={onOpen}>
          <span className="wd__next-num">{count}</span> signed up
          <span className="wd__next-see">
            See people <ChevronRight size={14} aria-hidden="true" />
          </span>
        </button>
        <MeetingButton state={meetingState(answers, now)} href={meetingHref(run.id)} name={name} liveLabel="Rejoin meeting" />
      </div>
    </section>
  );
}

// ---------- Sessions: every date, as a full-width table ----------
// Coming up first (soonest at the top), then past ones (latest first).
// A whole row is one button: it opens that session's people in a side
// panel. The last row adds a session.
//
//   Session              Status                Signed up
//   Sat 31 Oct 2:00 pm   ● Coming up  🔗 link     0      See people >
//   Sat 24 Oct 2:00 pm   Ended                    2      See people >
//   + Add another session
function SessionsTable({ sessions, linkRunId, now, onOpen, onAdd }) {
  const isPast = (r) => webinarStatus(r, now) === 'past';
  const order = [...sessions.filter((r) => !isPast(r)), ...sessions.filter(isPast).reverse()];
  return (
    <div className="wd__st">
      <div className="wd__st-row wd__st-row--head" aria-hidden="true">
        <span>Session</span>
        <span>Status</span>
        <span>Signed up</span>
        <span />
      </div>
      <ul className="wd__st-list">
        {order.map((r) => {
          const answers = r.answers ?? {};
          const live = isOnNow(answers, now);
          const past = isPast(r);
          const label = live ? 'Live now' : past ? 'Ended' : 'Coming up';
          const tone = live ? 'wd__st-badge--live' : past ? '' : 'wb-badge--live';
          const count = peopleOf(r.id).length;
          const day = dayOfRun(r) ?? 'No date yet';
          return (
            <li key={r.id}>
              <button
                type="button"
                className="wd__st-row"
                onClick={() => onOpen(r.id)}
                aria-label={`${day}, ${label}, ${count} signed up. See people`}
              >
                <span className="wd__st-when">
                  <span className="wd__st-day">{day}</span>
                  <span className="wd__st-time">{timeOfRun(r)}</span>
                </span>
                <span className="wd__st-status">
                  <span className={`wb-badge ${tone}`}>
                    {!past && <span className="wb-badge__dot" aria-hidden="true" />}
                    {label}
                  </span>
                  {r.id === linkRunId && (
                    <span className="wd__st-link">
                      <Link2 size={13} aria-hidden="true" /> Your link opens this
                    </span>
                  )}
                </span>
                <span className="wd__st-count">{count}</span>
                <span className="wd__st-go">
                  See people <ChevronRight size={15} aria-hidden="true" />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <button type="button" className="wd__st-add" onClick={onAdd}>
        <Plus size={16} aria-hidden="true" /> Add another session
      </button>
    </div>
  );
}

// ---------- One session's people, in a side panel ----------
// Opened from its row (or "See people" on the next session). Its own
// actions sit under the title (Join meeting, Change date); Delete session
// waits quietly in the footer, beside Download Excel.
// Each person is one line: name, then email and phone; when they signed
// up and WhatsApp on the right. Download Excel stays at the bottom.
function SessionDrawer({ run, name, now, onClose, onChangeDate, onDelete }) {
  const people = usePeople(run.id);
  const answers = run.answers ?? {};
  const ended = webinarStatus(run, now) === 'past';
  const price = webinarPrice(answers);
  const day = dayOfRun(run);
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
    const blob = new Blob([peopleCsv(people, { paid: !price.isFree })], { type: 'text/csv;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = `${run.slug ?? 'webinar'}-${answers.date ?? 'session'}-people.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  };

  const sub = [timeOfRun(run), lengthLabel(answers), price.label, ended ? 'Ended' : startsIn(answers, now)]
    .filter(Boolean)
    .join(' · ');

  return (
    <Drawer
      className="wd-drawer"
      title={`Session on ${day ?? 'a date to be set'}`}
      sub={sub}
      onClose={onClose}
      extra={
        ended ? null : (
        <div className="wd-drawer__actions">
          {!ended && <MeetingButton state={meetingState(answers, now)} href={meetingHref(run.id)} name={name} liveLabel="Rejoin meeting" />}
          {!ended && (
            <button type="button" className="oh__edit" onClick={onChangeDate}>
              <CalendarClock size={15} aria-hidden="true" /> Change date
            </button>
          )}
        </div>
        )
      }
      // Download on the left; Delete, rarely needed, quiet on the right
      footer={
        people.length > 0 || onDelete ? (
          <>
            {people.length > 0 ? (
              <button type="button" className="oh__edit" onClick={download}>
                <Download size={15} aria-hidden="true" /> Download Excel
              </button>
            ) : (
              <span />
            )}
            {onDelete && (
              <button type="button" className="wd-drawer__delete" onClick={onDelete}>
                <Trash2 size={15} aria-hidden="true" /> Delete session
              </button>
            )}
          </>
        ) : null
      }
    >
      <div className="wd-drawer__top">
        <h3 className="wd-drawer__count">
          {people.length} {people.length === 1 ? 'person' : 'people'} signed up
        </h3>
        {people.length > 5 && (
          <label className="wd__search wd-drawer__search">
            <Search size={16} aria-hidden="true" />
            <span className="oh__sr-only">Search people</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, email or phone"
            />
          </label>
        )}
      </div>

      {people.length === 0 ? (
        <div className="calls__empty">
          <span className="calls__empty-icon" aria-hidden="true">
            <Users size={22} />
          </span>
          <h3 className="calls__empty-title">{ended ? 'No one signed up for this session' : 'No one has signed up yet'}</h3>
          {!ended && <p className="calls__empty-text">Share your landing page link. People who sign up will show up here.</p>}
        </div>
      ) : shown.length === 0 ? (
        <div className="calls__empty">
          <h3 className="calls__empty-title">No one matches “{query.trim()}”</h3>
          <button type="button" className="oh__edit" onClick={() => setQuery('')}>
            <X size={15} aria-hidden="true" /> Clear search
          </button>
        </div>
      ) : (
        <ul className="wd-people">
          {shown.map((p) => {
            const first = p.name.split(/\s+/)[0] || p.name;
            const chat = whatsappHref(p.phone, `Hi ${first}, `);
            return (
              <li key={p.id} className="wd-person">
                <div className="wd-person__text">
                  <p className="wd-person__name">{p.name}</p>
                  <p className="wd-person__contact">
                    <a className="wd__email" href={`mailto:${p.email}`}>
                      {p.email}
                    </a>
                    {p.phone && <span> · {p.phone}</span>}
                  </p>
                </div>
                <div className="wd-person__side">
                  <span className="wd-person__when">{registeredWhen(p.registeredAt, now)}</span>
                  {!price.isFree && p.amount > 0 && (
                    <span className="wd-person__paid">₹{p.amount.toLocaleString('en-IN')}</span>
                  )}
                </div>
                {chat ? (
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
                  </a>
                ) : (
                  <span />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Drawer>
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

// ---------- The landing page, as a small desktop window ----------
// Drawn at laptop width and scaled down (PageThumbnail), in the same
// browser frame as the example page in the storefront setup
// (ProfileExample). Only the landing page: it stands for all three.
//
// The page sits under a dark wash with a white "Edit webinar pages" pill
// in the middle, as on the building step (BuildingStep.css), so it's
// plainly a button. Hover or focus darkens it and lifts the pill. The
// whole page area is that one button; 👁 in the address bar opens the
// full preview in a new tab, where a browser keeps its own controls.
//
// The frame stretches to the height of the left column, so its top
// lines up with the title and its bottom with the line under the link.
// run: the session the pages belong to (the next one, else the latest)
// address: the link as the bar shows it
function LandingThumb({ run, address, name, onEdit, previewHref, onPreview }) {
  return (
    <div className="wd-thumb">
      <div className="wd-thumb__bar">
        <span className="wd-thumb__dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span className="wd-thumb__url" aria-hidden="true">
          <Lock size={10} /> {address}
        </span>
        <a
          className="wd-thumb__preview"
          href={previewHref}
          target="_blank"
          rel="noopener"
          onClick={onPreview}
          aria-label="Preview the landing page (opens in a new tab)"
          data-tip="Preview"
          data-tip-align="end"
        >
          <Eye size={16} aria-hidden="true" />
        </a>
      </div>
      <div className="wd-thumb__view">
        <PageThumbnail answers={run.answers ?? {}} themeId={run.themeId ?? null} />
        <button type="button" className="wd-thumb__edit" onClick={onEdit} aria-label={`Edit the pages of ${name}`}>
          <span className="wd-thumb__pill">
            <Pencil size={16} aria-hidden="true" /> Edit webinar pages
          </span>
        </button>
      </div>
    </div>
  );
}

// ---------- Share and copy: two buttons under the title ----------
// The address itself isn't shown here: it's already in the picture's
// address bar (and 👁 opens it). These are just the two things coaches
// do with it.
//
//   [↗ Share webinar]  [🔗 Copy link]
//
// Share webinar opens the same pop-up as on the list (WhatsApp, the
// link and Copy, with a ready-made message). Copy link is one click,
// since coaches copy it often; it turns into "✓ Copied" for a moment.
// Share is left out once every session is over (the link then says the
// webinar has ended); Copy link stays.
function LinkActions({ url, onShare }) {
  const [copy, copyLink] = useCopy();
  const copied = copy === 'copied';
  return (
    <div className="wd__actions">
      <div className="wd__actions-row">
        {onShare && (
          <button type="button" className="wd__act" onClick={onShare}>
            <Share2 size={16} aria-hidden="true" /> Share webinar
          </button>
        )}
        <button
          type="button"
          className={`wd__act wd__act--quiet ${copied ? 'wd__act--done' : ''}`}
          onClick={() => copyLink(url)}
          aria-label={copied ? 'Link copied' : 'Copy the landing page link'}
        >
          {copied ? <Check size={16} strokeWidth={3} aria-hidden="true" /> : <Link2 size={16} aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy link'}
        </button>
      </div>
      <span className="oh__sr-only" aria-live="polite">
        {copied && 'Link copied'}
      </span>
      {copy === 'failed' && (
        <p className="oh__copy-error wd__copy-error" role="alert">
          Couldn’t copy. Open the page with 👁 and copy the address from the browser.
        </p>
      )}
    </div>
  );
}

// ---------- The tabs: Sessions | Emails ----------
// Underlined tabs at the top of the panel. Sessions shows how many there
// are; Emails holds the automatic emails.
function Tabs({ tab, onTab, sessions }) {
  const items = [
    { id: 'sessions', label: 'Sessions', count: sessions },
    { id: 'reminders', label: 'Emails', count: null }, // the automatic emails (WebinarReminders.jsx)
  ];
  // Left and right arrows move between the tabs
  const onKey = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const next = tab === 'sessions' ? 'reminders' : 'sessions';
    onTab(next);
    requestAnimationFrame(() => document.getElementById(`wd-tab-${next}`)?.focus());
  };
  return (
    <div className="wd__tabs" role="tablist" aria-label="Webinar" onKeyDown={onKey}>
      {items.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          id={`wd-tab-${t.id}`}
          aria-selected={tab === t.id}
          aria-controls={`wd-panel-${t.id}`}
          tabIndex={tab === t.id ? 0 : -1}
          className="wd__tab"
          onClick={() => onTab(t.id)}
        >
          {t.label} {t.count !== null && <span className="oh__count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}