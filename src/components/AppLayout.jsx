import {
  Layers, Compass, Video, BookOpen, MessageCircle,
  Grid3x3, Bell, Search, ChevronDown, ArrowLeft, Check, AlertTriangle,
  LayoutGrid, Sparkles, BarChart3, Briefcase, ShoppingCart,
  ArrowLeftRight, Monitor, User, TrendingUp, SlidersHorizontal,
} from 'lucide-react';
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
  { id: 'ai-cofounder', label: 'AI Co-Founder', icon: Sparkles, badge: 'NEW' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'services', label: 'Services', icon: Briefcase },
  { id: 'products', label: 'Products', icon: ShoppingCart, hasMenu: true },
  { id: 'sales', label: 'Sales', icon: ArrowLeftRight, hasMenu: true },
  { id: 'page-builder', label: 'Page Builder', icon: Monitor },
  { id: 'customers', label: 'Customers', icon: User, hasMenu: true },
  { id: 'marketing', label: 'Marketing', icon: TrendingUp, hasMenu: true },
  { id: 'automation', label: 'Automation', icon: SlidersHorizontal, hasMenu: true },
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