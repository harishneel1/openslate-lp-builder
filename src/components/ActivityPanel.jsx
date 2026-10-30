import {
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  CalendarX,
  Mail,
  Plus,
  RotateCcw,
  UserMinus,
  Users,
  Video,
  XCircle,
} from 'lucide-react';
import { activityByDay, sessionActivity } from '../data/sessionActivity';
import './ActivityPanel.css';

// ------------------------------------------------------------
// A session's Activity tab, in its side panel (WebinarDetails.jsx):
// everything that happened to it, newest first, under day headings
// (data/sessionActivity.js builds the lines).
//
//   Today
//   (↻) Rescheduled from Fri 13 Nov to Fri 20 Nov              4:10 pm
//       3 people emailed · By you
//   (✉) 1-day reminder sent to 3 people                        7:00 pm
//       Automatic
//
// Each line says who did it: Automatic (the system) or By you. Only the
// recording's line is a button (it opens Recording); every other line,
// sign-ups and refunds included, is just text.
// A session always has at least its "Session added" line.
//
// run: the session; people: its people; now
// onOpen(tab): 'recording'
//
// The list itself is ActivityList, which a 1:1 call's page uses too
// (CallOverview.jsx, with data/callActivity.js), so both read the same.
// ------------------------------------------------------------

const ICONS = {
  added: Plus,
  signups: Users,
  reminder: Mail,
  ended: CalendarCheck,
  moved: CalendarClock,
  cancelled: CalendarX,
  refund: RotateCcw, // older saves' refunds by hand
  removed: UserMinus,
  recording: Video,
  // A 1:1 call's lines (data/callActivity.js)
  booked: CalendarPlus,
  declined: XCircle,
};

export default function ActivityPanel({ run, people = [], now, onOpen }) {
  return <ActivityList groups={activityByDay(sessionActivity(run, people, now), now)} onOpen={onOpen} />;
}

// ------------------------------------------------------------
// Day headings, then a line each: [{ day, label, items }] from activityByDay.
// onOpen(item.open): for the lines that open something
// Who did it: item.by is 'auto' (Automatic), 'you' (By you), or 'guest'
// (By <item.byName>, someone who booked a 1:1 call)
// ------------------------------------------------------------
export function ActivityList({ groups, onOpen }) {
  return (
    <div className="act">
      {groups.map((g) => (
        <section key={g.day} className="act__day" aria-label={g.label}>
          <h3 className="act__day-title">{g.label}</h3>
          <ol className="act__list">
            {g.items.map((item) => (
              <li key={item.key} className={`act__item act__item--${item.kind}`}>
                <Line item={item} onOpen={onOpen} />
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

// One line: icon, what happened, who did it, when
function Line({ item, onOpen }) {
  const Icon = ICONS[item.kind] ?? Plus;
  const who = item.by === 'auto' ? 'Automatic' : item.by === 'guest' ? `By ${item.byName || 'your guest'}` : 'By you';
  const body = (
    <>
      <span className="act__icon" aria-hidden="true">
        <Icon size={15} />
      </span>
      <span className="act__text">
        <span className="act__title">{item.title}</span>
        <span className="act__detail">{[item.detail, who].filter(Boolean).join(' · ')}</span>
      </span>
      <span className="act__time">{item.time}</span>
    </>
  );
  if (!item.open || !onOpen) return <div className="act__line">{body}</div>;
  return (
    <button type="button" className="act__line act__line--link" onClick={() => onOpen(item.open)}>
      {body}
    </button>
  );
}