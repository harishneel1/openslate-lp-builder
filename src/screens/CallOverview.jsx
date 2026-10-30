import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CalendarCheck,
  Check,
  ChevronRight,
  ExternalLink,
  Link2,
  Pencil,
  Phone,
  Video,
  XCircle,
} from 'lucide-react';
import BookingDrawer from '../components/BookingDrawer';
import CallEmails from './CallEmails';
import { ActivityList } from '../components/ActivityPanel';
import CallReminderEditor from './CallReminderEditor';
import GuestInitials from '../components/GuestInitials';
import HoursTip from '../components/HoursTip';
import { useCalendar } from '../components/CalendarConnect';
import { useCopy } from './OfferingsHome';
import { loadBookings, onBookingsChange } from '../data/bookingsStore';
import {
  coachZone,
  longDay,
  movedFromLabel,
  relativeDay,
  shortDay,
  startsIn,
  zoneLabel,
} from '../data/buildBookingsJson';
import { PAGE_SIZE, byDay, callBookingsOf, guestClock, listOf } from '../data/callBookings';
import { loadCallHours } from '../data/availabilityStore';
import { emailTextOf, remindersOf, withEmailText, withReminderOn } from '../data/callReminders';
import { callActivity } from '../data/callActivity';
import { activityByDay } from '../data/sessionActivity';
import { readMeetingLink } from '../data/callDetails';
import { weekSummary } from '../utils/weeklyHours';
import { todayIn } from '../utils/slots';
import './OfferingsHome.css'; // panels and buttons, as on the 1:1 calls list
import './BookingsPage.css'; // .bk-btn, .bk-face, the chips and the next call card, shared with the Bookings page
import './CallOverview.css';

// ------------------------------------------------------------
// One 1:1 call's own page, opened from its card on the 1:1 calls list.
// Who has booked it, without going through the calendar:
//
//   ← 1:1 calls
//   Discovery call                     [Copy link] [Edit] [↗ View live page]
//   Video call · 30 min · ₹999
//   Mon–Fri, 9 am – 5 pm
//
//   ⚠ New bookings are paused: …       (only when nobody can book it)
//
//   ┃ (PS) Next call, in 3 hr
//   ┃      Today, 4:00 pm                                      [Join call]
//   ┃      Priya Sharma
//
//   ┌ Bookings 4 | Emails | Activity          [Upcoming 3] [Past 12] [Cancelled 1] ┐
//   │ Times in India (Kolkata), GMT+5:30                                        │
//   │ Today, Tuesday 4 November                                        2 calls │
//   │  4:00 pm  (PS) Priya Sharma                 [Starts in 8 min] [Join call] │
//   │  to 4:30  11:30 am, UK (London)                                           │
//   │ …                                                                         │
//   │                          [Show 20 more]                                    │
//   └───────────────────────────────────────────────────────────────────────────┘
//
// A booking opens the same side panel as on the Bookings page
// (BookingDrawer): details, History (with the reminder emails), and
// Reschedule / Cancel. Everything is on the creator's clock, like there.
// The list follows the clock (a call moves to Past as it ends) and new
// bookings from any tab (onBookingsChange).
//
// The Emails tab (CallEmails.jsx) has the two reminder emails: switches
// that save straight away, and a pencil that opens the email editor
// (CallReminderEditor.jsx) in place of this page. Saving there saves the
// words and comes back here, on Emails.
//
// The Activity tab is one timeline for the whole call, newest first, by
// day: bookings, reschedules, cancellations, declined invites, reminders
// sent and calls ended (data/callActivity.js), drawn like a webinar
// session's Activity (ActivityList). A line opens its booking.
//
// call: the call as the 1:1 calls list shows it (buildProfileJson's service)
// callAnswers: the call's own answers (its reminder switches and words, length)
// hostName: the coach's name, for the email preview
// meetingLink: their video link as saved, for the email preview
// url: its booking link
// tab: 'bookings' | 'emails' | 'activity'; onTab(tab) (the 1:1 calls page keeps it, so
//      coming back from the call's editor lands on the same tab)
// onBack(): to the 1:1 calls list
// onEdit(): to its editor
// onSaveCall(changes): saves changed answers on the call (its reminders)
// ------------------------------------------------------------

