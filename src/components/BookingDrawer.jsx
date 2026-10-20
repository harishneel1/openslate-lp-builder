import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Clock, Copy, Mail, Phone, Video, Wallet } from 'lucide-react';
import Drawer from './Drawer';
import GuestInitials from './GuestInitials';
import { cancelBooking, rescheduleBooking } from '../data/bookingsStore';
import { getMyAvailability } from '../data/mockAvailability';
import { money } from '../data/checkoutRules';
import { findSlots, formatTime, zoned } from '../utils/slots';
import { matchZone } from '../data/timeZones';
import { getMyProfile } from '../data/myProfile';
import { mockAccount } from '../data/myPage';
import { whatsappHref } from '../utils/whatsapp';
import { exactDay, lengthLabel, longDay, onDay, shortDay, startsIn, zoneLabel } from '../data/buildBookingsJson';
import './BookingDrawer.css';

// ------------------------------------------------------------
// One booking, opened from the Bookings page. Three views in the
// same panel:
//   details     read top to bottom, in the order the creator asks:
//               who is this (head: initials, name, WhatsApp, email, phone)
//               what did they book (the call: name, when, format, join)
//               about them (contact, then their answers to the questions)
//               history (booked, rescheduled, cancelled)
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

// A WhatsApp message ready to send, written for where the call is.
// Times on the guest's clock when we know it, since they're reading it.
function whatsappMessage(booking, zone, guestName) {
  const me = firstName(getMyProfile().creator.name || mockAccount.name);
  const clock = matchZone(booking.guestTimeZone) ?? zone;
  const ms = Date.parse(booking.start);
  const day = exactDay(zoned(ms, clock).date);
  const when = `${day} at ${formatTime(ms, clock)}`;
  const hi = `Hi ${guestName}, this is ${me}`;
  if (booking.state === 'cancelled') return `${hi}, about the ${booking.title} we had booked for ${when}.`;
  if (booking.state === 'ended') return `${hi}. Thanks for our ${booking.title} on ${day}.`;
  return `${hi}, about our ${booking.title} on ${when}.`;
}

// WhatsApp's mark as a line icon (Tabler's brand-whatsapp, MIT), on the same
// 24px grid and 2px stroke as lucide, so it sits evenly beside Mail and Phone
function WhatsAppIcon({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9l-5.05 .9" />
      <path d="M9 10a.5 .5 0 0 0 1 0V9a.5 .5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5 .5 0 0 0 0-1h-1a.5 .5 0 0 0 0 1" />
    </svg>
  );
}

