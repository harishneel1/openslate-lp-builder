import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Users, Video } from 'lucide-react';
import AcademyTop from '../components/AcademyTop';
import { academyHome } from '../data/courses';
import { mockAccount } from '../data/myPage';
import { previewOf } from '../data/imagePreviews';
import { classTimeRange, onBatchesChange } from '../data/batches';
import { onStudentsChange } from '../data/classStudents';
import { zoneShort } from '../components/BatchFields';
import { JOIN_FROM_MS, communityPath, joinState, studentJoinHref, upcomingFor } from '../data/studentClasses';
import { appNow, onTestDateChange } from '../utils/testClock';
import './AcademyCoursesPage.css';
import './CommunityPage.css';

// ------------------------------------------------------------
// The academy's Community tab (/web/community), what students see. Only
// its Feed for now, and on it only their next live class, as TagMango's
// next-session card. Posts and Messages come later.
//
//   ┌──────────────────────────────────────────────────────────────┐
//   │ [ picture ]  TUE, 24 NOV                                      │
//   │              Bharatanatyam for Beginners            [▶ Join]  │
//   │              By Harish Neel                                   │
//   │              6:00–7:00 pm IST · Starts in 15h 43m             │
//   └──────────────────────────────────────────────────────────────┘
//
// Which class: the soonest one coming up in any class they're in
// (studentClasses.js); a class on now stays until it ends. Cancelled
// ones don't show.
// Join opens the class's Zoom room in a new tab. It works from 15 minutes
// before until the class ends; before that it's greyed, saying when it
// opens. The line under the time counts down: "Starts in 3 days",
// "Starts in 15h 43m", "Starts in 12 min", then "Live now".
// Under it, Upcoming classes: the ones after it (up to 10), as cards in a
// row that scrolls sideways, with See all in its head and ‹ › arrows on
// wider screens. Each card: a date block, the class's name, and its day
// and time. Left out when there's nothing after the next one.
//
//   Upcoming classes                                   See all  ‹ ›
//   ┌──────────────────────────────────┐ ┌───────────────────────
//   │ ┌─────┐ Yoga at sunrise          │ │ ┌─────┐ Bharatanatyam…
//   │ │ NOV │ By Harish Neel           │ │ │ NOV │
//   │ │ 25  │ 📅 Wed 25 Nov  🕖 6:30 am │ │ │ 26  │
//   │ │ WED │                          │ │ │ THU │
//   │ └─────┘                          │ │ └─────┘
//   └──────────────────────────────────┘ └───────────────────────
//
// Nothing coming up: a quiet line saying their classes will show here.
//
// See all (/web/community/classes): every class coming up, grouped by
// date, as TagMango's Workshops page (Upcoming only). ← Community goes back.
//
//   ← Community
//   Upcoming classes
//   Tue 24 Nov 2026
//   ┌──────────────────────────────────────────────────────────────┐
//   │ [pic] Bharatanatyam for Beginners                   [▶ Join] │
//   │       6:00–7:00 pm IST · By Harish Neel        Opens at 5:45 pm │
//   └──────────────────────────────────────────────────────────────┘
//   Wed 25 Nov 2026
//   …
//
// student: the signed-in student, or null for the coach's preview
//   (?preview=1), which shows every class's
// page: 'classes' for See all, else the Community page
// ------------------------------------------------------------

