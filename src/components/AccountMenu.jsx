import { Settings } from 'lucide-react';
import { usePanel } from './DatePicker';
import './AccountMenu.css';

// ------------------------------------------------------------
// The avatar in the top bar, as a menu: who's signed in, and Settings
// (SettingsPage.jsx). More (Help, Sign out) can join ITEMS later.
//
//   (H) ▸ ┌──────────────────┐
//         │ Harish Neel      │
//         │ ⚙ Settings       │
//         └──────────────────┘
//
// Closes on a click outside, Escape (back to the avatar) or a pick.
// onNavigate(id): App's sidebar navigation
// ------------------------------------------------------------

const ITEMS = [{ id: 'settings', label: 'Settings', icon: Settings }];

export default function AccountMenu({ name = 'Harish Neel', initial = 'H', onNavigate }) {
  const { open, setOpen, close, wrapRef, triggerRef, onPanelKeyDown } = usePanel();

  return (
    <div className="acct" ref={wrapRef}>
      <button
        type="button"
        ref={triggerRef}
        className="topnav__avatar acct__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${name}: your account`}
        onClick={() => (open ? close() : setOpen(true))}
      >
        {initial}
      </button>
      {open && (
        <div className="acct__menu" role="menu" aria-label="Your account" onKeyDown={onPanelKeyDown}>
          <p className="acct__name">{name}</p>
          {ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="menuitem"
              className="acct__item"
              autoFocus
              onClick={() => {
                close(false);
                onNavigate(id);
              }}
            >
              <Icon size={16} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}