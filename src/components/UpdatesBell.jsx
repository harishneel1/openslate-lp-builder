import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import GuestInitials from './GuestInitials';
import { loadBookings, onBookingsChange } from '../data/bookingsStore';
import { buildUpdates, loadLastSeen, saveLastSeen } from '../data/bookingUpdates';
import './UpdatesBell.css';

// ------------------------------------------------------------
// The bell in the top bar: what students did with the creator's calls.
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
//   │ Earlier                                 │
//   │ (PR) Priya booked              Yesterday│
//   └─────────────────────────────────────────┘
//
// Opening it clears the count. What was new stays tinted while the list
// is open, so they can see which ones they hadn't seen. Clicking an
// update opens that call on the Bookings page (onOpenBooking).
// Follows bookings as they change, even from another tab.
// ------------------------------------------------------------

const TICK_MS = 60_000; // keeps "12 min ago" moving

export default function UpdatesBell({ onOpenBooking }) {
  const [bookings, setBookings] = useState(loadBookings);
  const [lastSeen, setLastSeen] = useState(loadLastSeen);
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  // While open: what counted as new when it was opened, so those stay tinted
  const [seenBefore, setSeenBefore] = useState(lastSeen);

  const wrap = useRef(null);
  const button = useRef(null);

  useEffect(() => onBookingsChange(() => setBookings(loadBookings())), []);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const updates = useMemo(() => buildUpdates({ bookings, lastSeen, now }), [bookings, lastSeen, now]);
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
  const isNew = (u) => u.at > seenBefore;
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
            <p className="upd__empty">When students book, reschedule or cancel, you'll see it here.</p>
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
                            onOpenBooking?.(u.bookingId);
                          }}
                        >
                          <GuestInitials name={u.name} />
                          <span className="upd__text">
                            <span className="upd__head">
                              <span className="upd__what">
                                <strong>{u.first}</strong> {VERBS[u.kind]}
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