import { useEffect, useState } from 'react';
import {
  Search, ChevronDown, ArrowLeft, Check, AlertTriangle,
  LayoutGrid, Sparkles, BarChart3, Briefcase, ShoppingCart,
  ArrowLeftRight, User, TrendingUp, SlidersHorizontal, MonitorPlay,
  CalendarCheck, Users, Store, Video,
} from 'lucide-react';
import { SETUP_CHANGED_EVENT, savedHandle } from '../data/myPage';
import { loadBookings, onBookingsChange } from '../data/bookingsStore';
import { buildBookingsJson, shortDay } from '../data/buildBookingsJson';
import { webinarEnd, webinarStart } from '../data/webinar';
import { isPublished } from '../utils/publish';
import { loadSaved } from '../utils/storage';
import { formatTime, zoned } from '../utils/slots';
import UpdatesBell from './UpdatesBell';
import './AppLayout.css';

const sidebarItems = [
  // Where 1:1 calls are made and managed. My offerings only shows them.
  // Users, not Video: Video is Workshops in the top nav.
  { id: 'calls', label: '1:1 calls', icon: Users },
  // Webinars, each with its pages (landing, sign-up, thank you). The id is
  // still 'page-builder' so saves made when this was Funnels open here.
  // MonitorPlay, not Video: Video is Workshops in the top nav.
  { id: 'page-builder', label: 'Webinars', icon: MonitorPlay },
  { id: 'services', label: 'Contracts', icon: Briefcase },
  // Their storefront (the offerings page): set up once and shared, so it
  // sits last. The id is still 'my-page'. Bookings has no item here: the
  // "Your calendar" card at the top is the way in.
  { id: 'my-page', label: 'Storefront', icon: Store },
];

