import { useEffect, useRef } from 'react';
import { Check, Copy, MessageCircle, X } from 'lucide-react';
import { useCopy } from '../screens/OfferingsHome';
import { whatsappShareHref } from '../utils/whatsapp';
import './ShareDialog.css';

// ------------------------------------------------------------
// Share pop-up, like YouTube's: what's being shared, a row of apps, then
// the link with Copy. The browser's own <dialog> (as ConfirmDialog), so it
// dims the page, keeps the keyboard inside, and closes on Escape, ✕ or a
// click outside.
//
//   Share webinar                                   ✕
//   Fix the Vasthu mistakes that block money…
//   Mon 9 Nov, 7:00 pm IST · Free
//
//    (●)
//   WhatsApp
//
//   [ localhost:5173/fix-the-vasthu-mistakes | Copy ]
//
// Only WhatsApp for now. APPS is the one place to add more (Telegram,
// Email…): each takes the message and returns its link.
//
// heading: the pop-up's title ('Share webinar')
// name: what's being shared; meta: one line under it (date · price), optional
// url: the link to share; message: the text the apps get (with the link in it)
// onClose()
// ------------------------------------------------------------

const APPS = [{ id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, href: whatsappShareHref }];

export default function ShareDialog({ heading = 'Share', name, meta = null, url, message, onClose }) {
  const ref = useRef(null);
  const [copy, copyLink] = useCopy();
  const copied = copy === 'copied';
  const shown = url.replace(/^https?:\/\//, '');

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.open && dialog.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className="share-dialog"
      aria-labelledby="share-dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className="share-dialog__head">
        <h2 className="share-dialog__title" id="share-dialog-title">
          {heading}
        </h2>
        <button type="button" className="share-dialog__close" onClick={onClose} aria-label="Close">
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <div className="share-dialog__what">
        <p className="share-dialog__name">{name}</p>
        {meta && <p className="share-dialog__meta">{meta}</p>}
      </div>

      <ul className="share-dialog__apps" aria-label="Share to">
        {APPS.map(({ id, label, icon: Icon, href }) => (
          <li key={id}>
            <a
              className={`share-dialog__app share-dialog__app--${id}`}
              href={href(message)}
              target="_blank"
              rel="noopener"
              aria-label={`Share on ${label} (opens in a new tab)`}
            >
              <span className="share-dialog__app-icon" aria-hidden="true">
                <Icon size={26} />
              </span>
              <span className="share-dialog__app-label">{label}</span>
            </a>
          </li>
        ))}
      </ul>

      <div className="share-dialog__link" role="group" aria-label="Landing page link">
        <span className="share-dialog__url" title={url}>
          {shown}
        </span>
        <button
          type="button"
          className={`share-dialog__copy ${copied ? 'share-dialog__copy--done' : ''}`}
          onClick={() => copyLink(url)}
          aria-label={copied ? 'Link copied' : 'Copy link'}
          autoFocus
        >
          {copied ? <Check size={15} strokeWidth={3} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <span className="share-dialog__sr" aria-live="polite">
        {copied && 'Link copied'}
      </span>
      {copy === 'failed' && (
        <p className="share-dialog__error" role="alert">
          Couldn’t copy. Select the link and copy it yourself.
        </p>
      )}
    </dialog>
  );
}