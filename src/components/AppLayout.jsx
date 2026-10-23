import { useEffect, useState } from 'react';
import {
  Layers, Compass, Video, BookOpen, MessageCircle,
  Grid3x3, Search, ChevronDown, ArrowLeft, Check, AlertTriangle,
  LayoutGrid, Sparkles, BarChart3, Briefcase, ShoppingCart,
  ArrowLeftRight, User, TrendingUp, SlidersHorizontal, MonitorPlay,
  CalendarCheck, Users, Store,
} from 'lucide-react';
import { SETUP_CHANGED_EVENT, savedHandle } from '../data/myPage';
import { loadBookings, onBookingsChange } from '../data/bookingsStore';
import { buildBookingsJson, shortDay } from '../data/buildBookingsJson';
import UpdatesBell from './UpdatesBell';
import './AppLayout.css';

const topNavItems = [
  { id: 'dashboard', label: 'Dashboard', icon: Layers },
  { id: 'feed', label: 'Feed', icon: Compass },
  { id: 'workshops', label: 'Workshops', icon: Video },
  { id: 'courses', label: 'Courses', icon: BookOpen },
  { id: 'messages', label: 'Messages', icon: MessageCircle },
];

const sidebarItems = [
  { id: 'get-started', label: 'Get Started', icon: LayoutGrid },
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
  // "Your bookings" card at the top is the way in.
  { id: 'my-page', label: 'Storefront', icon: Store },
];

// Today, for the "Your bookings" card: how many calls are left and when
// the next one is. Follows new bookings (even from another tab) and the
// clock, so it moves on as calls end.
function todayOf() {
  const page = buildBookingsJson({ bookings: loadBookings() });
  const { next, today, upcomingToday: left } = page;
  // Two short lines, so neither gets cut off in the narrow card
  let line;
  let nextLine = null;
  if (left > 0) {
    line = `${left} ${left === 1 ? 'call' : 'calls'} left today`;
    nextLine = next.state === 'live' ? 'One is on now' : `Next at ${next.time}`;
  } else if (next) {
    line = 'No calls today';
    nextLine = `Next: ${shortDay(next.date, today).toLowerCase()}, ${next.time}`;
  } else {
    line = 'No calls coming up';
  }
  return { left, line, nextLine };
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
// focus: null for the normal shell, or { title, onExit, saveFailed }
function FocusBar({ title, onExit, saveFailed }) {
  return (
    <header className="focusbar">
      <button type="button" className="focusbar__exit" onClick={onExit}>
        <ArrowLeft size={16} /> All webinars
      </button>

      <p className="focusbar__title" title={title}>{title}</p>

      {saveFailed ? (
        <p className="focusbar__status focusbar__status--error">
          <AlertTriangle size={15} /> Not saved
        </p>
      ) : (
        <p className="focusbar__status">
          <Check size={15} strokeWidth={2.5} /> Saved
        </p>
      )}
    </header>
  );
}

// "Your bookings": pinned above the nav, because what's on today is what a
// coach opens the app for. Collapsed it's a calendar icon, with a dot when
// calls are left today; expanded it says how many and when the next one is,
// with Open calendar. The whole card opens the calendar (Bookings).
function BookingsCard({ active, onOpen }) {
  const { left, line, nextLine } = useToday();
  return (
    <div className={`mypage bkcard ${active ? 'mypage--active' : ''}`}>
      <button
        type="button"
        className="mypage__main"
        onClick={onOpen}
        title="Your bookings"
        aria-label={`Your bookings: ${line}${nextLine ? `. ${nextLine}` : ''}. Open calendar`}
      >
        <span className="mypage__avatar bkcard__icon">
          <CalendarCheck size={17} aria-hidden="true" />
          {left > 0 && <span className="bkcard__dot" aria-hidden="true" />}
        </span>
        <span className="mypage__text">
          <span className="mypage__label">Your bookings</span>
          <span className="mypage__link">{line}</span>
          {nextLine && <span className="mypage__link bkcard__next">{nextLine}</span>}
        </span>
      </button>

      <div className="mypage__actions">
        <button type="button" className="mypage__action" onClick={onOpen} tabIndex={-1} aria-hidden="true">
          <CalendarCheck size={14} /> Open calendar
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
        <div className="topnav__logo">HN</div>

        <nav className="topnav__links">
          {topNavItems.map(({ id, label, icon: Icon }) => (
            <a
              key={id}
              href="#"
              onClick={(e) => e.preventDefault()}
              className={`topnav__link ${activeNav === id ? 'topnav__link--active' : ''}`}
            >
              <Icon size={22} />
              <span>{label}</span>
            </a>
          ))}
        </nav>

        <div className="topnav__actions">
          <button type="button" className="topnav__icon-btn"><Grid3x3 size={20} /></button>
          <UpdatesBell onOpenBooking={onOpenBooking} />
          <div className="topnav__avatar">H</div>
        </div>
      </header>

      <div className="app__body">
        <div className="sidebar-rail">
          <aside className="sidebar">
            <div className="sidebar__search">
              <Search size={16} />
              <input placeholder="Search..." />
            </div>

            <BookingsCard active={activeNav === 'bookings'} onOpen={() => onNavigate('bookings')} />

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