import { useState } from 'react';
import ConfirmDialog from './ConfirmDialog';
import { SessionFields, sessionProblem } from './BatchFields';
import { DEFAULT_LENGTH, DEFAULT_START, classDay, scheduleClass, timeLine, updateClass } from '../data/batches';
import { addDays, todayIn } from '../utils/slots';
import { appNow } from '../utils/testClock';
import './QuestionInput.css';

// ------------------------------------------------------------
// Scheduling one class of a live class, on the fly, from its Classes tab
// (BatchOverview.jsx): a pop-up with its date, start time and length.
//
//   Schedule a class
//   Date [📅 Tue 24 Nov ⌄]   Starts at [🕖 6:00 pm IST ⌄]
//   Length [1 ▾] hr [00 ▾] min
//                                   [Cancel] [Schedule class]
//
// It starts from tomorrow, at the time and length of the class's last
// one (or 6 pm, 1 hr), so the usual case is one or two taps.
//
// Change time (c given): the same pop-up, filled in with that class. Its
// students aren't messaged; their reminders follow the new time.
//
// batch: the class. c: the class (session) being changed, or null.
// onDone(message): saved, with a line to show. onClose(): nothing saved.
// ------------------------------------------------------------

export default function ScheduleClassDialog({ batch, c = null, onDone, onClose }) {
  const now = appNow();
  const last = (batch.sessions ?? []).at(-1) ?? null;
  const [value, setValue] = useState(() =>
    c
      ? { date: c.date, startTime: c.startTime, durationMins: c.durationMins }
      : {
          date: addDays(todayIn(batch.timeZone, now), 1),
          startTime: last?.startTime ?? DEFAULT_START,
          durationMins: last?.durationMins ?? DEFAULT_LENGTH,
        },
  );
  const [tried, setTried] = useState(false);
  const [failed, setFailed] = useState(false);
  const problem = sessionProblem(value, batch.timeZone, now);
  const today = todayIn(batch.timeZone, now);

  const save = () => {
    if (problem) {
      setTried(true);
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

  return (
    <ConfirmDialog
      title={c ? 'Change this class’s time' : 'Schedule a class'}
      confirmLabel={c ? 'Save' : 'Schedule class'}
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
        onChange={(field, v) => setValue((x) => ({ ...x, [field]: v }))}
      />
      <p className="bfld__summary sched__note">
        {c
          ? 'Students aren’t messaged about the change. Their reminders follow the new time.'
          : 'Everyone on the class’s contracts gets the reminders before it.'}
      </p>
      {failed && (
        <p className="qinput__error" role="alert">
          We couldn’t save in this browser. Free up some space and try again.
        </p>
      )}
    </ConfirmDialog>
  );
}
