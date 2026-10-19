import { useEffect, useState } from 'react';
import {
  Layers, Compass, Video, BookOpen, MessageCircle,
  Grid3x3, Bell, Search, ChevronDown, ArrowLeft, Check, AlertTriangle,
  LayoutGrid, Sparkles, BarChart3, Briefcase, ShoppingCart,
  ArrowLeftRight, Filter, User, TrendingUp, SlidersHorizontal,
  Copy, ExternalLink,
} from 'lucide-react';
import { initials } from '../utils/initials';
import { PAGE_DOMAIN, SETUP_CHANGED_EVENT, mockAccount, pageUrl, savedHandle } from '../data/myPage';
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
  { id: 'services', label: 'Contracts', icon: Briefcase },
  { id: 'page-builder', label: 'Funnels', icon: Filter }
];

// Focus mode: while a funnel is open, the app's top nav and sidebar step back
// and one slim bar takes their place: exit on the left, funnel name in the
// middle, save status on the right.
// focus: null for the normal shell, or { title, onExit, saveFailed }
function FocusBar({ title, onExit, saveFailed }) {
  return (
    <header className="focusbar">
      <button type="button" className="focusbar__exit" onClick={onExit}>
        <ArrowLeft size={16} /> All funnels
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
      <button type="button" className="mypage__main" onClick={onOpen} title="My services page">
        <span className="mypage__avatar">{initials(mockAccount.name)}</span>
        <span className="mypage__text">
          <span className="mypage__label">My services page</span>
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

export default function AppLayout({ activeNav, onNavigate, focus = null, children }) {
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
          <button type="button" className="topnav__icon-btn"><Bell size={20} /></button>
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
              {sidebarItems.map(({ id, label, icon: Icon, badge, hasMenu }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onNavigate(id)}
                  className={`sidebar__item ${activeNav === id ? 'sidebar__item--active' : ''}`}
                >
                  <Icon size={20} className="sidebar__icon" />
                  <span className="sidebar__label">{label}</span>
                  {badge && <span className="sidebar__badge">{badge}</span>}
                  {hasMenu && <ChevronDown size={16} className="sidebar__chevron" />}
                </button>
              ))}
            </nav>
          </aside>
        </div>

        <main className="app__main">{children}</main>
      </div>
    </div>
  );
}