const TICK_MS = 30_000;
const ROW_MAX = 10; // cards in the row; See all has the rest
const allPath = `${communityPath}/classes`; // See all
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export default function CommunityPage({ student, preview, page = null }) {
  const [now, setNow] = useState(appNow);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNow(appNow()), TICK_MS);
    const stops = [
      onTestDateChange(() => setNow(appNow())),
      onBatchesChange(() => setVersion((v) => v + 1)),
      onStudentsChange(() => setVersion((v) => v + 1)),
    ];
    return () => {
      clearInterval(id);
      stops.forEach((stop) => stop?.());
    };
  }, []);
  useEffect(() => {
    document.title = `${mockAccount.name} - ${page === 'classes' ? 'Upcoming classes' : 'Community'}`;
  }, [page]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const all = useMemo(() => upcomingFor(student, now), [student, now, version]);
  const next = all[0] ?? null;
  const later = all.slice(1, ROW_MAX + 1);

  const back = preview ? `${communityPath}?preview=1` : communityPath;
  if (page === 'classes') {
    return (
      <div className="acd">
        <AcademyTop student={student} home={academyHome(preview)} on="community" preview={preview} />
        <AllClasses items={all} now={now} back={back} preview={preview} />
      </div>
    );
  }

  return (
    <div className="acd">
      <AcademyTop student={student} home={academyHome(preview)} on="community" preview={preview} />

      <main className="acd__main cm">
        <h1 className="acd__title">Community</h1>

        {next ? (
          <>
            <NextClass c={next.c} batch={next.batch} now={now} />
            {later.length > 0 && <UpcomingRow items={later} seeAll={preview ? `${allPath}?preview=1` : allPath} />}
          </>
        ) : (
          <section className="acd__empty">
            <span className="acd__empty-icon" aria-hidden="true">
              <Users size={28} />
            </span>
            <h2 className="acd__empty-title">No classes coming up</h2>
            <p className="acd__empty-text">
              {preview
                ? 'Classes you schedule will show up here.'
                : `Live classes you join from ${mockAccount.name} will show up here.`}
            </p>
          </section>
        )}
      </main>
    </div>
  );
}

// "TUE, 24 NOV", in the class's own time zone
function datePill(c) {
  const d = new Date(`${c.date}T12:00:00Z`);
  return d
    .toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
    .replace(/^(\w+)/, '$1,')
    .toUpperCase();
}

// "Starts in 3 days", "Starts in 15h 43m", "Starts in 12 min", "Live now"
function startsIn(c, now) {
  const left = c.start - now;
  if (left <= 0) return 'Live now';
  if (left >= 2 * DAY) return `Starts in ${Math.floor(left / DAY)} days`;
  if (left >= HOUR) {
    const h = Math.floor(left / HOUR);
    const m = Math.floor((left % HOUR) / MIN);
    return `Starts in ${h}h ${String(m).padStart(2, '0')}m`;
  }
  return `Starts in ${Math.max(1, Math.ceil(left / MIN))} min`;
}

function NextClass({ c, batch, now }) {
  const state = joinState(c, now);
  return (
    <section className="cm-next" aria-label="Your next class">
      <ClassPicture batch={batch} className="cm-next__pic" />

      <div className="cm-next__body">
        <span className="cm-next__date">{datePill(c)}</span>
        <h2 className="cm-next__title">{batch.title}</h2>
        <p className="cm-next__by">By {mockAccount.name}</p>
        <p className="cm-next__when">
          {classTimeRange(c, batch)} {zoneShort(batch.timeZone)}
          <span aria-hidden="true"> · </span>
          <span className={`cm-next__in ${state !== 'later' ? 'cm-next__in--soon' : ''}`}>{startsIn(c, now)}</span>
        </p>
      </div>

      <div className="cm-next__join">
        <JoinButton c={c} batch={batch} now={now} />
      </div>
    </section>
  );
}

// Join: greyed with when it opens until 15 minutes before, then our
// orange (with a soft ring while it's on), opening the class's Zoom
function JoinButton({ c, batch, now }) {
  const state = joinState(c, now);
  if (state === 'later') {
    const opensAt = new Date(c.start - JOIN_FROM_MS).toLocaleTimeString('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: batch.timeZone,
    });
    return (
      <>
        <span className="cm-join cm-join--off" aria-disabled="true">
          <Video size={17} aria-hidden="true" /> Join
        </span>
        <span className="cm-next__opens">Opens at {opensAt.toLowerCase()}</span>
      </>
    );
  }
  return (
    <a
      className="cm-join"
      href={studentJoinHref(batch.id)}
      target="_blank"
      rel="noopener"
      aria-label={`Join ${batch.title} (opens Zoom in a new tab)`}
    >
      {state === 'live' && <span className="cm-join__pulse" aria-hidden="true" />}
      <Video size={17} aria-hidden="true" /> Join
    </a>
  );
}

// The class's picture, 16:9; without one, our orange tint with a camera
function ClassPicture({ batch, className }) {
  const picture = batch.thumbnail ? previewOf(batch.thumbnail.previewId) : null;
  return (
    <span className={className} aria-hidden="true">
      {picture ? <img src={picture} alt="" /> : <Video size={24} />}
    </span>
  );
}

