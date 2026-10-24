import { useState } from 'react';
import ConfirmDialog from './ConfirmDialog';
import DatePicker from './DatePicker';
import TimePicker from './TimePicker';
import InfoTip from './InfoTip';
import { isFuture, nextDateFor, webinarStart, webinarWhen } from '../data/webinar';
import './RunAgainDialog.css';

// ------------------------------------------------------------
// "Add another session": a new session of this webinar on a new date
// (App.jsx). Only the date and time are asked for; the pages, price,
// design and emails come along. The new session gets its own sign-up
// record and Zoom meeting, and shares the webinar's one link, which
// always opens the next session coming up (data/webinar.js).
//
// Kept short on purpose: one line of text, the two pickers already
// filled in (same day and time, a week after the latest session), and a
// quiet note saying why, until they pick their own.
//
// Uses the "Are you sure?" pop-up (ConfirmDialog) as a form: a click
// outside doesn't close it.
//
// answers: its current answers (date, time, time zone, length)
// onCancel(), onSchedule({ date, time })
// ------------------------------------------------------------
export default function RunAgainDialog({ answers, onCancel, onSchedule }) {
  // Filled in with the same day and time as the latest session, a week on
  // (nextDateFor); the hint under the pickers says so until they change it
  const [initial] = useState(() => ({ date: nextDateFor(answers), time: answers.time ?? '19:00' }));
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const suggested = date === initial.date && time === initial.time && Boolean(answers.date);

  // The suggestion in their own dates: 'Sat 24 Oct, 6:30 pm' → 'Sat 31 Oct, 6:30 pm'.
  // weeks: how far on it is (more than 1 when the last session was a while ago)
  const why = (() => {
    const was = webinarWhen(answers);
    const will = webinarWhen({ ...answers, date: initial.date });
    if (!was || !will) return null;
    const short = (w) => w.line.replace(/ [A-Z]{2,5}$/, ''); // without the zone: 'Sat 24 Oct, 6:30 pm'
    const days = Math.round((Date.parse(`${initial.date}T00:00:00Z`) - Date.parse(`${answers.date}T00:00:00Z`)) / 86_400_000);
    const start = webinarStart(answers);
    return {
      last: short(was),
      next: short(will),
      weeks: Math.round(days / 7),
      weekday: new Date(`${initial.date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long' }),
      past: start !== null && start < Date.now(),
    };
  })();

  const zone = String(answers.timeZone ?? 'IST').split(' ')[0]; // 'IST', shown after the time
  const filled = /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(time);
  const future = filled && isFuture(answers, date, time);
  const error = !filled ? 'Pick a date and a start time.' : !future ? 'Pick a date and time in the future.' : null;

  return (
    <ConfirmDialog
      title="Add another session"
      confirmLabel="Add session"
      confirmDisabled={Boolean(error)}
      form
      onCancel={onCancel}
      onConfirm={() => onSchedule({ date, time })}
    >
      {/* One line: what this is, and the one worry it answers. The rest
          (pages and price come along, nobody's signed up yet) shows for
          itself once the new row is in the table. */}
      <p className="run-again__lead">
        Same webinar, new date.
        <br />
        <span className="run-again__link">
          Your link stays the same.
          <InfoTip
            label="Your link stays the same"
            text="Wherever you’ve shared your link, it opens the next session coming up. No need to share a new one."
          />
        </span>
      </p>

      <div className="run-again__row">
        <div className="run-again__field">
          <label className="run-again__label" htmlFor="run-again-date">
            Date
          </label>
          <DatePicker id="run-again-date" value={date} onChange={setDate} className="run-again__input" />
        </div>
        <div className="run-again__field">
          <label className="run-again__label" htmlFor="run-again-time">
            Start time
          </label>
          <TimePicker id="run-again-time" value={time} onChange={setTime} zone={zone} className="run-again__input" />
        </div>
      </div>
      {/* Why this date is filled in, with their real dates: which session it
          counted from, and what it picked (bold). Only a suggestion: the
          pickers are right above. Gone once they pick their own. */}
      {suggested && why && (
        <p className="run-again__why" aria-live="polite">
          {why.weeks === 1 ? (
            <>
              Your last session {why.past ? 'was' : 'is'} on {why.last}, so we suggested a week later:{' '}
              <strong>{why.next}</strong>. Change it if you need another date.
            </>
          ) : (
            <>
              Your last session was on {why.last}, so we suggested the next {why.weekday}:{' '}
              <strong>{why.next}</strong>. Change it if you need another date.
            </>
          )}
        </p>
      )}

      <p className="run-again__error" id="run-again-error" role="alert">
        {error && filled ? error : ''}
      </p>
    </ConfirmDialog>
  );
}