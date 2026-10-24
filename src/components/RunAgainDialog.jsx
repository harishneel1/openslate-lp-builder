import { useState } from 'react';
import { Pencil } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';
import DatePicker from './DatePicker';
import TimePicker from './TimePicker';
import { isFuture, nextDateFor } from '../data/webinar';
import './RunAgainDialog.css';

// ------------------------------------------------------------
// "Run again on a new date": makes a new webinar, a copy of this one on
// a new date (App.jsx). Only the date and time are asked for; the pages,
// price, design and settings are copied. (The copy promises the Meta
// pixel too; the pixel setting isn't built yet.) The copy gets its own link,
// sign-up page and Zoom meeting, and this one stays as it is, with the
// people who signed up for it.
//
// Uses the "Are you sure?" pop-up (ConfirmDialog) as a form: a click
// outside doesn't close it. The date and time use our own pickers, and a
// quiet line under them says the date can be changed later, so picking
// one doesn't feel final.
//
// answers: its current answers (date, time, time zone, length)
// onCancel(), onSchedule({ date, time })
// ------------------------------------------------------------
export default function RunAgainDialog({ answers, onCancel, onSchedule }) {
  const [date, setDate] = useState(() => nextDateFor(answers));
  const [time, setTime] = useState(answers.time ?? '19:00');

  const zone = String(answers.timeZone ?? 'IST').split(' ')[0]; // 'IST', shown after the time
  const filled = /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(time);
  const future = filled && isFuture(answers, date, time);
  const error = !filled ? 'Pick a date and a start time.' : !future ? 'Pick a date and time in the future.' : null;

  return (
    <ConfirmDialog
      title="Run again on a new date"
      confirmLabel="Create new webinar"
      confirmDisabled={Boolean(error)}
      form
      onCancel={onCancel}
      onConfirm={() => onSchedule({ date, time })}
    >
      <p>We will make a copy of this webinar with a new link. Your pages, price and Meta pixel will be copied too.</p>
      <p>The new cloned webinar starts with 0 signed-up customers.</p>

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
      <p className="run-again__later">
        <Pencil size={13} aria-hidden="true" /> Not sure yet? Pick any date. You can change it later.
      </p>

      <p className="run-again__error" id="run-again-error" role="alert">
        {error && filled ? error : ''}
      </p>
    </ConfirmDialog>
  );
}