// ---------- Upcoming classes: the row ----------
function UpcomingRow({ items, seeAll }) {
  const strip = useRef(null);
  const [ends, setEnds] = useState({ start: true, end: false });
  const measure = () => {
    const el = strip.current;
    if (!el) return;
    setEnds({ start: el.scrollLeft <= 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 });
  };
  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [items.length]);
  const move = (dir) => strip.current?.scrollBy({ left: dir * strip.current.clientWidth * 0.8, behavior: 'smooth' });

  return (
    <section className="cm-up" aria-labelledby="cm-up-title">
      <div className="cm-up__head">
        <h2 className="cm-up__title" id="cm-up-title">
          Upcoming classes
        </h2>
        <a className="cm-up__all" href={seeAll}>
          See all
        </a>
        {!(ends.start && ends.end) && (
          <span className="cm-up__arrows">
            <button type="button" className="cm-up__arrow" onClick={() => move(-1)} disabled={ends.start} aria-label="Earlier classes">
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <button type="button" className="cm-up__arrow" onClick={() => move(1)} disabled={ends.end} aria-label="Later classes">
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </span>
        )}
      </div>
      <ul className="cm-up__strip" ref={strip} onScroll={measure}>
        {items.map(({ c, batch }) => (
          <li key={`${batch.id}-${c.id}`} className="cm-up__card">
            <DateBlock c={c} />
            <span className="cm-up__text">
              <span className="cm-up__name">{batch.title}</span>
              <span className="cm-up__by">By {mockAccount.name}</span>
              <span className="cm-up__when">
                <span>
                  <CalendarDays size={14} aria-hidden="true" /> {dayLine(c)}
                </span>
                <span>
                  <Clock size={14} aria-hidden="true" /> {classTimeRange(c, batch)}
                </span>
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// NOV / 25 / WED, as TagMango's calendar block
function DateBlock({ c }) {
  const d = new Date(`${c.date}T12:00:00Z`);
  const part = (o) => d.toLocaleDateString('en-GB', { ...o, timeZone: 'UTC' });
  return (
    <span className="cm-date" aria-hidden="true">
      <span className="cm-date__month">{part({ month: 'short' })}</span>
      <span className="cm-date__day">{part({ day: 'numeric' })}</span>
      <span className="cm-date__week">{part({ weekday: 'short' })}</span>
    </span>
  );
}

// "Wed 25 Nov"
const dayLine = (c) =>
  new Date(`${c.date}T12:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });

// ---------- See all: every class coming up, grouped by date ----------
function AllClasses({ items, now, back, preview }) {
  const days = [];
  items.forEach((item) => {
    const last = days.at(-1);
    if (last && last.date === item.c.date) last.items.push(item);
    else days.push({ date: item.c.date, items: [item] });
  });
  return (
    <main className="acd__main cm">
      <a className="cm-back" href={back}>
        <ChevronLeft size={18} aria-hidden="true" /> Community
      </a>
      <h1 className="acd__title">Upcoming classes</h1>

      {days.length === 0 ? (
        <section className="acd__empty">
          <span className="acd__empty-icon" aria-hidden="true">
            <Users size={28} />
          </span>
          <h2 className="acd__empty-title">No classes coming up</h2>
          <p className="acd__empty-text">
            {preview
              ? 'Classes you schedule will show up here.'
              : `Live classes you join from ${mockAccount.name} will show up here.`}
          </p>
        </section>
      ) : (
        days.map((day) => (
          <section key={day.date} className="cm-day" aria-labelledby={`cm-day-${day.date}`}>
            <h2 className="cm-day__title" id={`cm-day-${day.date}`}>
              {fullDay(day.date)}
            </h2>
            <ul className="cm-day__list">
              {day.items.map(({ c, batch }) => (
                <li key={`${batch.id}-${c.id}`} className="cm-row">
                  <ClassPicture batch={batch} className="cm-row__pic" />
                  <span className="cm-row__text">
                    <span className="cm-row__name">{batch.title}</span>
                    <span className="cm-row__when">
                      {classTimeRange(c, batch)} {zoneShort(batch.timeZone)}
                      {joinState(c, now) !== 'later' && (
                        <span className="cm-next__in--soon"> · {startsIn(c, now)}</span>
                      )}
                    </span>
                    <span className="cm-row__by">By {mockAccount.name}</span>
                  </span>
                  <span className="cm-row__join">
                    <JoinButton c={c} batch={batch} now={now} />
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </main>
  );
}

// "Tue 24 Nov 2026"
const fullDay = (date) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
