import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarCheck, ChevronLeft, ChevronRight, Phone, Video, XCircle } from 'lucide-react';
import BookingDrawer from '../components/BookingDrawer';
import GuestInitials from '../components/GuestInitials';
import { loadBookings, onBookingsChange } from '../data/bookingsStore';
import { loadAnswers, myCallIds } from '../data/myProfile';
import {
  buildBookingsJson,
  buildDayTimeline,
  clockLabel,
  dayInSentence,
  describeBooking,
  exactDay,
  hourLabel,
  lengthLabel,
  longDay,
  movedFromLabel,
  onDay,
  shortDay,
  startsIn,
} from '../data/buildBookingsJson';
import { addDays } from '../utils/slots';
import './BookingsPage.css';

// ------------------------------------------------------------
// The creator's 1:1 bookings. The next call first, then any day
// they want to look at, drawn as an hour grid:
//
//   ┌──────────────────────────────────────────────┐
//   │ Bookings                                     │
//   │ Times in India (Kolkata), GMT+5:30           │
//   │ ┌──────────────────────────────────────────┐ │
//   │ │ (HN) Next call: Tomorrow, 1:00 pm [Join] │ │  opens the drawer
//   │ └──────────────────────────────────────────┘ │
//   │  ‹  Mon Tue [Wed] Thu Fri ...  ›    Today    │  dots: calls that day
//   │ Wednesday 21 October     1 call, 30 min      │
//   │  9 am ─────────────────────────────────────  │
//   │ 10 am ─────────────────────────────────────  │
//   │  1 pm ┃(HN) Harish Neel                      │  placed at its time,
//   │       ┃ Discovery call, 1:00 to 1:30 pm      │  as tall as it is long
//   │  5 pm ─────────────────────────────────────  │
//   └──────────────────────────────────────────────┘
//
// Orange means "act now" only: Join, the now line, a call about to start.
// A call opens BookingDrawer on the right. Bookings come from this
// browser (bookingsStore.js) and refresh when they change anywhere.
//
// onNavigate: the app's sidebar navigation, for the empty state's link
// openRequest: { id, n } from the bell in the top bar: go to that call's
//              day and open it (a new n opens it again)
// ------------------------------------------------------------

const TICK_MS = 30_000; // how often "now" moves on
const PX_PER_MIN = 72 / 60; // an hour is 72px tall
const FOLD_AFTER_MINS = 120; // empty time between calls longer than this is folded (never the padding around a short day)
const FOLD_PX = 36; // how tall a folded stretch is
const COMPACT_BELOW = 60; // calls shorter than this (px) fit on one line

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// '2 calls, 1 hr 30 min booked'
function daySummary(count, mins) {
  if (!count) return null;
  return `${count} ${count === 1 ? 'call' : 'calls'}, ${lengthLabel(mins)} booked`;
}

// Who cancelled: 'You cancelled' or 'Tarun cancelled'
function cancelledBy(booking) {
  if (booking.cancelledBy !== 'guest') return 'You cancelled';
  const first = String(booking.guest?.name ?? '').trim().split(/\s+/)[0] || 'Your guest';
  return `${first} cancelled`;
}

// Working hours as words: '9:00 am to 1:00 pm, 4:00 pm to 8:00 pm'

