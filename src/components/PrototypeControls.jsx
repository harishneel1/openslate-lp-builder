import { useState } from 'react';
import { ChevronDown, FlaskConical } from 'lucide-react';
import { addSampleStudents, clearSampleStudents, hasSampleStudents, studentsOf } from '../data/classStudents';
import { cancelClass, nextClasses, saveBatch, newSessionId } from '../data/batches';
import { appNow, setTestDate, testDate } from '../utils/testClock';
import { addDays, todayIn } from '../utils/slots';
import './PrototypeControls.css';

// ------------------------------------------------------------
// Prototype controls, at the bottom of a class's page: for trying every
// situation without remembering addresses. Not part of the product, and
// it says so; developers leave it out.
//
//   ⚗ Prototype controls · not part of the product                    ▾
//   Sample students  [Add sample students]  [Clear samples]
//                    8 people across the class's contracts, one on two
//                    of them, one with no phone number
//   Pretend today is [Real date] [+1 week] [+1 month] [+5 weeks] [date]
//                    Testing as 6 Dec 2026
//   Classes          [Add a sample break]  [Cancel the next class]
//                    Straight in: 3 class days off a week ahead, or the next class
//                    cancelled as if students were told (no cancel page)
//
// Sample students show on the Students tab with a Sample mark
// (classStudents.js), so search, the filter, Export and WhatsApp can be
// tried. They aren't real sign-ups: Contracts and Courses don't count them.
// The pretend date is utils/testClock.js; jumps count from the real date.
// Open or closed is remembered for this tab.
//
// batch: the class. onChange(): students or the date changed.
// ------------------------------------------------------------

const OPEN_KEY = 'pagebuilder:prototype-controls-open';

// Who'd be told now, for the class controls: every student, and those
// with a phone (as if WhatsApp were connected)
function toldNow(batch) {
  const students = studentsOf(batch);
  return { email: students.length, whatsapp: students.filter((s) => s.phone).length };
}

// '2026-12-06' → '6 Dec'
function shortDate(date) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' });
}

const JUMPS = [
  ['+1 week', 7],
  ['+1 month', 30],
  ['+5 weeks', 35],
];

export default function PrototypeControls({ batch, onChange }) {
  const [open, setOpen] = useState(() => {
    try {
      return sessionStorage.getItem(OPEN_KEY) === '1';
    } catch {
      return false;
    }
  });
  const toggle = () => {
    setOpen((o) => {
      try {
        sessionStorage.setItem(OPEN_KEY, o ? '0' : '1');
      } catch {
        // fine: it just won't be remembered
      }
      return !o;
    });
  };

  const realToday = todayIn(batch.timeZone, Date.now());
  const testing = testDate();
  const samples = hasSampleStudents(batch.id);
  const linked = (batch.contractIds ?? []).length > 0;

  const pretend = (date) => {
    setTestDate(date === realToday ? null : date);
    onChange?.();
  };

  return (
    <section className={`proto ${open ? 'proto--open' : ''}`} aria-label="Prototype controls">
      <button type="button" className="proto__head" aria-expanded={open} onClick={toggle}>
        <FlaskConical size={16} aria-hidden="true" />
        <span className="proto__title">Prototype controls</span>
        <span className="proto__tag">For testing, not part of the product</span>
        {testing && <span className="proto__now">Testing as {shortDate(testing)}</span>}
        <ChevronDown size={16} className="proto__chevron" aria-hidden="true" />
      </button>

      {open && (
        <div className="proto__body">
          <div className="proto__row">
            <span className="proto__label">Sample students</span>
            <div className="proto__controls">
              <button
                type="button"
                className="proto__btn"
                disabled={!linked || samples}
                onClick={() => {
                  addSampleStudents(batch, appNow());
                  onChange?.();
                }}
              >
                Add sample students
              </button>
              <button
                type="button"
                className="proto__btn"
                disabled={!samples}
                onClick={() => {
                  clearSampleStudents(batch.id);
                  onChange?.();
                }}
              >
                Clear samples
              </button>
              <p className="proto__note">
                {linked
                  ? '8 people across the class’s contracts: one on two of them, one with no phone number.'
                  : 'Link a contract to the class first.'}
              </p>
            </div>
          </div>

          <div className="proto__row">
            <span className="proto__label">Classes</span>
            <div className="proto__controls">
              <button
                type="button"
                className="proto__btn"
                onClick={() => {
                  const now = appNow();
                  const today = todayIn(batch.timeZone, now);
                  // Three classes at different times: tomorrow 6 pm, in 3 days 7:30 am, in 5 days 8 pm
                  const samples = [
                    [1, '18:00', 60],
                    [3, '07:30', 45],
                    [5, '20:00', 90],
                  ].map(([d, startTime, durationMins]) => ({ id: newSessionId(), date: addDays(today, d), startTime, durationMins }));
                  saveBatch({ ...batch, sessions: [...(batch.sessions ?? []), ...samples] });
                  onChange?.();
                }}
              >
                Schedule 3 sample classes
              </button>
              <button
                type="button"
                className="proto__btn"
                onClick={() => {
                  const now = appNow();
                  const next = nextClasses(batch, now, 1)[0];
                  if (next) cancelClass(batch, next.id, toldNow(batch), now);
                  onChange?.();
                }}
              >
                Cancel the next class
              </button>
              <p className="proto__note">
                Straight in, without the pop-up or the cancel page: 3 classes at different times from{' '}
                {testing ? 'the pretend date' : 'today'}, or the next class cancelled.
              </p>
            </div>
          </div>

          <div className="proto__row">
            <span className="proto__label">Pretend today is</span>
            <div className="proto__controls">
              <button type="button" className="proto__btn" aria-pressed={!testing} onClick={() => pretend(realToday)}>
                Real date
              </button>
              {JUMPS.map(([label, days]) => {
                const date = addDays(realToday, days);
                return (
                  <button
                    key={label}
                    type="button"
                    className="proto__btn"
                    aria-pressed={testing === date}
                    onClick={() => pretend(date)}
                  >
                    {label}
                  </button>
                );
              })}
              <input
                type="date"
                className="proto__date"
                aria-label="Pick a date"
                value={testing ?? realToday}
                onChange={(e) => e.target.value && pretend(e.target.value)}
              />
              <p className="proto__note">
                See which class is next on a later day. Only Live classes use this date.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}