// A saved instant → 'Thu 22 Oct' on the creator's clock, never 'Today'
const dayOf = (iso, zone) => exactDay(zoned(Date.parse(iso), zone).date);

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
  const whatsapp = whatsappHref(booking.guest?.phone, whatsappMessage(booking, zone, name));

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
      setError("We couldn't reschedule this call. Try again.");
      return;
    }
    show('details');
    onChanged(`Call rescheduled to ${exactDay(picked.date)}, ${picked.time}.`);
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
            {picked ? `Reschedule to ${exactDay(picked.date)}, ${picked.time}` : 'Pick a new time'}
          </button>
        )}
      </>
    );
  }

  // What the guest answered when booking: the call's booking questions as
  // they were asked (callQuestions.js), saved with the booking as
  // answers: [{ question, answer }]. Older bookings only have `topic`.
  const answers = booking.answers ?? [{ question: TOPIC_QUESTION, answer: booking.topic }];

  // About the guest: how to reach them
  const contact = [
    booking.guest?.email && ['Email', <a href={`mailto:${booking.guest.email}`}>{booking.guest.email}</a>],
    booking.guest?.phone && ['Phone', <a href={telHref(booking.guest.phone)}>{booking.guest.phone}</a>],
  ].filter(Boolean);

  // What happened to the booking, as a timeline read top to bottom, oldest
  // first: each step says who did what, and when they did it.
  // Only the latest reschedule is saved (previousStart), so a call moved
  // twice shows one move, from the time before the latest one.
  const who = (by) => (by === 'guest' ? name : 'You');
  const at = (iso) => `${dayOf(iso, zone)}, ${formatTime(Date.parse(iso), zone)}`;
  // 'From 11:00 am to 9:15 am on Wed 21 Oct' when the day stayed the same,
  // else 'From Wed 21 Oct, 9:15 am to Thu 22 Oct, 10:00 am'
  const movedLine = (from, to) =>
    dayOf(from, zone) === dayOf(to, zone)
      ? `From ${formatTime(Date.parse(from), zone)} to ${formatTime(Date.parse(to), zone)} on ${dayOf(to, zone)}`
      : `From ${at(from)} to ${at(to)}`;
  const history = [
    {
      key: 'booked',
      what: `${name} booked`,
      detail: `For ${at(booking.previousStart ?? booking.start)}`,
      when: booking.createdAt,
    },
    booking.previousStart && {
      key: 'rescheduled',
      what: `${who(booking.moved?.by)} rescheduled`,
      detail: movedLine(booking.previousStart, booking.start),
      when: booking.rescheduledAt,
    },
    booking.state === 'cancelled' && {
      key: 'cancelled',
      what: `${who(booking.cancelledBy)} cancelled`,
      // The creator's note goes with their cancel; a guest's reason is shown
      // up with their answers, since it's something to read, not a record
      detail: booking.cancelMessage && booking.cancelledBy !== 'guest' ? `Your note: ${booking.cancelMessage}` : null,
      when: booking.cancelledAt,
    },
  ]
    .filter(Boolean)
    // Older bookings may be missing a time; those keep the order above
    .map((step, i) => ({ ...step, order: Date.parse(step.when) || 0, i }))
    .sort((x, y) => (x.order && y.order ? x.order - y.order : x.i - y.i));

  const status = {
    live: 'Happening now',
    soon: `Starts ${soon}`,
    upcoming: soon ? `Starts ${soon}` : `${shortDay(booking.date, today)}`,
    ended: 'Ended',
    cancelled: booking.cancelledBy === 'guest' ? `${name} cancelled` : 'Cancelled',
  }[booking.state];

  const isPhone = booking.format === 'phone';
  const price = typeof booking.paid === 'number' ? (booking.paid > 0 ? `Paid ${money(booking.paid)}` : 'Free') : null;

  // ---------- Head: the person, and every way to reach them ----------
  const reach = [
    whatsapp && { label: `WhatsApp ${name}`, href: whatsapp, external: true, icon: <WhatsAppIcon /> },
    booking.guest?.email && {
      label: `Email ${name}`,
      href: `mailto:${booking.guest.email}`,
      icon: <Mail size={18} aria-hidden="true" />,
    },
    booking.guest?.phone && {
      label: `Call ${name}`,
      href: telHref(booking.guest.phone),
      icon: <Phone size={18} aria-hidden="true" />,
    },
  ].filter(Boolean);

  const contactRow = reach.length > 0 && (
    <div className="bkd__reach">
      {reach.map((r) => (
        <a
          key={r.label}
          className="bkd__contact"
          href={r.href}
          {...(r.external ? { target: '_blank', rel: 'noreferrer' } : {})}
          aria-label={r.label}
          data-tip={r.label}
        >
          {r.icon}
        </a>
      ))}
    </div>
  );

  return (
    <Drawer
      title={booking.guest?.name || 'Guest'}
      media={<GuestInitials name={booking.guest?.name} size="lg" />}
      extra={view === 'details' ? contactRow : null}
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

          {/* ---------- The call they booked ---------- */}
          <section className={`bkd__call bkd__call--${booking.state}`} aria-label="Their booking">
            <div className="bkd__call-top">
              <h3 className="bkd__service">{booking.title}</h3>
              <span className={`bkd__state bkd__state--${booking.state}`}>{status}</span>
            </div>

            <p className="bkd__date">{longDay(booking.date)}</p>
            <p className="bkd__clock">
              {booking.time} to {booking.ends}
            </p>
            {/* Only when they booked from another time zone */}
            {theirTime && (
              <p className="bkd__their-time">
                For {name}: {theirTime}
              </p>
            )}

            <ul className="bkd__meta">
              <li>
                {isPhone ? <Phone size={15} aria-hidden="true" /> : <Video size={15} aria-hidden="true" />}
                {isPhone ? 'Phone call' : 'Video call'}
              </li>
              <li>
                <Clock size={15} aria-hidden="true" />
                {lengthLabel(booking.lengthMins)}
              </li>
              {price && (
                <li>
                  <Wallet size={15} aria-hidden="true" />
                  {price}
                </li>
              )}
            </ul>

            {/* Join: the one big action, while the call is on */}
            {open &&
              (isPhone ? (
                <a className="bk-btn bk-btn--primary bkd__join" href={telHref(booking.guest?.phone)}>
                  <Phone size={16} aria-hidden="true" /> Call {booking.guest?.phone}
                </a>
              ) : booking.meetingLink ? (
                <div className="bkd__join-row">
                  <a className="bk-btn bk-btn--primary bkd__join" href={booking.meetingLink} target="_blank" rel="noreferrer">
                    <Video size={16} aria-hidden="true" /> Join call
                  </a>
                  <button
                    type="button"
                    className="bk-btn bk-btn--secondary bkd__copy"
                    onClick={copyLink}
                    aria-label={copied ? 'Link copied' : 'Copy meeting link'}
                    data-tip={copied ? 'Link copied' : 'Copy meeting link'}
                    data-tip-align="end"
                  >
                    {copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
                  </button>
                  <span className="bkd__sr" aria-live="polite">
                    {copied ? 'Link copied' : ''}
                  </span>
                </div>
              ) : null)}
          </section>

          {/* ---------- About the guest: contact, then their answers ---------- */}
          {contact.length > 0 && (
            <section className="bkd__section">
              <h3 className="bkd__heading">About {name}</h3>
              <dl className="bkd__facts">
                {contact.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {/* Their answers to the call's booking questions (none when it asked none) */}
          {answers.length > 0 && (
          <section className="bkd__section">
            <h3 className="bkd__heading">{answers.length === 1 ? 'Their answer' : 'Their answers'}</h3>
            <dl className="bkd__answers">
              {answers.map(({ question, answer }) => (
                <div key={question}>
                  <dt>{question}</dt>
                  <dd className={answer ? '' : 'bkd__no-answer'}>{answer || 'No answer'}</dd>
                </div>
              ))}
            </dl>
          </section>
          )}

          {booking.cancelMessage && booking.cancelledBy === 'guest' && (
            <section className="bkd__section">
              <p className="bkd__sent-note bkd__sent-note--theirs">
                <span className="bkd__note-label">{name}'s reason for cancelling</span>
                {booking.cancelMessage}
              </p>
            </section>
          )}

          {/* ---------- History: a timeline, oldest at the top ---------- */}
          <section className="bkd__section bkd__history">
            <h3 className="bkd__heading">History</h3>
            <ol className="bkd__timeline">
              {history.map((step) => (
                <li key={step.key} className={`bkd__event bkd__event--${step.key}`}>
                  <div className="bkd__event-line">
                    <span className="bkd__event-what">{step.what}</span>
                    {step.when && <time dateTime={step.when}>{at(step.when)}</time>}
                  </div>
                  {step.detail && <p className="bkd__event-detail">{step.detail}</p>}
                </li>
              ))}
            </ol>
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
              <h3 className="bkd__step-title">No open times to reschedule to</h3>
              <p className="bkd__step-text">
                This call has no free times coming up. Add hours to the call, then try again.
              </p>
            </>
          ) : (
            <>
              <h3 className="bkd__step-title">Reschedule your call with {name}</h3>
              <p className="bkd__step-text">
                Booked for {exactDay(booking.date)}, {booking.time}. Pick a new time and {name}'s invite will be
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