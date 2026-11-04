import { Mail, MessageCircle } from 'lucide-react';
import { useWhatsApp } from './WhatsAppTab';
import { useSwitches } from './WhatsAppMessages';
import { SETUP_STEPS, hasNumber, messageStatus, setupStep } from '../data/whatsappConnection';
import { MESSAGES } from '../data/whatsappMessages';
import './ReminderChannels.css';

// ------------------------------------------------------------
// The top of the Reminders tab, on a webinar's page (WebinarDetails.jsx)
// and a 1:1 call's page (CallOverview.jsx): two big cards, one per way
// reminders go out. The chosen one lights up in its own colour and
// points down at what's below, which gets a line in the same colour, so
// it's clear the cards swap the whole page.
//
//   ┌──────────────────────────┐ ┌──────────────────────────┐
//   │ [logo] Email             │ │ [logo] WhatsApp          │
//   │ 3 of 3 reminders on      │ │ Not connected · Set it up│
//   └────▼─────────────────────┘ └──────────────────────────┘
//   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  (the chosen one's colour)
//
// Each card's second line is worth reading on its own, so a creator
// looking at one channel sees when the other needs them:
//   Email     "3 of 3 reminders on", "All off"
//   WhatsApp  "Not connected · Set it up", "Step 2 of 3" (setting up),
//             "2 of 3 reminders on · 1 in review",
//             and in red "Paused", "Needs a new name",
//             "1 message not approved"
//
// Email is the default. The page keeps which card is open in its own
// tab state ('whatsapp', beside the email tab's id).
//
// channel: 'email' | 'whatsapp'; onChannel(channel)
// kind: 'call' | 'webinar'
// offering: whose WhatsApp switches ('call:<id>' or 'webinar:<id>')
// emailOn, emailTotal: how many of the page's emails are switched on
// ------------------------------------------------------------

// The real logos. Stand-in icons show until these are set: put the
// official files in src/assets and import them here, e.g.
//   import gmailLogo from '../assets/gmail.svg';
//   import whatsappLogo from '../assets/whatsapp.svg';
//   const LOGOS = { email: gmailLogo, whatsapp: whatsappLogo };
const LOGOS = { email: null, whatsapp: null };

export default function ReminderChannels({ channel, onChannel, kind, offering, emailOn, emailTotal }) {
  const connection = useWhatsApp();
  const switches = useSwitches(offering, kind);
  const whatsapp = whatsAppSummary(connection, kind, switches);
  const email = emailOn === 0 ? { text: 'All off' } : { text: `${emailOn} of ${emailTotal} reminders on` };

  return (
    <>
      <div className="rc" role="group" aria-label="Send reminders by">
        <Card id="email" label="Email" summary={email} chosen={channel === 'email'} onChoose={onChannel} />
        <Card id="whatsapp" label="WhatsApp" summary={whatsapp} chosen={channel === 'whatsapp'} onChoose={onChannel} />
      </div>
      <div className={`rc__rule rc__rule--${channel}`} aria-hidden="true" />
    </>
  );
}

function Card({ id, label, summary, chosen, onChoose }) {
  return (
    <button
      type="button"
      className={`rc__card rc__card--${id}`}
      aria-pressed={chosen}
      onClick={() => onChoose(id)}
    >
      <ChannelLogo id={id} />
      <span className="rc__text">
        <span className="rc__label">{label}</span>
        <span className={`rc__summary ${summary.warn ? 'rc__summary--warn' : ''}`}>{summary.text}</span>
      </span>
    </button>
  );
}

// The channel's logo: the real one once it's in LOGOS, a stand-in till then
function ChannelLogo({ id }) {
  if (LOGOS[id]) return <img src={LOGOS[id]} alt="" className="rc__logo rc__logo--img" />;
  const Icon = id === 'email' ? Mail : MessageCircle;
  return (
    <span className={`rc__logo rc__logo--${id}`} aria-hidden="true">
      <Icon size={18} strokeWidth={2.25} />
    </span>
  );
}

// What the WhatsApp card says under its name
function whatsAppSummary(connection, kind, switches) {
  const step = setupStep(connection);
  if (step) return { text: `Step ${step} of ${SETUP_STEPS}` };
  if (!hasNumber(connection)) return { text: 'Not connected · Set it up' };
  if (connection.status === 'lost') return { text: 'Paused', warn: true };
  if (connection.nameStatus === 'rejected') return { text: 'Needs a new name', warn: true };

  const ids = MESSAGES[kind].map((m) => m.id);
  const rejected = ids.filter((id) => messageStatus(connection, id) === 'rejected').length;
  if (rejected) return { text: rejected === 1 ? '1 message not approved' : `${rejected} messages not approved`, warn: true };

  const on = ids.filter((id) => switches[id]);
  if (on.length === 0) return { text: 'All off' };
  const inReview = on.filter((id) => messageStatus(connection, id) === 'review').length;
  const count = `${on.length} of ${ids.length} reminders on`;
  if (connection.nameStatus === 'review' || inReview) return { text: `${count} · ${inReview ? `${inReview} in review` : 'name in review'}` };
  return { text: count };
}