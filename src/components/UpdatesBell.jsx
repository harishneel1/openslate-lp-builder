import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, CalendarClock, CalendarX, Video } from 'lucide-react';
import GuestInitials from './GuestInitials';
import { loadBookings, onBookingsChange } from '../data/bookingsStore';
import { buildUpdates, loadLastSeen, saveLastSeen } from '../data/bookingUpdates';
import { buildSignupUpdates } from '../data/signupUpdates';
import { buildRecordingUpdates } from '../data/recordingUpdates';
import { buildCancelUpdates, buildRescheduleUpdates } from '../data/cancelUpdates';
import { onRecordingsChange } from '../data/recordings';
import { onSignupsChange } from '../data/webinarSignups';
import './UpdatesBell.css';

// ------------------------------------------------------------
// The bell in the top bar: what students did with the creator's calls,
// who signed up for their webinars, and recordings that are ready.
//
//   (bell)•2   an orange count while there's something they haven't seen.
//              A plain icon at rest, a grey circle on hover, tinted orange
//              while open; one small wiggle when something new comes in.
//   ┌─────────────────────────────────────────┐
//   │ Updates                                 │
//   │ Today                                   │
//   │ (TK) Tarun cancelled          12 min ago│  unread: tinted
//   │      Discovery call, Wed 21 Oct, 10 am  │
//   │      “Something came up at work”        │
//   │ (AS) Asha and 11 others signed up  1 hr ago│
//   │      Webinar name, Mon 9 Nov, 7:00 pm IST│
//   │ (▶)  Your recording is ready      2 hr ago│
//   │      Webinar name, Sat 7 Nov, 7:00 pm IST│
//   │ Earlier                                 │
//   │ (PR) Priya booked              Yesterday│
//   └─────────────────────────────────────────┘
//
// Opening it clears the count. What was new stays tinted while the list
// is open, so they can see which ones they hadn't seen. Clicking a call's
// update opens that call on the Bookings page (onOpenBooking); clicking
// a sign-up line opens that webinar with the session's people showing
// (onOpenWebinar). Sign-ups for one session on one day are one line
// (data/signupUpdates.js), which counts once in the badge.
// A recording line (data/recordingUpdates.js) opens that session on its
// Recording tab: onOpenWebinar(id, { tab: 'recording' }).
// A cancelled session's line (data/cancelUpdates.js) is a record of what
// the coach did: never new, so it doesn't count or ring. It opens that
// session's people.
// Follows bookings, sign-ups and recordings as they change, even from
// another tab. A recording turns ready with time rather than an event, so
// the minute tick (and opening the bell) picks it up.
//
// webinars: every webinar session (the sign-up lines name them)
// ------------------------------------------------------------

const TICK_MS = 60_000; // keeps "12 min ago" moving

