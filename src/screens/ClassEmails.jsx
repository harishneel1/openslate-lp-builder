import { Lock, Pencil } from 'lucide-react';
import { CLASS_REMINDERS, CLASS_WELCOME, emailTextOf, remindersOf } from '../data/classReminders';
import './WebinarReminders.css'; // the same rows, switch and pencil as a webinar's Emails tab
import './CallEmails.css'; // and as a 1:1 call's (cem)

// ------------------------------------------------------------
// The Email half of a live class's Reminders tab (BatchOverview.jsx),
// laid out like a 1:1 call's (CallEmails.jsx):
//
//   Reminder emails
//   Email                                              On       Edit
//   Welcome after joining                        🔒 Always on    ✎
//   24 hours before                                    [━○]      ✎
//   1 hour before                                      [●━]      ✎
//   5 minutes before                                   [●━]      ✎
//   Class cancelled                          🔒 When you cancel
//   Students also get an email when you cancel a class. You write it
//   on the cancel page each time.
//
// A switch saves straight away. The pencil opens the email editor
// (ClassReminderEditor.jsx, from LiveClassesPage).
//
// batch: the class (its saved switches and words)
// onToggle(id, on), onEdit(id)
// ------------------------------------------------------------

export default function ClassEmails({ batch, onToggle, onEdit }) {
  const switches = remindersOf(batch);

  return (
    <div className="cem">
      <div className="rm__group-head">
        <h3 className="rm__group-title">Reminder emails</h3>
      </div>

      <div className="rm cem__table">
        <div className="rm__head" aria-hidden="true">
          <span>Email</span>
          <span className="rm__col">On</span>
          <span className="rm__col">Edit</span>
        </div>

        <ul className="cem__list">
          <li className="rm__row">
            <span className="rm__name">
              <span>{CLASS_WELCOME.name}</span>
              {emailTextOf(batch, CLASS_WELCOME.id).edited && <span className="rm__edited"> · Edited</span>}
            </span>
            <span className="rm__col">
              <span
                className="cem__always"
                tabIndex={0}
                data-tip="Always goes: it’s how students learn when the class is and how to join."
                data-tip-align="end"
              >
                <Lock size={13} aria-hidden="true" /> Always on
              </span>
            </span>
            <span className="rm__col">
              <EditButton label="Edit the welcome email" onClick={() => onEdit(CLASS_WELCOME.id)} />
            </span>
          </li>

          {CLASS_REMINDERS.map((r) => {
            const on = switches[r.id];
            return (
              <li key={r.id} className={`rm__row ${on ? '' : 'rm__row--off'}`}>
                <span className="rm__name">
                  <span id={`cle-name-${r.id}`}>{r.name}</span>
                  {emailTextOf(batch, r.id).edited && <span className="rm__edited"> · Edited</span>}
                </span>
                <span className="rm__col">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    aria-labelledby={`cle-name-${r.id}`}
                    className="rm__switch"
                    onClick={() => onToggle(r.id, !on)}
                  >
                    <span className="rm__switch-thumb" aria-hidden="true" />
                  </button>
                </span>
                <span className="rm__col">
                  <EditButton label={`Edit the email sent ${r.name}`} onClick={() => onEdit(r.id)} />
                </span>
              </li>
            );
          })}

          <li className="rm__row">
            <span className="rm__name">Class cancelled</span>
            <span className="rm__col">
              <span
                className="cem__always"
                tabIndex={0}
                data-tip="Goes to every student when you cancel a class from the Classes tab."
                data-tip-align="end"
              >
                <Lock size={13} aria-hidden="true" /> When you cancel
              </span>
            </span>
            <span className="rm__col" />
          </li>
        </ul>
      </div>

      <p className="cem__foot">
        You write the cancellation email on the cancel page, each time you cancel a class.
      </p>
    </div>
  );
}

function EditButton({ label, onClick }) {
  return (
    <button type="button" className="rm__icon" onClick={onClick} aria-label={label} data-tip="Edit email" data-tip-align="end">
      <Pencil size={16} aria-hidden="true" />
    </button>
  );
}