const TICK_MS = 30_000; // how often "now" moves on
const ACTIVITY_PAGE = 40; // activity lines shown before "Show more"

const FILTERS = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Past' },
  { id: 'cancelled', label: 'Cancelled' },
];

// When it can be booked, in a few words: "Mon–Fri, 9 am – 5 pm", with
// "+ 1 more" when days have different hours. From the call's own hours.
// none: no hours at all, so nobody can book it.
export function hoursOf(id) {
  const { open } = weekSummary(loadCallHours(id).weekly);
  if (open.length === 0) return { line: 'No hours set', none: true };
  const first = `${open[0].days}, ${open[0].hours}`;
  return { line: open.length > 1 ? `${first} + ${open.length - 1} more` : first, none: false };
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const firstName = (name) =>
  String(name ?? '')
    .trim()
    .split(/\s+/)[0] || 'Your guest';

// Who cancelled: 'You cancelled' or 'Priya cancelled'
const cancelledLine = (b) => (b.cancelledBy === 'guest' ? `${firstName(b.guest?.name)} cancelled` : 'You cancelled');

export default function CallOverview({
  call,
  callAnswers,
  hostName,
  meetingLink,
  url,
  tab = 'bookings',
  onTab,
  onBack,
  onEdit,
  onSaveCall,
}) {
  const [bookings, setBookings] = useState(loadBookings);
  const [now, setNow] = useState(() => Date.now());
  const [filter, setFilter] = useState('upcoming');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [openId, setOpenId] = useState(null);
  const [notice, setNotice] = useState(null);
  const [copy, copyLink] = useCopy();
  const connection = useCalendar();
  const [emailOpen, setEmailOpen] = useState(null); // the reminder open in the email editor, or null
  const [said, setSaid] = useState(''); // for screen readers: what just saved
  const [activityLimit, setActivityLimit] = useState(ACTIVITY_PAGE);

  // Keep up with new bookings (checkout in another tab) and the clock
  useEffect(() => onBookingsChange(() => setBookings(loadBookings())), []);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    document.title = call.title;
  }, [call.title, emailOpen]);

  const zone = useMemo(() => coachZone(), []);
  const today = todayIn(zone, now);
  const lists = useMemo(() => callBookingsOf(call.id, { bookings, zone, now }), [call.id, bookings, zone, now]);
  const hours = useMemo(() => hoursOf(call.id), [call.id]);
  const mine = useMemo(() => bookings.filter((b) => b.serviceId === call.id), [bookings, call.id]);
  const switches = remindersOf(callAnswers);
  const activity = useMemo(
    () => (tab === 'activity' ? callActivity(mine, switches, zone, now) : []),
    // switches is rebuilt each render: compare what it says
    [tab, mine, zone, now, switches.dayBefore, switches.hourBefore], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const opened = openId ? (lists.all.find((b) => b.id === openId) ?? null) : null;
  const shown = lists[filter];
  const groups = byDay(shown.slice(0, limit));
  const more = shown.length - limit;

  const pick = (id) => {
    setFilter(id);
    setLimit(PAGE_SIZE);
  };

  const open = (id) => {
    setNotice(null);
    setOpenId(id);
  };

  // After a reschedule or cancel in the drawer: reload, and follow the
  // booking to the list it's in now (a cancelled call goes to Cancelled)
  const changed = (message) => {
    const fresh = loadBookings();
    setBookings(fresh);
    setNotice(message);
    const after = callBookingsOf(call.id, { bookings: fresh, zone, now: Date.now() }).all.find((b) => b.id === openId);
    if (after && listOf(after) !== filter) pick(listOf(after));
  };

  // Why nobody can book it right now, if they can't: the calendar first,
  // since it pauses every call
  const calendarOk = connection?.status === 'connected';
  const problem = !calendarOk
    ? {
        title: 'New bookings are paused',
        text:
          connection?.status === 'lost'
            ? `We can’t reach ${connection.email}. Bookings you already have aren’t affected.`
            : 'Connect Google Calendar so people can book this call. Bookings you already have aren’t affected.',
        action: connection?.status === 'lost' ? 'Reconnect on 1:1 calls' : 'Connect on 1:1 calls',
        onAction: onBack,
      }
    : hours.none
      ? {
          title: 'Nobody can book this call yet',
          text: 'It has no booking hours. Set the days and times people can pick.',
          action: 'Set hours',
          onAction: onEdit,
        }
      : null;

  const details = call.facts.map((f) => f.text).join(' · ');

  // ---------- Emails ----------
  const toggleReminder = (id, on) => {
    onSaveCall({ callReminders: withReminderOn(callAnswers, id, on) });
    setSaid(`${on ? 'Turned on' : 'Turned off'} the email ${id === 'dayBefore' ? '24 hours' : '1 hour'} before.`);
  };

  // Back from the email editor, on Emails, at the top of the page
  const closeEmail = () => {
    setEmailOpen(null);
    requestAnimationFrame(() => {
      document.querySelector('.app__main')?.scrollTo?.(0, 0);
      window.scrollTo(0, 0);
    });
  };

  if (emailOpen) {
    const link = readMeetingLink(meetingLink);
    return (
      <CallReminderEditor
        reminderId={emailOpen}
        value={emailTextOf(callAnswers, emailOpen)}
        call={{
          title: call.title,
          durationMins: callAnswers?.callDuration,
          timeZone: loadCallHours(call.id).timeZone,
          meetingLink: link.valid ? link.url : null,
        }}
        hostName={hostName}
        onApply={(text) => {
          onSaveCall({ callReminderEmails: withEmailText(callAnswers?.callReminderEmails ?? {}, emailOpen, text) });
          setSaid('Email saved.');
          closeEmail();
        }}
        onClose={closeEmail}
      />
    );
  }

  return (
    <div className="oh cov">
      {/* ---------- The call ---------- */}
      <header className="cov__head">
        <button type="button" className="cov__back" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" /> 1:1 calls
        </button>

        <div className="cov__intro">
          <div className="cov__about">
            <h1 className="cov__title">{call.title}</h1>
            <p className="cov__detail">
              {details} ·{' '}
              <span className={call.price.isFree ? 'oh-row__price oh-row__price--free' : 'oh-row__price'}>
                {call.price.label}
              </span>
            </p>
            <HoursTip
              callId={call.id}
              line={hours.line}
              className={`cov__hours ${hours.none ? 'cov__hours--none' : ''}`}
            />
          </div>

          <div className="cov__actions">
            <button type="button" className="oh-card__copy" onClick={() => copyLink(url)}>
              {copy === 'copied' ? (
                <Check size={16} strokeWidth={3} aria-hidden="true" />
              ) : (
                <Link2 size={16} aria-hidden="true" />
              )}
              {copy === 'copied' ? 'Copied' : 'Copy link'}
            </button>
            <button type="button" className="oh__edit" onClick={onEdit}>
              <Pencil size={15} aria-hidden="true" /> Edit
            </button>
            <a
              className="oh__edit cov__live"
              href={url}
              target="_blank"
              rel="noopener"
              aria-label="View live page (opens in a new tab)"
            >
              <ExternalLink size={15} aria-hidden="true" /> View live page
            </a>
          </div>
        </div>
        <span className="oh__sr-only" aria-live="polite">
          {copy === 'copied' && 'Link copied'}
        </span>
        {copy === 'failed' && (
          <p className="oh__copy-error cov__copy-error" role="alert">
            Couldn’t copy. Select the link and copy it yourself: <span className="oh-card__url">{url}</span>
          </p>
        )}
      </header>

      {problem && (
        <div className="cov__alert" role="status">
          <AlertCircle size={18} aria-hidden="true" className="cov__alert-icon" />
          <div className="cov__alert-text">
            <p className="cov__alert-title">{problem.title}</p>
            <p className="cov__alert-sub">{problem.text}</p>
          </div>
          <button type="button" className="bk-btn bk-btn--secondary" onClick={problem.onAction}>
            {problem.action}
          </button>
        </div>
      )}

      {lists.next && <NextBooking booking={lists.next} today={today} now={now} onOpen={() => open(lists.next.id)} />}

      {/* ---------- Its bookings ---------- */}
      <section className="oh__panel cov__panel" aria-label={TABS.find((t) => t.id === tab)?.label ?? 'Bookings'}>
        <div className="oh__panel-head cov__panel-head">
          <Tabs tab={tab} onTab={onTab} bookings={lists.upcoming.length} />
          {tab === 'bookings' && (
            <div className="cov__filters" role="group" aria-label="Show bookings">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className="cov__filter"
                  aria-pressed={filter === f.id}
                  onClick={() => pick(f.id)}
                >
                  {f.label} <span className="cov__filter-count">{lists[f.id].length}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {tab === 'activity' ? (
          <div className="cov__activity" id="cov-panel-activity" role="tabpanel" aria-labelledby="cov-tab-activity">
            {activity.length === 0 ? (
              <div className="cov__empty">
                <p className="bk__empty-title">Nothing yet</p>
                <p className="bk__empty-text">
                  Bookings, changes and reminder emails for this call show up here as they happen.
                </p>
              </div>
            ) : (
              <>
                <p className="cov__zone cov__zone--activity">Times in {zoneLabel(zone)}</p>
                <ActivityList groups={activityByDay(activity.slice(0, activityLimit), now)} onOpen={open} />
                {activity.length > activityLimit && (
                  <div className="cov__more">
                    <button
                      type="button"
                      className="bk-btn bk-btn--secondary"
                      onClick={() => setActivityLimit((n) => n + ACTIVITY_PAGE)}
                    >
                      Show more
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ) : tab === 'emails' ? (
          <div id="cov-panel-emails" role="tabpanel" aria-labelledby="cov-tab-emails">
            <CallEmails
              bookings={mine}
              callAnswers={callAnswers}
              now={now}
              onToggle={toggleReminder}
              onEdit={setEmailOpen}
            />
          </div>
        ) : (
          <div className="cov__body" id="cov-panel-bookings" role="tabpanel" aria-labelledby="cov-tab-bookings">
            <p className="cov__zone">Times in {zoneLabel(zone)}</p>
            {shown.length === 0 ? (
              <Empty filter={filter} hasAny={lists.all.length > 0} copy={copy} onCopy={() => copyLink(url)} />
            ) : (
              <>
                {groups.map((g) => (
                  <DayGroup
                    key={g.date}
                    date={g.date}
                    today={today}
                    items={g.items}
                    zone={zone}
                    now={now}
                    onOpen={open}
                  />
                ))}
                {more > 0 && (
                  <div className="cov__more">
                    <button
                      type="button"
                      className="bk-btn bk-btn--secondary"
                      onClick={() => setLimit((n) => n + PAGE_SIZE)}
                    >
                      Show {Math.min(more, PAGE_SIZE)} more
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </section>

      <p className="oh__sr-only" aria-live="polite">
        {said}
      </p>

      {opened && (
        <BookingDrawer
          booking={opened}
          zone={zone}
          today={today}
          now={now}
          notice={notice}
          onClose={() => {
            setOpenId(null);
            setNotice(null);
          }}
          onChanged={changed}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------
// Bookings | Emails | Activity, as on a webinar's page. Left and right arrows move
// between them. bookings: how many are still to come, beside its name.
// ------------------------------------------------------------
const TABS = [
  { id: 'bookings', label: 'Bookings' },
  { id: 'emails', label: 'Emails' },
  { id: 'activity', label: 'Activity' },
];

function Tabs({ tab, onTab, bookings }) {
  const onKey = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const at = TABS.findIndex((t) => t.id === tab);
    const next = TABS[(at + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length].id;
    onTab(next);
    requestAnimationFrame(() => document.getElementById(`cov-tab-${next}`)?.focus());
  };
  return (
    <div className="cov__tabs" role="tablist" aria-label="Call" onKeyDown={onKey}>
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          id={`cov-tab-${t.id}`}
          aria-selected={tab === t.id}
          aria-controls={`cov-panel-${t.id}`}
          tabIndex={tab === t.id ? 0 : -1}
          className="cov__tab"
          onClick={() => onTab(t.id)}
        >
          {t.label}
          {t.id === 'bookings' && bookings > 0 && <span className="oh__count">{bookings}</span>}
        </button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------
// The next booking, above the list, whichever filter is on: the same
// card as the Bookings page's next call
// ------------------------------------------------------------
function NextBooking({ booking, today, now, onOpen }) {
  const live = booking.state === 'live';
  const joinable = live || booking.state === 'soon';
  const inWords = !live ? startsIn(Date.parse(booking.start), now) : null;
  const name = booking.guest?.name || 'Guest';

  return (
    <div className={`bk__next cov__next ${joinable ? 'bk__next--now' : ''}`}>
      <button type="button" className="bk__next-main" onClick={onOpen}>
        <GuestInitials name={name} size="lg" />
        <span className="bk__next-text">
          <span className="bk__next-label">
            {live ? 'Happening now' : 'Next call'}
            {inWords && <span className="bk__next-in">, {inWords}</span>}
          </span>
          <span className="bk__next-when">{live ? name : `${shortDay(booking.date, today)}, ${booking.time}`}</span>
          <span className="bk__next-who">{live ? `${booking.time} to ${booking.ends}` : name}</span>
          {booking.invite?.status === 'declined' && (
            <span className="bk__next-flag">
              <XCircle size={14} aria-hidden="true" /> Declined the calendar invite
            </span>
          )}
        </span>
      </button>
      <JoinAction booking={booking} />
    </div>
  );
}

// Join for a video call, Call for a phone call; null when there's neither
function JoinAction({ booking, small = false }) {
  const size = small ? 'cov-btn--small' : '';
  if (booking.format === 'phone') {
    return booking.guest?.phone ? (
      <a className={`bk-btn bk-btn--primary ${size}`} href={`tel:${booking.guest.phone.replace(/\s/g, '')}`}>
        <Phone size={16} aria-hidden="true" /> Call
      </a>
    ) : null;
  }
  return booking.meetingLink ? (
    <a className={`bk-btn bk-btn--primary ${size}`} href={booking.meetingLink} target="_blank" rel="noreferrer">
      <Video size={16} aria-hidden="true" /> Join call
    </a>
  ) : null;
}

// ------------------------------------------------------------
// One day of bookings: its date, then a row each
// ------------------------------------------------------------
function DayGroup({ date, today, items, zone, now, onOpen }) {
  const rel = relativeDay(date, today);
  const active = items.filter((b) => b.state !== 'cancelled').length;
  return (
    <section className="cov-day" aria-label={longDay(date)}>
      <div className="cov-day__head">
        <h3 className={`cov-day__title ${date === today ? 'cov-day__title--today' : ''}`}>
          {rel ? `${rel}, ` : ''}
          {longDay(date)}
        </h3>
        {active > 1 && <span className="cov-day__count">{plural(active, 'call')}</span>}
      </div>
      <ul className="cov-day__list">
        {items.map((b) => (
          <BookingRow key={b.id} booking={b} zone={zone} now={now} onOpen={() => onOpen(b.id)} />
        ))}
      </ul>
    </section>
  );
}

// One booking: its time, who, what's worth knowing, and Join when it's time
function BookingRow({ booking: b, zone, now, onOpen }) {
  const name = b.guest?.name || 'Guest';
  const joinable = b.state === 'live' || b.state === 'soon';
  const cancelled = b.state === 'cancelled';
  const theirs = guestClock(b, zone, zoneLabel);
  const soonIn = b.state === 'soon' ? startsIn(Date.parse(b.start), now) : null;
  const movedFrom = movedFromLabel(b);
  // Under the name: the guest's own time when it differs, else how to reach them
  const sub =
    cancelled && b.cancelledBy === 'guest' && b.cancelMessage
      ? `“${b.cancelMessage}”`
      : theirs
        ? `Their time: ${theirs}`
        : b.guest?.email || b.guest?.phone || '';

  return (
    <li className={`cov-row cov-row--${b.state}`}>
      <button type="button" className="cov-row__main" onClick={onOpen}>
        <span className="cov-row__time">
          <span className="cov-row__start">{b.time}</span>
          <span className="cov-row__end">to {b.ends}</span>
        </span>
        <GuestInitials name={name} />
        <span className="cov-row__who">
          <span className="cov-row__name">{name}</span>
          {sub && <span className="cov-row__sub">{sub}</span>}
        </span>
        <span className="cov-row__chips">
          {b.state === 'live' && <span className="bk-call__chip bk-call__chip--live">Happening now</span>}
          {soonIn && <span className="bk-call__chip bk-call__chip--live">Starts {soonIn}</span>}
          {cancelled && <span className="bk-call__chip">{cancelledLine(b)}</span>}
          {!cancelled && movedFrom && (
            <span className="bk-call__chip bk-call__chip--moved">Moved from {movedFrom}</span>
          )}
          {!cancelled && b.invite?.status === 'declined' && (
            <span className="bk-call__chip bk-call__chip--declined">
              <XCircle size={12} aria-hidden="true" /> Declined invite
            </span>
          )}
        </span>
        {!joinable && <ChevronRight size={18} aria-hidden="true" className="cov-row__chevron" />}
      </button>
      {joinable && (
        <span className="cov-row__action">
          <JoinAction booking={b} small />
        </span>
      )}
    </li>
  );
}

// ------------------------------------------------------------
// Nothing in the chosen list. With no bookings at all, or nothing
// ahead, the way forward is sharing the link.
// ------------------------------------------------------------
function Empty({ filter, hasAny, copy, onCopy }) {
  const share = (
    <button type="button" className="bk-btn bk-btn--secondary" onClick={onCopy}>
      {copy === 'copied' ? (
        <Check size={16} strokeWidth={3} aria-hidden="true" />
      ) : (
        <Link2 size={16} aria-hidden="true" />
      )}
      {copy === 'copied' ? 'Copied' : 'Copy link'}
    </button>
  );

  if (!hasAny) {
    return (
      <div className="cov__empty">
        <span className="bk__empty-icon" aria-hidden="true">
          <CalendarCheck size={22} />
        </span>
        <p className="bk__empty-title">No bookings yet</p>
        <p className="bk__empty-text">Share this call’s link. When someone books, they show up here.</p>
        {share}
      </div>
    );
  }

  const words = {
    upcoming: { title: 'Nothing booked ahead', text: 'Share the link to get your next booking.', share: true },
    past: { title: 'No past calls yet', text: 'Calls move here once they’ve ended.', share: false },
    cancelled: { title: 'No cancelled calls', text: 'Calls you or your guests cancel show up here.', share: false },
  }[filter];

  return (
    <div className="cov__empty">
      <p className="bk__empty-title">{words.title}</p>
      <p className="bk__empty-text">{words.text}</p>
      {words.share && share}
    </div>
  );
}