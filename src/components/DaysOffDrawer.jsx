import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, X } from 'lucide-react';
import Drawer from './Drawer';
import { saveDaysOff } from '../data/availabilityStore';
import { activeBookings, onBookingsChange } from '../data/bookingsStore';
import { addDays, todayIn, zoned } from '../utils/slots';
import { bookingsOnDays, clashLabel, daysBetween, groupRanges, longRange, upcomingDaysOff } from '../utils/daysOff';
import '../screens/EditFrame.css'; // the footer button (es__btn), as in HoursDrawer
import './HoursDrawer.css'; // the footer's status and actions (hd__status, hd__actions)
import './DaysOff.css';

// ------------------------------------------------------------
// "Days off" from the 1:1 calls page (DaysOffRow.jsx). Days off
// belong to the creator, not a call: one day away blocks every call.
//
//   ┌ Days off                                      ✕ ┐
//   │ Tap the days you want to take off. …            │
//   │           ‹   October 2026   ›                  │
//   │  Mon Tue Wed Thu Fri Sat Sun                    │
//   │               22  23  24  25                    │
//   │  ██  ██  ██  29• 30  31                         │
//   │  ■ Day off  • You have a booking                │
//   │                                                 │
//   │ You're away                                     │
//   │  Mon 26 Oct – Wed 28 Oct   3 days             ✕ │
//   │   ⚠ 1 call is already booked on these days …    │
//   ├─────────────────────────────────────────────────┤
//   │ 1 day added. Not saved yet.  Cancel  Save days off│
//   └─────────────────────────────────────────────────┘
//
// Tapping marks a day off, tapping again gives it back. Nothing is
// saved until Save days off; closing with changes asks first. Booked
// days can still be taken off: the creator knows best, so we say the
// calls stay booked rather than stopping them.
//
// value: the saved days off (availabilityStore overrides)
// zone: the creator's time zone; dates are on this clock
// onSaved(next): saved (the panel then closes)
// onClose(): close without saving
// ------------------------------------------------------------

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const LAST_DAY_AHEAD = 365;

// ---------- Month helpers ('2026-10' is October 2026) ----------
const monthOf = (date) => date.slice(0, 7);

function shiftMonth(month, n) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
}

function monthLabel(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', { timeZone: 'UTC', month: 'long', year: 'numeric' });
}

// Its dates, and how many blank cells come before the 1st (weeks start Monday)
function monthGrid(month) {
  const [y, m] = month.split('-').map(Number);
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const days = Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
  return { lead, days };
}

// 1 call → 'call', and 'It stays'; more → 'calls', 'They stay'
const calls = (n) => (n === 1 ? '1 call' : `${n} calls`);
const stays = (n) => (n === 1 ? 'It stays booked.' : 'They stay booked.');
const dayCount = (n) => (n === 1 ? '1 day' : `${n} days`);

