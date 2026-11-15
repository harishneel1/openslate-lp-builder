import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';

// ------------------------------------------------------------
// A ⋯ button with a menu of actions, in words with an icon each, as on
// the Courses page's cards. Styled by CoursesPage.css (crs-icon-btn,
// crs-menu). Closes on a choice, a click outside or Escape (back to ⋯).
// Up and down move between the items; one that can't be used now is
// shown faded and skipped.
//
// label: what the menu is for, read out on ⋯ ("More for Section 1")
// items: [{ label, icon, onSelect, danger?, disabled? } | { divider: true }]
// small: a 34px button, for lesson rows
// ------------------------------------------------------------
export default function ActionMenu({ label, items, small = false }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);
  const button = useRef(null);
  const menuId = useRef(`am-${Math.random().toString(36).slice(2)}`).current;

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!wrap.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    wrap.current?.querySelector('[role="menuitem"]:not([aria-disabled="true"])')?.focus();
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const onMenuKey = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const list = [...wrap.current.querySelectorAll('[role="menuitem"]:not([aria-disabled="true"])')];
    const at = list.indexOf(document.activeElement);
    list[(at + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length]?.focus();
  };

  return (
    <div className={`crs-menu ${open ? 'crs-menu--open' : ''}`} ref={wrap}>
      <button
        ref={button}
        type="button"
        className={`crs-icon-btn ${small ? 'crs-icon-btn--small' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <MoreHorizontal size={18} aria-hidden="true" />
        <span className="sr-only">{label}</span>
      </button>
      {open && (
        <div className="crs-menu__list" id={menuId} role="menu" aria-label={label} onKeyDown={onMenuKey}>
          {items.map((item, i) =>
            item.divider ? (
              <div key={`d${i}`} className="crs-menu__divider" role="separator" />
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                className={`crs-menu__item ${item.danger ? 'crs-menu__item--danger' : ''}`}
                aria-disabled={item.disabled || undefined}
                onClick={() => {
                  if (item.disabled) return;
                  setOpen(false);
                  item.onSelect();
                }}
              >
                {item.icon && <item.icon size={16} aria-hidden="true" />}
                {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}