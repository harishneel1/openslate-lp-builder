import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Mail, Phone, Video } from 'lucide-react';
import Drawer from './Drawer';
import GuestInitials from './GuestInitials';
import { cancelBooking, rescheduleBooking } from '../data/bookingsStore';
import { getMyAvailability } from '../data/mockAvailability';
import { money } from '../data/checkoutRules';
import { findSlots, formatTime, zoned } from '../utils/slots';
import { matchZone } from '../data/timeZones';
import { dayInSentence, lengthLabel, longDay, onDay, shortDay, startsIn, zoneLabel } from '../data/buildBookingsJson';
import './BookingDrawer.css';

// ------------------------------------------------------------
// One booking, opened from the Bookings page. Three views in the
// same panel:
//   details     when (on both clocks), join, then one Details list:
//               their answers to the booking questions, contact, payment
//   reschedule  pick a new time from the call's own open times
//   cancel      confirm, with an optional note to the guest
// Ended and cancelled calls only show details.
//
// booking: from describeBooking (buildBookingsJson.js)
// onChanged(notice): after a reschedule or cancel. The page reloads its
//                    bookings and passes the notice back to show here.
// ------------------------------------------------------------

// The question checkout asks (CheckoutPage.jsx), shown with the guest's answer
const TOPIC_QUESTION = 'What would you like to talk about?';

const firstName = (name) => String(name ?? '').trim().split(/\s+/)[0] || 'your guest';
const telHref = (phone) => `tel:${String(phone ?? '').replace(/\s/g, '')}`;

// The guest's own clock, when it differs from the creator's:
// '8:30 am on Tue 20 Oct, UK (London), GMT+1' or '3:45 pm today, ...'
function guestTime(booking, zone, today) {
  const theirs = matchZone(booking.guestTimeZone);
  if (!theirs || theirs === matchZone(zone)) return null;
  const ms = Date.parse(booking.start);
  return `${formatTime(ms, theirs)} ${onDay(zoned(ms, theirs).date, today)}, ${zoneLabel(theirs)}`;
}

// A saved instant → 'Thu 22 Oct' on the creator's clock
const dayOf = (iso, zone, today) => shortDay(zoned(Date.parse(iso), zone).date, today);

