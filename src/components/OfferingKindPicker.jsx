import { useEffect, useRef } from 'react';
import { BookOpen, CalendarDays, ChevronRight, MessageSquare, Video, X } from 'lucide-react';
import './OfferingKindPicker.css';

// What can be added, in the order shown. ready: false shows the kind
// with "Coming soon" until its editor is built.
const KINDS = [
  {
    id: 'call',
    name: '1:1 call',
    text: 'A video or phone call people book at a time that suits them.',
    Icon: Video,
    ready: true,
  },
  {
    id: 'dm',
    name: 'Priority DMs',
    text: 'People send you a question, and you reply within a few days.',
    Icon: MessageSquare,
    ready: false,
  },
  {
    id: 'webinar',
    name: 'Webinar',
    text: 'A live session for a group, on a date you set.',
    Icon: CalendarDays,
    ready: false,
  },
  {
    id: 'course',
    name: 'Course',
    text: 'Lessons people buy and work through at their own pace.',
    Icon: BookOpen,
    ready: false,
  },
];

// ------------------------------------------------------------
// "Add a new offering": pick what kind first. A pop-up over the
// offerings home, so closing it leaves them where they were.
// One click on a kind goes straight to its editor.
//
// onPick(kindId): open the editor for a new one of that kind
// onClose: back to the offerings home, nothing added
//
// The browser's own <dialog>: it sits above everything, dims the page,
// keeps the keyboard inside, and Escape closes it.
// ------------------------------------------------------------
export default function OfferingKindPicker({ onPick, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.open && dialog.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className="okp"
      aria-labelledby="okp-title"
      onCancel={(e) => {
        e.preventDefault(); // Escape: we close it ourselves
        onClose();
      }}
      // A click on the dimmed page around it closes it too
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className="okp__head">
        <div>
          <h2 className="okp__title" id="okp-title">
            What do you want to offer?
          </h2>
          <p className="okp__sub">You can change everything about it before it goes on your page.</p>
        </div>
        <button type="button" className="okp__close" onClick={onClose} aria-label="Close">
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <ul className="okp__list">
        {KINDS.map(({ id, name, text, Icon, ready }) => (
          <li key={id}>
            <button
              type="button"
              className="okp__kind"
              onClick={() => onPick(id)}
              disabled={!ready}
              // The first one that can be picked has focus, so Enter picks it
              autoFocus={id === 'call'}
            >
              <span className="okp__icon" aria-hidden="true">
                <Icon size={20} strokeWidth={2} />
              </span>
              <span className="okp__text">
                <span className="okp__name">
                  {name}
                  {!ready && <span className="okp__soon">Coming soon</span>}
                </span>
                <span className="okp__blurb">{text}</span>
              </span>
              {ready && <ChevronRight size={18} className="okp__go" aria-hidden="true" />}
            </button>
          </li>
        ))}
      </ul>
    </dialog>
  );
}