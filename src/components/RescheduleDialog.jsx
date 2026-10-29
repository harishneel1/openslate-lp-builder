import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';
import DatePicker from './DatePicker';
import TimePicker from './TimePicker';
import { moveProblem, moveWarnings } from '../data/reschedule';
import { webinarWhen } from '../data/webinar';
import './RunAgainDialog.css';
import './RescheduleDialog.css';

// ------------------------------------------------------------
// Reschedule: moving one session to a new date and time, from its side
// panel (WebinarDetails.jsx). Built like "Add another session"
// (RunAgainDialog): the same pickers, filled in with where it is now.
//
//   Reschedule the session on Fri 13 Nov                    ✕
//   Its people, pages and Zoom link stay the same.
//
//   Date                          Start time
//   [📅 Fri, 13 Nov 2026]          [7:00 pm IST ▾]
//
//   ⚠ You have a 1:1 call with Priya at 7:30 pm that day.
//   ⚠ Your main landing page link will point to your next upcoming
//     session, Fri 20 Nov.
//                                       [Go back] [Reschedule]
//
// Problems stop it (data/reschedule.js moveProblem: in the past, where
// it already is, at the same time as another session of this webinar),
// shown once they've changed something. Warnings don't (moveWarnings: a
// 1:1 call or another webinar at that time, the link pointing elsewhere).
// A click outside doesn't close it; Go back, ✕ and Escape do.
//
// With people signed up, the button says Continue: the email they're
// sent comes next (RescheduleSession.jsx), and a line says so.
//
// run: the session; all: every webinar session (for the checks)
// people: how many signed up
// onCancel(), onConfirm({ date, time })
// ------------------------------------------------------------
export default function RescheduleDialog({ run, all, people = 0, onCancel, onConfirm }) {
  const answers = run.answers ?? {};
  const [date, setDate] = useState(String(answers.date ?? ''));
  const [time, setTime] = useState(String(answers.time ?? '19:00'));
  const when = webinarWhen(answers);
  const day = when ? `${when.weekday} ${when.day} ${when.month}` : 'this date';

  const zone = String(answers.timeZone ?? 'IST').split(' ')[0]; // 'IST', shown after the time
  const now = Date.now();
  const problem = moveProblem(run, all, date, time, now);
  const warnings = moveWarnings(run, all, date, time, now);
  const changed = date !== String(answers.date ?? '') || time !== String(answers.time ?? '19:00');

  return (
    <ConfirmDialog
      title={`Reschedule the session on ${day}`}
      confirmLabel={people > 0 ? 'Continue' : 'Reschedule'}
      cancelLabel="Go back"
      confirmDisabled={Boolean(problem)}
      form
      closeButton
      onCancel={onCancel}
      onConfirm={() => onConfirm({ date, time })}
    >
      <p className="run-again__lead">
        Its people, pages and Zoom link stay the same.
        {people > 0 && (
          <>
            <br />
            Next, you’ll see the email we send to the {people === 1 ? 'person' : `${people} people`} who signed up.
          </>
        )}
      </p>

      <div className="run-again__row">
        <div className="run-again__field">
          <label className="run-again__label" htmlFor="reschedule-date">
            Date
          </label>
          <DatePicker id="reschedule-date" value={date} onChange={setDate} className="run-again__input" />
        </div>
        <div className="run-again__field">
          <label className="run-again__label" htmlFor="reschedule-time">
            Start time
          </label>
          <TimePicker id="reschedule-time" value={time} onChange={setTime} zone={zone} className="run-again__input" />
        </div>
      </div>

      {/* Only once they've changed something: no red text on a fresh pop-up */}
      <p className="run-again__error" role="alert">
        {changed && problem ? problem : ''}
      </p>

      {warnings.length > 0 && (
        <ul className="reschedule__warnings">
          {warnings.map((text) => (
            <li key={text} className="reschedule__warning">
              <AlertTriangle size={15} aria-hidden="true" />
              {text}
            </li>
          ))}
        </ul>
      )}
    </ConfirmDialog>
  );
}