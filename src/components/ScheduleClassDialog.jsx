import { useState } from 'react';
import ConfirmDialog from './ConfirmDialog';
import { RepeatFields, SessionFields, repeatProblem, sessionProblem } from './BatchFields';
import {
  DEFAULT_LENGTH,
  DEFAULT_START,
  REPEAT_MAX,
  REPEAT_WEEKS,
  classDay,
  repeatDates,
  scheduleClass,
  scheduleClasses,
  timeLine,
  updateClass,
} from '../data/batches';
import { addDays, todayIn, weekdayOf } from '../utils/slots';
import { appNow } from '../utils/testClock';
import './QuestionInput.css';

// ------------------------------------------------------------
// Scheduling classes of a live class, on the fly, from its Classes tab
// or its row on Live classes: a pop-up with the date, start time and
// length, and Repeat weekly.
//
//   Schedule a class
//   Date [📅 Tue 24 Nov ⌄]   Starts at [🕖 6:00 pm IST ⌄]
//   Length [1 ▾] hr [00 ▾] min
//   ┌ Repeat weekly                                  [━●] ┐
//   │ [Mon] [Tue] [Wed] [Thu] [Fri] [Sat] [Sun]            │
//   │ Until [📅 Tue 22 Dec ⌄]                              │
//   └──────────────────────────────────────────────────────┘
//   Creates 12 classes, Tue 24 Nov to Sat 19 Dec.
//                                [Cancel] [Schedule 12 classes]
//
// It starts from tomorrow, at the time and length of the class's last
// one (or 6 pm, 1 hr). Repeat weekly is off to start; turned on, the
// date's own weekday is ticked and it runs 4 weeks. Each class it makes
// is saved on its own (scheduleClasses), so one can be moved or
// cancelled without the rest. A date that already has a class at that
// time is skipped. At most REPEAT_MAX at once.
//
// Change time (c given): the same pop-up, filled in with that class,
// without Repeat weekly. Its students aren't messaged; their reminders
// follow the new time.
//
// batch: the class. c: the class (session) being changed, or null.
// onDone(message): saved, with a line to show. onClose(): nothing saved.
// ------------------------------------------------------------

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export default function ScheduleClassDialog({ batch, c = null, onDone, onClose }) {
  const now = appNow();
  const today = todayIn(batch.timeZone, now);
  const last = (batch.sessions ?? []).at(-1) ?? null;
  const [value, setValue] = useState(() =>
    c
      ? { date: c.date, startTime: c.startTime, durationMins: c.durationMins }
      : {
          date: addDays(today, 1),
          startTime: last?.startTime ?? DEFAULT_START,
          durationMins: last?.durationMins ?? DEFAULT_LENGTH,
        },
  );
  const [repeat, setRepeat] = useState(() => ({
    repeat: false,
    days: [weekdayOf(addDays(today, 1))],
    until: addDays(addDays(today, 1), REPEAT_WEEKS * 7 - 1),
  }));
  const [tried, setTried] = useState(false);
  const [failed, setFailed] = useState(false);

  const repeating = !c && repeat.repeat;
  const dates = repeating ? repeatDates(value.date, repeat.days, repeat.until) : [];
  const problem =
    sessionProblem(value, batch.timeZone, now) ??
    (repeating ? repeatProblem(repeat, value.date) : null) ??
    (repeating && dates.length === 0 ? 'None of those days fall before the end date.' : null);

  // A new date moves its weekday along, while only that one day is ticked
  const changeValue = (field, v) => {
    setValue((x) => ({ ...x, [field]: v }));
    if (field === 'date' && v) {
      setRepeat((r) => {
        const days = r.days.length === 1 && r.days[0] === weekdayOf(value.date) ? [weekdayOf(v)] : r.days;
        const until = r.until && r.until >= v ? r.until : addDays(v, REPEAT_WEEKS * 7 - 1);
        return { ...r, days, until };
      });
    }
  };

  const save = () => {
    if (problem) {
      setTried(true);
      return;
    }
    if (repeating) {
      const added = scheduleClasses(batch, dates, value);
      if (added === null) {
        setFailed(true);
        return;
      }
      const span = `${classDay(dates[0], today)} to ${classDay(dates.at(-1), today)}`;
      onDone(
        added === 0
          ? 'Those classes were already scheduled.'
          : `${plural(added, 'class', 'classes')} scheduled, ${span}, at ${timeLine(value.startTime)}.`,
      );
      return;
    }
    const ok = c ? updateClass(batch, c.id, value) : Boolean(scheduleClass(batch, value));
    if (!ok) {
      setFailed(true);
      return;
    }
    const when = `${classDay(value.date, today)}, ${timeLine(value.startTime)}`;
    onDone(c ? `Moved to ${when}.` : `Class scheduled for ${when}.`);
  };

  const confirmLabel = c ? 'Save' : repeating && dates.length > 1 ? `Schedule ${dates.length} classes` : 'Schedule class';

  return (
    <ConfirmDialog
      title={c ? 'Change this class’s time' : 'Schedule a class'}
      confirmLabel={confirmLabel}
      form
      closeButton
      onCancel={onClose}
      onConfirm={save}
    >
      <SessionFields
        value={value}
        timeZone={batch.timeZone}
        minDate={today}
        now={now}
        showProblem={tried}
        onChange={changeValue}
      />
      {!c && (
        <div className="sched__repeat">
          <RepeatFields
            value={repeat}
            minDate={value.date}
            showProblem={tried}
            onChange={(field, v) => setRepeat((r) => ({ ...r, [field]: v }))}
          />
        </div>
      )}
      <p className="bfld__summary sched__note" aria-live="polite">
        {c
          ? 'Students aren’t messaged about the change. Their reminders follow the new time.'
          : repeating && dates.length > 0
            ? `Creates ${plural(dates.length, 'class', 'classes')}, ${classDay(dates[0], null)} to ${classDay(dates.at(-1), null)}.${
                dates.length === REPEAT_MAX ? ` That’s the most at once.` : ''
              }`
            : 'Students get a reminder before each class.'}
      </p>
      {failed && (
        <p className="qinput__error" role="alert">
          We couldn’t save in this browser. Free up some space and try again.
        </p>
      )}
    </ConfirmDialog>
  );
}
