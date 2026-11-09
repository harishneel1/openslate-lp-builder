import { useLayoutEffect, useState } from 'react';
import { LifeBuoy, Settings } from 'lucide-react';
import { usePanel } from './DatePicker';
import { SUPPORT_EMAIL } from '../data/metaSignup';
import './AccountMenu.css';

// ------------------------------------------------------------
// Who's signed in, at the foot of the sidebar (AppLayout.jsx), under
// Settings. Collapsed it's their initial; opened, their name too. A click
// opens a small menu above it, for account things:
//
//         ┌──────────────────┐
//         │ Harish Neel      │
//         │ ⚙ Settings       │
//         │ ◎ Get help       │
//         └──────────────────┘
//   (H) Harish Neel
//
// Settings is also its own item just above (one click, always in view);
// it's here too because the account is where some people look for it.
// More (Sign out) can join the menu later.
//
// The menu is fixed to the screen, beside the avatar, so the sidebar's
// scrolling can't clip it. Closes on a click outside, Escape (back to the
// avatar) or a pick.
// onNavigate(id): App's sidebar navigation
// ------------------------------------------------------------

export default function AccountMenu({ name = 'Harish Neel', initial = 'H', onNavigate }) {
  const { open, setOpen, close, wrapRef, triggerRef, onPanelKeyDown } = usePanel();
  const [place, setPlace] = useState(null); // where the menu sits: { left, bottom }

  useLayoutEffect(() => {
    if (!open) return;
    const r = triggerRef.current.getBoundingClientRect();
    setPlace({ left: r.left, bottom: window.innerHeight - r.top + 8 });
  }, [open, triggerRef]);

  return (
    <div className="acct" ref={wrapRef}>
      <button
        type="button"
        ref={triggerRef}
        className="acct__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${name}: your account`}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <span className="acct__avatar" aria-hidden="true">
          {initial}
        </span>
        <span className="acct__who sidebar__label">{name}</span>
      </button>
      {open && place && (
        <div
          className="acct__menu"
          role="menu"
          aria-label="Your account"
          onKeyDown={onPanelKeyDown}
          style={{ left: place.left, bottom: place.bottom }}
        >
          <p className="acct__name">{name}</p>
          <button
            type="button"
            role="menuitem"
            className="acct__item"
            autoFocus
            onClick={() => {
              close(false);
              onNavigate('settings');
            }}
          >
            <Settings size={16} aria-hidden="true" />
            Settings
          </button>
          <a role="menuitem" className="acct__item" href={`mailto:${SUPPORT_EMAIL}`} onClick={() => close(false)}>
            <LifeBuoy size={16} aria-hidden="true" />
            Get help
          </a>
        </div>
      )}
    </div>
  );
}