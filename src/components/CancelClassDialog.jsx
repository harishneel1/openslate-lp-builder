import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { classDay, classTimeRange } from '../data/batches';
import { zoneShort } from './BatchFields';
import './ConfirmDialog.css';
import './CancelClassDialog.css';

// ------------------------------------------------------------
// "Cancel this class?" — asked before the cancel page, so a class can
// also be cancelled quietly.
//
//   Cancel this class?
//   Tue 24 Nov, 6:00–7:00 pm IST. 12 students are booked.
//   Do you want to let them know?
//          [Keep class] [Cancel without notifying] [Cancel and notify students]
//
// The same look as every "Are you sure?" pop-up (ConfirmDialog.css): one
// right-aligned row of 44px buttons, stacked full width on a phone.
// With nobody booked there's no one to tell: Keep class and Cancel class.
// A click outside doesn't close it; ✕, Keep class and Escape do.
// The title takes focus on open (no ring), so Enter by habit cancels nothing.
//
// onNotify(): to the cancel page (the email), onQuiet(): cancel now, onClose()
// ------------------------------------------------------------
export default function CancelClassDialog({ batch, c, count, onNotify, onQuiet, onClose }) {
  const ref = useRef(null);
  const titleRef = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    titleRef.current?.focus(); // not the ✕ or a button, so no ring shows
    return () => dialog?.open && dialog.close();
  }, []);

  const when = `${classDay(c.date, null)}, ${classTimeRange(c, batch)} ${zoneShort(batch.timeZone)}`;

  return (
    <dialog
      ref={ref}
      className="confirm-dialog confirm-dialog--close ccd"
      aria-labelledby="ccd-title"
      aria-describedby="ccd-body"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <button type="button" className="confirm-dialog__close" onClick={onClose} aria-label="Close">
        <X size={18} aria-hidden="true" />
      </button>
      <h2 className="confirm-dialog__title ccd__title" id="ccd-title" tabIndex={-1} ref={titleRef}>
        Cancel this class?
      </h2>
      <div className="confirm-dialog__body" id="ccd-body">
        {count > 0 ? (
          <>
            <p>
              {when}. {count} {count === 1 ? 'student is' : 'students are'} booked.
            </p>
            <p>Do you want to let them know?</p>
          </>
        ) : (
          <p>{when}. Nobody is booked yet.</p>
        )}
      </div>
      <div className="confirm-dialog__actions ccd__actions">
        <button type="button" className="confirm-btn confirm-btn--quiet" onClick={onClose}>
          Keep class
        </button>
        {count > 0 ? (
          <>
            <button type="button" className="confirm-btn confirm-btn--quiet" onClick={onQuiet}>
              Cancel without notifying
            </button>
            <button type="button" className="confirm-btn confirm-btn--primary" onClick={onNotify}>
              Cancel and notify students
            </button>
          </>
        ) : (
          <button type="button" className="confirm-btn confirm-btn--primary" onClick={onQuiet}>
            Cancel class
          </button>
        )}
      </div>
    </dialog>
  );
}
