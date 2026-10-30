import { useId, useRef } from 'react';
import { loadCallHours } from '../data/availabilityStore';
import { zoneLabel } from '../data/buildBookingsJson';
import { WEEK, shortTime, toMinutes } from '../utils/weeklyHours';
import './HoursTip.css';

// ------------------------------------------------------------
// A call's hours at a glance ("Mon, 10 am – 1 pm, 4 pm – 8:15 pm + 3 more"),
// with every day spelled out in a tooltip on hover or keyboard focus:
//
//   Mon, 10 am – 1 pm, 4 pm – 8:15 pm + 3 more
//   ┌──────────────────────────────┐
//   │ Monday     10 am – 1 pm      │
//   │            4 pm – 8:15 pm    │
//   │ Tuesday    9 am – 5 pm       │
//   │ …                            │
//   │ Sunday     Unavailable       │
//   │ ──────────────────────────── │
//   │ India (Kolkata), GMT+5:30    │
//   └──────────────────────────────┘
//
// One line per time range, so a day with two blocks reads as two lines.
// Used on a call's row in the 1:1 calls list and on the call's own page.
// With no hours at all there's nothing more to show, so no tooltip.
// The bubble has the app's tooltip look (.tip, tooltip.css) and opens
// below the line, so it never covers the call's name above it. As it
// opens it's nudged left if it would run off the screen (narrow windows).
//
// callId: whose hours (availabilityStore.js)
// line: the short summary that shows ("Mon–Fri, 9 am – 5 pm")
// className: the summary's own class, for its size and colour
// ------------------------------------------------------------
export default function HoursTip({ callId, line, className = '' }) {
  const id = useId();
  const bubble = useRef(null);

  // Keep the bubble inside the window: measured as it opens, from where it would sit
  const fit = () => {
    const el = bubble.current;
    if (!el) return;
    el.style.setProperty('--htip-shift', '0px');
    const { left, right } = el.getBoundingClientRect();
    const over = right - (document.documentElement.clientWidth - 8);
    el.style.setProperty('--htip-shift', `${-Math.max(0, Math.min(over, left - 8))}px`);
  };
  const { weekly = {}, timeZone } = loadCallHours(callId);
  const days = WEEK.map((d) => ({
    ...d,
    ranges: (weekly[d.id] ?? []).map(([f, t]) => `${shortTime(toMinutes(f))} – ${shortTime(toMinutes(t))}`),
  }));

  if (!days.some((d) => d.ranges.length > 0)) return <p className={className}>{line}</p>;

  return (
    <p className={`htip ${className}`} onMouseEnter={fit} onFocus={fit}>
      {/* Focusable, so keyboard users can open it too */}
      <span className="htip__line" tabIndex={0} aria-describedby={id}>
        {line}
      </span>
      <span className="tip htip__bubble" role="tooltip" id={id} ref={bubble}>
        <span className="htip__days">
          {days.map((d) => (
            <span key={d.id} className={`htip__day ${d.ranges.length ? '' : 'htip__day--off'}`}>
              <span className="htip__name">{d.label}</span>
              <span className="htip__ranges">
                {d.ranges.length ? d.ranges.map((r) => <span key={r}>{r}</span>) : <span>Unavailable</span>}
              </span>
            </span>
          ))}
        </span>
        {timeZone && <span className="htip__zone">{zoneLabel(timeZone)}</span>}
      </span>
    </p>
  );
}