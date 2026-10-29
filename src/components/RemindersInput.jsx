import { AlertTriangle, Eye } from 'lucide-react';
import { CALL_REMINDERS, remindersOf } from '../data/callReminders';
import './HoursDrawer.css'; // the grey Example box, as the booking rules have it
import './RemindersInput.css';

// ------------------------------------------------------------
// The call editor's Reminders section (EditService.jsx): the two
// reminder emails, each with its own Preview and switch.
//
//   24 hours before                         [👁 Preview]  (●  )
//   ┌ Example: If Rohan’s call with you is at 4:00 PM on ┐
//   └ Thursday, he gets this email at 4:00 PM on Wednesday.┘
//   ──────────────────────────────────────────────────────────
//   1 hour before                           [👁 Preview]  (●  )
//   ┌ Example: If Rohan’s call with you is at 4:00 PM on ┐
//   └ Thursday, he gets this email at 3:00 PM on Thursday. ┘
//   ──────────────────────────────────────────────────────────
//   Turning one off affects future calls.
//
// The Example box is the booking rules' own (HoursDrawer.css), so the
// two sections explain themselves the same way.
// Both off: an amber note says nobody will be reminded (it doesn't stop
// saving: some coaches remind people themselves).
// The switches change the editor's draft; its Save saves them.
//
// value: the call's callReminders, as in the draft
// onChange(next): the switches after a flip ({ dayBefore, hourBefore })
// onPreview(id): open the preview on that email
// ------------------------------------------------------------
export default function RemindersInput({ value, onChange, onPreview }) {
  const on = remindersOf({ callReminders: value });
  const noneOn = CALL_REMINDERS.every((r) => !on[r.id]);

  return (
    <div className="rmi">
      <ul className="rmi__list">
        {CALL_REMINDERS.map((r) => (
          <li key={r.id} className={`rmi__row ${on[r.id] ? '' : 'rmi__row--off'}`}>
            <div className="rmi__top">
              <p className="rmi__name" id={`rmi-${r.id}`}>
                {r.name}
              </p>
              <div className="rmi__actions">
                <button
                  type="button"
                  className="rmi__preview"
                  onClick={() => onPreview(r.id)}
                  aria-label={`Preview the email sent ${r.name}`}
                >
                  <Eye size={15} aria-hidden="true" />
                  Preview
                </button>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on[r.id]}
                  aria-labelledby={`rmi-${r.id}`}
                  className="rmi__switch"
                  onClick={() => onChange({ ...on, [r.id]: !on[r.id] })}
                >
                  <span className="rmi__switch-thumb" aria-hidden="true" />
                </button>
              </div>
            </div>
            <p className="hd-rule__example rmi__example">
              <span className="hd-rule__example-tag">Example:</span>{' '}
              {r.example.map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>))}
            </p>
          </li>
        ))}
      </ul>

      {noneOn && (
        <p className="rmi__warning" role="status">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>Both are off, so people won’t get a reminder before this call.</span>
        </p>
      )}

      <p className="rmi__foot">Turning one off affects future calls.</p>
    </div>
  );
}