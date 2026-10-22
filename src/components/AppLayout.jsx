import { useEffect, useState } from 'react';
import {
  Layers, Compass, Video, BookOpen, MessageCircle,
  Grid3x3, Search, ChevronDown, ArrowLeft, Check, AlertTriangle,
  LayoutGrid, Sparkles, BarChart3, Briefcase, ShoppingCart,
  ArrowLeftRight, User, TrendingUp, SlidersHorizontal, MonitorPlay,
  Copy, ExternalLink, CalendarCheck, Users,
} from 'lucide-react';
import { initials } from '../utils/initials';
import { PAGE_DOMAIN, SETUP_CHANGED_EVENT, mockAccount, pageUrl, savedHandle } from '../data/myPage';
import { loadBookings, onBookingsChange } from '../data/bookingsStore';
import { buildBookingsJson } from '../data/buildBookingsJson';
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
  { id: 'bookings', label: 'Bookings', icon: CalendarCheck },
];

// Calls still to come today, for the Bookings tab's count. Follows new
// bookings (even from another tab) and the clock, so it drops as calls end.
function useCallsLeftToday() {
  const count = () => buildBookingsJson({ bookings: loadBookings() }).upcomingToday;
  const [left, setLeft] = useState(count);
  useEffect(() => {
    const update = () => setLeft(count());
    const stop = onBookingsChange(update);
    const timer = setInterval(update, 60_000);
    return () => {
      stop();
      clearInterval(timer);
    };
  }, []);
  return left;
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

// The creator's offerings page. Pinned above the nav because it's the thing
// they share everywhere: collapsed it's just their avatar, expanded it shows
// the link and quick actions. Before they've picked a link, it invites them
// to set it up instead.
function MyPageCard({ active, onOpen }) {
  const [handle, setHandle] = useState(savedHandle);
  const [copied, setCopied] = useState(false);
  const link = handle ? `${PAGE_DOMAIN}/${handle}` : null;

  // The setup screen saves the link; pick it up as soon as it does
  useEffect(() => {
    const update = () => setHandle(savedHandle());
    window.addEventListener(SETUP_CHANGED_EVENT, update);
    return () => window.removeEventListener(SETUP_CHANGED_EVENT, update);
  }, []);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(pageUrl(handle));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked: nothing to do, the link is visible on the card
    }
  }

  return (
    <div className={`mypage ${active ? 'mypage--active' : ''}`}>
      <button type="button" className="mypage__main" onClick={onOpen} title="My offerings page">
        <span className="mypage__avatar">{initials(mockAccount.name)}</span>
        <span className="mypage__text">
          <span className="mypage__label">My offerings page</span>
          <span className="mypage__link">{link ?? 'Not set up yet'}</span>
        </span>
      </button>

      <div className="mypage__actions">
        {link ? (
          <>
            <button type="button" className="mypage__action" onClick={copyLink}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy link'}
            </button>
            <a className="mypage__action" href={`/${handle}`} target="_blank" rel="noreferrer">
              <ExternalLink size={14} /> View
            </a>
          </>
        ) : (
          <button type="button" className="mypage__action mypage__action--start" onClick={onOpen}>
            Set it up
          </button>
        )}
      </div>
    </div>
  );
}

// onOpenBooking(id): an update in the bell was clicked; open that call on Bookings
export default function AppLayout({ activeNav, onNavigate, onOpenBooking, focus = null, children }) {
  const callsLeftToday = useCallsLeftToday();

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

            <MyPageCard active={activeNav === 'my-page'} onOpen={() => onNavigate('my-page')} />

            <nav className="sidebar__nav">
              {sidebarItems.map(({ id, label, icon: Icon, badge, hasMenu }) => {
                // Bookings shows how many calls are left today: a number when the
                // sidebar is open, a dot on the icon when it's closed
                const count = id === 'bookings' && callsLeftToday > 0 ? callsLeftToday : null;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onNavigate(id)}
                    className={`sidebar__item ${activeNav === id ? 'sidebar__item--active' : ''}`}
                    aria-label={count ? `${label}, ${count} ${count === 1 ? 'call' : 'calls'} left today` : undefined}
                    title={count ? `${count} ${count === 1 ? 'call' : 'calls'} left today` : undefined}
                  >
                    <span className="sidebar__icon-wrap">
                      <Icon size={20} className="sidebar__icon" />
                      {count && <span className="sidebar__dot" aria-hidden="true" />}
                    </span>
                    <span className="sidebar__label">{label}</span>
                    {badge && <span className="sidebar__badge">{badge}</span>}
                    {count && (
                      <span className="sidebar__badge sidebar__badge--count" aria-hidden="true">
                        {count}
                      </span>
                    )}
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