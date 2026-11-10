import { Mail, MessageCircle } from 'lucide-react';
import { useWhatsApp } from './WhatsAppTab';
import { useSwitches } from './WhatsAppMessages';
import { hasNumber, messageStatus } from '../data/whatsappConnection';
import { MESSAGES } from '../data/whatsappMessages';
import './ReminderChannels.css';

// ------------------------------------------------------------
// The top of the Reminders tab, on a webinar's page (WebinarDetails.jsx)
// and a 1:1 call's page (CallOverview.jsx): which reminders show below,
// the emails or WhatsApp. A toggle in the iPhone's way (a segmented
// control): compact, a light grey track, and a white thumb under the
// chosen side that slides across when the other is tapped. Just the two
// names, centred, each with its channel's logo.
//
//   ╭──────────────────────────────╮
//   │ ╭────────────╮               │
//   │ │ ✉  Email   │  ◉ WhatsApp ● │
//   │ ╰────────────╯               │
//   ╰──────────────────────────────╯
//
// No counts: the list below already shows every switch. When a channel
// needs fixing (WhatsApp paused, its name or a message not approved), a
// small red dot sits after its name, as an app badge does; the reason is
// in that channel's half.
//
// Tabs to screen readers (tablist), with left and right arrows to move.
// Email is the default. The page keeps which side is chosen in its own
// tab state ('whatsapp', beside the email tab's id).
//
// channel: 'email' | 'whatsapp'; onChannel(channel)
// kind: 'call' | 'webinar'
// offering: whose WhatsApp switches ('call:<id>' or 'webinar:<id>')
// (emailOn and emailTotal, which the pages still pass, aren't shown now)
// ------------------------------------------------------------

const CHANNELS = [
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
];

export default function ReminderChannels({ channel, onChannel, kind, offering }) {
  const connection = useWhatsApp();
  const switches = useSwitches(offering, kind);
  // Only WhatsApp can need fixing; email always works
  const problems = { email: null, whatsapp: whatsAppSummary(connection, kind, switches) };

  const onKey = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const next = channel === 'email' ? 'whatsapp' : 'email';
    onChannel(next);
    requestAnimationFrame(() => document.getElementById(`rc-tab-${next}`)?.focus());
  };

  return (
    <div className="rc">
      <div className={`rc__track rc__track--${channel}`} role="tablist" aria-label="Reminders sent by" onKeyDown={onKey}>
        {/* The white thumb under the chosen side; it slides between them */}
        <span className="rc__thumb" aria-hidden="true" />
        {CHANNELS.map((c) => {
          const chosen = channel === c.id;
          const problem = problems[c.id]?.warn ? problems[c.id].text : null;
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
              data-tip={problem ?? undefined}
            >
              <Icon size={15} strokeWidth={2.25} className={`rc__icon rc__icon--${c.id}`} aria-hidden="true" />
              {c.label}
              {problem && (
                <>
                  <span className="rc__badge" aria-hidden="true" />
                  <span className="rc__sr">, needs attention: {problem}</span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// How WhatsApp stands, in a few words; warn: it needs fixing (the red dot)
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