import { useEffect, useMemo, useState } from 'react';
import { CalendarX2, Check, Phone, Video } from 'lucide-react';
import { cancelBooking, getBooking, onBookingsChange, rescheduleBooking } from '../data/bookingsStore';
import { buildBookingJson } from '../data/buildBookingJson';
import { exactDay, statusOf } from '../data/buildBookingsJson';
import { getMyAvailability } from '../data/mockAvailability';
import { MY_CALL_ID, profileHrefFor } from '../data/myProfile';
import { matchZone, zoneOptions } from '../data/timeZones';
import { findSlots, formatTime, zoned } from '../utils/slots';
import SlotPicker from '../components/booking/SlotPicker';
import TimeZonePicker from '../components/booking/TimeZonePicker';
import '../styles/storeTheme.css';
import './BookedPage.css';
import './ManageBookingPage.css';

// ------------------------------------------------------------
// The student's side of a booking: the page behind the two links in
// their confirmation email. Opened at
//   ?mock=manage&booking=<id>&action=cancel | reschedule
// (&tz=<zone> to see it on another clock). With no action, it offers both.
//
// The booking decides what they see first, so an old link never errors:
//   cancelled   who cancelled and when, and a way to book again
//   ended       it's over, and a way to book again
//   live        it's happening: Join, not a cancel form
//   otherwise   cancel (a reason is required) or reschedule
// A rescheduled booking just shows its new time, so the link in the
// first email keeps working.
//
// Changes are saved with by: 'guest', so the creator's Bookings page
// says "Tarun cancelled" or "Rescheduled by Tarun".
// ------------------------------------------------------------

const TICK_MS = 30_000; // how often "now" moves on, so a call can go live while open

const firstName = (name) => String(name ?? '').trim().split(/\s+/)[0] || '';

// An instant on the student's clock, in the pieces the page shows
function when(ms, endMs, zone) {
  const { date } = zoned(ms, zone);
  const [y, m, d] = date.split('-').map(Number);
  const value = new Date(Date.UTC(y, m - 1, d));
  const part = (opts) => value.toLocaleDateString('en-GB', { timeZone: 'UTC', ...opts });
  return {
    date,
    day: d,
    month: part({ month: 'short' }),
    long: `${part({ weekday: 'long' })} ${d} ${part({ month: 'long' })}`,
    exact: exactDay(date), // 'Tue 20 Oct'
    time: formatTime(ms, zone),
    ends: formatTime(endMs, zone),
  };
}

