import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Clock, Copy, Phone, Video } from 'lucide-react';
import { buildBookedJson } from '../data/buildBookedJson';
import { matchZone } from '../data/timeZones';
import { googleCalendarUrl } from '../utils/calendar';
import '../styles/storeTheme.css';
import './BookedPage.css';
import { profileHrefFor } from '../data/myProfile';

// ------------------------------------------------------------
// Confirmation page, after checkout. Answers three things: you're
// booked, when it is, and what to do next. The creator's own Google
// Calendar sends the visitor an invite (with the link to join), so the
// next steps are: accept it, then join from the event. Opened at ?mock=booked with
// the details checkout passed on (see main.jsx).
// Payment details, rescheduling and cancelling are left out for now.
// ------------------------------------------------------------

const ICONS = { clock: Clock, phone: Phone, video: Video };

export default function BookedPage({ serviceId, time, timeZone, state, name, email, phone, bookingId }) {
  const zone = matchZone(timeZone) ?? matchZone(Intl.DateTimeFormat().resolvedOptions().timeZone) ?? 'Asia/Kolkata';
  const booking = useMemo(
    () => buildBookedJson({ serviceId, time, timeZone: zone, profileState: state, bookingId }),
    [serviceId, time, zone, state, bookingId],
  );

  const [copied, setCopied] = useState(false);
  const copyTimer = useRef(null);
  useEffect(() => () => clearTimeout(copyTimer.current), []);

  const stateParam = state ? `&state=${encodeURIComponent(state)}` : '';
  const profileHref = profileHrefFor(serviceId, stateParam); // their own page, or Meera's
  const firstName = String(name ?? '').trim().split(/\s+/)[0];

  useEffect(() => {
    document.title = booking ? `Booked: ${booking.service.title} with ${booking.creator.name}` : 'Booking not found';
  }, [booking]);

  // ---------- A link that doesn't lead to a booking ----------
  if (!booking) {
    return (
      <div className="bd store-theme">
        <main className="bd__wrap bd__wrap--center">
          <h1 className="bd__title">We couldn't find this booking</h1>
          <p className="bd__lead">The link may be incomplete. Your confirmation email has the full details.</p>
          <a className="bd__btn" href={profileHref}>
            See all services
          </a>
        </main>
      </div>
    );
  }

  const { creator, service } = booking;
  const ordered = [...service.facts].sort((a, b) => Number(b.icon === 'clock') - Number(a.icon === 'clock'));

  const title = `${service.title} with ${creator.name}`;
  // A video call with no link saved here (older bookings). The link is
  // still in the creator's calendar invite; we just can't show it on this page.
  const linkToCome = booking.format === 'video' && !booking.meetingLink;
  const location = booking.meetingLink ?? (linkToCome ? 'Video call' : `${creator.firstName} will call ${phone ?? 'you'}`);
  const details = booking.meetingLink
    ? `Join: ${booking.meetingLink}`
    : linkToCome
      ? `The link to join is in ${creator.firstName}’s calendar invite.`
      : `${creator.firstName} will call you on ${phone}.`;
  const event = { id: booking.id, title, start: booking.start, end: booking.end, details, location };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(booking.meetingLink);
      setCopied(true);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the link stays visible to copy by hand
    }
  };

  return (
    <div className="bd store-theme">
      <main className="bd__wrap">
        {/* ---------- You're booked ---------- */}
        <header className="bd__head">
          <span className="bd__tick" aria-hidden="true">
            <Check size={26} strokeWidth={2.5} />
          </span>
          <h1 className="bd__title">{firstName ? `You're booked, ${firstName}` : "You're booked"}</h1>
          {/* The invite comes from the creator's own calendar, so name them as the sender */}
          <p className="bd__lead">
            {email ? (
              <>
                {creator.firstName} has sent a calendar invite to <strong>{email}</strong>.
              </>
            ) : (
              `${creator.firstName} has sent you a calendar invite by email.`
            )}
          </p>
        </header>

        {/* ---------- The session ---------- */}
        <section className="bd__session" aria-label="Your session">
          <span className="bd__cal" aria-hidden="true">
            <span className="bd__cal-month">{booking.month}</span>
            <span className="bd__cal-day">{booking.day}</span>
          </span>
          <div className="bd__session-text">
            <p className="bd__session-title">{service.title}</p>
            <p className="bd__session-with">with {creator.name}</p>
            <p className="bd__session-when">
              {booking.weekday} {booking.day} {booking.monthLong}, {booking.time} to {booking.ends}
            </p>
            <p className="bd__session-zone">{booking.zoneLabel}</p>
            <ul className="bd__facts">
              {ordered.map(({ icon, text }) => {
                const Icon = ICONS[icon];
                return (
                  <li key={text}>
                    {Icon && <Icon size={14} aria-hidden="true" />} {text}
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* ---------- What's next: accept the invite, then join from it ---------- */}
        <section className="bd__box" aria-labelledby="bd-next">
          <h2 id="bd-next" className="bd__box-title">
            What’s next
          </h2>

          <ol className="bd__steps">
            <li className="bd__step">
              <span className="bd__step-num" aria-hidden="true">1</span>
              <div className="bd__step-body">
                <p className="bd__step-title">Accept the invite</p>
                <p className="bd__step-text">
                  Open the invite from {creator.firstName} and tap <strong>Yes</strong>, so it’s saved in your calendar.
                </p>
              </div>
            </li>

            <li className="bd__step">
              <span className="bd__step-num" aria-hidden="true">2</span>
              <div className="bd__step-body">
                {booking.format === 'phone' ? (
                  <>
                    <p className="bd__step-title">Pick up the call</p>
                    <p className="bd__step-text">
                      {creator.firstName} will call you on <strong>{phone ?? 'your phone'}</strong> at {booking.time}.
                    </p>
                  </>
                ) : (
                  <>
                    {/* "Join on Zoom": the creator's room, named when we know it */}
                    <p className="bd__step-title">
                      {booking.meetingProvider ? `Join on ${booking.meetingProvider}` : 'Join from your calendar'}
                    </p>
                    {/* The invite always carries the link; we show it here too when we have it */}
                    <p className="bd__step-text">
                      The link is in the invite. Open it from your calendar at {booking.time} on the day.
                    </p>
                    {booking.meetingLink && (
                      <div className="bd__link-row">
                        <a className="bd__link" href={booking.meetingLink} target="_blank" rel="noreferrer">
                          {booking.meetingLink.replace('https://', '')}
                        </a>
                        <button type="button" className="bd__copy" onClick={copyLink}>
                          {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
                          {copied ? 'Copied' : 'Copy link'}
                        </button>
                        <span className="bd__sr-only" aria-live="polite">
                          {copied ? 'Link copied' : ''}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </li>
          </ol>
        </section>

      </main>
    </div>
  );
}