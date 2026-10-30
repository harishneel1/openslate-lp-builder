import { useEffect, useRef } from 'react';
import { MoreHorizontal } from 'lucide-react';
import './RowMenu.css';

// ------------------------------------------------------------
// ⋯ on a row: its less common actions, in words. Used by 1:1 calls and
// My offerings, and looks like Contracts' menu. Closes on a click outside
// or Escape (back to ⋯); the keyboard lands on the first item, and up and
// down move between items.
//
// title: what the row is ("More for Discovery call")
// open / onOpenChange(open): the parent keeps which row's menu is open
// items: [{ label, icon (a lucide icon), danger, onSelect, disabled, hint }]
//   disabled: shown but does nothing (greyed), with hint under it saying
//   why ("People signed up, so it can't be deleted."), so the coach learns
//   the rule where they looked for the action
// ------------------------------------------------------------
export default function RowMenu({ title, open, onOpenChange, items }) {
  const wrap = useRef(null);
  const button = useRef(null);
  const menuId = useRef(`row-menu-${Math.random().toString(36).slice(2)}`).current;

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!wrap.current?.contains(e.target)) onOpenChange(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
        button.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    wrap.current?.querySelector('[role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const onMenuKey = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const list = [...wrap.current.querySelectorAll('[role="menuitem"]')];
    const at = list.indexOf(document.activeElement);
    list[(at + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length]?.focus();
  };

  return (
    <div className="row-menu" ref={wrap}>
      <button
        ref={button}
        type="button"
        className="row-menu__button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`More for ${title}`}
        onClick={() => onOpenChange(!open)}
      >
        <MoreHorizontal size={18} aria-hidden="true" />
      </button>

      {open && (
        <div className="row-menu__list" id={menuId} role="menu" aria-label={`More for ${title}`} onKeyDown={onMenuKey}>
          {items.map(({ label, icon: Icon, danger, onSelect, disabled = false, hint = null }) => (
            <button
              key={label}
              type="button"
              role="menuitem"
              aria-disabled={disabled || undefined}
              className={`row-menu__item ${danger ? 'row-menu__item--danger' : ''} ${disabled ? 'row-menu__item--off' : ''}`}
              onClick={disabled ? undefined : onSelect}
            >
              {Icon && <Icon size={16} aria-hidden="true" />}
              <span className="row-menu__text">
                {label}
                {hint && <span className="row-menu__hint">{hint}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}