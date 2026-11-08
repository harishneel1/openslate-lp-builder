import { Fragment } from 'react';
import { ChevronLeft, ExternalLink, MessageCircle, Phone, Reply } from 'lucide-react';
import { initials } from '../utils/initials';
import '../components/WhatsAppTab.css'; // the phone (wamp__…), as the Reminders tab's preview
import './TemplatePhone.css';

// ------------------------------------------------------------
// One of the coach's own templates on a phone, as a student gets it:
// the message in WhatsApp's formatting (*bold*, _italic_, ~strike~), its
// {{1}} blanks filled with their samples (highlighted; an empty sample
// shows the blank itself), the footer, and the buttons under it.
// Used live in the editor (WhatsAppTemplateEditor.jsx) and in a
// template's pop-up (WhatsAppTemplates.jsx).
//   template: { body, samples, footer, buttons }
//   sender:   the business name at the top of the chat
// ------------------------------------------------------------
export default function TemplatePhone({ template, sender }) {
  const buttons = template.buttons ?? [];
  const empty = !template.body?.trim();

  return (
    <figure className="wamp__phone" aria-label={`The message on WhatsApp, from ${sender}`}>
      <div className="wamp__screen">
        <div className="wamp__top">
          <ChevronLeft size={18} aria-hidden="true" />
          <span className="wa-chat__face" aria-hidden="true">
            {initials(sender)}
          </span>
          <span className="wa-chat__who">
            <span className="wa-chat__name">{sender}</span>
            <span className="wa-chat__kind">Business account</span>
          </span>
        </div>

        <div className="wamp__chat">
          <div className="wamp__bubble">
            <p className={`wam__text ${empty ? 'tph__empty' : ''}`}>
              {empty ? (
                'Your message shows here as you type.'
              ) : (
                <Formatted body={template.body} samples={template.samples} />
              )}
              <span className="wa-chat__time">10:12 am</span>
            </p>
            {template.footer?.trim() && <p className="tph__footer">{template.footer}</p>}
            {buttons
              .filter((b) => b.text?.trim())
              .map((b, i) => {
                const Icon = b.type === 'url' ? ExternalLink : b.type === 'phone' ? Phone : Reply;
                return (
                  <span key={i} className="wamp__btn">
                    <Icon size={13} aria-hidden="true" />
                    {b.text}
                  </span>
                );
              })}
          </div>
        </div>

        <div className="wamp__reply" aria-hidden="true">
          <span className="wamp__reply-box">Message</span>
          <span className="wamp__reply-send">
            <MessageCircle size={15} />
          </span>
        </div>
      </div>
    </figure>
  );
}

// WhatsApp's formatting, with blanks filled: *bold*, _italic_, ~strike~, new lines
function Formatted({ body, samples = {} }) {
  const out = [];
  const on = { '*': false, _: false, '~': false };
  body.split(/(\{\{\d+\}\}|\*|_|~|\n)/g).forEach((part, i) => {
    if (!part) return;
    if (part in on) {
      on[part] = !on[part];
      return;
    }
    if (part === '\n') {
      out.push(<br key={i} />);
      return;
    }
    const blank = part.match(/^\{\{(\d+)\}\}$/);
    let node = blank ? (
      <mark key={i} className="wam__fill">
        {samples[blank[1]]?.trim() || part}
      </mark>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    );
    if (on['~']) node = <s key={i}>{node}</s>;
    if (on._) node = <em key={i}>{node}</em>;
    if (on['*']) node = <strong key={i}>{node}</strong>;
    out.push(node);
  });
  return out;
}