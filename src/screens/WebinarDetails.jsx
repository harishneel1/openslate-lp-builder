import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarClock,
  CalendarX,
  Check,
  ChevronRight,
  Download,
  Eye,
  Link2,
  Share2,
  Lock,
  MessageCircle,
  Pencil,
  Play,
  Plus,
  Save,
  Search,
  UserMinus,
  Users,
  X,
} from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import Drawer from '../components/Drawer';
import InfoTip from '../components/InfoTip';
import { PriceWithDiscount } from '../components/CallDetailsInput';
import PageThumbnail from '../components/PageThumbnail';
import PixelStatus from '../components/PixelStatus';
import RecordingPanel from '../components/RecordingPanel';
import ActivityPanel from '../components/ActivityPanel';
import RescheduleDialog from '../components/RescheduleDialog';
import ShareDialog from '../components/ShareDialog';
import { useCopy } from './OfferingsHome';
import WebinarReminders from './WebinarReminders';
import { LinkMoves } from './CancelSession';
import { MeetingButton, useNow } from './WebinarsPage';
import { funnelTypes } from '../data/funnelTypes';
import {
  currentRun,
  durationMins,
  canCancel,
  isCancelled,
  isOnNow,
  linkAfterCancel,
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
import { attendingOf, isRemoved, keptOf, onSignupsChange, peopleCsv, peopleOf, removeOne } from '../data/webinarSignups';
import RowMenu from '../components/RowMenu';
import { onRecordingsChange, recordingOf } from '../data/recordings';
import { funnelName } from '../utils/funnelName';
import { liveHref } from '../utils/publish';
import { webinarShareMessage } from '../utils/shareMessage';
import { whatsappHref } from '../utils/whatsapp';
import './OfferingsHome.css'; // panels and buttons
import './CallsPage.css'; // the empty state
import './WebinarsPage.css'; // the meeting button and badges, as on the list
import '../components/QuestionInput.css'; // the price boxes, as in the webinar's own price screen
import './WebinarDetails.css';

// ------------------------------------------------------------
// One published webinar: where the coach comes back to run it. Drafts
// open the setup screen instead (App.jsx). A webinar runs in sessions:
// each session (a run, data/webinar.js) has its own date and people, and
// all of them share one link.
//
//   Fix the Vasthu mistakes that block     ┌ ● ● ● 🔒 site/slug        👁 ┐
//   money in your home…                    │                             │
//                                          │  their landing page, as on  │
//   [↗ Share webinar]  [🔗 Copy link]      │  a laptop, under a wash     │
//   📣 Running Meta ads? Connect your…     │                             │
//   ┌ 23            ₹22,977             ┐  │                             │
//   │ Registered ›  Collected ›         │  │                             │
//   │                                   │  │   [✎ Edit webinar pages]    │
//   │ 📅 Sat 31 Oct, 2:00 pm IST · Starts in 7 days  [Join meeting]    │
//   └───────────────────────────────────┘  └─────────────────────────────┘
//   (all on the page's grey, like every other page header)
//   ┌ Sessions 2 | Emails ──────────────────────────────────────────────┐
//   │ Session             Status                  Registered            │
//   │ Sat 31 Oct 2:00 pm  ● Coming up  🔗 link        0    See people > │
//   │ Sat 24 Oct 2:00 pm  Ended                       2    See people > │
//   │ + Add another session                                             │
//   └───────────────────────────────────────────────────────────────────┘
//
// One page for the whole webinar, whichever session App opened it on.
// The next session gets its own card (it's what coaches check every
// day). Every session is a row; a click opens it in a side panel
// (SessionDrawer) with its tabs: Manage people, Edit session (until it
// ends) and Recording.
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
// onEditPages(id), onSaveSession(id, changes) (Edit session: title and
// price; the date moves with Reschedule), onRunAgain(id) (copies that session),
// onPreview() (just before the preview tab opens). Sessions aren't deleted
// here (onDelete is unused): the whole webinar can be, from All webinars.
// openSession: { id, n, tab } from the bell: open that session in the side
//   panel on arrival, on Manage people (a sign-up line) or on Recording
//   (tab: 'recording', a recording line); onSessionOpened() once it has
// onToggleReminder(sessionId, id, on), onEditReminder(sessionId, id): the Emails tab
// onReschedule(id, { date, time }): Reschedule with nobody signed up: moves
//   it at once; returns false if it couldn't be moved
// onStartReschedule(id, { date, time }): with people signed up: the
//   reschedule page (the email they're sent) comes first
// onCancelSession(id): Cancel session with people signed up: the cancel
//   page (with the email); onCancelNow(id): with nobody, cancels at once
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
  onSaveSession,
  onRunAgain,
  onDelete,
  onPreview,
  openSession = null,
  onSessionOpened,
  onToggleReminder,
  onEditReminder,
  onCancelSession,
  onCancelNow,
  onReschedule,
  onStartReschedule,
}) {
  const now = useNow(15_000); // the countdown moves on every minute
  useSignupsTick(); // counts follow sign-ups, here or in another tab
  useRecordingsTick(); // recordings follow the Zoom room, in its own tab
  const name = funnelName(webinar, TYPE);
  const url = liveHref(webinar);
  // Every session of this webinar, and the one its link opens now
  const found = runsOf(webinar, webinars);
  const sessions = found.length > 0 ? found : [webinar];
  const linkRun = currentRun(seriesIdOf(webinar, webinars), webinars, now) ?? webinar;
  const next = webinarStatus(linkRun, now) !== 'past' ? linkRun : null; // null once every session is over
  const latest = sessions[sessions.length - 1]; // "Add another session" copies the latest
  // Pages and emails: the next session's (what the link shows), else the
  // latest that wasn't cancelled (a cancelled one sends nothing more)
  const latestHeld = [...sessions].reverse().find((r) => !isCancelled(r)) ?? latest;
  const current = next ?? latestHeld;
  const currentWhen = webinarWhen(current.answers ?? {});
  const currentDay = currentWhen ? `${currentWhen.weekday} ${currentWhen.day} ${currentWhen.month}` : 'the next session';
  const emailPeople = usePeople(current.id);
  const shownTab = tab === 'reminders' ? 'reminders' : 'sessions';

  const [openId, setOpenId] = useState(null); // the session open in the side panel
  const [openTab, setOpenTab] = useState('people'); // the tab it opened on
  const opened = sessions.find((r) => r.id === openId) ?? null;
  // Opens a session's side panel on the tab that fits the click: Activity
  // from its row (Manage session), Manage people from Registered or
  // Collected, Recording from the recording chip or the bell's recording
  // line. Manage people when none is named (the bell's other lines)
  const openAt = (id, at = 'people') => {
    setOpenTab(at);
    setOpenId(id);
  };
  const [sharing, setSharing] = useState(false); // the Share webinar pop-up

  // From the bell: that session, open on Manage people (a sign-up line)
  // or on Recording (a recording line)
  useEffect(() => {
    if (!openSession) return;
    if (sessions.some((r) => r.id === openSession.id)) openAt(openSession.id, openSession.tab ?? 'people');
    onSessionOpened?.();
    // Only when a new request comes in (n)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSession?.n]);

  useEffect(() => {
    document.title = name;
  }, [name]);

  return (
    <div className="oh wd">
      {/* The whole webinar: its name, its one link, its pages */}
      <header className="wd__head">
        <div className="wd__intro">
          <h1 className="wd__title">{name}</h1>
          <LinkActions url={url} onShare={() => setSharing(true)} />
          <NextSession run={next} name={name} now={now} onOpen={() => openAt(next.id)} onAdd={() => onRunAgain(latest.id)} />
        </div>
        <LandingThumb
          run={current}
          address={webinar.slug ? `${window.location.host}/${webinar.slug}` : shortLink(url)}
          name={name}
          ended={!next}
          onEdit={() => onEditPages(current.id)}
          previewHref={`?preview=${encodeURIComponent(current.id)}`}
          onPreview={onPreview}
        />
      </header>

      <section className="oh__panel wd__main" aria-label={shownTab === 'reminders' ? 'Emails' : 'Sessions'}>
        <div className="oh__panel-head wd__people-head">
          <Tabs tab={shownTab} onTab={onTab} sessions={sessions.length} />
          {/* At the top, so it's in reach however long the list gets */}
          {shownTab === 'sessions' && (
            <button type="button" className="wd__st-new" onClick={() => onRunAgain(latest.id)}>
              <Plus size={16} aria-hidden="true" /> Add session
            </button>
          )}
        </div>
        {shownTab === 'sessions' ? (
          <div id="wd-panel-sessions" role="tabpanel" aria-labelledby="wd-tab-sessions">
            <SessionsTable sessions={sessions} linkRunId={next?.id ?? null} now={now} onOpen={openAt} />
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
          // A new tab to open on (the bell, while it's open) starts it afresh
          key={`${opened.id}:${openTab}`}
          run={opened}
          initialTab={openTab}
          name={name}
          now={now}
          onClose={() => setOpenId(null)}
          onSave={(changes) => onSaveSession(opened.id, changes)}
          onPreview={onPreview}
          // The upcoming session the link moves to if this one is cancelled
          nextDay={(() => {
            const to = linkAfterCancel(opened, webinars.length > 0 ? webinars : sessions, now);
            return to ? dayOfRun(to) : null;
          })()}
          all={webinars.length > 0 ? webinars : sessions}
          onReschedule={(when) => onReschedule(opened.id, when)}
          onStartReschedule={(when) => onStartReschedule(opened.id, when)}
          onCancelSession={() => onCancelSession(opened.id)}
          onCancelNow={() => onCancelNow(opened.id)}
        />
      )}

      {sharing && (
        <ShareDialog
          heading="Share webinar"
          name={name}
          meta={
            next
              ? [webinarWhen(next.answers ?? {})?.line, webinarPrice(next.answers ?? {}).label].filter(Boolean).join(' · ')
              : 'No upcoming session'
          }
          url={url}
          message={webinarShareMessage(next ?? current, name, url, { upcoming: Boolean(next) })}
          onClose={() => setSharing(false)}
        />
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

// What a session's people paid in all, after any discount and less any
// refunds (rupees): what the coach keeps
function collectedOf(runId) {
  return peopleOf(runId).reduce((sum, p) => sum + keptOf(p), 0);
}

// '₹11,988'
const rupees = (n) => `₹${n.toLocaleString('en-IN')}`;

// Re-renders when someone signs up, here or in another tab
function useSignupsTick() {
  const [, setTick] = useState(0);
  useEffect(() => onSignupsChange(() => setTick((n) => n + 1)), []);
}

// Re-renders when a recording starts or stops (the Zoom room is its own
// tab). Processing turning into ready needs no event: the page's clock
// (useNow) moves on and recordingOf works it out again.
function useRecordingsTick() {
  const [, setTick] = useState(0);
  useEffect(() => onRecordingsChange(() => setTick((n) => n + 1)), []);
}

// ---------- The next session: a card in the header, under the link ----------
// Light orange, the same every day: the one thing coaches check daily.
// Join meeting is the one filled orange button in the header (the button
// itself turns into Start webinar / Live now near the time, as on the list).
//
//   ┌─────────────────────────────────────────────────────────────────┐
//   │ 23              ₹22,977                                         │
//   │ Registered ›    Collected ›                                     │
//   │ ─────────────────────────────────────────────────────────────── │
//   │ 📅 Sat 31 Oct, 2:00 pm IST · Starts in 7 days    [Join meeting] │
//   └─────────────────────────────────────────────────────────────────┘
//
// The numbers lead: they're what a coach checks every day. Each number
// is a button that opens this session's people (Manage people), so
// there's no separate link. No status pill either: "Starts in" says
// registrations are open, and on the day the countdown turns to Live
// now (the sessions table's badge still says it in words).
// Collected only for a paid session: what its people paid in all. A free
// one shows Registered alone, in the same row, so the card keeps its shape.
// With nothing coming up, the same card says so and offers to add a session.
function NextSession({ run, name, now, onOpen, onAdd }) {
  // Nothing coming up: a short, quiet card (white, grey edge), the text on
  // the left and the one orange button on the right. Being short, it keeps
  // the hero (and the page picture beside it, which matches its height) compact.
  //   ┌──────────────────────────────────────────────────────────────┐
  //   │ No upcoming session                                           │
  //   │ Your landing page shows that this webinar has ended. [+ Add session] │
  //   └──────────────────────────────────────────────────────────────┘
  if (!run) {
    return (
      <section className="wd__next wd__next--none" aria-labelledby="wd-next-title">
        <div className="wd__next-none-text">
          <h2 className="wd__next-title wd__next-title--none" id="wd-next-title">
            No upcoming session
          </h2>
          <p className="wd__next-text">Your landing page shows that this webinar has ended.</p>
        </div>
        <button type="button" className="oh__add wd__next-add" onClick={onAdd}>
          <Plus size={16} aria-hidden="true" /> Add session
        </button>
      </section>
    );
  }
  const answers = run.answers ?? {};
  const today = dayOf(answers, now);
  const count = attendingOf(run.id).length; // who's coming: removed people aren't
  const paid = !webinarPrice(answers).isFree;
  // The big numbers: Registered always, Collected for a paid session
  const stats = [
    { label: 'Registered', value: count.toLocaleString('en-IN') },
    paid && { label: 'Collected', value: rupees(collectedOf(run.id)) },
  ].filter(Boolean);
  return (
    <section className="wd__next" aria-label="Next session">
      {/* The numbers are the buttons: each opens this session's people */}
      <div className="wd__next-stats">
        {stats.map((st) => (
          <button
            key={st.label}
            type="button"
            className="wd__next-stat"
            onClick={onOpen}
            aria-label={`${st.value} ${st.label.toLowerCase()}. Manage people`}
          >
            <span className="wd__next-value">{st.value}</span>
            <span className="wd__next-key">
              {st.label} <ChevronRight size={14} aria-hidden="true" />
            </span>
          </button>
        ))}
      </div>
      <div className="wd__next-foot">
        <div className="wd__next-when">
          <CalendarClock size={16} aria-hidden="true" />
          <span>
            {dayOfRun(run) ?? 'No date yet'}
            {timeOfRun(run) ? `, ${timeOfRun(run)}` : ''}
          </span>
          {today ? (
            <Countdown day={today} />
          ) : (
            <span className="wd__next-soon">
              <span aria-hidden="true">· </span>
              {startsIn(answers, now)}
            </span>
          )}
        </div>
        <MeetingButton state={meetingState(answers, now)} href={meetingHref(run.id)} name={name} liveLabel="Rejoin meeting" />
      </div>
    </section>
  );
}

// ---------- Sessions: every date, as a full-width table ----------
// Coming up first (soonest at the top), then past ones (latest first).
// Clicking a row opens that session in a side panel, on its Activity tab;
// its Manage session button does the same from the keyboard.
// Adding a session is the + Add session button at the top right of the
// panel, beside the tabs, so it's in reach however long the list gets.
//
//   Session              Status                   Registered  Collected
// ▌ Mon 9 Nov 7:00 pm    ● Registrations open (i)      12     ₹11,988   Manage session >
//   Mon 16 Nov 7:00 pm   Scheduled                      0     ₹0        Manage session >
//   Mon 2 Nov 7:00 pm    Ended                          2     Free      Manage session >
//
// The session the landing page link takes registrations for (linkRunId)
// is the one marked: the only orange badge, on a light orange row with an
// orange edge, like the upcoming session card. Its (i) says what the
// landing page shows now: "Your landing page shows this session: Mon 9 Nov,
// 7:00 pm IST · ₹999". While it's on, it says Live now instead. Every
// later one is Scheduled, in grey.
//
// With GROUP_AT sessions or more, the rows come in groups: Next up (or
// Happening now), Later · 10, and Ended · 4, which starts folded away.
//
// Collected (what each session's people paid in all) shows once any
// session is paid, or anyone has paid; a free session's row says Free.
//
// Once a session's recording is ready, its row says so beside its status:
//   Mon 2 Nov 7:00 pm    Ended  [▶ View recording]   2   Free   Manage session >
// A button that opens the side panel on its Recording tab. Until it's
// ready, nothing here; the tab itself says it isn't ready yet.
const GROUP_AT = 10;

function SessionsTable({ sessions, linkRunId, now, onOpen }) {
  const [endedOpen, setEndedOpen] = useState(false);
  const isPast = (r) => webinarStatus(r, now) === 'past';
  const upcoming = sessions.filter((r) => !isPast(r));
  const ended = sessions.filter(isPast).reverse();
  const money = sessions.some((r) => !webinarPrice(r.answers ?? {}).isFree || collectedOf(r.id) > 0);
  const linkRun = upcoming.find((r) => r.id === linkRunId) ?? null;
  const later = upcoming.filter((r) => r.id !== linkRunId);
  const linkLive = linkRun ? isOnNow(linkRun.answers ?? {}, now) : false;

  const row = (r) => (
    <SessionRow key={r.id} run={r} now={now} isLink={r.id === linkRunId} money={money} onOpen={onOpen} />
  );

  const grouped = sessions.length >= GROUP_AT;

  return (
    <div className={`wd__st ${money ? 'wd__st--money' : ''}`}>
      <div className="wd__st-row wd__st-row--head" aria-hidden="true">
        <span>Session</span>
        <span>Status</span>
        <span>Registered</span>
        {money && <span>Collected</span>}
        <span />
      </div>

      {grouped ? (
        <>
          {linkRun && (
            <section aria-label={linkLive ? 'Happening now' : 'Next up'}>
              <h3 className="wd__st-group">{linkLive ? 'Happening now' : 'Next up'}</h3>
              <ul className="wd__st-list">{row(linkRun)}</ul>
            </section>
          )}
          {later.length > 0 && (
            <section aria-label="Later">
              <h3 className="wd__st-group">
                Later <span className="wd__st-group-count">· {later.length}</span>
              </h3>
              <ul className="wd__st-list">{later.map(row)}</ul>
            </section>
          )}
          {ended.length > 0 && (
            <section aria-label="Ended">
              <h3 className="wd__st-group wd__st-group--toggle">
                <button
                  type="button"
                  className="wd__st-group-btn"
                  aria-expanded={endedOpen}
                  aria-controls="wd-st-ended"
                  onClick={() => setEndedOpen((o) => !o)}
                >
                  Ended <span className="wd__st-group-count">· {ended.length}</span>
                  <ChevronRight
                    size={15}
                    aria-hidden="true"
                    className={`wd__st-group-chev ${endedOpen ? 'wd__st-group-chev--open' : ''}`}
                  />
                </button>
              </h3>
              {endedOpen && (
                <ul className="wd__st-list" id="wd-st-ended">
                  {ended.map(row)}
                </ul>
              )}
            </section>
          )}
        </>
      ) : (
        <ul className="wd__st-list">{[...upcoming, ...ended].map(row)}</ul>
      )}
    </div>
  );
}

// One session's row. The row is clickable as a whole; Manage session is the
// real button (for the keyboard and screen readers), so the (i) inside the
// row can be a button of its own.
function SessionRow({ run: r, now, isLink, money, onOpen }) {
  const answers = r.answers ?? {};
  const cancelled = isCancelled(r); // counts as past (data/webinar.js)
  const live = !cancelled && isOnNow(answers, now);
  const past = webinarStatus(r, now) === 'past';
  const label = cancelled ? 'Cancelled' : live ? 'Live now' : past ? 'Ended' : isLink ? 'Registrations open' : 'Scheduled';
  const tone = live || isLink ? 'wd__st-badge--link' : '';
  const count = attendingOf(r.id).length; // who's coming: removed people aren't
  const collected = collectedOf(r.id);
  const free = webinarPrice(answers).isFree && collected === 0;
  const moneyText = money ? (free ? 'Free' : rupees(collected)) : null;
  const day = dayOfRun(r) ?? 'No date yet';
  const rec = recordingOf(r.id, now);
  const open = () => onOpen(r.id, 'activity'); // the row and Manage session: Activity first
  const recSaid = rec.status === 'ready' ? ', recording ready' : '';
  // The (i) beside Registrations open: what the landing page shows now
  const linkTip = (
    <>
      Your landing page shows this session:
      <strong className="wd__st-tip-line">
        {[webinarWhen(answers)?.line, webinarPrice(answers).label].filter(Boolean).join(' · ')}
      </strong>
    </>
  );
  return (
    <li>
      <div className={`wd__st-row wd__st-row--click ${isLink ? 'wd__st-row--link' : ''}`} onClick={open}>
        <span className="wd__st-when">
          <span className="wd__st-day">{day}</span>
          <span className="wd__st-time">{timeOfRun(r)}</span>
        </span>
        <span className="wd__st-status">
          <span className={`wb-badge ${tone}`}>
            {(live || isLink) && <span className="wb-badge__dot" aria-hidden="true" />}
            {label}
          </span>
          {isLink && !live && (
            // A click on the (i) explains; it doesn't open the session
            <span className="wd__st-tip" onClick={(e) => e.stopPropagation()}>
              <InfoTip label="Registrations open" text={linkTip} />
            </span>
          )}
          <RecordingChip status={rec.status} onOpen={() => onOpen(r.id, 'recording')} />
        </span>
        <span className="wd__st-count">{count}</span>
        {money && <span className={`wd__st-money ${free ? 'wd__st-money--free' : ''}`}>{moneyText}</span>}
        <button
          type="button"
          className="wd__st-go"
          onClick={(e) => {
            e.stopPropagation();
            open();
          }}
          aria-label={`Manage session: ${day}, ${label}${recSaid}, ${count} registered${
            moneyText ? `, ${free ? 'free' : `${moneyText} collected`}` : ''
          }`}
        >
          Manage session <ChevronRight size={15} aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}

// View recording, once the recording is ready (Zoom can take hours or
// days); nothing before that. The drawer's Recording tab says when it
// isn't ready. It stops the click reaching the row, so it opens on
// Recording rather than Activity.
function RecordingChip({ status, onOpen }) {
  if (status !== 'ready') return null;
  return (
    <button
      type="button"
      className="wd__rec-chip"
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
    >
      <Play size={11} fill="currentColor" aria-hidden="true" /> View recording
    </button>
  );
}

// ---------- One session, in a side panel ----------
// Opened from its row (or Manage people on the upcoming session card,
// the recording chip on its row, or a line in the bell).
// Its meeting button sits under the title; under that, its tabs:
//
//   Session on Mon 9 Nov                                   ✕
//   7:00 pm IST · 60 min · Free · Starts in 14 days
//   [Join meeting]
//   ────────────────────────────────────────────────────────
//    Activity  |  Manage people 3  |  Edit session  |  Recording
//
// Manage people: everyone who signed up, one line each (name, email and
// phone; when they signed up and WhatsApp on the right). The footer has
// Download CSV (asks first, in a pop-up).
// Edit session: the quick edit (SessionEdit). Its footer has Cancel and
// Save changes. Past sessions have no Edit session: they're a record
// of what happened.
// Recording: the session's Zoom recording (RecordingPanel). Always there:
// the recording once it's ready, else a short message saying where it is
// (coming after the session, recording now, not ready yet, not recorded).
// Only the coach sees it.
// Edits stay while switching tabs; closing with unsaved edits asks first.
// Saving shows a small pop-up that points them at the landing page:
//
//   ✓ Changes saved
//   Your landing page is updated. Take a look to see how it reads.
//                                   [Close] [View landing page]
//
// View landing page opens this session's preview in a new tab (as 👁 on
// the thumbnail does); the panel stays open on Edit session. A click
// outside doesn't close the pop-up; Close and Escape do.
//
// initialTab: 'people' (default), 'edit', 'recording' or 'activity'; one it doesn't
//   have (Edit session on a past session) opens Manage people instead
// onSave(changes): { date, time, headline, subheadline, pricing, price, oldPrice }
// onPreview(): just before the preview tab opens
//
// Just after a reschedule (from the email page, or at once with nobody
// registered), a toast at the bottom says it's done:
//   ┌───────────────────────────────────────────────────────┐
//   │ ✓  Rescheduled to Sat 14 Nov, 8:30 pm IST           ✕ │
//   │    Email sent to 1 person            View activity ›  │
//   └───────────────────────────────────────────────────────┘
// It stays until they switch tabs (View activity included) or close the
// panel, or dismiss it with ✕. The full record (every move, who was
// emailed) is on the Activity tab.
function SessionDrawer({
  run,
  name,
  now,
  initialTab = 'people',
  onClose,
  onSave,
  onPreview,
  onCancelSession,
  onCancelNow,
  onReschedule,
  onStartReschedule,
  all = [],
  nextDay = null,
}) {
  const people = usePeople(run.id); // everyone who signed up, removed people included
  const attending = people.filter((p) => !isRemoved(p)); // who's coming
  const answers = run.answers ?? {};
  const ended = webinarStatus(run, now) === 'past';
  const price = webinarPrice(answers);
  const day = dayOfRun(run);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState(initialTab); // 'activity' | 'people' | 'edit' | 'recording'
  const recording = recordingOf(run.id, now);
  const tabs = ['activity', 'people', !ended && 'edit', 'recording'].filter(Boolean);
  const shownTab = tabs.includes(tab) ? tab : 'people';

  // The edit form's values: what's saved, until they change something
  const savedKey = JSON.stringify(editValues(answers));
  const saved = useMemo(() => JSON.parse(savedKey), [savedKey]);
  const [form, setForm] = useState(saved);
  const [formKey, setFormKey] = useState(0); // a new one resets the price boxes' own tick
  const [savedPopup, setSavedPopup] = useState(false); // "Changes saved" pop-up
  // "Discard your changes?", before closing ('close') or cancelling ('cancel')
  const [asking, setAsking] = useState(null);
  const [cancelEmpty, setCancelEmpty] = useState(false); // "Cancel this session?" with nobody signed up
  const [moving, setMoving] = useState(false); // the Reschedule pop-up
  const [downloading, setDownloading] = useState(false); // "Download the people who signed up?"
  const [menuFor, setMenuFor] = useState(null); // the person whose ⋯ menu is open
  const [removing, setRemoving] = useState(null); // "Remove Priya and refund them?"
  const moved = useMovedToast(run, shownTab);
  const cancelled = isCancelled(run);
  const live = !cancelled && isOnNow(answers, now);
  // A save (or a change made elsewhere) brings the form back in line
  useEffect(() => setForm(saved), [saved]);

  const dirty = !ended && changedKeys(saved, form).length > 0;
  const problem = editProblem(answers, form);

  const save = () => {
    if (!dirty || problem) return;
    onSave(cleanValues(form));
    setSavedPopup(true);
    setFormKey((k) => k + 1);
  };
  const close = () => (dirty ? setAsking('close') : onClose());

  // Cancel session: with people signed up, the cancel page (the email);
  // with nobody, a short "are you sure". Unsaved edits ask first.
  const startCancel = () => {
    if (attending.length > 0) onCancelSession(); // removed people aren't emailed
    else setCancelEmpty(true);
  };
  const askCancel = () => (dirty ? setAsking('cancel') : startCancel());
  // Reschedule: the pop-up with the date and time. Unsaved edits ask first.
  const askMove = () => (dirty ? setAsking('reschedule') : setMoving(true));

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

  // The list, split: who's coming, then people removed
  const shownAttending = shown.filter((p) => !isRemoved(p));
  const shownRemoved = shown.filter(isRemoved);
  // Removing people: until the session is cancelled (then it's over, and
  // everyone who paid was already refunded or not, as chosen)
  const canRemove = !cancelled;

  // Nobody signed up (or nobody still coming, once everyone was removed)
  const emptyPeople = (
    <div className="calls__empty">
      <span className="calls__empty-icon" aria-hidden="true">
        <Users size={22} />
      </span>
      <h3 className="calls__empty-title">
        {cancelled ? 'No one had signed up' : ended ? 'No one signed up for this session' : 'No one has signed up yet'}
      </h3>
      {!ended && <p className="calls__empty-text">Share your landing page link. People who sign up will show up here.</p>}
    </div>
  );

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

  const sub = [timeOfRun(run), lengthLabel(answers), price.label, isCancelled(run) ? 'Cancelled' : ended ? 'Ended' : startsIn(answers, now)]
    .filter(Boolean)
    .join(' · ');

  // Download CSV once anyone signed up. Sessions can't be deleted: one
  // with people is cancelled instead, and stays as a record.
  const peopleFooter =
    people.length > 0 ? (
      <button type="button" className="oh__edit" onClick={() => setDownloading(true)}>
        <Download size={15} aria-hidden="true" /> Download CSV
      </button>
    ) : null;

  const editFooter = (
    <>
      <div className="wd-edit__buttons">
        <button
          type="button"
          className="oh__edit"
          onClick={() => {
            setForm(saved);
            setFormKey((k) => k + 1);
          }}
          disabled={!dirty}
        >
          Cancel
        </button>
        <button type="button" className="oh__add" onClick={save} disabled={!dirty || Boolean(problem)}>
          <Save size={15} aria-hidden="true" /> Save changes
        </button>
      </div>
    </>
  );

  return (
    <Drawer
      className="wd-drawer"
      title={`Session on ${day ?? 'a date to be set'}`}
      sub={sub}
      onClose={close}
      extra={
        cancelled ? (
          <CancelledSummary cancelled={run.cancelled} />
        ) : ended ? null : (
          <>
          <div className="wd-drawer__actions">
            <MeetingButton state={meetingState(answers, now)} href={meetingHref(run.id)} name={name} liveLabel="Rejoin meeting" />
            {live ? (
              // Can't move it while it's on: says why on hover and focus
              <button
                type="button"
                className="oh__edit wd-drawer__move"
                aria-disabled="true"
                data-tip="It’s happening now, so it can’t be moved."
              >
                <CalendarClock size={15} aria-hidden="true" /> Reschedule
              </button>
            ) : (
              canCancel(run, now) && (
                <button type="button" className="oh__edit wd-drawer__move" onClick={askMove}>
                  <CalendarClock size={15} aria-hidden="true" /> Reschedule
                </button>
              )
            )}
            {live ? (
              // Can't cancel while it's on: says why on hover and focus
              <button
                type="button"
                className="oh__edit wd-drawer__cancel"
                aria-disabled="true"
                data-tip="It’s happening now. End it in Zoom instead."
              >
                <CalendarX size={15} aria-hidden="true" /> Cancel session
              </button>
            ) : (
              canCancel(run, now) && (
                <button type="button" className="oh__edit wd-drawer__cancel" onClick={askCancel}>
                  <CalendarX size={15} aria-hidden="true" /> Cancel session
                </button>
              )
            )}
          </div>
          </>
        )
      }
      footer={shownTab === 'edit' ? editFooter : shownTab === 'people' ? peopleFooter : null}
      notice={
        moved.shown && (
          <MovedToast
            line={moved.shown.line}
            emailedTo={moved.shown.emailedTo}
            onActivity={
              shownTab === 'activity'
                ? null
                : () => {
                    setTab('activity');
                    moved.dismiss();
                  }
            }
            onClose={moved.dismiss}
          />
        )
      }
    >
      <SessionTabs tab={shownTab} onTab={setTab} people={attending.length} canEdit={!ended} />

      {shownTab === 'activity' ? (
        <div id="wd-drawer-panel-activity" role="tabpanel" aria-labelledby="wd-drawer-tab-activity">
          <ActivityPanel run={run} people={people} now={now} onOpen={setTab} />
        </div>
      ) : shownTab === 'recording' ? (
        <div id="wd-drawer-panel-recording" role="tabpanel" aria-labelledby="wd-drawer-tab-recording">
          <RecordingPanel recording={recording} ended={ended} cancelled={cancelled} title={name} day={day} />
        </div>
      ) : shownTab === 'edit' ? (
        <div id="wd-drawer-panel-edit" role="tabpanel" aria-labelledby="wd-drawer-tab-edit">
          <SessionEdit
            key={formKey}
            answers={answers}
            saved={saved}
            form={form}
            onForm={setForm}
            problem={problem}
            day={day}
            people={people.length}
            onSubmit={save}
          />
        </div>
      ) : (
        <div id="wd-drawer-panel-people" role="tabpanel" aria-labelledby="wd-drawer-tab-people">
          {people.length > 5 && (
            <div className="wd-drawer__top">
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
            </div>
          )}

        {people.length === 0 ? (
          emptyPeople
        ) : shown.length === 0 ? (
          <div className="calls__empty">
            <h3 className="calls__empty-title">No one matches “{query.trim()}”</h3>
            <button type="button" className="oh__edit" onClick={() => setQuery('')}>
              <X size={15} aria-hidden="true" /> Clear search
            </button>
          </div>
        ) : (
          <>
            {/* Who's coming. Each has a ⋯ with Remove (and refund, when they
                paid), until the session is cancelled. */}
            {shownAttending.length > 0 ? (
              <ul className={`wd-people ${canRemove ? 'wd-people--menus' : ''}`}>
                {shownAttending.map((p) => (
                  <PersonRow
                    key={p.id}
                    person={p}
                    runId={run.id}
                    now={now}
                    menu={
                      canRemove ? (
                        <RowMenu
                          title={p.name}
                          open={menuFor === p.id}
                          onOpenChange={(open) => setMenuFor(open ? p.id : null)}
                          items={[
                            {
                              label: p.amount > 0 && !p.refundedAt ? 'Remove and refund' : 'Remove',
                              icon: UserMinus,
                              danger: true,
                              onSelect: () => {
                                setMenuFor(null);
                                setRemoving(p);
                              },
                            },
                          ]}
                        />
                      ) : null
                    }
                  />
                ))}
              </ul>
            ) : (
              // Nobody still coming (everyone was removed): the usual empty
              // state, with the Removed section under it
              !query.trim() && emptyPeople
            )}

            {/* Removed: a record, under who's coming, always open */}
            {shownRemoved.length > 0 && (
              <section className="wd-removed" aria-labelledby="wd-removed-title">
                <h3 className="wd-removed__head" id="wd-removed-title">
                  Removed <span className="oh__count">{shownRemoved.length}</span>
                </h3>
                <ul className="wd-people wd-people--removed">
                  {shownRemoved.map((p) => (
                    <PersonRow key={p.id} person={p} runId={run.id} now={now} />
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
        </div>
      )}

      {asking && (
        <ConfirmDialog
          title="Discard your changes?"
          confirmLabel="Discard changes"
          cancelLabel="Keep editing"
          danger
          onCancel={() => setAsking(null)}
          onConfirm={() => {
            const next = asking;
            setAsking(null);
            if (next === 'cancel' || next === 'reschedule') {
              setForm(saved);
              setFormKey((k) => k + 1);
              if (next === 'cancel') startCancel();
              else setMoving(true);
            } else onClose();
          }}
        >
          <p>You changed this session but haven’t saved it.</p>
        </ConfirmDialog>
      )}

      {moving && (
        <RescheduleDialog
          run={run}
          all={all}
          people={people.length}
          onCancel={() => setMoving(false)}
          onConfirm={(when) => {
            setMoving(false);
            // With people signed up, the email page first; with nobody, at once
            if (people.length > 0) onStartReschedule(when);
            else onReschedule(when);
          }}
        />
      )}

      {cancelEmpty && (
        <ConfirmDialog
          title={`Cancel the session on ${day ?? 'this date'}?`}
          confirmLabel="Cancel session"
          cancelLabel="Go back"
          danger
          // A stray click outside doesn't close it; Go back and Escape do
          stayOpen
          onCancel={() => setCancelEmpty(false)}
          onConfirm={() => {
            setCancelEmpty(false);
            onCancelNow();
          }}
        >
          <p>
            Nobody has signed up yet. <LinkMoves nextDay={nextDay} />
          </p>
        </ConfirmDialog>
      )}

      {removing && (
        <RemoveDialog
          key={removing.id}
          person={removing}
          onCancel={() => setRemoving(null)}
          onRemove={(refund) => {
            removeOne(run.id, removing.id, { refund });
            setRemoving(null);
          }}
        />
      )}

      {downloading && (
        <ConfirmDialog
          title="Download the people who signed up?"
          confirmLabel="Download CSV"
          // A stray click outside doesn't close it; ✕, Cancel and Escape do
          stayOpen
          closeButton
          onCancel={() => setDownloading(false)}
          onConfirm={() => {
            setDownloading(false);
            download();
          }}
        >
          <p>
            You'll get a CSV file with{' '}
            {people.length === 1
              ? 'the name, email and phone number of 1 person'
              : `the names, emails and phone numbers of ${people.length} people`}
            .
          </p>
        </ConfirmDialog>
      )}

      {savedPopup && (
        <ConfirmDialog
          title={
            <span className="wd-saved__title">
              <span className="wd-saved__tick" aria-hidden="true">
                <Check size={15} strokeWidth={3} />
              </span>
              Changes saved
            </span>
          }
          form // a click outside doesn't close it; Close and Escape do
          confirmLabel="View landing page"
          cancelLabel="Close"
          onCancel={() => setSavedPopup(false)}
          onConfirm={() => {
            setSavedPopup(false);
            onPreview?.();
            window.open(`?preview=${encodeURIComponent(run.id)}`, '_blank', 'noopener');
          }}
        >
          <p>Your landing page is updated. Take a look to see how it reads.</p>
        </ConfirmDialog>
      )}
    </Drawer>
  );
}

// ---------- One person in Manage people ----------
// Name (with a Refunded badge once refunded, which opens the refund's
// details in a new tab), email and phone; when they signed up (or were
// removed) and what they paid; WhatsApp; and the ⋯ (menu) for people
// still coming. Removed people's rows are quieter (CSS) and have no ⋯.
function PersonRow({ person: p, runId, now, menu = null }) {
  const first = p.name.split(/\s+/)[0] || p.name;
  const chat = whatsappHref(p.phone, `Hi ${first}, `);
  const removed = isRemoved(p);
  const back = (p.refunded ?? p.amount).toLocaleString('en-IN');
  return (
    <li className="wd-person">
      <div className="wd-person__text">
        <p className="wd-person__name">
          {p.name}
          {p.refundedAt && (
            <a
              className="wd-person__badge"
              href={`?mock=refund&webinar=${encodeURIComponent(runId)}&person=${encodeURIComponent(p.id)}`}
              target="_blank"
              rel="noopener"
              aria-label={`Refunded ₹${back}. See refund details (opens in a new tab)`}
            >
              Refunded ₹{back}
            </a>
          )}
        </p>
        <p className="wd-person__contact">
          <a className="wd__email" href={`mailto:${p.email}`}>
            {p.email}
          </a>
          {p.phone && <span> · {p.phone}</span>}
        </p>
      </div>
      <div className="wd-person__side">
        <span className="wd-person__when">
          {removed ? `Removed ${registeredWhen(p.removedAt, now).replace(/^(Today|Yesterday)/, (d) => d.toLowerCase())}` : registeredWhen(p.registeredAt, now)}
        </span>
        {/* What they paid, refunded or not (the badge says what went back) */}
        {p.amount > 0 && <span className="wd-person__paid">₹{p.amount.toLocaleString('en-IN')}</span>}
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
      {menu}
    </li>
  );
}

// ---------- Remove one person (and refund them) ----------
//
//   Remove Harish Neel and refund them?
//   They won't get any more emails about this session.
//   They paid ₹499. The refund usually reaches them in 5 to 7 working days.
//   ☐ Refund part of it
//      ₹ [ 200 ]                 (once ticked)
//                       [Go back] [Remove and refund ₹499 → ₹200]
//
// Someone who didn't pay (or was refunded already) is just removed:
//   Remove Harish Neel?  They won't get any more emails about this session.
// A part refund is more than ₹0 and less than what they paid; the button
// does nothing until it's one that works. Nobody is emailed about it: the
// coach tells them. A stray click outside doesn't close it; Go back and
// Escape do.
function RemoveDialog({ person, onCancel, onRemove }) {
  const paid = person.amount;
  const refunds = paid > 0 && !person.refundedAt;
  const money = (n) => `₹${n.toLocaleString('en-IN')}`;
  const [partial, setPartial] = useState(false);
  const [amount, setAmount] = useState(''); // digits only
  const value = Number(amount) || 0;
  const tooHigh = partial && value >= paid;
  const ready = !refunds || !partial || (value > 0 && !tooHigh);
  const remove = () => ready && onRemove(refunds && partial ? value : null);

  // Ticked: straight into the amount box
  const input = useRef(null);
  useEffect(() => {
    if (partial) input.current?.focus();
  }, [partial]);

  if (!refunds) {
    return (
      <ConfirmDialog
        title={`Remove ${person.name}?`}
        confirmLabel="Remove"
        cancelLabel="Go back"
        danger
        stayOpen
        onCancel={onCancel}
        onConfirm={remove}
      >
        <p>They won’t get any more emails about this session.</p>
      </ConfirmDialog>
    );
  }

  return (
    <ConfirmDialog
      title={`Remove ${person.name} and refund them?`}
      confirmLabel={partial ? (ready ? `Remove and refund ${money(value)}` : 'Remove and refund') : `Remove and refund ${money(paid)}`}
      cancelLabel="Go back"
      danger
      confirmDisabled={!ready}
      stayOpen
      onCancel={onCancel}
      onConfirm={remove}
    >
      <p>They won’t get any more emails about this session.</p>
      <p>They paid {money(paid)}. The refund usually reaches them in 5 to 7 working days.</p>
      <label className="wd-refund__check">
        <input type="checkbox" checked={partial} onChange={(e) => setPartial(e.target.checked)} />
        Refund part of it
      </label>
      {partial && (
        <div className="wd-refund__amount">
          <span className="qinput__money">
            <span className="qinput__currency" aria-hidden="true">
              ₹
            </span>
            <input
              ref={input}
              inputMode="numeric"
              className={`qinput__text qinput__money-input ${tooHigh ? 'qinput__text--error' : ''}`}
              aria-label="Amount to refund, in rupees"
              aria-invalid={tooHigh || undefined}
              aria-describedby={tooHigh ? 'wd-refund-error' : undefined}
              value={amount}
              maxLength={6}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, '').replace(/^0+/, ''))}
              onKeyDown={(e) => e.key === 'Enter' && remove()}
            />
          </span>
          {tooHigh && (
            <p className="qinput__error" id="wd-refund-error">
              Enter an amount less than {money(paid)}.
            </p>
          )}
        </div>
      )}
    </ConfirmDialog>
  );
}

// ---------- "Rescheduled" toast ----------
// A move shows its toast once: the first time a session's panel sees it,
// and only while it's fresh (a minute), so reopening the session later,
// or a reload, doesn't bring it back. Kept outside React so it survives
// the panel being closed and opened again.
// It stays put until the panel moves to another tab, the panel closes
// (it goes with it), or ✕.
const MOVE_FRESH_MS = 60_000;
const movesShown = new Set();

function useMovedToast(run, tab) {
  const movedAt = run.rescheduled?.at ?? null;
  const [shown, setShown] = useState(null); // { line, emailedTo }
  useEffect(() => {
    if (!movedAt || movesShown.has(movedAt) || Date.now() - movedAt > MOVE_FRESH_MS) return;
    movesShown.add(movedAt);
    const when = webinarWhen(run.answers ?? {});
    setShown({ line: when?.line ?? dayOfRun(run) ?? 'the new date', emailedTo: run.rescheduled.emailedTo ?? 0 });
    // Only for a new move
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movedAt]);
  // Another tab: it's done its job. The ref keeps the first render (and a
  // dev double-run) from counting as a switch.
  const lastTab = useRef(tab);
  useEffect(() => {
    if (lastTab.current === tab) return;
    lastTab.current = tab;
    setShown(null);
  }, [tab]);
  return { shown, dismiss: () => setShown(null) };
}

// line: the new date, "Sat 14 Nov, 8:30 pm IST"; emailedTo: how many were
// told (0 leaves the line off); onActivity: null on the Activity tab itself
function MovedToast({ line, emailedTo, onActivity, onClose }) {
  return (
    <div className="wd-toast" role="status">
      <span className="wd-toast__tick" aria-hidden="true">
        <Check size={14} strokeWidth={3} />
      </span>
      <div className="wd-toast__text">
        <strong className="wd-toast__title">Rescheduled to {line}</strong>
        {(emailedTo > 0 || onActivity) && (
          <span className="wd-toast__row">
            {emailedTo > 0 && (
              <span className="wd-toast__sub">
                Email sent to {emailedTo} {emailedTo === 1 ? 'person' : 'people'}
              </span>
            )}
            {onActivity && (
              <button type="button" className="wd-toast__link" onClick={onActivity}>
                View activity <ChevronRight size={14} aria-hidden="true" />
              </button>
            )}
          </span>
        )}
      </div>
      <button type="button" className="wd-toast__close" aria-label="Dismiss" onClick={onClose}>
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

// What happened when a session was cancelled, under its title:
//   Cancelled on 28 Oct, 3:50 pm
//   Email sent to 23 people · ₹22,977 refunded to 23 people
function CancelledSummary({ cancelled }) {
  const at = new Date(cancelled.at);
  const when = `${at.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${at
    .toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
    .toLowerCase()}`;
  const n = cancelled.emailedTo ?? 0;
  const parts = [
    n > 0 ? `Email sent to ${n} ${n === 1 ? 'person' : 'people'}` : 'Nobody had signed up',
    cancelled.refund
      ? `${rupees(cancelled.refund.total)} refunded to ${cancelled.refund.count} ${cancelled.refund.count === 1 ? 'person' : 'people'}${
          cancelled.refund.each ? `, ${rupees(cancelled.refund.each)} each` : ''
        }`
      : null,
  ].filter(Boolean);
  return (
    <div className="wd-drawer__cancelled">
      <p className="wd-drawer__cancelled-title">
        <CalendarX size={16} aria-hidden="true" /> Cancelled on {when}
      </p>
      <p className="wd-drawer__cancelled-text">{parts.join(' · ')}</p>
    </div>
  );
}

// The tabs at the top of the side panel: Activity always first, then
// Manage people, Edit session and Recording. Past sessions have no Edit
// session; the rest are always there. Left and right arrows move between
// them, wrapping round.
function SessionTabs({ tab, onTab, people, canEdit }) {
  const items = [
    { id: 'activity', label: 'Activity', count: null },
    { id: 'people', label: 'Manage people', count: people },
    canEdit && { id: 'edit', label: 'Edit session', count: null },
    { id: 'recording', label: 'Recording', count: null },
  ].filter(Boolean);
  const onKey = (e) => {
    if (items.length < 2 || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    const at = Math.max(0, items.findIndex((t) => t.id === tab));
    const step = e.key === 'ArrowRight' ? 1 : -1;
    const next = items[(at + step + items.length) % items.length].id;
    onTab(next);
    requestAnimationFrame(() => document.getElementById(`wd-drawer-tab-${next}`)?.focus());
  };
  return (
    <div className="wd__tabs wd-drawer__tabs" role="tablist" aria-label="Session" onKeyDown={onKey}>
      {items.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          id={`wd-drawer-tab-${t.id}`}
          aria-selected={tab === t.id}
          aria-controls={`wd-drawer-panel-${t.id}`}
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

// ---------- Edit session: the quick edit ----------
//
//   Date [Mon, 9 Nov 2026 ▾]        Start time [7:00 pm IST ▾]
//   Headline ⓘ    [Fix the Vasthu mistakes that block money…   ]
//   Subheadline ⓘ [A webinar for families who want money to stay…]
//   Price ⓘ  (Free) (Paid)
//            Price ₹[999]   ☑ Discounted price ₹[499]
//
// One list, no groups: the (i) beside the landing page's fields says so. The
// date and time are this session's own; the headline, subheadline and
// price are the landing page's, shared by this session and the ones after
// it (withSharedChanges in data/webinar.js), so App saves them the usual way.
// The price boxes are the same as on the webinar's "Set your price" screen
// and in Contracts (PriceWithDiscount): a price, and a discount only once
// it's ticked. Saved as there: price = what people pay, oldPrice = the
// price shown crossed out (or '').
// Short notes show only when they matter: people already signed up and
// the date or price changes. Enter in a one-line field saves.

const PAGE_TIP = 'This changes your landing page for current and upcoming sessions.';

// The form's values, from a session's answers (all strings)
// The date and time aren't here: a session is moved with Reschedule, which
// tells the people who signed up (data/reschedule.js)
function editValues(answers) {
  return {
    headline: String(answers.headline ?? ''),
    subheadline: String(answers.subheadline ?? ''),
    pricing: answers.pricing === 'Paid' ? 'Paid' : 'Free',
    price: String(answers.price ?? ''),
    oldPrice: String(answers.oldPrice ?? ''),
  };
}

// Which values differ (a free webinar's price boxes don't count)
function changedKeys(saved, form) {
  return Object.keys(form).filter((key) => {
    if ((key === 'price' || key === 'oldPrice') && form.pricing === 'Free' && saved.pricing === 'Free') return false;
    return String(saved[key]).trim() !== String(form[key]).trim();
  });
}

// What's saved: trimmed, and the price boxes only for a paid webinar
function cleanValues(form) {
  const out = {
    headline: form.headline.trim(),
    subheadline: form.subheadline.trim(),
    pricing: form.pricing,
  };
  if (form.pricing === 'Paid') {
    out.price = form.price.trim();
    out.oldPrice = form.oldPrice.trim();
  }
  return out;
}

// The first thing that stops a save, or null: { text, quiet }. Quiet ones
// are already said by the price boxes themselves, so they're not repeated.
function editProblem(answers, form) {
  if (!form.headline.trim()) return { text: 'Add a headline.' };
  if (form.pricing === 'Paid') {
    const pay = Number(form.price) || 0;
    const was = Number(form.oldPrice) || 0;
    if (was > 0 && pay === 0) return { text: 'Add the discounted price, or untick it.', quiet: true };
    if (pay === 0) return { text: 'Add a price.' };
    if (was > 0 && pay >= was) return { text: 'The discounted price needs to be lower.', quiet: true };
  }
  return null;
}

// A field's name with its (i)
function FieldLabel({ htmlFor, id, children, tip }) {
  const Tag = htmlFor ? 'label' : 'span';
  return (
    <span className="wd-edit__label-row">
      <Tag className="wd-edit__label" htmlFor={htmlFor} id={id}>
        {children}
      </Tag>
      {tip && <InfoTip label={`About ${children}`} text={tip} />}
    </span>
  );
}

function SessionEdit({ answers, saved, form, onForm, problem, day, people, onSubmit }) {
  const set = (key) => (value) => onForm((f) => ({ ...f, [key]: value }));
  const changed = changedKeys(saved, form);
  const priceMoved = changed.some((k) => k === 'pricing' || k === 'price' || k === 'oldPrice');
  // Only once they've changed something: no red text on a fresh form
  const showProblem = changed.length > 0 && problem && !problem.quiet;
  // Enter in a one-line field saves
  const enterSaves = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <form
      className="wd-edit"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className="wd-edit__field">
        <FieldLabel htmlFor="wd-edit-headline" tip={PAGE_TIP}>
          Headline
        </FieldLabel>
        <textarea
          id="wd-edit-headline"
          className="wd-edit__input wd-edit__text"
          rows={2}
          maxLength={120}
          value={form.headline}
          onChange={(e) => set('headline')(e.target.value)}
          onKeyDown={enterSaves}
        />
      </div>

      <div className="wd-edit__field">
        <FieldLabel htmlFor="wd-edit-subheadline" tip={PAGE_TIP}>
          Subheadline
        </FieldLabel>
        <textarea
          id="wd-edit-subheadline"
          className="wd-edit__input wd-edit__text"
          rows={3}
          maxLength={200}
          value={form.subheadline}
          onChange={(e) => set('subheadline')(e.target.value)}
          onKeyDown={enterSaves}
        />
      </div>

      <div className="wd-edit__field">
        <FieldLabel id="wd-edit-pricing" tip={PAGE_TIP}>
          Price
        </FieldLabel>
        <div className="wd-edit__choice" role="radiogroup" aria-labelledby="wd-edit-pricing">
          {['Free', 'Paid'].map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={form.pricing === option}
              className="wd-edit__option"
              onClick={() => set('pricing')(option)}
            >
              {option}
            </button>
          ))}
        </div>
        {/* The same boxes as the webinar's "Set your price" screen */}
        {form.pricing === 'Paid' && (
          <div className="wd-edit__prices">
            <PriceWithDiscount
              answers={form}
              onChange={(value, id) => set(id)(value)}
              ids={{ price: 'price', compare: 'oldPrice' }}
              label="Price"
              example="999"
            />
          </div>
        )}
      </div>
      {priceMoved && people > 0 && saved.pricing === 'Paid' && (
        <p className="wd-edit__note">People who already paid keep what they paid.</p>
      )}

      <p className="wd-edit__error" role="alert">
        {showProblem ? problem.text : ''}
      </p>
      {/* Lets Enter in the price boxes save */}
      <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
    </form>
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
// ended: no session coming up. A small "Ended" tag on the picture says its
// Register button isn't live (visitors see "This webinar has ended").
function LandingThumb({ run, address, name, ended = false, onEdit, previewHref, onPreview }) {
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
        {ended && <span className="wd-thumb__ended">Ended</span>}
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
//
// Under them, one quiet line: the Meta Pixel (PixelStatus), since this is
// where coaches get the link they put in their ads. It's the account's one
// pixel, the same as on the Webinars list.
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
      <PixelStatus variant="line" />
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