export default function DaysOffDrawer({ value, zone, onSaved, onClose }) {
  const today = todayIn(zone);
  const lastDay = addDays(today, LAST_DAY_AHEAD);
  const dayName = (date) => longRange({ from: date, to: date }, today); // 'Monday 26 October'
  const [draft, setDraft] = useState(() => ({ ...value }));
  const [month, setMonth] = useState(() => monthOf(today));
  const [focusDate, setFocusDate] = useState(today); // the one day in the tab order
  const [asking, setAsking] = useState(false); // "Drop your changes?" showing
  const [failed, setFailed] = useState(false);
  const [bookings, setBookings] = useState(activeBookings);
  const dayRefs = useRef({});
  const moveFocus = useRef(false); // arrow keys moved it: follow with real focus

  useEffect(() => onBookingsChange(() => setBookings(activeBookings())), []);

  // After arrow keys (possibly into another month), focus the new day
  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    dayRefs.current[focusDate]?.focus();
  }, [focusDate, month]);

  const days = upcomingDaysOff(draft, today);
  const offSet = new Set(days);
  const ranges = groupRanges(days);

  // What's changed since the last save, for the footer
  const savedDays = upcomingDaysOff(value, today);
  const added = days.filter((d) => !savedDays.includes(d)).length;
  const removed = savedDays.filter((d) => !offSet.has(d)).length;
  const dirty = added + removed > 0;

  // Upcoming bookings by date, on the creator's clock, for the dots
  const bookedOn = {};
  for (const b of bookings) {
    if (Date.parse(b.end ?? b.start) <= Date.now()) continue;
    const date = zoned(Date.parse(b.start), zone).date;
    (bookedOn[date] ??= []).push(b);
  }

  const toggle = (date) => {
    setDraft((d) => {
      const next = { ...d };
      if (offSet.has(date)) delete next[date];
      else next[date] = [];
      return next;
    });
    setFocusDate(date);
    setAsking(false);
    setFailed(false);
  };

  const removeRange = (range) => {
    setDraft((d) => {
      const next = { ...d };
      for (const day of daysBetween(range.from, range.to)) delete next[day];
      return next;
    });
    setAsking(false);
    setFailed(false);
  };

  // Past days off no longer matter: dropped as we save
  const save = () => {
    const clean = Object.fromEntries(Object.entries(draft).filter(([date]) => date >= today));
    if (saveDaysOff(clean)) onSaved(clean);
    else setFailed(true);
  };

  const requestClose = () => (dirty ? setAsking(true) : onClose());

  const goMonth = (n) => {
    const next = shiftMonth(month, n);
    setMonth(next);
    // Keep the tab stop inside the month on screen
    const first = next === monthOf(today) ? today : `${next}-01`;
    setFocusDate(first);
  };

  // Arrow keys move a day or a week, across months if need be
  const onKeyDown = (e, date) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (!step) return;
    e.preventDefault();
    const target = addDays(date, step);
    if (target < today || target > lastDay) return;
    moveFocus.current = true;
    setFocusDate(target);
    if (monthOf(target) !== month) setMonth(monthOf(target));
  };

  const { lead, days: monthDays } = monthGrid(month);
  const canGoBack = month > monthOf(today);
  const canGoOn = month < monthOf(lastDay);
  // The tab stop has to be a day that's shown and can be tapped
  const tabStop =
    monthOf(focusDate) === month && focusDate >= today && focusDate <= lastDay
      ? focusDate
      : monthDays.find((d) => d >= today && d <= lastDay);

  const changes = [added && `${dayCount(added)} added`, removed && `${dayCount(removed)} removed`].filter(Boolean).join(', ');

  const footer = asking ? (
    <>
      <p className="hd__status" role="alert">
        <strong>Your days off aren’t saved.</strong> Drop your changes?
      </p>
      <div className="hd__actions">
        <button type="button" className="es__btn es__btn--quiet" onClick={() => setAsking(false)}>
          Keep editing
        </button>
        <button type="button" className="es__btn es__btn--danger" onClick={onClose}>
          Drop changes
        </button>
      </div>
    </>
  ) : (
    <>
      <p className={`hd__status ${failed ? 'do__failed' : ''}`} aria-live="polite">
        {failed
          ? 'Couldn’t save. Check your browser allows storage and try again.'
          : dirty
            ? `${changes[0].toUpperCase()}${changes.slice(1)}. Not saved yet.`
            : ''}
      </p>
      <div className="hd__actions">
        <button type="button" className="es__btn es__btn--quiet" onClick={requestClose}>
          Cancel
        </button>
        <button type="button" className="es__btn es__btn--primary" onClick={save} disabled={!dirty}>
          Save days off
        </button>
      </div>
    </>
  );

  return (
    <Drawer
      className="do-drawer"
      title="Days off"
      sub="Tap the days you want to take off. No one can book any of your calls on them."
      onClose={requestClose}
      footer={footer}
    >
      <div className="do-drawer__body">
        {/* ---------- The month ---------- */}
        <section className="do-cal" aria-label="Choose your days off">
          <div className="do-cal__head">
            <button
              type="button"
              className="do-cal__nav"
              onClick={() => goMonth(-1)}
              disabled={!canGoBack}
              aria-label="Previous month"
            >
              <ChevronLeft size={20} aria-hidden="true" />
            </button>
            <h3 className="do-cal__month" aria-live="polite">
              {monthLabel(month)}
            </h3>
            <button
              type="button"
              className="do-cal__nav"
              onClick={() => goMonth(1)}
              disabled={!canGoOn}
              aria-label="Next month"
            >
              <ChevronRight size={20} aria-hidden="true" />
            </button>
          </div>

          <div className="do-cal__grid" role="group" aria-label={monthLabel(month)}>
            {WEEKDAYS.map((d) => (
              <span key={d} className="do-cal__weekday" aria-hidden="true">
                {d}
              </span>
            ))}
            {Array.from({ length: lead }, (_, i) => (
              <span key={`blank-${i}`} aria-hidden="true" />
            ))}
            {monthDays.map((date) => {
              const usable = date >= today && date <= lastDay;
              const off = offSet.has(date);
              const n = bookedOn[date]?.length ?? 0;
              const label = [dayName(date), date === today && 'today', off && 'day off', n && `${calls(n)} booked`]
                .filter(Boolean)
                .join(', ');
              return (
                <button
                  key={date}
                  ref={(el) => (dayRefs.current[date] = el)}
                  type="button"
                  className={[
                    'do-day',
                    off && 'do-day--off',
                    date === today && 'do-day--today',
                    n > 0 && 'do-day--booked',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-pressed={usable ? off : undefined}
                  aria-label={label}
                  disabled={!usable}
                  tabIndex={date === tabStop ? 0 : -1}
                  onClick={() => toggle(date)}
                  onKeyDown={(e) => onKeyDown(e, date)}
                >
                  {Number(date.slice(8))}
                </button>
              );
            })}
          </div>

          <div className="do-cal__legend" aria-hidden="true">
            <span className="do-key">
              <span className="do-key__off" /> Day off
            </span>
            <span className="do-key">
              <span className="do-key__dot" /> You have a booking
            </span>
          </div>
        </section>

        {/* ---------- Read back in words ---------- */}
        <section className="do-list" aria-labelledby="do-list-title">
          <h3 className="do-list__title" id="do-list-title">
            You’re away {days.length > 0 && <span className="oh__count">{days.length}</span>}
          </h3>

          {ranges.length === 0 ? (
            <p className="do-empty">No days off coming up. Tap a day on the calendar to add one.</p>
          ) : (
            <ul className="do-ranges">
              {ranges.map((range) => {
                const span = daysBetween(range.from, range.to);
                const label = longRange(range, today);
                const clashes = bookingsOnDays(bookings, span, zone);
                return (
                  <li key={range.from} className="do-range">
                    <div className="do-range__main">
                      <span className="do-range__label">{label}</span>
                      {span.length > 1 && <span className="do-range__count">{span.length} days</span>}
                      <button
                        type="button"
                        className="do-range__remove"
                        aria-label={`Remove ${label}`}
                        onClick={() => removeRange(range)}
                      >
                        <X size={16} aria-hidden="true" />
                      </button>
                    </div>
                    {clashes.length > 0 && <Clashes bookings={clashes} zone={zone} single={span.length === 1} />}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </Drawer>
  );
}

// Calls already booked on a day off. They aren't cancelled for them:
// the creator decides, from Bookings.
const SHOWN = 3;
function Clashes({ bookings, zone, single }) {
  const n = bookings.length;
  return (
    <div className="do-clash" role="note">
      <p className="do-clash__title">
        <AlertTriangle size={15} aria-hidden="true" />
        {calls(n)} {n === 1 ? 'is' : 'are'} already booked on {single ? 'this day' : 'these days'}
      </p>
      <ul className="do-clash__list">
        {bookings.slice(0, SHOWN).map((b) => (
          <li key={b.id}>{clashLabel(b, zone)}</li>
        ))}
        {n > SHOWN && <li>and {n - SHOWN} more</li>}
      </ul>
      <p className="do-clash__text">{stays(n)} Reschedule or cancel from Bookings, so your guests know.</p>
    </div>
  );
}