export default function ManageBookingPage({ bookingId, action, timeZone }) {
  const [booking, setBooking] = useState(() => getBooking(bookingId));
  const [now, setNow] = useState(() => Date.now());
  const [done, setDone] = useState(null); // 'cancelled' | 'rescheduled', once they've made the change here

  // The student's clock: &tz= when testing, then the zone they booked in, then their device's
  const [zone, setZone] = useState(
    () =>
      matchZone(timeZone) ??
      matchZone(booking?.guestTimeZone) ??
      matchZone(Intl.DateTimeFormat().resolvedOptions().timeZone) ??
      'Asia/Kolkata',
  );

  // Keep up with changes made elsewhere (the creator, another tab) and the clock
  useEffect(() => onBookingsChange(() => setBooking(getBooking(bookingId))), [bookingId]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const serviceId = booking?.serviceId ?? MY_CALL_ID;
  const creator = useMemo(() => buildBookingJson({ serviceId, timeZone: zone }).creator, [serviceId, zone]);
  const profileHref = profileHrefFor(serviceId);
  const state = booking ? statusOf(booking, now) : null;

  // Which screen. A change made here wins, so the done screen stays put.
  const screen = !booking
    ? 'missing'
    : done ?? (state === 'cancelled' ? 'was-cancelled' : state === 'ended' ? 'ended' : state === 'live' ? 'live' : action === 'cancel' || action === 'reschedule' ? action : 'choose');

  useEffect(() => {
    const titles = {
      missing: 'Booking not found',
      cancelled: 'Call cancelled',
      rescheduled: 'Call rescheduled',
      'was-cancelled': 'Call cancelled',
      ended: 'Call ended',
      live: 'Your call is happening now',
      cancel: 'Cancel your call',
      reschedule: 'Reschedule your call',
      choose: 'Your call',
    };
    document.title = creator?.name ? `${titles[screen]} with ${creator.name}` : titles[screen];
  }, [screen, creator?.name]);

  const hrefFor = (next) =>
    `?mock=manage&booking=${encodeURIComponent(bookingId)}&action=${next}&tz=${encodeURIComponent(zone)}`;

  // ---------- A link that doesn't lead to a booking ----------
  // Says nothing about whether a booking exists, so links can't be probed
  if (screen === 'missing') {
    return (
      <Page center>
        <h1 className="bd__title">We couldn't find this booking</h1>
        <p className="bd__lead">The link may be incomplete. Check the email you got when you booked.</p>
        <a className="bd__btn" href={profileHref}>
          See all services
        </a>
      </Page>
    );
  }

  const startMs = Date.parse(booking.start);
  const endMs = Date.parse(booking.end);
  const at = when(startMs, endMs, zone);
  const zoneName = zoneOptions(zone).find((o) => o.id === zone)?.label ?? zone;
  const host = creator.firstName;
  const card = (extra, muted = false) => (
    <Session booking={booking} at={at} zoneName={zoneName} creator={creator} muted={muted}>
      {extra}
    </Session>
  );

  // ================= Just cancelled, here =================
  if (screen === 'cancelled') {
    return (
      <Page>
        <Head icon="cancel" title="Your call is cancelled">
          {host} has been told, and you'll get a cancellation email from Google Calendar.
        </Head>
        {card(null, true)}
        <BookAgain href={profileHref} host={host} />
      </Page>
    );
  }

  // ================= Just rescheduled, here =================
  if (screen === 'rescheduled') {
    const was = booking.previousStart ? when(Date.parse(booking.previousStart), 0, zone) : null;
    return (
      <Page>
        <Head icon="done" title="Your call has been rescheduled">
          {host} has been told, and Google Calendar will send you the updated invite.
        </Head>
        {card(
          was && (
            <p className="mb__was">
              Was <s>{was.exact}, {was.time}</s>
            </p>
          ),
        )}
      </Page>
    );
  }

  // ================= Opened after it was cancelled =================
  if (screen === 'was-cancelled') {
    const byGuest = booking.cancelledBy === 'guest';
    const on = booking.cancelledAt ? ` on ${when(Date.parse(booking.cancelledAt), 0, zone).exact}` : '';
    return (
      <Page>
        <Head icon="cancel" title="This call was cancelled">
          {byGuest ? `You cancelled it${on}.` : `${host} cancelled it${on}.`}
        </Head>
        {card(null, true)}
        {/* The creator's note, when they left one. The student's own reason they already know. */}
        {!byGuest && booking.cancelMessage && (
          <section className="bd__box">
            <p className="mb__note-label">{host}'s note</p>
            <p className="mb__note">{booking.cancelMessage}</p>
          </section>
        )}
        <BookAgain href={profileHref} host={host} />
      </Page>
    );
  }

  // ================= Opened after it ended =================
  if (screen === 'ended') {
    return (
      <Page>
        <Head title="This call has ended">It can't be changed now. You can book another one any time.</Head>
        {card(null, true)}
        <BookAgain href={profileHref} host={host} label="Book another call" />
      </Page>
    );
  }

  // ================= Opened while it's happening =================
  if (screen === 'live') {
    return (
      <Page>
        <Head title="Your call is happening now">
          {booking.format === 'phone' ? `${host} is calling you now.` : `${host} is waiting for you.`}
        </Head>
        {card()}
        {booking.format === 'phone' ? (
          <p className="mb__live-phone">
            <Phone size={16} aria-hidden="true" /> {host} will call {booking.guest?.phone || 'your phone'}.
          </p>
        ) : (
          booking.meetingLink && (
            <a className="bd__btn mb__btn-wide" href={booking.meetingLink} target="_blank" rel="noreferrer">
              <Video size={17} aria-hidden="true" /> Join call
            </a>
          )
        )}
      </Page>
    );
  }

  // ================= No action in the link: offer both =================
  if (screen === 'choose') {
    return (
      <Page>
        <Head title={firstName(booking.guest?.name) ? `Your call, ${firstName(booking.guest.name)}` : 'Your call'}>
          Need to change it? You can pick a new time or cancel.
        </Head>
        {card()}
        <div className="mb__choices">
          <a className="mb__btn mb__btn--primary" href={hrefFor('reschedule')}>
            Reschedule
          </a>
          <a className="mb__btn mb__btn--quiet" href={hrefFor('cancel')}>
            Cancel call
          </a>
        </div>
      </Page>
    );
  }

  // ================= Cancel =================
  if (screen === 'cancel') {
    return (
      <CancelForm
        booking={booking}
        host={host}
        card={card()}
        rescheduleHref={hrefFor('reschedule')}
        onDone={(saved) => {
          setBooking(saved);
          setDone('cancelled');
        }}
      />
    );
  }

  // ================= Reschedule =================
  return (
    <Reschedule
      booking={booking}
      host={host}
      at={at}
      zone={zone}
      onZoneChange={setZone}
      now={now}
      profileHref={profileHref}
      cancelHref={hrefFor('cancel')}
      onDone={(saved) => {
        setBooking(saved);
        setDone('rescheduled');
      }}
    />
  );
}

// ------------------------------------------------------------
// Cancel: what's being cancelled, then why. The reason is required,
// so Cancel call stays off until they've written one.
// ------------------------------------------------------------
function CancelForm({ booking, host, card, rescheduleHref, onDone }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);
  const ready = reason.trim().length > 0;

  const submit = (e) => {
    e.preventDefault();
    if (!ready) return;
    const saved = cancelBooking(booking.id, { message: reason, by: 'guest' });
    if (!saved) {
      setError("We couldn't cancel your call. Try again.");
      return;
    }
    onDone(saved);
  };

  return (
    <Page>
      <Head title="Cancel your call?">
        {host} will be told, and the time opens up for someone else.
      </Head>
      {card}

      <form className="bd__box" onSubmit={submit} noValidate>
        <div>
          <label className="mb__label" htmlFor="mb-reason">
            Why are you cancelling?
          </label>
          <p className="mb__hint" id="mb-reason-hint">
            {host} will see this.
          </p>
        </div>
        <textarea
          id="mb-reason"
          className="mb__textarea"
          rows={4}
          required
          aria-describedby="mb-reason-hint"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Something came up at work. I'll book another time."
        />
        {error && (
          <p className="mb__error" role="alert">
            {error}
          </p>
        )}
        <div className="mb__actions">
          <button type="submit" className="mb__btn mb__btn--danger" disabled={!ready}>
            Cancel call
          </button>
          <a className="mb__btn mb__btn--quiet" href={rescheduleHref}>
            Pick a new time instead
          </a>
        </div>
      </form>
    </Page>
  );
}

