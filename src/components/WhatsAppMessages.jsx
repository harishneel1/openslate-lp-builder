import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Eye, MessageCircle } from 'lucide-react';
import Drawer from './Drawer';
import { messageStatus } from '../data/whatsappConnection';
import { BUTTONS, MESSAGES, WHATSAPP_SWITCHES_EVENT, setSwitch, switchesOf } from '../data/whatsappMessages';
import { initials } from '../utils/initials';
import '../screens/WebinarReminders.css'; // the rows, switch and icon button, as for the emails
import './WhatsAppTab.css';

// ------------------------------------------------------------
// The WhatsApp reminders of one webinar session or call, once a number
// is connected (WhatsAppTab.jsx). Laid out like the email list, with
// Meta's review under each name while it matters:
//
//   WhatsApp reminders
//   Sent from your number as well as the emails…
//
//   Message                                          On    View
//   24 hours before                                [●━]     👁
//   1 hour before                                  [●━]     👁
//     [In review] Meta is checking it. Until then, only the email goes.
//
// An approved message says nothing. A switched-off one is greyed and
// only says if Meta rejected it (switching it on wouldn't send it).
//
// View opens the message as a student sees it on WhatsApp, with example
// details, and why Meta said no if it did. The wording is ours and fixed,
// by design: coaches choose which messages go, never what they say.
//
// connection: the connected (or lost) number
// kind: 'call' | 'webinar'
// offering: whose switches ('call:<id>' or 'webinar:<id>')
// offeringName: the call's or webinar's name, for the preview
// links: where the preview's buttons lead: { meetingLink, callId } for a
//        call, { webinarId } for a webinar
// ------------------------------------------------------------
export default function WhatsAppMessages({ connection, kind, offering, offeringName, links }) {
  const switches = useSwitches(offering, kind);
  const [viewing, setViewing] = useState(null); // the message open in its preview
  const lost = connection.status === 'lost';
  const messages = MESSAGES[kind];
  const who = kind === 'call' ? 'people who book' : 'people who register';

  return (
    <div className="wam">
      <div className="wam__head">
        <h3 className="wa-head__title">WhatsApp reminders</h3>
        <p className="wa-head__text">
          Sent from your number as well as the emails, to {who}. Kept to the ones that matter most, so no one gets too
          many messages.
        </p>
      </div>

      <div className="rm wam__table" role="table" aria-label="WhatsApp reminders">
        <div className="rm__head" role="row">
          <span role="columnheader">Message</span>
          <span role="columnheader" className="rm__col">
            On
          </span>
          <span role="columnheader" className="rm__col">
            View
          </span>
        </div>

        {messages.map((m) => {
          const on = switches[m.id];
          const status = messageStatus(connection, m.id);
          return (
            <div key={m.id} role="row" className={`rm__row wam__row ${on ? '' : 'rm__row--off'}`}>
              <span role="cell" className="wam__name-cell">
                <span className="rm__name">{m.name}</span>
                <RowStatus on={on} lost={lost} status={status} onWhy={() => setViewing(m)} />
              </span>

              <span role="cell" className="rm__col">
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={`Send the WhatsApp reminder ${m.name.toLowerCase()}`}
                  className="rm__switch"
                  onClick={() => setSwitch(offering, m.id, !on)}
                >
                  <span className="rm__switch-thumb" aria-hidden="true" />
                </button>
              </span>

              <span role="cell" className="rm__col">
                <button
                  type="button"
                  className="rm__icon"
                  onClick={() => setViewing(m)}
                  aria-label={`See the WhatsApp reminder ${m.name.toLowerCase()}`}
                  data-tip="See message"
                  data-tip-align="end"
                >
                  <Eye size={16} aria-hidden="true" />
                </button>
              </span>
            </div>
          );
        })}
      </div>

      {viewing && (
        <MessagePreview
          message={viewing}
          kind={kind}
          connection={connection}
          offeringName={offeringName}
          links={links}
          onClose={() => setViewing(null)}
          onPick={setViewing}
        />
      )}
    </div>
  );
}

