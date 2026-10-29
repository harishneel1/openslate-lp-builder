import { Archive, ArrowLeft, CornerUpLeft, Mail, MoreVertical, Star, Trash2 } from 'lucide-react';
import './InboxPreview.css';

// ------------------------------------------------------------
// An email as it looks opened in a desktop inbox: the subject large at
// the top, the sender's row (avatar, name, "to me", time), then the
// email at the usual 600px email width. Looks like Gmail on a laptop,
// without Google's name or logo.
//
//   ┌ ←  ▢  🗑  ✉                                         ┐
//   │ You're registered: Fix the Vasthu…          [Inbox]  │
//   │ (H) Harish Neel                        2:15 PM ☆ ↩ ⋮ │
//   │     to me                                            │
//   │     Hi Priya,                                        │
//   │     …                                                │
//   │     [ Join webinar ]                                 │
//   │     You're getting this because…                     │
//   └──────────────────────────────────────────────────────┘
//
// Only shows; nothing in it is clickable except links, which open in a
// new tab (so the editor is never left by accident).
//
// subject: plain text, filled in
// bodyHtml: the email's simple HTML, filled in (already safe: built by
//           the editor's clean() with escaped values)
// fromName, toEmail, time ("2:15 PM")
// join: { label, href } for the Join button, or null
// afterJoinHtml: a part of the email under the button (a 1:1 call's
//                reschedule-or-cancel line), filled in and already safe
// footer: the small print at the bottom
// ------------------------------------------------------------
export default function InboxPreview({ subject, bodyHtml, fromName, toEmail, time, join = null, afterJoinHtml = '', footer }) {
  const initial = (fromName || '?').trim().charAt(0).toUpperCase();

  // Links open in a new tab, never in place of the editor
  const onClick = (e) => {
    const link = e.target.closest('a');
    if (!link) return;
    e.preventDefault();
    window.open(link.href, '_blank', 'noopener');
  };

  return (
    <div className="ib" onClick={onClick}>
      <div className="ib__bar" aria-hidden="true">
        <ArrowLeft size={18} />
        <Archive size={17} />
        <Trash2 size={17} />
        <Mail size={17} />
      </div>

      <div className="ib__subject-row">
        <h2 className="ib__subject">{subject || '(no subject)'}</h2>
        <span className="ib__tag">Inbox</span>
      </div>

      <div className="ib__msg">
        <span className="ib__avatar" aria-hidden="true">
          {initial}
        </span>
        <div className="ib__main">
          <div className="ib__from-row">
            <p className="ib__from">
              <b>{fromName}</b>
            </p>
            <span className="ib__time">
              {time}
              <Star size={16} aria-hidden="true" />
              <CornerUpLeft size={16} aria-hidden="true" />
              <MoreVertical size={16} aria-hidden="true" />
            </span>
          </div>
          <p className="ib__to">to {toEmail ? 'me' : 'you'}</p>

          <div className="ib__email">
            <div className="ib__body" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
            {join && (
              <a className="ib__join" href={join.href}>
                {join.label}
              </a>
            )}
            {afterJoinHtml && <div className="ib__body ib__after" dangerouslySetInnerHTML={{ __html: afterJoinHtml }} />}
            {footer && <p className="ib__foot">{footer}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}