// ------------------------------------------------------------
// Reschedule: their call on the left, the creator's open times on the
// right, with their current time marked. Laid out like the booking page.
// ------------------------------------------------------------
function Reschedule({ booking, host, at, zone, onZoneChange, now, profileHref, cancelHref, onDone }) {
  const lengthMins = Math.round((Date.parse(booking.end) - Date.parse(booking.start)) / 60_000);

  // The creator's open times for this call, counting this booking's own time as free
  const availability = useMemo(
    () =>
      findSlots({
        ...getMyAvailability(booking.serviceId, { exceptId: booking.id }),
        durationMins: lengthMins,
        timeZone: zone,
        now,
      }),
    // now: only when the page opens or the clock changes, not every tick
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [booking.serviceId, booking.id, lengthMins, zone],
  );

  // Open on the day they're booked, when it has other times; else the first day that does
  const startDay = availability.days.find((d) => d.date === at.date && d.slots.length > 1)?.date ?? availability.firstAvailable;
  const [date, setDate] = useState(startDay);
  const [slot, setSlot] = useState(null);
  const [error, setError] = useState(null);

  // A new clock: start over on that clock's days
  const changeZone = (next) => {
    onZoneChange(next);
    setSlot(null);
    setDate(null);
  };
  const shownDate = date ?? startDay;

  const chosenDay = availability.days.find((d) => d.date === shownDate);
  const chosen = chosenDay?.slots.find((s) => s.start === slot);
  const newAt = chosen ? when(Date.parse(chosen.start), Date.parse(chosen.start) + lengthMins * 60_000, zone) : null;

  const confirm = () => {
    if (!chosen) return;
    const saved = rescheduleBooking(booking.id, chosen.start, { by: 'guest' });
    if (!saved) {
      setError("We couldn't reschedule your call. Try again.");
      return;
    }
    onDone(saved);
  };

  return (
    <div className="bd store-theme">
      <div className="mb__layout">
        <main className="mb__side">
          <Head title="Reschedule your call" left>
            Pick a new time. {host} will be told, and Google Calendar will update your invite.
          </Head>
          <div className="mb__current">
            <p className="mb__current-label">Your current time</p>
            <p className="mb__current-when">
              {at.long}, {at.time} to {at.ends}
            </p>
          </div>
        </main>

        <aside className="mb__picker" aria-label="Pick a new time">
          <div className="mb__picker-card">
            <SlotPicker
              key={zone}
              availability={availability}
              creatorName={host}
              profileHref={profileHref}
              date={shownDate}
              slot={slot}
              currentSlot={booking.start}
              zonePicker={<TimeZonePicker zone={zone} onChange={changeZone} />}
              onDateChange={(d) => {
                setDate(d);
                setSlot(null);
              }}
              onSlotChange={setSlot}
            />

            {availability.firstAvailable && (
              <div className="mb__go">
                <p className={newAt ? 'mb__go-when' : 'mb__go-when mb__go-when--empty'} aria-live="polite">
                  {newAt ? (
                    <>
                      <span className="mb__go-label">New time</span>
                      {newAt.exact}, {newAt.time} to {newAt.ends}
                    </>
                  ) : (
                    'Pick a new time'
                  )}
                </p>
                <button type="button" className="mb__btn mb__btn--primary" disabled={!newAt} onClick={confirm}>
                  Reschedule
                </button>
              </div>
            )}
            {error && (
              <p className="mb__error" role="alert">
                {error}
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Pieces shared by every screen
// ------------------------------------------------------------
function Page({ children, center = false }) {
  return (
    <div className="bd store-theme">
      <main className={center ? 'bd__wrap bd__wrap--center' : 'bd__wrap'}>{children}</main>
    </div>
  );
}

// The page's title and one line under it. icon: 'done' (green tick) or 'cancel' (grey)
function Head({ title, children, icon = null, left = false }) {
  return (
    <header className={left ? 'mb__head mb__head--left' : 'bd__head'}>
      {icon === 'done' && (
        <span className="bd__tick" aria-hidden="true">
          <Check size={26} strokeWidth={2.5} />
        </span>
      )}
      {icon === 'cancel' && (
        <span className="bd__tick mb__tick--cancel" aria-hidden="true">
          <CalendarX2 size={24} />
        </span>
      )}
      <h1 className="bd__title">{title}</h1>
      {children && <p className="bd__lead">{children}</p>}
    </header>
  );
}

// The call, as on the confirmation page. muted: grey, for a call that isn't happening.
function Session({ booking, at, zoneName, creator, muted, children }) {
  return (
    <section className={muted ? 'bd__session mb__session--muted' : 'bd__session'} aria-label="Your call">
      <span className="bd__cal" aria-hidden="true">
        <span className="bd__cal-month">{at.month}</span>
        <span className="bd__cal-day">{at.day}</span>
      </span>
      <div className="bd__session-text">
        <p className="bd__session-title">{booking.title}</p>
        <p className="bd__session-with">with {creator.name}</p>
        <p className="bd__session-when">
          {at.long}, {at.time} to {at.ends}
        </p>
        <p className="bd__session-zone">{zoneName}</p>
        {children}
      </div>
    </section>
  );
}

function BookAgain({ href, host, label = 'Book another time' }) {
  return (
    <div className="mb__again">
      <a className="bd__btn" href={href}>
        {label}
      </a>
      <p className="mb__again-text">See {host}'s open times and pick one that works.</p>
    </div>
  );
}