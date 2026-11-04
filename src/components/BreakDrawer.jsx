import { useState } from 'react';
import Drawer from './Drawer';
import DatePicker from './DatePicker';
import { classDay, classesInRange, offOn } from '../data/batches';
import { rangeLine } from '../data/batchNotices';
import { daysBetween } from '../data/batchMembers';
import './QuestionInput.css';
import './BreakDrawer.css';

// ------------------------------------------------------------
// "Add a break", from the Breaks row on a batch's Classes tab. Pick the
// first and last day off; the panel says which classes that takes out.
// Continue goes to the announcement page (BatchAnnounce.jsx), where the
// break is added once members are told.
//
//   Add a break                                         ✕
//   No classes from   [📅 Thu 1 Jan 2027 ]
//   to                [📅 Wed 7 Jan 2027 ]
//   6 classes won't happen: Thu 1 Jan … Wed 7 Jan.
//   Fees don't change.
//   ─────────────────────────────────────────────────────
//                                   Cancel   [Continue]
//
// A break can't start before today, end before it starts, run past 90
// days, or overlap another break, and it has to take out at least one
// class.
//
// batch, today ('YYYY-MM-DD' on the batch's clock)
// onContinue({ from, to }), onClose()
// ------------------------------------------------------------

const MAX_DAYS = 90;

export default function BreakDrawer({ batch, today, onContinue, onClose }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [tried, setTried] = useState(false);

  const classes = from && to && to >= from ? classesInRange(batch, from, to) : [];
  const overlap = from && to ? (batch.breaks ?? []).find((x) => !(x.to < from || x.from > to)) : null;
  const alreadyOff = classes.filter((d) => offOn(batch, d)).length;

  const problem = !from
    ? 'Pick the first day of your break.'
    : !to
      ? 'Pick the last day of your break.'
      : to < from
        ? 'The last day has to be on or after the first.'
        : daysBetween(from, to) >= MAX_DAYS
          ? `A break can be up to ${MAX_DAYS} days.`
          : overlap
            ? `This overlaps your break on ${rangeLine(overlap.from, overlap.to)}.`
            : classes.length - alreadyOff === 0
              ? 'There are no classes on these days, so there’s nothing to take off.'
              : null;

  const go = () => {
    setTried(true);
    if (!problem) onContinue({ from, to });
  };

  const footer = (
    <>
      <button type="button" className="bk-btn bk-btn--secondary" onClick={onClose}>
        Cancel
      </button>
      <button type="button" className="bk-btn bk-btn--primary" onClick={go}>
        Continue
      </button>
    </>
  );

  return (
    <Drawer
      title="Add a break"
      sub="No classes on these days. You’ll tell your members next."
      onClose={onClose}
      footer={footer}
    >
      <div className="brk">
        <div className="brk__field">
          <label className="brk__label" htmlFor="brk-from">
            No classes from
          </label>
          <DatePicker
            id="brk-from"
            value={from}
            min={today}
            onChange={(d) => {
              setFrom(d);
              if (to && to < d) setTo(d);
            }}
            className="qinput__text qinput__picker"
          />
        </div>
        <div className="brk__field">
          <label className="brk__label" htmlFor="brk-to">
            To (the last day off)
          </label>
          <DatePicker
            id="brk-to"
            value={to}
            min={from || today}
            onChange={setTo}
            className="qinput__text qinput__picker"
          />
        </div>

        {from && to && to >= from && !problem && (
          <div className="brk__summary" role="status">
            <p className="brk__count">
              {classes.length - alreadyOff === 1
                ? '1 class won’t happen'
                : `${classes.length - alreadyOff} classes won’t happen`}
            </p>
            <p className="brk__dates">
              {classes
                .filter((d) => !offOn(batch, d))
                .slice(0, 8)
                .map((d) => classDay(d, today))
                .join(', ')}
              {classes.length - alreadyOff > 8 ? ` and ${classes.length - alreadyOff - 8} more` : ''}
            </p>
            <p className="brk__fees">Fees don’t change, and the time opens up for 1:1 calls.</p>
          </div>
        )}

        {tried && problem && (
          <p className="brk__error" role="alert">
            {problem}
          </p>
        )}
      </div>
    </Drawer>
  );
}