export default function BookingDrawer({ booking, zone, today, now, notice, onClose, onChanged }) {
  const [view, setView] = useState('details');
  const [message, setMessage] = useState('');
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef(null);
  useEffect(() => () => clearTimeout(copyTimer.current), []);

  // Where focus goes when the panel opens or switches view. Runs after the
  // Drawer has opened (a child's effects run first), so it wins over the
  // browser putting focus, and a focus ring, on the close button.
  const focusRef = useRef(null);

  // Reschedule: the day being looked at, and the time picked on it
  const [moveDate, setMoveDate] = useState(null);
  const [picked, setPicked] = useState(null);

  // A different booking opened: start over on its details
  useEffect(() => {
    setView('details');
    setMessage('');
    setError(null);
    setMoveDate(null);
    setPicked(null);
  }, [booking.id]);

  useEffect(() => {
    focusRef.current?.focus({ preventScroll: true });
  }, [booking.id, view]);

  // The open times this call could move to. Worked out only while rescheduling.
  const openDays = useMemo(() => {
    if (view !== 'reschedule') return [];
    const { schedule, bookings } = getMyAvailability(booking.serviceId, { exceptId: booking.id });
    return findSlots({ schedule, bookings, durationMins: booking.lengthMins, timeZone: zone }).days.filter(
      (d) => d.slots.length > 0,
    );
  }, [view, booking.serviceId, booking.id, booking.lengthMins, zone]);
  const moveDay = openDays.find((d) => d.date === moveDate) ?? openDays[0] ?? null;

  const name = firstName(booking.guest?.name);
  const open = booking.state !== 'ended' && booking.state !== 'cancelled';
  const theirTime = guestTime(booking, zone, today);
  const soon = startsIn(Date.parse(booking.start), now);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(booking.meetingLink);
      setCopied(true);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the link is on screen to copy by hand
    }
  };

  const show = (next) => {
    setView(next);
    setError(null);
    setPicked(null);
    setMoveDate(null);
  };

  const confirmCancel = () => {
    const done = cancelBooking(booking.id, { message });
    if (!done) {
      setError("We couldn't cancel this call. Try again.");
      return;
    }
    show('details');
    onChanged('Call cancelled. Its time is open for booking again.');
  };

  const confirmMove = () => {
    if (!picked) return;
    const done = rescheduleBooking(booking.id, picked.start);
    if (!done) {
      setError("We couldn't move this call. Try again.");
      return;
    }
    show('details');
    onChanged(`Call moved to ${dayInSentence(picked.date, today)}, ${picked.time}.`);
  };

  // ---------- Footer: changes with the view ----------
  let footer = null;
  if (view === 'details' && open) {
    footer = (
      <>
        <button type="button" className="bk-btn bk-btn--danger-text" onClick={() => show('cancel')}>
          Cancel call
        </button>
        <button type="button" className="bk-btn bk-btn--secondary" onClick={() => show('reschedule')}>
          Reschedule
        </button>
      </>
    );
  } else if (view === 'cancel') {
    footer = (
      <>
        <button type="button" className="bk-btn bk-btn--secondary" onClick={() => show('details')}>
          Keep call
        </button>
        <button type="button" className="bk-btn bk-btn--danger" onClick={confirmCancel}>
          Cancel call
        </button>
      </>
    );
  } else if (view === 'reschedule') {
    footer = (
      <>
        <button type="button" className="bk-btn bk-btn--secondary" onClick={() => show('details')}>
          Back
        </button>
        {openDays.length > 0 && (
          <button type="button" className="bk-btn bk-btn--primary" disabled={!picked} onClick={confirmMove}>
            {picked ? `Move to ${dayInSentence(picked.date, today)}, ${picked.time}` : 'Pick a new time'}
          </button>
        )}
      </>
    );
  }

  // What the guest answered when booking. One question for now; each call
  // can have its own questions later, saved with the booking as
  // answers: [{ question, answer }]. Older bookings only have `topic`.
  const answers = booking.answers ?? [{ question: TOPIC_QUESTION, answer: booking.topic }];

  const facts = [
    theirTime && ['Their time', theirTime],
    ['Format', booking.format === 'phone' ? 'Phone call' : 'Video call'],
    typeof booking.paid === 'number' && ['Payment', booking.paid > 0 ? `Paid ${money(booking.paid)}` : 'Free call'],
    booking.guest?.email && ['Email', <a href={`mailto:${booking.guest.email}`}>{booking.guest.email}</a>],
    booking.guest?.phone && ['Phone', <a href={telHref(booking.guest.phone)}>{booking.guest.phone}</a>],
    ['Booked', dayOf(booking.createdAt, zone, today)],
    booking.previousStart && [
      'Moved from',
      `${dayOf(booking.previousStart, zone, today)}, ${formatTime(Date.parse(booking.previousStart), zone)}`,
    ],
    booking.state === 'cancelled' && booking.cancelledAt && ['Cancelled', dayOf(booking.cancelledAt, zone, today)],
  ].filter(Boolean);

  const status = {
    live: 'Happening now',
    soon: `Starts ${soon}`,
    upcoming: soon ? `Starts ${soon}` : `${shortDay(booking.date, today)}`,
    ended: 'Ended',
    cancelled: 'Cancelled',
  }[booking.state];

  return (
    <Drawer
      title={booking.guest?.name || 'Guest'}
      sub={booking.title}
      onClose={onClose}
      footer={footer}
      className="bkd"
    >
      {/* Focus lands here when the panel opens or changes view, not on the close button */}
      <div ref={focusRef} tabIndex={-1} className="bkd__focus">
      {/* ================= Details ================= */}
      {view === 'details' && (
        <div className="bkd__details">
          {notice && (
            <p className="bkd__notice" role="status">
              <Check size={16} aria-hidden="true" /> {notice}
            </p>
          )}

          {/* ---------- When: the biggest thing in the panel ---------- */}
          <section className="bkd__hero" aria-label="When">
            <div className="bkd__hero-top">
              <GuestInitials name={booking.guest?.name} size="lg" />
              <span className={`bkd__state bkd__state--${booking.state}`}>{status}</span>
            </div>
            <p className="bkd__clock">
              {booking.time} to {booking.ends}
            </p>
            <p className="bkd__date">
              {longDay(booking.date)}, {lengthLabel(booking.lengthMins)}
            </p>
          </section>

          {/* ---------- Join: right under the time ---------- */}
          {open && (
            <section className="bkd__actions" aria-label="How to join">
              {booking.format === 'phone' ? (
                <a className="bk-btn bk-btn--primary bkd__join" href={telHref(booking.guest?.phone)}>
                  <Phone size={16} aria-hidden="true" /> Call {booking.guest?.phone}
                </a>
              ) : booking.meetingLink ? (
                <>
                  <a
                    className="bk-btn bk-btn--primary bkd__join"
                    href={booking.meetingLink}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Video size={16} aria-hidden="true" /> Join call
                  </a>
                  <div className="bkd__more">
                    <button type="button" className="bk-btn bk-btn--secondary" onClick={copyLink}>
                      {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
                      {copied ? 'Link copied' : 'Copy meeting link'}
                    </button>
                    {booking.guest?.email && (
                      <a className="bk-btn bk-btn--secondary" href={`mailto:${booking.guest.email}`}>
                        <Mail size={16} aria-hidden="true" /> Email {name}
                      </a>
                    )}
                  </div>
                </>
              ) : null}
            </section>
          )}

          {/* ---------- Everything else, at a glance ---------- */}
          <section className="bkd__section">
            <h3 className="bkd__heading">Details</h3>
            <dl className="bkd__facts">
              {answers.map(({ question, answer }) => (
                <div key={question} className="bkd__answer">
                  <dt>{question}</dt>
                  <dd className={answer ? '' : 'bkd__no-answer'}>{answer || 'No answer'}</dd>
                </div>
              ))}
              {facts.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            {booking.cancelMessage && (
              <p className="bkd__sent-note">
                Your note to {name}: {booking.cancelMessage}
              </p>
            )}
          </section>
        </div>
      )}

      {/* ================= Cancel ================= */}
      {view === 'cancel' && (
        <div className="bkd__step">
          <h3 className="bkd__step-title">Cancel your call with {name}?</h3>
          <p className="bkd__step-text">
            {longDay(booking.date)}, {booking.time} to {booking.ends}. {name} gets an email saying it's cancelled, and the
            time opens up for others to book.
          </p>
          {booking.paid > 0 && (
            <p className="bkd__step-text">
              {name} paid {money(booking.paid)}. Cancelling doesn't refund them automatically.
            </p>
          )}
          <label className="bkd__label" htmlFor="bkd-message">
            Note to {name} <span className="bkd__optional">(optional)</span>
          </label>
          <textarea
            id="bkd-message"
            className="bkd__textarea"
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Sorry, something came up. Please pick another time from my page."
          />
          {error && (
            <p className="bkd__error" role="alert">
              {error}
            </p>
          )}
        </div>
      )}

      {/* ================= Reschedule ================= */}
      {view === 'reschedule' && (
        <div className="bkd__step">
          {openDays.length === 0 ? (
            <>
              <h3 className="bkd__step-title">No open times to move to</h3>
              <p className="bkd__step-text">
                This call has no free times coming up. Add hours to the call, then try again.
              </p>
            </>
          ) : (
            <>
              <h3 className="bkd__step-title">Move your call with {name}</h3>
              <p className="bkd__step-text">
                Booked for {dayInSentence(booking.date, today)}, {booking.time}. Pick a new time and {name}'s invite will be
                updated.
              </p>

              <div className="bkd__days" role="group" aria-label="New date">
                {openDays.map((d) => (
                  <button
                    key={d.date}
                    type="button"
                    className="bkd__day"
                    aria-pressed={d.date === moveDay?.date}
                    onClick={() => {
                      setMoveDate(d.date);
                      setPicked(null);
                    }}
                  >
                    <span className="bkd__day-name">{d.relative ?? d.weekday}</span>
                    <span className="bkd__day-num">{d.day}</span>
                    <span className="bkd__day-name">{d.month}</span>
                  </button>
                ))}
              </div>

              {moveDay && (
                <>
                  <p className="bkd__times-title">{longDay(moveDay.date)}</p>
                  <div className="bkd__times" role="group" aria-label={`Times on ${longDay(moveDay.date)}`}>
                    {moveDay.slots.map((s) => (
                      <button
                        key={s.start}
                        type="button"
                        className="bkd__time"
                        aria-pressed={picked?.start === s.start}
                        onClick={() => setPicked({ ...s, date: moveDay.date })}
                      >
                        {s.time}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
          {error && (
            <p className="bkd__error" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
      </div>
    </Drawer>
  );
}