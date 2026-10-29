import { useState } from 'react';
import { Pencil } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import { REMINDERS, emailOf, emailStatus, timeline } from '../data/reminders';
import './WebinarReminders.css';

// ------------------------------------------------------------
// The Emails tab of a webinar's details page: its seven automatic
// emails as a plain settings list, the way coaches know it from other
// platforms. Every row is the same: a name that explains itself, a
// switch, a pencil.
//
//   Email                                         Status        On    Edit
//   Confirmation email after registering         42 sent      [●━]    ✎
//   Reminder email 48 hours before webinar       40 sent      [●━]    ✎
//   Reminder email 36 hours before webinar       Off          [━○]    ✎
//   Reminder email 24 hours before webinar       38 sent      [●━]    ✎
//   Reminder email 1 hour before webinar · Edited Today, 1 pm [●━]    ✎
//   Reminder email 5 mins before webinar         Off          [━○]    ✎
//   Thank-you email after webinar                Today, 3 pm  [●━]    ✎
//
// Status: two or three words, so the list stays one line a row. Sent
// emails show a count, waiting ones their time; the next one to go out
// is in full text colour, the rest grey. Hovering gives the full
// sentence, the same one the email editor shows (emailStatus).
// people: who registered (for the counts); now: the clock
// Turning off the confirmation asks first: it has the join link.
// The reschedule and cancel emails aren't here: they're written in those
// flows (RescheduleSession.jsx, CancelSession.jsx), when they're sent.
//
// webinar: its record (answers, reminders)
// onToggle(id, on), onEdit(id)
// ------------------------------------------------------------
export default function WebinarReminders({ webinar, people = [], now = Date.now(), onToggle, onEdit }) {
  const [asking, setAsking] = useState(null); // the id whose switch is asking first
  const rows = timeline(webinar, people, now);

  const flip = (r, on) => {
    if (!on && r.askOff) setAsking(r.id);
    else onToggle(r.id, on);
  };

  return (
    <>
      <div className="rm" role="table" aria-label="Automatic emails">
        <div className="rm__head" role="row">
          <span role="columnheader">Email</span>
          <span role="columnheader">Status</span>
          <span role="columnheader" className="rm__col">
            On
          </span>
          <span role="columnheader" className="rm__col">
            Edit
          </span>
        </div>

        {REMINDERS.map((r) => {
          const { on, edited } = emailOf(webinar, r.id);
          const status = emailStatus(rows.find((x) => x.id === r.id), webinar.answers, now);
          return (
            <div key={r.id} role="row" className={`rm__row ${on ? '' : 'rm__row--off'}`}>
              <span role="cell" className="rm__name">
                {r.name}
                {edited && <span className="rm__edited"> · Edited</span>}
              </span>

              <span role="cell" className={`rm__status ${status.tone ? `rm__status--${status.tone}` : ''}`}>
                <span data-tip={status.full} data-tip-align="start">
                  {status.short}
                </span>
              </span>

              <span role="cell" className="rm__col">
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={`Send the ${r.name.toLowerCase()}`}
                  className="rm__switch"
                  onClick={() => flip(r, !on)}
                >
                  <span className="rm__switch-thumb" aria-hidden="true" />
                </button>
              </span>

              <span role="cell" className="rm__col">
                <button
                  type="button"
                  className="rm__icon"
                  onClick={() => onEdit(r.id)}
                  aria-label={`Edit the ${r.name.toLowerCase()}`}
                  data-tip="Edit email"
                  data-tip-align="end"
                >
                  <Pencil size={16} aria-hidden="true" />
                </button>
              </span>
            </div>
          );
        })}
      </div>

      {asking && (
        <ConfirmDialog
          title="Turn off the confirmation email?"
          confirmLabel="Turn it off"
          cancelLabel="Keep it on"
          danger
          onCancel={() => setAsking(null)}
          onConfirm={() => {
            onToggle(asking, false);
            setAsking(null);
          }}
        >
          <p>People who register won’t get their join link by email. They’ll only see it on the thank you page.</p>
        </ConfirmDialog>
      )}
    </>
  );
}