// The switches, kept up to date when they change anywhere
export function useSwitches(offering, kind) {
  const [switches, setSwitches] = useState(() => switchesOf(offering, kind));
  useEffect(() => {
    const refresh = () => setSwitches(switchesOf(offering, kind));
    refresh();
    window.addEventListener(WHATSAPP_SWITCHES_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(WHATSAPP_SWITCHES_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [offering, kind]);
  return switches;
}

// Under a message's name: why it isn't going, if it isn't. A rejected
// message says so even when switched off, since switching it on won't
// send it; the rest only matter while it's on.
function RowStatus({ on, lost, status, onWhy }) {
  if (status === 'rejected' && !lost) {
    return (
      <span className="wam__status">
        <span className="wa-badge wa-badge--bad">Not approved</span> {on ? 'Only the email goes.' : ''}
        <button type="button" className="cal-link wam__why" onClick={onWhy}>
          See why
        </button>
      </span>
    );
  }
  if (!on) return null;
  if (lost) {
    return (
      <span className="wam__status">
        <span className="wa-badge wa-badge--bad">Paused</span> The email still goes.
      </span>
    );
  }
  if (status === 'review') {
    return (
      <span className="wam__status">
        <span className="wa-badge wa-badge--wait">In review</span> Meta is checking it. Until then, only the email goes.
      </span>
    );
  }
  return null;
}

// ------------------------------------------------------------
// One message, as a phone shows it, explained the way the storefront
// explains its example page: the picture does the talking, and a few
// orange pills point at what matters.
//
//   ┌──────────────────┐
//   │ ● Harish Neel    │
//   │ Hi [Priya], …    │──── Filled in for each booking
//   │  Manage booking ↗│──── Tap to try it
//   │ [ Message      ] │──── Replies come to your WhatsApp
//   └──────────────────┘
//    What your customers receive
//
//   ‹ 24 hours before                     5 minutes before ›
//
// The buttons work: each opens where it really goes, in a new tab. Manage
// booking opens the booking page in sample mode (ManageBookingPage.jsx),
// so trying Cancel there can't touch a real booking. A hover hint says
// where each goes, for anyone who'd rather not click.
//
// Too narrow for pills beside the phone (a phone's own screen), the pills
// become a short list under it, with matching numbered dots on the phone.
// The footer flips through this page's messages in the order they go.
// ------------------------------------------------------------
//
// Also used by Settings → WhatsApp → Templates (WhatsAppTemplates.jsx),
// for a sample with no particular webinar or call behind it:
//   links null      the buttons show but go nowhere (no "Tap to try it")
//   showStatus      false: no review line (not connected yet)
//   title           the drawer's title, if not "WhatsApp reminder: …"
export function MessagePreview({
  message,
  kind,
  connection,
  offeringName,
  links,
  onClose,
  onPick,
  showStatus = true,
  title,
}) {
  const status = showStatus ? messageStatus(connection, message.id) : null;
  const lost = showStatus && connection.status === 'lost';
  const all = MESSAGES[kind];
  const at = all.findIndex((m) => m.id === message.id);
  const before = all[at - 1] ?? null;
  const after = all[at + 1] ?? null;
  const values = {
    first_name: 'Priya',
    host: connection.name,
    call: offeringName,
    webinar: offeringName,
    batch: offeringName,
    next: 'Thu 19 Nov',
    date: 'Thu 12 Nov',
    time: kind === 'call' ? '4:00 pm' : '7:00 pm',
  };

  const notes = [
    { id: 'fill', target: '.wam__fill', label: 'Filled in for each booking' },
    ...(links ? [{ id: 'tap', target: '.wamp__btn', label: 'Tap to try it' }] : []),
    { id: 'reply', target: '.wamp__reply', label: 'Replies come to your WhatsApp' },
  ];

  return (
    <Drawer
      title={title ?? `WhatsApp reminder: ${message.name.toLowerCase()}`}
      sub={message.when}
      onClose={onClose}
      footer={
        <>
          {before ? (
            <button type="button" className="wamp__flip" onClick={() => onPick(before)}>
              <ChevronLeft size={16} aria-hidden="true" /> {before.name}
            </button>
          ) : (
            <span />
          )}
          {after && (
            <button type="button" className="wamp__flip wamp__flip--next" onClick={() => onPick(after)}>
              {after.name} <ChevronRight size={16} aria-hidden="true" />
            </button>
          )}
        </>
      }
    >
      {lost ? (
        <p className="wamp__status wamp__status--bad">Paused: WhatsApp dropped your number. The email still goes.</p>
      ) : status === 'review' ? (
        <p className="wamp__status">Meta is checking this message. Until it’s approved, only the email goes.</p>
      ) : status === 'rejected' ? (
        <p className="wamp__status wamp__status--bad">Meta didn’t approve this message. Only the email goes for now.</p>
      ) : null}

      <Annotated notes={notes} watch={message.id} caption={<p className="wamp__caption">What your customers receive</p>}>
        <PhoneMessage message={message} kind={kind} sender={connection.name} values={values} links={links} />
      </Annotated>
    </Drawer>
  );
}

// The phone, showing one message as the student gets it. Also used by
// Settings → WhatsApp → Templates (WhatsAppTemplates.jsx).
//   sender   the business name at the top of the chat
//   values   the blanks' sample values ({ first_name, call, … })
//   links    where the buttons go (see hrefFor), or null: they show but go nowhere
export function PhoneMessage({ message, kind, sender, values, links }) {
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
            <p className="wam__text">
              <Filled body={message.body} values={values} />
              <span className="wa-chat__time">{message.sentAt}</span>
            </p>
            {message.buttons.map((b) =>
              links ? (
                <a
                  key={b}
                  className="wamp__btn"
                  href={hrefFor(kind, b, links)}
                  target="_blank"
                  rel="noreferrer"
                  // The browser's own hint: the phone's rounded screen would clip ours
                  title={BUTTONS[kind][b].hint}
                >
                  {BUTTONS[kind][b].label}
                  <ExternalLink size={13} aria-hidden="true" />
                </a>
              ) : (
                // A sample: shows where it'd go, goes nowhere
                <span key={b} className="wamp__btn" title={BUTTONS[kind][b].hint}>
                  {BUTTONS[kind][b].label}
                </span>
              ),
            )}
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

// Where a button really goes, for the coach to open:
//   manage   the booking page, in sample mode (never a real booking)
//   join     a call's meeting link, or a webinar's room
//   details  a webinar's thank-you page
//   links: { meetingLink, callId } for a call, { webinarId } for a webinar
function hrefFor(kind, button, links = {}) {
  if (kind === 'call') {
    if (button === 'join') return links.meetingLink;
    return `?mock=manage&booking=sample&service=${encodeURIComponent(links.callId ?? '')}`;
  }
  const id = encodeURIComponent(links.webinarId ?? '');
  return button === 'join' ? `?mock=zoom&webinar=${id}` : `?preview=${id}&page=thank-you`;
}

// The phone, with an orange pill beside it for each note, on a line to the
// part it's about (found by CSS selector, as the storefront's annotations
// are). Without the room, the pills become a numbered list under it.
//   notes: [{ id, target, label }]; a note whose part isn't there is left out
//   watch: re-measure when this changes (another message)
const PILL_ROOM = 470; // the width the phone and its pills need side by side

function Annotated({ notes, watch, caption, children }) {
  const stage = useRef(null);
  const [marks, setMarks] = useState([]); // [{ id, label, y, n }]
  const [wide, setWide] = useState(true);

  const measureRef = useRef(() => {});

  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return undefined;
    const measure = () => {
      const box = el.getBoundingClientRect();
      const phone = el.firstElementChild?.getBoundingClientRect();
      setWide(box.width >= PILL_ROOM);
      const found = [];
      for (const note of notes) {
        const part = el.querySelector(note.target);
        if (!part) continue;
        const r = part.getBoundingClientRect();
        // A dot sits on the phone's edge, level with its part, so it covers nothing
        const x = (phone ? phone.right : r.right) - box.left;
        found.push({ ...note, y: r.top - box.top + r.height / 2, x, n: found.length + 1 });
      }
      setMarks(found);
    };
    measureRef.current = measure;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [watch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Switching between pills and dots moves the phone (left, or centred)
  // without resizing the stage, so measure again once it has moved
  useLayoutEffect(() => measureRef.current(), [wide]);

  return (
    <>
      <div ref={stage} className={`wamp__stage ${wide ? 'wamp__stage--wide' : ''}`}>
        {children}
        {marks.map((m) =>
          wide ? (
            <span key={m.id} className="wamp__pill" style={{ top: m.y }}>
              {m.label}
            </span>
          ) : (
            <span key={m.id} className="wamp__dot" style={{ top: m.y, left: m.x }} aria-hidden="true">
              {m.n}
            </span>
          ),
        )}
      </div>
      {caption}
      {!wide && marks.length > 0 && (
        <ol className="wamp__notes">
          {marks.map((m) => (
            <li key={m.id}>
              <span className="wamp__dot wamp__dot--inline" aria-hidden="true">
                {m.n}
              </span>
              {m.label}
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

// The message with its blanks filled in and highlighted, in WhatsApp's
// own formatting: *bold* (which can wrap a blank), and new lines
function Filled({ body, values }) {
  const out = [];
  let bold = false;
  body.split(/(\*|\{\w+\}|\n)/g).forEach((part, i) => {
    if (!part) return;
    if (part === '*') {
      bold = !bold;
      return;
    }
    if (part === '\n') {
      out.push(<br key={i} />);
      return;
    }
    const blank = part.match(/^\{(\w+)\}$/);
    let node = blank ? (
      <mark key={i} className="wam__fill">
        {values[blank[1]] ?? part}
      </mark>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    );
    if (bold) node = <strong key={i}>{node}</strong>;
    out.push(node);
  });
  return out;
}