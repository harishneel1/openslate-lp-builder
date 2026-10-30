import { Pencil } from 'lucide-react';
import { CALL_REMINDERS, emailTextOf, reminderReport, remindersOf } from '../data/callReminders';
import './WebinarReminders.css'; // the same rows, switch and pencil as a webinar's Emails tab
import '../components/HoursDrawer.css'; // the grey Example box, as the booking rules have it
import './CallEmails.css';

// ------------------------------------------------------------
// The Emails tab of a 1:1 call's page (CallOverview.jsx): its two
// reminder emails as plain settings, laid out like a webinar's Emails tab:
//
//   Reminder emails
//   People who book get a reminder before their call, so they don't forget.
//   ┌ Example: If Rohan books a call for 4:00 PM on Thursday, he gets  ┐
//   └ reminders at 4:00 PM on Wednesday and 3:00 PM on Thursday.       ┘
//
//   Email                                              On    Edit
//   24 hours before · Edited                          [●━]    ✎
//   1 hour before                                     [━○]    ✎
//   3 upcoming calls won’t get it
//
// What went out, and to whom, is on the Activity tab (and each booking's
// History), so there's no status here. The one thing those can't show is
// what's ahead: a reminder switched off stops for calls already booked, so
// an off reminder says how many upcoming calls that affects.
//
// A switch saves straight away, as on a webinar's Emails tab. The pencil
// opens the email editor (CallReminderEditor.jsx, in CallOverview).
//
// bookings: the call's saved bookings (bookingsStore.js), cancelled too
// callAnswers: the call's answers (its switches and own words)
// now: the clock
// onToggle(id, on), onEdit(id)
// ------------------------------------------------------------

const calls = (n) => `${n} upcoming ${n === 1 ? 'call' : 'calls'}`;

export default function CallEmails({ bookings, callAnswers, now, onToggle, onEdit }) {
  const switches = remindersOf(callAnswers);
  const report = reminderReport(bookings, switches, now);

  return (
    <div className="cem">
      <div className="rm__group-head">
        <h3 className="rm__group-title">Reminder emails</h3>
        <p className="rm__group-text">People who book get a reminder before their call, so they don’t forget.</p>
        <p className="hd-rule__example cem__example">
          <span className="hd-rule__example-tag">Example:</span> If Rohan books a call for{' '}
          <strong>4:00 PM on Thursday</strong>, he gets reminders at <strong>4:00 PM on Wednesday</strong> and{' '}
          <strong>3:00 PM on Thursday</strong>.
        </p>
      </div>

      <div className="rm cem__table">
        <div className="rm__head" aria-hidden="true">
          <span>Email</span>
          <span className="rm__col">On</span>
          <span className="rm__col">Edit</span>
        </div>

        <ul className="cem__list">
          {CALL_REMINDERS.map((r) => {
            const row = report.find((x) => x.id === r.id);
            const edited = emailTextOf(callAnswers, r.id).edited;
            const missing = row.on ? 0 : row.off.length;

            return (
              <li key={r.id} className={`rm__row ${row.on ? '' : 'rm__row--off'}`}>
                <span className="rm__name">
                  <span id={`cem-name-${r.id}`}>{r.name}</span>
                  {edited && <span className="rm__edited"> · Edited</span>}
                  {missing > 0 && <span className="cem__warn">{calls(missing)} won’t get it</span>}
                </span>

                <span className="rm__col">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={row.on}
                    aria-labelledby={`cem-name-${r.id}`}
                    className="rm__switch"
                    onClick={() => onToggle(r.id, !row.on)}
                  >
                    <span className="rm__switch-thumb" aria-hidden="true" />
                  </button>
                </span>

                <span className="rm__col">
                  <button
                    type="button"
                    className="rm__icon"
                    onClick={() => onEdit(r.id)}
                    aria-label={`Edit the email sent ${r.name}`}
                    data-tip="Edit email"
                    data-tip-align="end"
                  >
                    <Pencil size={16} aria-hidden="true" />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="cem__foot">People always get a confirmation email when they book, and when a call is moved or cancelled.</p>
    </div>
  );
}