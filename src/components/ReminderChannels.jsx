import { Mail, MessageCircle } from 'lucide-react';
import { useWhatsApp } from './WhatsAppTab';
import { useSwitches } from './WhatsAppMessages';
import { hasNumber, messageStatus } from '../data/whatsappConnection';
import { MESSAGES } from '../data/whatsappMessages';
import './ReminderChannels.css';

// ------------------------------------------------------------
// The top of the Reminders tab, on a webinar's page (WebinarDetails.jsx)
// and a 1:1 call's page (CallOverview.jsx): which reminders show below,
// the emails or WhatsApp. A two-way switch, the same kind as the Bookings
// tab's Upcoming | Past | Cancelled (.cov__filters, CallOverview.css): a
// light grey track, with a black block under the chosen half (white words
// on it, as the Cloud Storage page's chosen filter) that slides across
// when the other half is clicked. Each half has the channel's logo and a
// short count, so it's plain these are two views.
//
//   ┌────────────────────────┬────────────────────────┐
//   │█[✉] Email          3/3█│ [●] WhatsApp       4/4 │
//   └────────────────────────┴────────────────────────┘
//   ──────────────────────────────────────────────────────
//
// The count says how many of its reminders are on, so a creator looking
// at one channel still sees when the other needs them:
//   Email     "3/3", "Off"
//   WhatsApp  "Not set up" (it's set up in Settings), "4/4",
//             "4/4 · 1 in review", and in red "Paused",
//             "Needs a new name", "1 not approved"
//
// Tabs to screen readers (tablist), with left and right arrows to move.
// Email is the default. The page keeps which half is chosen in its own
// tab state ('whatsapp', beside the email tab's id).
//
// channel: 'email' | 'whatsapp'; onChannel(channel)
// kind: 'call' | 'webinar'
// offering: whose WhatsApp switches ('call:<id>' or 'webinar:<id>')
// emailOn, emailTotal: how many of the page's emails are switched on
// ------------------------------------------------------------

const CHANNELS = [
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
];

export default function ReminderChannels({ channel, onChannel, kind, offering, emailOn, emailTotal }) {
  const connection = useWhatsApp();
  const switches = useSwitches(offering, kind);
  const summaries = {
    email: emailOn === 0 ? { text: 'Off' } : { text: `${emailOn}/${emailTotal}` },
    whatsapp: whatsAppSummary(connection, kind, switches),
  };

  const onKey = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const next = channel === 'email' ? 'whatsapp' : 'email';
    onChannel(next);
    requestAnimationFrame(() => document.getElementById(`rc-tab-${next}`)?.focus());
  };

  return (
    <div className="rc">
      <div className={`rc__track rc__track--${channel}`} role="tablist" aria-label="Reminders sent by" onKeyDown={onKey}>
        {/* The black block under the chosen half; it slides between them */}
        <span className="rc__thumb" aria-hidden="true" />
        {CHANNELS.map((c) => {
          const chosen = channel === c.id;
          const summary = summaries[c.id];
          const Icon = c.icon;
          return (
            <button
              key={c.id}
              id={`rc-tab-${c.id}`}
              type="button"
              role="tab"
              aria-selected={chosen}
              tabIndex={chosen ? 0 : -1}
              className="rc__tab"
              onClick={() => onChannel(c.id)}
            >
              <span className={`rc__logo rc__logo--${c.id}`} aria-hidden="true">
                <Icon size={14} strokeWidth={2.25} />
              </span>
              <span className="rc__label">{c.label}</span>
              <span className={`rc__count ${summary.warn ? 'rc__count--warn' : ''}`}>{summary.text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// What the WhatsApp half's count says
function whatsAppSummary(connection, kind, switches) {
  if (!hasNumber(connection)) return { text: 'Not set up' };
  if (connection.status === 'lost') return { text: 'Paused', warn: true };
  if (connection.nameStatus === 'rejected') return { text: 'Needs a new name', warn: true };

  const ids = MESSAGES[kind].map((m) => m.id);
  const rejected = ids.filter((id) => messageStatus(connection, id) === 'rejected').length;
  if (rejected) return { text: `${rejected} not approved`, warn: true };

  const on = ids.filter((id) => switches[id]);
  if (on.length === 0) return { text: 'Off' };
  const inReview = on.filter((id) => messageStatus(connection, id) === 'review').length;
  const count = `${on.length}/${ids.length}`;
  if (connection.nameStatus === 'review' || inReview) return { text: `${count} · ${inReview ? `${inReview} in review` : 'name in review'}` };
  return { text: count };
}