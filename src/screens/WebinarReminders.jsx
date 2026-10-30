import { useState } from 'react';
import { Pencil } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import { REMINDERS, emailOf } from '../data/reminders';
import './WebinarReminders.css';

// ------------------------------------------------------------
// The Emails tab of a webinar's details page: its seven automatic
// emails as a plain settings list, the way coaches know it from other
// platforms. Every row is the same: a name that explains itself, a
// switch, a pencil.
//
//   Email                                                  On    Edit
//   Confirmation email after registering                 [●━]    ✎
//   Reminder email 48 hours before webinar               [●━]    ✎
//   Reminder email 36 hours before webinar               [━○]    ✎
//   Reminder email 1 hour before webinar · Edited        [●━]    ✎
//   Thank-you email after webinar                        [●━]    ✎
//
// No status column: what went out, and to how many, is on each session's
// Activity tab. The email editor still says when its email goes out.
// Turning off the confirmation asks first: it has the join link.
// The reschedule and cancel emails aren't here: they're written in those
// flows (RescheduleSession.jsx, CancelSession.jsx), when they're sent.
//
// webinar: its record (answers, reminders)
// onToggle(id, on), onEdit(id)
// ------------------------------------------------------------
export default function WebinarReminders({ webinar, onToggle, onEdit }) {
  const [asking, setAsking] = useState(null); // the id whose switch is asking first

  const flip = (r, on) => {
    if (!on && r.askOff) setAsking(r.id);
    else onToggle(r.id, on);
  };

  return (
    <>
      <div className="rm" role="table" aria-label="Automatic emails">
        <div className="rm__head" role="row">
          <span role="columnheader">Email</span>
          <span role="columnheader" className="rm__col">
            On
          </span>
          <span role="columnheader" className="rm__col">
            Edit
          </span>
        </div>

        {REMINDERS.map((r) => {
          const { on, edited } = emailOf(webinar, r.id);
          return (
            <div key={r.id} role="row" className={`rm__row ${on ? '' : 'rm__row--off'}`}>
              <span role="cell" className="rm__name">
                {r.name}
                {edited && <span className="rm__edited"> · Edited</span>}
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