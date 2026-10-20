import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './SlotPicker.css';

// ------------------------------------------------------------
// The date strip and the time grid. `availability` comes from
// findSlots (utils/slots.js). The chosen date and time live in
// the booking page, so Continue can use them. `zonePicker` is shown
// under the title, so the clock is known before the times are read.
// On desktop only the list of times scrolls (see SlotPicker.css).
// currentSlot: when rescheduling, the time they're booked at now. It's
// marked "Current" and can't be picked again.
// ------------------------------------------------------------

const PERIODS = [
  { id: 'morning', label: 'Morning' },
  { id: 'afternoon', label: 'Afternoon' },
  { id: 'evening', label: 'Evening' },
];

// '2026-10-19' → 'Monday, 19 October' (for screen readers and the grid heading)
function longDate(date, opts = { weekday: 'long', day: 'numeric', month: 'long' }) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { timeZone: 'UTC', ...opts });
}

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function SlotPicker({
  availability,
  creatorName,
  profileHref,
  zonePicker,
  date,
  slot,
  onDateChange,
  onSlotChange,
  currentSlot = null,
}) {
  const currentMs = currentSlot ? Date.parse(currentSlot) : null;
  const { days, firstAvailable } = availability;
  const strip = useRef(null);
  const pending = useRef(null); // where an arrow click is still scrolling to
  const [edges, setEdges] = useState({ start: true, end: true });

  // Where each day sits, as the scroll position that puts it first in the
  // strip. Measured on screen, so it matches where the strip's snapping
  // lands too (its left edge, past the focus-ring padding).
  const dayStops = () => {
    const el = strip.current;
    if (!el) return [];
    const left = el.getBoundingClientRect().left + el.clientLeft;
    return [...el.children].map((d) => Math.round(el.scrollLeft + d.getBoundingClientRect().left - left));
  };

  // Which ends the strip is at, so an arrow with nowhere to go is disabled
  useEffect(() => {
    const el = strip.current;
    if (!el) return undefined;
    const update = () => {
      setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
      // Arrived (or the visitor scrolled it themselves): arrows go from here
      if (pending.current !== null && Math.abs(el.scrollLeft - pending.current) < 4) pending.current = null;
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [days.length]);

  // Bring the chosen day into view when the page opens (it may be a week out)
  useEffect(() => {
    const el = strip.current;
    const chosen = el?.querySelector('[aria-pressed="true"]');
    // Only when it's out of sight, so "Today" stays visible beside "Tomorrow";
    // lined up on a day, so the arrows step evenly from there
    if (el && chosen && chosen.getBoundingClientRect().right > el.getBoundingClientRect().right) {
      el.scrollLeft = dayStops()[[...el.children].indexOf(chosen)] ?? 0;
    }
    // only on first show: later changes come from the visitor's own clicks
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // One day per click: to the next day's stop past where the strip is (or is
  // already heading, so quick clicks each count), or the one before it.
  // The 4px leeway skips the strip's focus-ring padding at the very start.
  const move = (dir) => {
    const el = strip.current;
    if (!el) return;
    const stops = dayStops();
    const from = pending.current ?? el.scrollLeft;
    const max = el.scrollWidth - el.clientWidth;
    const next = dir > 0 ? stops.find((x) => x > from + 4) : [...stops].reverse().find((x) => x < from - 4);
    if (next === undefined) return;
    const left = Math.min(Math.max(0, next), max);
    pending.current = left;
    el.scrollTo({ left, behavior: reduceMotion() ? 'auto' : 'smooth' });
  };

  // Nothing bookable in the whole window
  if (!firstAvailable) {
    return (
      <div className="sp">
        <h2 className="sp__title">Pick a time</h2>
        <div className="sp__empty">
          <p className="sp__empty-title">No times available right now</p>
          <p className="sp__empty-text">
            {creatorName} hasn't opened any times in the next {days.length} days. Check back soon.
          </p>
          <a className="sp__empty-link" href={profileHref}>
            See {creatorName}'s other services
          </a>
        </div>
      </div>
    );
  }

  const day = days.find((d) => d.date === date) ?? days.find((d) => d.date === firstAvailable);
  const firstIndex = days.findIndex((d) => d.date === firstAvailable);

  return (
    <div className="sp">
      <div className="sp__head">
        <h2 className="sp__title">Pick a time</h2>
        {zonePicker}
      </div>

      {/* Worth saying only when the first free day is a few days off, and kept
          neutral: an empty day may be a day off, not a full one */}
      {firstIndex >= 3 && (
        <p className="sp__note">
          The next available day is {longDate(firstAvailable, { weekday: 'short', day: 'numeric', month: 'short' })}.
        </p>
      )}

      {/* ---------- Dates ---------- */}
      <div className="sp__dates">
        <button type="button" className="sp__arrow" onClick={() => move(-1)} disabled={edges.start} aria-label="Earlier dates">
          <ChevronLeft size={18} aria-hidden="true" />
        </button>

        <div className="sp__strip" ref={strip} role="group" aria-label="Date">
          {days.map((d) => {
            const open = d.slots.length > 0;
            const chosen = d.date === day.date;
            return (
              <button
                key={d.date}
                type="button"
                className="sp__day"
                aria-pressed={chosen}
                disabled={!open}
                aria-label={`${longDate(d.date)}, ${open ? `${d.slots.length} times` : 'no times'}`}
                onClick={() => onDateChange(d.date)}
              >
                <span className="sp__day-name">{d.relative ?? d.weekday}</span>
                <span className="sp__day-num">{d.day}</span>
                <span className="sp__day-month">{d.month}</span>
              </button>
            );
          })}
        </div>

        <button type="button" className="sp__arrow" onClick={() => move(1)} disabled={edges.end} aria-label="Later dates">
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>

      {/* ---------- Times for the chosen day ---------- */}
      <div className="sp__times">
        <h3 className="sp__times-title">{longDate(day.date)}</h3>
        {/* key: a new day starts at the top of its list */}
        <div className="sp__periods" key={day.date}>
        {PERIODS.map((p) => {
          const slots = day.slots.filter((s) => s.period === p.id);
          if (!slots.length) return null;
          return (
            <div key={p.id} className="sp__period" role="group" aria-label={p.label}>
              <p className="sp__period-label" aria-hidden="true">{p.label}</p>
              <div className="sp__grid">
                {slots.map((s) =>
                  Date.parse(s.start) === currentMs ? (
                    <button
                      key={s.start}
                      type="button"
                      className="sp__time sp__time--current"
                      disabled
                      aria-label={`${s.time}, your current time`}
                    >
                      {s.time}
                      <span className="sp__time-note" aria-hidden="true">
                        Current
                      </span>
                    </button>
                  ) : (
                    <button
                      key={s.start}
                      type="button"
                      className="sp__time"
                      aria-pressed={s.start === slot}
                      onClick={() => onSlotChange(s.start)}
                    >
                      {s.time}
                    </button>
                  ),
                )}
              </div>
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}