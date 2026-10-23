import { useEffect, useId, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import DaysOffDrawer from './DaysOffDrawer';
import { loadDaysOff } from '../data/availabilityStore';
import { activeBookings, onBookingsChange } from '../data/bookingsStore';
import { coachZone } from '../data/buildBookingsJson';
import { todayIn } from '../utils/slots';
import { bookingsOnDays, daysBetween, groupRanges, longRange, shortRange, upcomingDaysOff } from '../utils/daysOff';
import './DaysOff.css';

// ------------------------------------------------------------
// "Days off": the row under Calendar on the 1:1 calls page, laid out
// like it (.oh__row: label, value, actions). Both are settings for
// every call, so they sit above the calls themselves.
//
//   Days off   26–28 Oct, 2 Nov  +1 more                   [Manage]
//              ⚠ 2 booked calls fall on your days off
//
// Hovering (or tabbing to) the dates shows every day off in full:
//
//   ┌ Your days off                ┐
//   │ Mon 26 Oct – Wed 28 Oct  3 days│
//   │ Monday 2 November              │
//   │   1 call booked                │
//   └────────────────────────────────┘
//
// Nothing coming up: "None coming up" and Add days off. The panel
// (DaysOffDrawer.jsx) is a calendar: tap the days to take off, then Save.
// ------------------------------------------------------------
const SHOWN = 2; // ranges named on the row; the rest are "+N more"
const IN_TIP = 8; // ranges listed in the tooltip; past that, Manage shows them all

export default function DaysOffRow() {
  const zone = coachZone();
  const [saved, setSaved] = useState(loadDaysOff);
  const [open, setOpen] = useState(false);
  const tipId = useId();
  const [bookings, setBookings] = useState(activeBookings);

  useEffect(() => onBookingsChange(() => setBookings(activeBookings())), []);

  const today = todayIn(zone);
  const days = upcomingDaysOff(saved, today);
  const ranges = groupRanges(days);
  const clashes = bookingsOnDays(bookings, days, zone);
  const more = ranges.length - SHOWN;

  return (
    <>
      <div className="oh__row do-row">
        <span className="oh__row-label">Days off</span>

        <div className="oh__row-value">
          {ranges.length > 0 ? (
            // Focusable too, so the full list isn't for mouse users only
            <div className="do-row__summary" tabIndex={0} aria-describedby={tipId}>
              <span className="do-row__dates">
                {ranges
                  .slice(0, SHOWN)
                  .map((r) => shortRange(r, today))
                  .join(', ')}
                {more > 0 && <span className="do-row__more"> +{more} more</span>}
              </span>
              <DaysOffTip id={tipId} ranges={ranges} today={today} bookings={bookings} zone={zone} />
            </div>
          ) : (
            <p className="do-row__none">None coming up</p>
          )}
          {clashes.length > 0 && (
            <p className="do-row__clash">
              <AlertTriangle size={14} aria-hidden="true" />
              {clashes.length === 1
                ? '1 booked call falls on your days off'
                : `${clashes.length} booked calls fall on your days off`}
            </p>
          )}
        </div>

        <div className="oh__row-actions">
          <button type="button" className="oh__btn" onClick={() => setOpen(true)}>
            {ranges.length > 0 ? 'Manage' : 'Add days off'}
          </button>
        </div>
      </div>

      {open && (
        <DaysOffDrawer
          value={saved}
          zone={zone}
          onClose={() => setOpen(false)}
          onSaved={(next) => {
            setSaved(next);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

// Every day off in full, with how many days and any calls booked then
function DaysOffTip({ id, ranges, today, bookings, zone }) {
  const rest = ranges.length - IN_TIP;
  return (
    <span className="tip do-tip" role="tooltip" id={id}>
      <span className="do-tip__title">Your days off</span>
      {ranges.slice(0, IN_TIP).map((range) => {
        const span = daysBetween(range.from, range.to);
        const booked = bookingsOnDays(bookings, span, zone).length;
        return (
          <span key={range.from} className="do-tip__item">
            <span className="do-tip__row">
              <span>{longRange(range, today)}</span>
              {span.length > 1 && <span className="do-tip__count">{span.length} days</span>}
            </span>
            {booked > 0 && (
              <span className="do-tip__booked">{booked === 1 ? '1 call booked' : `${booked} calls booked`}</span>
            )}
          </span>
        );
      })}
      {rest > 0 && <span className="do-tip__more">and {rest} more. Open Manage to see them all.</span>}
    </span>
  );
}