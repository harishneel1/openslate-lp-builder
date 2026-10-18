import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { buildBookingJson } from '../data/buildBookingJson';
import { matchZone } from '../data/timeZones';
import { formatTime } from '../utils/slots';
import CallDetails from '../components/booking/CallDetails';
import SlotPicker from '../components/booking/SlotPicker';
import TimeZonePicker from '../components/booking/TimeZonePicker';
import '../styles/storeTheme.css';
import './BookingPage.css';
import { profileHrefFor } from '../data/myProfile';

// ------------------------------------------------------------
// One call's booking page: what the call is, and when to have it.
// Opened at ?mock=book&service=<id> (see main.jsx for the options).
// Continue goes to ?mock=checkout with the call, the chosen time
// (as a UTC instant) and the visitor's time zone.
// ------------------------------------------------------------

// The visitor's time zone: from &tz= when testing, otherwise their device's
function visitorZone(fromUrl) {
  return matchZone(fromUrl) ?? matchZone(Intl.DateTimeFormat().resolvedOptions().timeZone) ?? 'Asia/Kolkata';
}

export default function BookingPage({ serviceId, state, slots, timeZone }) {
  const [zone, setZone] = useState(() => visitorZone(timeZone));
  const page = useMemo(
    () => buildBookingJson({ serviceId, profileState: state, slotsState: slots, timeZone: zone }),
    [serviceId, state, slots, zone],
  );
  const { creator, service, durationMins, reviews, availability } = page;

  // The chosen day (starts on the first one with times) and time (none yet)
  const [date, setDate] = useState(() => availability?.firstAvailable ?? null);
  const [slot, setSlot] = useState(null);
  const chooseDate = (next) => {
    setDate(next);
    setSlot(null); // a time belongs to its day
  };

  // A new time zone can move a time onto a different day: follow the chosen
  // time to its day there, or go back to the first day with times
  const zoneChanged = useRef(false);
  useEffect(() => {
    if (!zoneChanged.current) {
      zoneChanged.current = true;
      return;
    }
    if (!availability) return;
    const holder = slot && availability.days.find((d) => d.slots.some((s) => s.start === slot));
    setDate(holder ? holder.date : availability.firstAvailable);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone]);

  // Back to the same version of the profile they came from
  const stateParam = state ? `&state=${encodeURIComponent(state)}` : '';
  const profileHref = profileHrefFor(serviceId, stateParam); // their own page, or Meera's

  useEffect(() => {
    document.title = service ? `${service.title} with ${creator.name}` : creator.name;
  }, [service, creator.name]);

  // Plain on purpose: the coach card below is where her name and photo appear
  const back = (
    <a className="bk__back" href={profileHref}>
      <ChevronLeft size={18} aria-hidden="true" />
      All services
    </a>
  );

  if (!service) {
    return (
      <div className="bk store-theme">
        <header className="bk__top">{back}</header>
        <main className="bk__missing">
          <h1 className="bk__missing-title">This call isn't available</h1>
          <p className="bk__missing-text">It may have been removed, or the link may be wrong.</p>
          <a className="bk__missing-link" href={profileHref}>
            See {creator.firstName}'s other services
          </a>
        </main>
      </div>
    );
  }

  const chosenDay = availability.days.find((d) => d.date === date);
  const chosenSlot = chosenDay?.slots.find((s) => s.start === slot);

  // "Mon 19 Oct, 11:15 am", and the end time for the summary
  const when = chosenSlot && `${chosenDay.weekday} ${chosenDay.day} ${chosenDay.month}, ${chosenSlot.time}`;
  const ends = chosenSlot && formatTime(Date.parse(chosenSlot.start) + durationMins * 60_000, zone);
  const checkoutHref =
    chosenSlot &&
    `?mock=checkout&service=${encodeURIComponent(service.id)}&time=${encodeURIComponent(chosenSlot.start)}` +
      `&tz=${encodeURIComponent(zone)}${stateParam}`;

  return (
    <div className="bk store-theme">
      <header className="bk__top">{back}</header>

      <div className="bk__layout">
        <main className="bk__details">
          <CallDetails service={service} creator={creator} profileHref={profileHref} reviews={reviews} />
        </main>

        <aside id="bk-picker" className="bk__picker" aria-label="Pick a time">
          <div className="bk__picker-card">
            <SlotPicker
              key={zone}
              availability={availability}
              creatorName={creator.firstName}
              profileHref={profileHref}
              date={date}
              slot={slot}
              zonePicker={<TimeZonePicker zone={zone} onChange={setZone} />}
              onDateChange={chooseDate}
              onSlotChange={setSlot}
            />

            {availability.firstAvailable && (
              /* The chosen time and Continue: always in view on desktop.
                 No price on this page: it's on the profile and at checkout. */
              <div className="bk__go">
                <p className={chosenSlot ? 'bk__go-when' : 'bk__go-when bk__go-when--empty'} aria-live="polite">
                  {chosenSlot ? (
                    <>
                      <span className="bk__go-label">Your call</span>
                      {when} to {ends}
                    </>
                  ) : (
                    'Pick a time to continue'
                  )}
                </p>
                {chosenSlot ? (
                  <a className="bk__go-btn" href={checkoutHref}>
                    Continue
                  </a>
                ) : (
                  <button type="button" className="bk__go-btn" disabled>
                    Continue
                  </button>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Phones: the picker is below the details, so this keeps it one tap away.
          Once a time is chosen, it carries straight on to checkout. */}
      <div className="bk__bar">
        <p className="bk__bar-info">
          {chosenSlot ? 'Your call' : service.title}
          <span className="bk__bar-detail">{when ?? service.facts.map((f) => f.text).join(', ')}</span>
        </p>
        <a className="bk__bar-cta" href={checkoutHref || '#bk-picker'}>
          {chosenSlot ? 'Continue' : service.cta}
        </a>
      </div>
    </div>
  );
}