export default function UpdatesBell({ webinars = [], onOpenBooking, onOpenWebinar }) {
  const [bookings, setBookings] = useState(loadBookings);
  const [signupsTick, setSignupsTick] = useState(0); // a new sign-up rebuilds the list
  const [recordingsTick, setRecordingsTick] = useState(0); // so does a recording starting or stopping
  const [lastSeen, setLastSeen] = useState(loadLastSeen);
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  // While open: what counted as new when it was opened, so those stay tinted
  const [seenBefore, setSeenBefore] = useState(lastSeen);

  const wrap = useRef(null);
  const button = useRef(null);

  useEffect(() => onBookingsChange(() => setBookings(loadBookings())), []);
  useEffect(() => onSignupsChange(() => setSignupsTick((n) => n + 1)), []);
  useEffect(() => onRecordingsChange(() => setRecordingsTick((n) => n + 1)), []);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  // Calls, sign-ups and recordings in one list, newest first
  const updates = useMemo(
    () =>
      [
        ...buildUpdates({ bookings, lastSeen, now }),
        ...buildSignupUpdates({ webinars, lastSeen, now }),
        ...buildRecordingUpdates({ webinars, lastSeen, now }),
        ...buildCancelUpdates({ webinars, now }),
        ...buildRescheduleUpdates({ webinars, now }),
      ].sort((a, b) => b.at - a.at),
    // signupsTick, recordingsTick: they live outside React, so a change bumps them
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bookings, webinars, lastSeen, now, signupsTick, recordingsTick],
  );
  const unread = updates.filter((u) => u.unread).length;

  // Something new came in while they're here: one small wiggle, then still.
  // Not on load, only when the count goes up.
  const [ringing, setRinging] = useState(false);
  const lastUnread = useRef(unread);
  useEffect(() => {
    if (unread > lastUnread.current) {
      setRinging(true);
      const id = setTimeout(() => setRinging(false), 700);
      lastUnread.current = unread;
      return () => clearTimeout(id);
    }
    lastUnread.current = unread;
    return undefined;
  }, [unread]);

  const show = () => {
    setSeenBefore(lastSeen);
    const seenAt = Date.now();
    saveLastSeen(seenAt);
    setLastSeen(seenAt);
    setNow(seenAt);
    setOpen(true);
  };

  const close = (returnFocus = true) => {
    setOpen(false);
    if (returnFocus) button.current?.focus();
  };

  // Close on Escape, or a click anywhere outside
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    const onClick = (e) => {
      if (!wrap.current?.contains(e.target)) close(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  // Shown in this open: tinted if it was new when the list opened
  // The coach's own changes (cancelled, rescheduled) are records, never new
  const isNew = (u) => u.kind !== 'cancelled-session' && u.kind !== 'rescheduled-session' && u.at > seenBefore;
  const groups = [
    { id: 'today', label: 'Today', items: updates.filter((u) => u.today) },
    { id: 'earlier', label: 'Earlier', items: updates.filter((u) => !u.today) },
  ].filter((g) => g.items.length);

  return (
    <div className="upd" ref={wrap}>
      <button
        ref={button}
        type="button"
        className={`upd__bell ${open ? 'upd__bell--open' : ''} ${ringing ? 'upd__bell--ring' : ''}`}
        aria-expanded={open}
        // Its name on hover, except while its own list is open
        data-tip={open ? undefined : 'Updates'}
        data-tip-align="end"
        aria-haspopup="dialog"
        aria-label={unread ? `Updates, ${unread} new` : 'Updates'}
        onClick={() => (open ? close() : show())}
      >
        <Bell size={20} strokeWidth={1.8} className="upd__bell-icon" aria-hidden="true" />
        {unread > 0 && (
          <span className="upd__count" aria-hidden="true">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="upd__panel" role="dialog" aria-label="Updates">
          <h2 className="upd__title">Updates</h2>

          {groups.length === 0 ? (
            <p className="upd__empty">
              When students book, reschedule or cancel a call, or sign up for a webinar, or a recording is ready,
              you'll see it here.
            </p>
          ) : (
            <div className="upd__scroll">
              {groups.map((g) => (
                <section key={g.id} className="upd__group" aria-label={g.label}>
                  <h3 className="upd__group-title">{g.label}</h3>
                  <ul className="upd__list">
                    {g.items.map((u) => (
                      <li key={u.key}>
                        <button
                          type="button"
                          className={`upd__item ${isNew(u) ? 'upd__item--new' : ''}`}
                          onClick={() => {
                            close(false);
                            if (u.kind === 'signups' || u.kind === 'cancelled-session' || u.kind === 'rescheduled-session')
                              onOpenWebinar?.(u.webinarId);
                            else if (u.kind === 'recording') onOpenWebinar?.(u.webinarId, { tab: 'recording' });
                            else onOpenBooking?.(u.bookingId);
                          }}
                        >
                          {/* A recording isn't a person: a video icon in the same circle */}
                          {u.kind === 'recording' ? (
                            <span className="bk-face" aria-hidden="true">
                              <Video size={17} />
                            </span>
                          ) : u.kind === 'cancelled-session' ? (
                            <span className="bk-face" aria-hidden="true">
                              <CalendarX size={17} />
                            </span>
                          ) : u.kind === 'rescheduled-session' ? (
                            <span className="bk-face" aria-hidden="true">
                              <CalendarClock size={17} />
                            </span>
                          ) : (
                            <GuestInitials name={u.name} />
                          )}
                          <span className="upd__text">
                            <span className="upd__head">
                              <span className="upd__what">
                                {u.kind === 'signups' ? (
                                  <SignedUp update={u} />
                                ) : u.kind === 'cancelled-session' ? (
                                  <>
                                    <strong>Session cancelled</strong>
                                    {u.emailedTo > 0
                                      ? ` · ${u.emailedTo} ${u.emailedTo === 1 ? 'person' : 'people'} emailed`
                                      : ''}
                                  </>
                                ) : u.kind === 'rescheduled-session' ? (
                                  <>
                                    <strong>Session rescheduled</strong>
                                    {u.emailedTo > 0
                                      ? ` · ${u.emailedTo} ${u.emailedTo === 1 ? 'person' : 'people'} emailed`
                                      : ''}
                                  </>
                                ) : u.kind === 'recording' ? (
                                  <>
                                    <strong>Your recording</strong> is ready
                                  </>
                                ) : (
                                  <>
                                    <strong>{u.first}</strong> {VERBS[u.kind]}
                                  </>
                                )}
                              </span>
                              <span className="upd__ago">{u.ago}</span>
                            </span>
                            <span className="upd__detail">
                              {u.kind === 'rescheduled' ? (
                                <>
                                  {u.title}, now {u.when}
                                  <span className="upd__was">
                                    Was <s>{u.was}</s>
                                  </span>
                                </>
                              ) : u.kind === 'rescheduled-session' ? (
                                `${u.title}, now ${u.when}`
                              ) : (
                                `${u.title}, ${u.when}`
                              )}
                            </span>
                            {u.kind === 'cancelled' && u.reason && <span className="upd__reason">“{u.reason}”</span>}
                          </span>
                          {isNew(u) && (
                            <>
                              <span className="upd__new-dot" aria-hidden="true" />
                              <span className="upd__sr">New</span>
                            </>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const VERBS = {
  booked: 'booked a call',
  rescheduled: 'rescheduled',
  cancelled: 'cancelled',
};

// 'Priya signed up', 'Priya and Rahul signed up', 'Priya and 11 others signed up'
function SignedUp({ update: u }) {
  if (u.second) {
    return (
      <>
        <strong>{u.first}</strong> and <strong>{u.second}</strong> signed up
      </>
    );
  }
  if (u.others > 0) {
    return (
      <>
        <strong>{u.first}</strong> and {u.others} {u.others === 1 ? 'other' : 'others'} signed up
      </>
    );
  }
  return (
    <>
      <strong>{u.first}</strong> signed up
    </>
  );
}