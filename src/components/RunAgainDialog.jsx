import { useState } from 'react';
import ConfirmDialog from './ConfirmDialog';
import DatePicker from './DatePicker';
import TimePicker from './TimePicker';
import { isFuture, nextDateFor } from '../data/webinar';
import './RunAgainDialog.css';

// ------------------------------------------------------------
// "Add another session": a new session of this webinar on a new date
// (App.jsx). Only the date and time are asked for; the pages, price,
// design and emails come along. The new session gets its own sign-up
// record and Zoom meeting, and shares the webinar's one link, which
// always opens the next session coming up (data/webinar.js).
//
//   Add another session                                  ✕
//   Running it again? Just pick a date.
//   Your link, pages and price stay the same.
//
//   Date                          Start time
//   [📅 Mon, 16 Nov 2026]          [7:00 pm IST ▾]
//   A week after your last session
//                                 [Cancel] [Add session]
//
// Kept short on purpose: two friendly lines that answer the one worry
// (what happens to my link and pages?), and the pickers already filled
// in (same day and time, a week after the latest session). A small
// hint under the date says where it came from, until they pick their own.
//
// Uses the "Are you sure?" pop-up (ConfirmDialog) as a form: a click
// outside doesn't close it; Cancel, ✕ and Escape do.
//
// answers: its current answers (date, time, time zone, length)
// onCancel(), onSchedule({ date, time })
// ------------------------------------------------------------
export default function RunAgainDialog({ answers, onCancel, onSchedule }) {
  // Filled in with the same day and time as the latest session, a week on
  // (nextDateFor); the hint under the date says so until they change it
  const [initial] = useState(() => ({ date: nextDateFor(answers), time: answers.time ?? '19:00' }));
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const suggested = date === initial.date && Boolean(answers.date);

  // Where the suggested date came from: 'A week after your last session',
  // or 'Next Monday' when the last one was a while ago (same weekday)
  const hint = (() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(answers.date ?? ''))) return null;
    const days = Math.round((Date.parse(`${initial.date}T00:00:00Z`) - Date.parse(`${answers.date}T00:00:00Z`)) / 86_400_000);
    if (!Number.isFinite(days)) return null;
    if (Math.round(days / 7) === 1) return 'A week after your last session';
    const weekday = new Date(`${initial.date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long' });
    return `Next ${weekday}`;
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
      closeButton
      onCancel={onCancel}
      onConfirm={() => onSchedule({ date, time })}
    >
      <p className="run-again__lead">
        Running it again? Just pick a date.
        <br />
        Your link, pages and price stay the same.
      </p>

      <div className="run-again__row">
        <div className="run-again__field">
          <label className="run-again__label" htmlFor="run-again-date">
            Date
          </label>
          <DatePicker
            id="run-again-date"
            value={date}
            onChange={setDate}
            className="run-again__input"
          />
          {suggested && hint && <p className="run-again__hint">{hint}</p>}
        </div>
        <div className="run-again__field">
          <label className="run-again__label" htmlFor="run-again-time">
            Start time
          </label>
          <TimePicker id="run-again-time" value={time} onChange={setTime} zone={zone} className="run-again__input" />
        </div>
      </div>

      <p className="run-again__error" id="run-again-error" role="alert">
        {error && filled ? error : ''}
      </p>
    </ConfirmDialog>
  );
}