export default function BookingsPage({ onNavigate, openRequest = null }) {
  const [bookings, setBookings] = useState(loadBookings);
  const [now, setNow] = useState(() => Date.now());
  const [openId, setOpenId] = useState(null);
  const [notice, setNotice] = useState(null);

  // Keep up with new bookings (checkout in another tab) and the clock
  useEffect(() => onBookingsChange(() => setBookings(loadBookings())), []);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const page = useMemo(() => buildBookingsJson({ bookings, now }), [bookings, now]);
  const [date, setDate] = useState(page.openOn);
  const day = useMemo(() => buildDayTimeline({ date, bookings, now }), [date, bookings, now]);

  const openRaw = bookings.find((b) => b.id === openId) ?? null;
  const opened = openRaw ? describeBooking(openRaw, page.zone, now) : null;

  const open = (id) => {
    setNotice(null);
    setOpenId(id);
  };

  // After a reschedule or cancel: reload, and follow the call to its new day
  const changed = (message) => {
    const fresh = loadBookings();
    setBookings(fresh);
    setNotice(message);
    const moved = fresh.find((b) => b.id === openId);
    if (moved) setDate(describeBooking(moved, page.zone, Date.now()).date);
  };

  // The next day after this one that has a call, for the empty-day link
  // Opened from the bell: that call's day, with it open
  useEffect(() => {
    if (!openRequest) return;
    const found = loadBookings().find((b) => b.id === openRequest.id);
    if (!found) return;
    setBookings(loadBookings());
    setNotice(null);
    setOpenId(found.id);
    setDate(describeBooking(found, page.zone, Date.now()).date);
    // only when a new request comes in
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openRequest?.n]);

  const nextCallAfter = page.days.find((d) => d.date > date && d.date >= page.today && d.count > 0)?.date ?? null;

  useEffect(() => {
    document.title = 'Calendar';
  }, []);

  // ---------- Nobody has booked yet ----------
  // Two cases: no 1:1 call to book yet (set one up), or calls that
  // nobody has booked (go share them). Both lead to the 1:1 calls page.
  if (!page.hasAny) {
    const hasCalls = myCallIds(loadAnswers()).length > 0;
    return (
      <div className="bk">
        <h1 className="bk__title">Calendar</h1>
        <div className="bk__empty bk__empty--page">
          <span className="bk__empty-icon" aria-hidden="true">
            <CalendarCheck size={22} />
          </span>
          <h2 className="bk__empty-title">No bookings yet</h2>
          <p className="bk__empty-text">
            {hasCalls
              ? 'When someone books one of your 1:1 calls, it shows up here with everything you need for it.'
              : 'Set up a 1:1 call and share its link. When someone books, it shows up here with everything you need for it.'}
          </p>
          {onNavigate && (
            <button
              type="button"
              className={`bk-btn ${hasCalls ? 'bk-btn--secondary' : 'bk-btn--primary'}`}
              onClick={() => onNavigate('calls')}
            >
              {hasCalls ? 'Go to 1:1 calls' : 'Set up a 1:1 call'}
            </button>
          )}
        </div>
      </div>
    );
  }

  const chosen = page.days.find((d) => d.date === date);
  const isPast = date < page.today;

  return (
    <div className="bk">
      <header className="bk__head">
        <h1 className="bk__title">Calendar</h1>
        <p className="bk__zone">Times in {page.zoneLabel}</p>
      </header>

      {/* ---------- Next call ---------- */}
      {page.next && <NextCall booking={page.next} today={page.today} now={now} onOpen={() => open(page.next.id)} />}

      {/* ---------- Dates ---------- */}
      <DateStrip days={page.days} date={date} today={page.today} onChange={setDate} />

      {/* ---------- The chosen day ---------- */}
      <section className="bk__day" aria-labelledby="bk-day-title">
        <div className="bk__day-head">
          <div>
            <h2 className="bk__day-title" id="bk-day-title">
              {chosen?.relative ? `${chosen.relative}, ` : ''}
              {longDay(date)}
            </h2>
          </div>
          {day.callCount > 0 && <p className="bk__day-sum">{daySummary(day.callCount, day.bookedMins)}</p>}
        </div>

        {day.callCount === 0 ? (
          <div className="bk__empty">
            <p className="bk__empty-title">
              {isPast ? 'No calls that day' : 'No calls booked yet'}
            </p>
            {nextCallAfter && (
              <>
                <p className="bk__empty-text">Your next call is {onDay(nextCallAfter, page.today)}.</p>
                <button type="button" className="bk-btn bk-btn--secondary" onClick={() => setDate(nextCallAfter)}>
                  Go to {dayInSentence(nextCallAfter, page.today)}
                </button>
              </>
            )}
          </div>
        ) : (
          <HourGrid day={day} onOpen={open} />
        )}

        {/* Cancelled calls: kept apart, since their time is free again */}
        {day.cancelled.length > 0 && (
          <div className="bk__cancelled">
            <h3 className="bk__cancelled-title">Cancelled</h3>
            <ul className="bk__cancelled-list">
              {day.cancelled.map((b) => (
                <li key={b.id}>
                  {/* Laid out like a call on the grid, in grey: readable, clearly not happening */}
                  <button type="button" className="bk__cancelled-row" onClick={() => open(b.id)}>
                    <span className="bk__cancelled-text">
                      <span className="bk__cancelled-name">{b.guest?.name || 'Guest'}</span>
                      <span className="bk__cancelled-meta">
                        {b.title}, {b.time} to {b.ends}
                      </span>
                    </span>
                    <span className="bk-call__chip">{cancelledBy(b)}</span>
                    {/* The guest's reason, in their words. The creator's own note is in the drawer. */}
                    {b.cancelledBy === 'guest' && b.cancelMessage && (
                      <span className="bk__cancelled-reason">“{b.cancelMessage}”</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {opened && (
        <BookingDrawer
          booking={opened}
          zone={page.zone}
          today={page.today}
          now={now}
          notice={notice}
          onClose={() => {
            setOpenId(null);
            setNotice(null);
          }}
          onChanged={changed}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------
// The next call, always on top, whichever day is chosen
// ------------------------------------------------------------
function NextCall({ booking, today, now, onOpen }) {
  const live = booking.state === 'live';
  const joinable = live || booking.state === 'soon';
  const when = live ? 'Happening now' : `${shortDay(booking.date, today)}, ${booking.time}`;
  const inWords = !live ? startsIn(Date.parse(booking.start), now) : null;
  const name = booking.guest?.name || 'Guest';

  // Join is always the orange action; a phone call gets Call instead
  const action =
    booking.format === 'phone' && booking.guest?.phone ? (
      <a className="bk-btn bk-btn--primary" href={`tel:${booking.guest.phone.replace(/\s/g, '')}`}>
        <Phone size={16} aria-hidden="true" /> Call
      </a>
    ) : booking.meetingLink ? (
      <a className="bk-btn bk-btn--primary" href={booking.meetingLink} target="_blank" rel="noreferrer">
        <Video size={16} aria-hidden="true" /> Join call
      </a>
    ) : null;

  return (
    <div className={`bk__next ${joinable ? 'bk__next--now' : ''}`}>
      <button type="button" className="bk__next-main" onClick={onOpen}>
        <GuestInitials name={name} size="lg" />
        <span className="bk__next-text">
          <span className="bk__next-label">
            {live ? 'Happening now' : 'Next call'}
            {inWords && <span className="bk__next-in">, {inWords}</span>}
          </span>
          <span className="bk__next-when">{live ? name : when}</span>
          <span className="bk__next-who">
            {live ? booking.title : `${name}, ${booking.title}`}
          </span>
          {/* Only a declined calendar invite shows here: the one reply worth acting on */}
          {booking.invite?.status === 'declined' && (
            <span className="bk__next-flag">
              <XCircle size={14} aria-hidden="true" /> Declined the calendar invite
            </span>
          )}
        </span>
      </button>
      {action}
    </div>
  );
}

// ------------------------------------------------------------
// A sideways strip of days, with dots for the calls on each
// ------------------------------------------------------------
function DateStrip({ days, date, today, onChange }) {
  const strip = useRef(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  // Which ends the strip is at, so an arrow with nowhere to go is disabled
  useEffect(() => {
    const el = strip.current;
    if (!el) return undefined;
    const update = () =>
      setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [days.length]);

  // Keep the chosen day in the middle of the strip
  const first = useRef(true);
  useEffect(() => {
    const el = strip.current;
    const chosen = el?.querySelector('[aria-pressed="true"]');
    if (!el || !chosen) return;
    const left = chosen.offsetLeft - el.clientWidth / 2 + chosen.offsetWidth / 2;
    el.scrollTo({ left, behavior: first.current || reduceMotion() ? 'auto' : 'smooth' });
    first.current = false;
  }, [date]);

  const page = (dir) => {
    const el = strip.current;
    el?.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: reduceMotion() ? 'auto' : 'smooth' });
  };

  // Arrow keys move a day at a time
  const onKeyDown = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const next = addDays(date, e.key === 'ArrowLeft' ? -1 : 1);
    if (!days.some((d) => d.date === next)) return;
    onChange(next);
    requestAnimationFrame(() => strip.current?.querySelector('[aria-pressed="true"]')?.focus());
  };

  return (
    <div className="bk__dates">
      <button type="button" className="bk__arrow" onClick={() => page(-1)} disabled={edges.start} aria-label="Earlier dates">
        <ChevronLeft size={18} aria-hidden="true" />
      </button>

      <div className="bk__strip" ref={strip} role="group" aria-label="Date" onKeyDown={onKeyDown}>
        {days.map((d) => {
          const pressed = d.date === date;
          return (
            <button
              key={d.date}
              type="button"
              className={`bk__date ${d.past ? 'bk__date--past' : ''} ${d.date === today ? 'bk__date--today' : ''}`}
              aria-pressed={pressed}
              tabIndex={pressed ? 0 : -1}
              aria-label={`${longDay(d.date)}${d.date === today ? ', today' : ''}, ${
                d.count ? `${d.count} ${d.count === 1 ? 'call' : 'calls'}` : 'no calls'
              }`}
              onClick={() => onChange(d.date)}
            >
              <span className="bk__date-name">{d.date === today ? 'Today' : d.weekday}</span>
              <span className="bk__date-num">{d.day}</span>
              <span className="bk__date-month">{d.month}</span>
              <span className="bk__date-dots" aria-hidden="true">
                {Array.from({ length: Math.min(d.count, 3) }, (_, i) => (
                  <span key={i} className="bk__dot" />
                ))}
                {d.count > 3 && <span className="bk__dot-more">+</span>}
              </span>
            </button>
          );
        })}
      </div>

      <button type="button" className="bk__arrow" onClick={() => page(1)} disabled={edges.end} aria-label="Later dates">
        <ChevronRight size={18} aria-hidden="true" />
      </button>

      <button type="button" className="bk-btn bk-btn--secondary bk__today" onClick={() => onChange(today)} disabled={date === today}>
        Today
      </button>
    </div>
  );
}

// ------------------------------------------------------------
// One day as an hour grid. Hours they work are white; the rest is
// shaded. Calls sit at their real time, as tall as they are long.
// ------------------------------------------------------------
function HourGrid({ day, onOpen }) {
  const { range, core, calls, nowMins } = day;
  if (!range) return null;

  // Long empty stretches between calls fold into one slim band, so a late
  // call doesn't stretch the day into hours of nothing. Only inside the
  // calls' own span (core): the hours added around them to fill a short day
  // are there to be seen, so they never fold.
  // The empty pieces of that span: no call in them
  let start = core.from;
  const pieces = [];
  for (const c of calls) {
    if (c.to <= start) continue;
    if (c.from > start) pieces.push([start, c.from]);
    start = Math.max(start, c.to);
  }
  if (start < core.to) pieces.push([start, core.to]);
  // Folded on whole hours, so the labels either side stay round
  const folds = [];
  for (const [a, b] of pieces) {
    const from = Math.ceil(a / 60) * 60;
    const to = Math.floor(b / 60) * 60;
    if (to - from > FOLD_AFTER_MINS) folds.push([from, to]);
  }
  const segments = [];
  let cursor = range.from;
  for (const [f, t] of folds) {
    if (f > cursor) segments.push({ from: cursor, to: f, fold: false });
    segments.push({ from: f, to: t, fold: true });
    cursor = t;
  }
  if (cursor < range.to) segments.push({ from: cursor, to: range.to, fold: false });
  let top = 0;
  for (const seg of segments) {
    seg.top = top;
    top += seg.fold ? FOLD_PX : (seg.to - seg.from) * PX_PER_MIN;
  }
  const height = top;

  // Minutes into the day → pixels down the grid
  const y = (mins) => {
    const seg = segments.find((sg) => mins >= sg.from && mins <= sg.to) ?? segments[segments.length - 1];
    const into = Math.min(Math.max(mins, seg.from), seg.to) - seg.from;
    return seg.top + (seg.fold ? (into / (seg.to - seg.from)) * FOLD_PX : into * PX_PER_MIN);
  };

  // Hour lines, except inside a fold
  const marks = [];
  for (let m = range.from; m <= range.to; m += 60) {
    if (!folds.some(([f, t]) => m > f && m < t)) marks.push(m);
  }
  const showNow = nowMins !== null && nowMins >= range.from && nowMins <= range.to;

  return (
    <div className="bk-grid" style={{ height }}>
      {folds.map(([f, t]) => (
        <div key={`fold-${f}`} className="bk-grid__fold" style={{ top: y(f), height: FOLD_PX }}>
          No calls, {hourLabel(f)} to {hourLabel(t)}
        </div>
      ))}

      {/* Hour lines and labels */}
      {marks.map((m) => (
        <div key={m} className="bk-grid__hour" style={{ top: y(m) }} aria-hidden="true">
          {/* Hidden when "now" sits right on it, so the two times don't overlap */}
          {!(showNow && Math.abs(m - nowMins) < 12) && <span className="bk-grid__label">{hourLabel(m)}</span>}
        </div>
      ))}

      {/* The calls */}
      <ol className="bk-grid__calls">
        {calls.map((b) => {
          const height = Math.max(28, y(Math.min(b.to, range.to)) - y(b.from) - 2);
          const compact = height < COMPACT_BELOW;
          const joinable = (b.state === 'live' || b.state === 'soon') && b.meetingLink;
          const name = b.guest?.name || 'Guest';
          // A rescheduled call says so until it's over, so a changed day doesn't surprise them
          const movedFrom = b.state !== 'ended' ? movedFromLabel(b) : null;
          const movedBy = b.moved?.by === 'guest' ? `Rescheduled by ${name}` : 'You rescheduled this call';
          return (
            <li
              key={b.id}
              className={`bk-call bk-call--${b.state} ${compact ? 'bk-call--compact' : ''}`}
              style={{ top: y(b.from) + 1, height }}
            >
              <button type="button" className="bk-call__open" onClick={() => onOpen(b.id)}>
                {!compact && <GuestInitials name={name} />}
                <span className="bk-call__text">
                  <span className="bk-call__name">{name}</span>
                  <span className="bk-call__meta">
                    {b.title}, {b.time} to {b.ends}
                  </span>
                </span>
              </button>
              {movedFrom && (
                // Hover the tag: who rescheduled, and the old and new times, at once
                <span className="bk-moved">
                  <span className="bk-call__chip bk-call__chip--moved">Rescheduled from {movedFrom}</span>
                  <span className="tip bk-moved__tip" role="tooltip">
                    <span className="bk-moved__who">{movedBy}</span>
                    <span className="bk-moved__row">
                      <span className="bk-moved__key">Was</span>
                      <s>
                        {exactDay(b.moved.date)}, {b.moved.time}
                      </s>
                    </span>
                    <span className="bk-moved__row">
                      <span className="bk-moved__key">Now</span>
                      {exactDay(b.date)}, {b.time}
                    </span>
                  </span>
                </span>
              )}
              {/* A declined calendar invite, until the call is over: open it to see more */}
              {b.state !== 'ended' && b.invite?.status === 'declined' && (
                <span className="bk-call__chip bk-call__chip--declined" data-tip={`${name} declined the calendar invite. The booking is still on.`} data-tip-align="end">
                  <XCircle size={13} aria-hidden="true" /> Declined invite
                </span>
              )}
              {b.state === 'live' && <span className="bk-call__chip bk-call__chip--live">Now</span>}
              {b.state === 'ended' && <span className="bk-call__chip">Ended</span>}
              {joinable && (
                <a className="bk-btn bk-btn--primary bk-call__join" href={b.meetingLink} target="_blank" rel="noreferrer">
                  <Video size={15} aria-hidden="true" /> Join
                </a>
              )}
            </li>
          );
        })}
      </ol>

      {/* Now */}
      {showNow && (
        <div className="bk-grid__now" style={{ top: y(nowMins) }} aria-label={`Now, ${clockLabel(nowMins)}`}>
          <span className="bk-grid__now-time">{clockLabel(nowMins)}</span>
        </div>
      )}
    </div>
  );
}