// Published webinars that aren't over yet, soonest first: { start, end }
// (ms). Drafts aren't on the calendar until they're published.
function webinarsAhead(now) {
  const { funnels } = loadSaved();
  return (Array.isArray(funnels) ? funnels : [])
    .filter((f) => f?.type === 'webinar' && isPublished(f))
    .map((f) => ({ start: webinarStart(f.answers ?? {}), end: webinarEnd(f.answers ?? {}) }))
    .filter((w) => w.start !== null && w.end > now)
    .sort((a, b) => a.start - b.start);
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Today, for the "Your calendar" card: what's left today, one short line
// each for calls and webinars (each fits the narrow card on its own), then
// what's next. Follows new bookings (even from another tab) and the clock,
// so it moves on as things end.
//   "2 calls left today" / "1 webinar left today" / "Next: webinar at 7:00 pm"
//   "Nothing left today" / "Next: tomorrow, 10:00 am"
//   "Nothing coming up"
function todayOf(now = Date.now()) {
  const page = buildBookingsJson({ bookings: loadBookings(), now });
  const { zone, today, next: call, upcomingToday: callsLeft } = page;

  const webinars = webinarsAhead(now);
  const webinarsLeft = webinars.filter((w) => zoned(w.start, zone).date === today).length;

  // The next thing of either kind: { kind, start, live }
  const nextCall = call ? { kind: 'call', start: Date.parse(call.start), live: call.state === 'live' } : null;
  const nextWebinar = webinars[0] ? { kind: 'webinar', start: webinars[0].start, live: webinars[0].start <= now } : null;
  const next = [nextCall, nextWebinar].filter(Boolean).sort((a, b) => a.start - b.start)[0] ?? null;

  const lines = [];
  if (callsLeft > 0) lines.push(`${plural(callsLeft, 'call')} left today`);
  if (webinarsLeft > 0) lines.push(`${plural(webinarsLeft, 'webinar')} left today`);

  let nextLine = null;
  if (next?.live) {
    nextLine = next.kind === 'call' ? 'A call is on now' : 'Your webinar is on now';
  } else if (next) {
    const time = formatTime(next.start, zone);
    const date = zoned(next.start, zone).date;
    if (date === today) {
      // Say which kind only when today has both
      nextLine = callsLeft > 0 && webinarsLeft > 0 ? `Next: ${next.kind} at ${time}` : `Next at ${time}`;
    } else {
      nextLine = `Next: ${shortDay(date, today).toLowerCase()}, ${time}`;
    }
  }

  if (lines.length === 0) lines.push(next ? 'Nothing left today' : 'Nothing coming up');
  return { busy: callsLeft + webinarsLeft > 0, lines, nextLine };
}

function useToday() {
  const [summary, setSummary] = useState(todayOf);
  useEffect(() => {
    const update = () => setSummary(todayOf());
    const stop = onBookingsChange(update);
    const timer = setInterval(update, 60_000);
    return () => {
      stop();
      clearInterval(timer);
    };
  }, []);
  return summary;
}

// Whether their storefront has a link yet; follows setup as it saves one
function useHasStorefront() {
  const [has, setHas] = useState(() => Boolean(savedHandle()));
  useEffect(() => {
    const update = () => setHas(Boolean(savedHandle()));
    window.addEventListener(SETUP_CHANGED_EVENT, update);
    return () => window.removeEventListener(SETUP_CHANGED_EVENT, update);
  }, []);
  return has;
}

// Focus mode: while a webinar is open, the app's top nav and sidebar step back
// and one slim bar takes their place: exit on the left, funnel name in the
// middle, save status on the right.
// focus: null for the normal shell, or { title, onExit, saveFailed, exitLabel, minimal, when }
// exitLabel: where the exit goes ('All webinars', or 'Webinar details'
// while editing a published webinar's pages)
// minimal: on a page that already shows the title big and edits nothing
// (the webinar details page): no title here and no "Saved", only the way
// back. "Not saved" still shows if saving ever fails.
// when: the webinar's date ("Sat 24 Oct, 2:00 pm IST"). Given, the middle
// shows the webinar (icon, title, date) even when minimal: the email
// editor uses it, so it's clear which webinar's email is open.
function FocusBar({ title, onExit, saveFailed, exitLabel = 'All webinars', minimal = false, when = null }) {
  return (
    <header className="focusbar">
      <button type="button" className="focusbar__exit" onClick={onExit}>
        <ArrowLeft size={16} /> {exitLabel}
      </button>

      {when ? (
        <p className="focusbar__context">
          <Video size={15} aria-hidden="true" className="focusbar__context-icon" />
          <span className="focusbar__title" title={title}>
            {title}
          </span>
          <span className="focusbar__when">{when}</span>
        </p>
      ) : minimal ? (
        <span />
      ) : (
        <p className="focusbar__title" title={title}>
          {title}
        </p>
      )}

      {saveFailed ? (
        <p className="focusbar__status focusbar__status--error">
          <AlertTriangle size={15} /> Not saved
        </p>
      ) : minimal ? (
        <span />
      ) : (
        <p className="focusbar__status">
          <Check size={15} strokeWidth={2.5} /> Saved
        </p>
      )}
    </header>
  );
}

// "Your calendar": pinned above the nav, because what's on today is what a
// coach opens the app for. Collapsed it's a calendar icon, with a dot when
// something is left today; expanded it says what's left today (calls and
// webinars) and what's next, with Open. The whole card opens the calendar
// (Bookings); Open is there to show it can be clicked. One icon: the
// calendar on the left.
function CalendarCard({ active, onOpen }) {
  const { busy, lines, nextLine } = useToday();
  return (
    <div className={`mypage bkcard ${active ? 'mypage--active' : ''}`}>
      <button
        type="button"
        className="mypage__main"
        onClick={onOpen}
        title="Your calendar"
        aria-label={`Your calendar: ${[...lines, nextLine].filter(Boolean).join('. ')}. Open`}
      >
        <span className="mypage__avatar bkcard__icon">
          <CalendarCheck size={17} aria-hidden="true" />
          {busy && <span className="bkcard__dot" aria-hidden="true" />}
        </span>
        <span className="mypage__text bkcard__text">
          <span className="mypage__label">Your calendar</span>
          {lines.map((line) => (
            <span key={line} className="mypage__link">
              {line}
            </span>
          ))}
          {nextLine && <span className="mypage__link bkcard__next">{nextLine}</span>}
        </span>
      </button>

      <div className="mypage__actions">
        <button type="button" className="mypage__action" onClick={onOpen} tabIndex={-1} aria-hidden="true">
          Open
        </button>
      </div>
    </div>
  );
}

// onOpenBooking(id): an update in the bell was clicked; open that call on Bookings
export default function AppLayout({ activeNav, onNavigate, onOpenBooking, focus = null, children }) {
  const hasStorefront = useHasStorefront();

  if (focus) {
    return (
      <div className="app">
        <FocusBar {...focus} />
        <div className="app__body">
          <main className="app__main">{children}</main>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="topnav">
        {/* The coach's own brand: what their students see too */}
        <div className="topnav__logo">HN</div>

        {/* Updates, then their profile */}
        <div className="topnav__actions">
          <UpdatesBell onOpenBooking={onOpenBooking} />
          <div className="topnav__avatar" title="Your profile">H</div>
        </div>
      </header>

      <div className="app__body">
        <div className="sidebar-rail">
          <aside className="sidebar">
            <div className="sidebar__search">
              <Search size={16} />
              <input placeholder="Search..." />
            </div>

            <CalendarCard active={activeNav === 'bookings'} onOpen={() => onNavigate('bookings')} />

            <nav className="sidebar__nav">
              {sidebarItems.map(({ id, label, icon: Icon, badge, hasMenu }) => {
                // Storefront, before it has a link: a small "Set up" tag
                const tag = id === 'my-page' && !hasStorefront ? 'Set up' : badge;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onNavigate(id)}
                    className={`sidebar__item ${activeNav === id ? 'sidebar__item--active' : ''}`}
                  >
                    <span className="sidebar__icon-wrap">
                      <Icon size={20} className="sidebar__icon" />
                    </span>
                    <span className="sidebar__label">{label}</span>
                    {tag && <span className="sidebar__badge">{tag}</span>}
                    {hasMenu && <ChevronDown size={16} className="sidebar__chevron" />}
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>

        <main className="app__main">{children}</main>
      </div>
    </div>
  );
}