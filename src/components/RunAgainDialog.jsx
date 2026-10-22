import { useState } from 'react';
import ConfirmDialog from './ConfirmDialog';
import { isFuture, lengthLabel, nextDateFor } from '../data/webinar';
import './RunAgainDialog.css';

// ------------------------------------------------------------
// "Run it again": the same webinar on a new date. Its pages and its
// link stay as they are, so ads and shared links keep working; only
// the date, time and (if it changed) the meeting link are asked for.
// The session that's over is kept as an earlier session.
//
// Uses the "Are you sure?" pop-up (ConfirmDialog), with the form inside.
//
// name: the webinar's name, for the title
// answers: its current answers (date, time, time zone, length, meeting link)
// onCancel(), onSchedule({ date, time, meetingLink })
// ------------------------------------------------------------
export default function RunAgainDialog({ name, answers, onCancel, onSchedule }) {
  const [date, setDate] = useState(() => nextDateFor(answers));
  const [time, setTime] = useState(answers.time ?? '19:00');
  const [link, setLink] = useState(answers.meetingLink ?? '');

  const zone = String(answers.timeZone ?? 'IST').split(' ')[0];
  const length = lengthLabel(answers);
  const filled = /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(time);
  const future = filled && isFuture(answers, date, time);
  const error = !filled ? 'Pick a date and a start time.' : !future ? 'Pick a date and time that’s still to come.' : null;

  return (
    <ConfirmDialog
      title="Run it again"
      confirmLabel="Schedule session"
      confirmDisabled={Boolean(error)}
      onCancel={onCancel}
      onConfirm={() => onSchedule({ date, time, meetingLink: link.trim() })}
    >
      <p>
        <strong>“{name}”</strong> keeps its pages and its link, so your ads keep working. Just pick
        the new date.
      </p>

      <div className="run-again__row">
        <label className="run-again__field">
          <span className="run-again__label">Date</span>
          <input
            className="run-again__input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-describedby="run-again-error"
          />
        </label>
        <label className="run-again__field">
          <span className="run-again__label">Start time</span>
          <input
            className="run-again__input"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            aria-describedby="run-again-error"
          />
        </label>
      </div>
      <p className="run-again__hint">
        {zone}
        {length ? `, ${length}` : ''}, as before. To change those, edit your landing page.
      </p>

      <label className="run-again__field">
        <span className="run-again__label">Meeting link</span>
        <input
          className="run-again__input"
          type="url"
          inputMode="url"
          spellCheck={false}
          autoCapitalize="off"
          value={link}
          placeholder="e.g. https://zoom.us/j/1234567890"
          onChange={(e) => setLink(e.target.value)}
        />
        <span className="run-again__hint">Using a new Zoom or Meet link for this session? Paste it here.</span>
      </label>

      <p className="run-again__error" id="run-again-error" role="alert">
        {error && filled ? error : ''}
      </p>
    </ConfirmDialog>
  );
}