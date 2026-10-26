import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import './ConfirmDialog.css';

// ------------------------------------------------------------
// "Are you sure?" pop-up, as in Contracts: the browser's own <dialog>,
// which dims the page, keeps the keyboard inside, and closes on Escape or
// a click outside (not for a form; see `form`). Cancel has focus first, so Enter by habit does nothing.
// Used by 1:1 calls (Delete) and My offerings (Remove from page).
//
// title, children (what happens, in a sentence or two)
// confirmLabel: the action's words ("Delete call")
// danger: the action's button in red (for what can't be undone)
// cancelLabel: the quiet button's words (default Cancel)
// onCancel(), onConfirm()
// ------------------------------------------------------------
// confirmDisabled: the action can't happen yet (e.g. a date still to fix); the button says so and does nothing
// form: it has fields to fill (Run again). A click outside doesn't close it,
//   so a date they've picked isn't lost by a stray click; Cancel and Escape
//   still do. Its date and time panels can open past its edges.
// stayOpen: a click outside doesn't close it either, for a pop-up with no
//   fields (Reset to default template); Cancel, ✕ and Escape still do
// closeButton: a ✕ in the top right corner, which does what Cancel does
export default function ConfirmDialog({
  title,
  children,
  confirmLabel,
  cancelLabel = 'Cancel',
  danger = false,
  confirmDisabled = false,
  form = false,
  stayOpen = false,
  closeButton = false,
  onCancel,
  onConfirm,
}) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.open && dialog.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className={['confirm-dialog', form && 'confirm-dialog--form', closeButton && 'confirm-dialog--close']
        .filter(Boolean)
        .join(' ')}
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-body"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      onClick={(e) => !form && !stayOpen && e.target === ref.current && onCancel()}
    >
      {closeButton && (
        <button type="button" className="confirm-dialog__close" onClick={onCancel} aria-label="Close">
          <X size={18} aria-hidden="true" />
        </button>
      )}
      <h2 className="confirm-dialog__title" id="confirm-dialog-title">
        {title}
      </h2>
      <div className="confirm-dialog__body" id="confirm-dialog-body">
        {children}
      </div>
      <div className="confirm-dialog__actions">
        <button type="button" className="confirm-btn confirm-btn--quiet" onClick={onCancel} autoFocus>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={`confirm-btn ${danger ? 'confirm-btn--danger' : 'confirm-btn--primary'}`}
          aria-disabled={confirmDisabled || undefined}
          onClick={() => !confirmDisabled && onConfirm()}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}