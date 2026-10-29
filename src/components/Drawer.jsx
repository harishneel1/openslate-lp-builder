import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import './Drawer.css';

// ------------------------------------------------------------
// A panel that slides in from the right, over the page, for work
// too big to fit inside a section (like a call's weekly hours).
//
// The browser's own <dialog>, opened as a modal: it sits above
// everything, dims the page, keeps the keyboard inside, and the
// page behind can't be clicked or scrolled. Shown while mounted:
// render it to open it, stop rendering it to close it. Focus goes
// back to whatever opened it.
//
//   ┌──────────────────────────┐
//   │ Title                  ✕ │  head: stays put
//   │ sub                      │
//   ├──────────────────────────┤
//   │                          │  body: scrolls
//   ├──────────────────────────┤
//   │ status       Cancel  Use │  footer: stays put
//   └──────────────────────────┘
//
// onClose: Escape, ✕ or a click on the dimmed page. The owner
//          decides whether to close (e.g. asks first about changes).
// footer:  the panel's own actions
// media:   optional, left of the title (e.g. a person's initials)
// extra:   optional, under the title (e.g. buttons to contact them)
// notice:  optional, a short-lived message (a toast) that floats over the
//          bottom of the body, just above the footer
// ------------------------------------------------------------
export default function Drawer({ title, sub, media, extra, notice, onClose, footer, className = '', children }) {
  const ref = useRef(null);
  const titleId = useId();
  const subId = useId();
  const close = useRef(onClose);
  close.current = onClose;

  // Open on mount; on unmount, close and hand focus back to what opened it
  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement;
    if (dialog && !dialog.open) dialog.showModal();
    // Keep the page behind still, so scrolling the panel doesn't move it
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      if (dialog?.open) dialog.close();
      root.style.overflow = overflow;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className={`drawer ${className}`}
      aria-labelledby={titleId}
      aria-describedby={sub ? subId : undefined}
      onCancel={(e) => {
        e.preventDefault(); // Escape: the owner decides
        close.current();
      }}
      // The dialog itself is only hit outside the panel: on the dimmed page
      onMouseDown={(e) => e.target === ref.current && close.current()}
    >
      <div className="drawer__panel">
        <header className="drawer__head">
          {media && <div className="drawer__media">{media}</div>}
          <div className="drawer__heading">
            <h2 className="drawer__title" id={titleId}>
              {title}
            </h2>
            {sub && (
              <p className="drawer__sub" id={subId}>
                {sub}
              </p>
            )}
            {extra && <div className="drawer__extra">{extra}</div>}
          </div>
          <button type="button" className="drawer__close" aria-label="Close" onClick={() => close.current()}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="drawer__body">{children}</div>

        {/* A zero-height anchor between body and footer: the notice floats
            up from it, over the body, without moving anything */}
        {notice && <div className="drawer__notice">{notice}</div>}

        {footer && <footer className="drawer__foot">{footer}</footer>}
      </div>
    </dialog>
  );
}