import { useState } from 'react';
import { ChevronDown, FlaskConical } from 'lucide-react';
import { addSampleMembers, clearSampleMembers, hasSampleMembers, membersOf, shortDate } from '../data/batchMembers';
import { cancelClass, classesInRange, nextClasses, saveBatchDaysOff } from '../data/batches';
import { appNow, setTestDate, testDate } from '../utils/testClock';
import { addDays, todayIn } from '../utils/slots';
import './PrototypeControls.css';

// ------------------------------------------------------------
// Prototype controls, at the bottom of a batch's page: for trying every
// situation without remembering addresses. Not part of the product, and
// it says so; developers leave it out.
//
//   ⚗ Prototype controls · not part of the product                    ▾
//   Sample members   [Add one of each]  [Clear samples]
//                    Paid, due soon, payment pending (today, 3 days,
//                    8 days), no phone number, removed, joined on the 31st
//   Pretend today is [Real date] [+1 week] [+1 month] [+5 weeks] [date]
//                    Testing as 6 Dec 2026
//   Classes          [Add a sample break]  [Cancel the next class]
//                    Straight in: 3 class days off a week ahead, or the next class
//                    cancelled as if members were told (no cancel page)
//
// Sample members are real members with a sample mark (batchMembers.js),
// so everything works on them: Remind, Mark as paid, Remove, the bell.
// The pretend date is utils/testClock.js; jumps count from the real date.
// Open or closed is remembered for this tab.
//
// batch: the batch. onChange(): members or the date changed.
// ------------------------------------------------------------

const OPEN_KEY = 'pagebuilder:prototype-controls-open';

// Who'd be told now, for the class controls: everyone not removed, and
// those with a phone (as if WhatsApp were connected)
function toldNow(batch, now) {
  const members = membersOf(batch, now).filter((m) => m.status !== 'removed');
  return { email: members.length, whatsapp: members.filter((m) => m.phone?.number).length };
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
  const samples = hasSampleMembers(batch.id);

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
            <span className="proto__label">Sample members</span>
            <div className="proto__controls">
              <button
                type="button"
                className="proto__btn"
                onClick={() => {
                  addSampleMembers(batch, appNow());
                  onChange?.();
                }}
              >
                Add one of each
              </button>
              <button
                type="button"
                className="proto__btn"
                disabled={!samples}
                onClick={() => {
                  clearSampleMembers(batch.id);
                  onChange?.();
                }}
              >
                Clear samples
              </button>
              <p className="proto__note">
                Paid, due soon, payment pending (today, 3 days late, 8 days late), no phone number, removed, and one who
                joined on the 31st. Dated from {testing ? 'the pretend date' : 'today'}.
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
                  const from = addDays(todayIn(batch.timeZone, now), 7);
                  // Three class days, a week from now, added to its days off
                  const days = classesInRange(batch, from, addDays(from, 6)).slice(0, 3);
                  saveBatchDaysOff(batch, [...(batch.daysOff ?? []), ...days]);
                  onChange?.();
                }}
              >
                Add a sample break
              </button>
              <button
                type="button"
                className="proto__btn"
                onClick={() => {
                  const now = appNow();
                  const next = nextClasses(batch, now, 1)[0];
                  if (next) cancelClass(batch, next.date, toldNow(batch, now), now);
                  onChange?.();
                }}
              >
                Cancel the next class
              </button>
              <p className="proto__note">
                Straight in, without the cancel page: 3 class days off a week from{' '}
                {testing ? 'the pretend date' : 'today'}, or the next class cancelled. Delete a break from the Classes
                tab.
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
                Watch a real member move from Paid to Due soon to Payment pending. Only Live classes use this date.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}