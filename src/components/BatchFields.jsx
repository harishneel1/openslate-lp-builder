import TimePicker from './TimePicker';
import { LENGTHS, PRICE_MAX, WEEKDAYS, scheduleLine } from '../data/batches';
import './QuestionInput.css';
import './CallDetailsInput.css';
import './BatchFields.css';

// ------------------------------------------------------------
// A batch's fields, shared by "Create a batch" (CreateBatchFlow.jsx) and
// its editor (EditBatch.jsx), so both look and check the same:
//
//   ScheduleFields   which days, the start time, how long
//     Days       [Mon][Tue][Wed][Thu][Fri][Sat][ Sun ]   (tap to switch)
//     Starts at  [🕖 6:30 am IST ▾]
//     Length     [45 min][1 hr][1 hr 15][1 hr 30]
//     → "Every Mon–Sat, 6:30–7:30 am IST. Nobody can book a 1:1 call then."
//
//   FeeField         the monthly fee, in rupees
//     [₹ 2000 ] a month
//     → note: one plain line under it, or none (Create a batch: "Put in
//        any amount. You can change it later.")
//
// value: the batch draft ({ days, startTime, durationMins, timeZone, price })
// onChange(field, value)
// ------------------------------------------------------------

// 'Asia/Kolkata' → 'IST' (or the zone's own short name)
export function zoneShort(timeZone) {
  try {
    const part = new Intl.DateTimeFormat('en-IN', { timeZone, timeZoneName: 'short' })
      .formatToParts(new Date())
      .find((p) => p.type === 'timeZoneName');
    return part?.value ?? timeZone;
  } catch {
    return timeZone;
  }
}

const lengthWords = (mins) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return { value: String(m), unit: 'min' };
  if (m === 0) return { value: String(h), unit: h === 1 ? 'hr' : 'hrs' };
  return { value: `${h} hr ${m}`, unit: 'min' };
};

// What's wrong with the schedule, or null
export const scheduleProblem = (b) => (b.days.length === 0 ? 'Pick at least one day.' : null);

// What's wrong with the fee, or null
export function feeProblem(price) {
  const n = Number(price);
  if (!String(price ?? '').trim() || !Number.isFinite(n) || n <= 0) return 'Enter the monthly fee.';
  if (n > PRICE_MAX) return 'That’s more than we can take in one payment.';
  return null;
}

export function ScheduleFields({ value, onChange, showProblem = false }) {
  const toggle = (day) => {
    const on = value.days.includes(day);
    onChange('days', on ? value.days.filter((d) => d !== day) : [...value.days, day]);
  };
  const problem = scheduleProblem(value);

  return (
    <div className="bfld">
      <div className="qinput__field">
        <span className="qinput__label" id="bfld-days">
          Days
        </span>
        <div className="call__chips bfld__days" role="group" aria-labelledby="bfld-days">
          {WEEKDAYS.map(([id, label]) => {
            const on = value.days.includes(id);
            return (
              <button
                key={id}
                type="button"
                aria-pressed={on}
                className={`call__chip call__chip--big bfld__day ${on ? 'call__chip--on' : ''}`}
                onClick={() => toggle(id)}
              >
                {label}
              </button>
            );
          })}
        </div>
        {showProblem && problem && (
          <span className="qinput__error" role="alert">
            {problem}
          </span>
        )}
      </div>

      <div className="qinput__field">
        <label className="qinput__label" htmlFor="bfld-start">
          Starts at
        </label>
        <TimePicker
          id="bfld-start"
          value={value.startTime}
          onChange={(t) => onChange('startTime', t)}
          zone={zoneShort(value.timeZone)}
          className="bfld__time"
        />
      </div>

      <div className="qinput__field">
        <span className="qinput__label" id="bfld-length">
          Length
        </span>
        <div className="call__lengths" role="radiogroup" aria-labelledby="bfld-length">
          {LENGTHS.map((mins) => {
            const on = value.durationMins === mins;
            const { value: v, unit } = lengthWords(mins);
            return (
              <button
                key={mins}
                type="button"
                role="radio"
                aria-checked={on}
                className={`call__length ${on ? 'call__length--on' : ''}`}
                onClick={() => onChange('durationMins', mins)}
              >
                <span className="call__length-value">{v}</span>
                <span className="call__length-unit">{unit}</span>
              </button>
            );
          })}
        </div>
      </div>

      {!problem && (
        <p className="bfld__summary">
          Every {scheduleLine(value).replace(' · ', ', ')} {zoneShort(value.timeZone)}. Nobody can book a 1:1 call with
          you then.
        </p>
      )}
    </div>
  );
}

export function FeeField({ value, onChange, showProblem = false, note = null }) {
  const problem = feeProblem(value.price);
  return (
    <div className="bfld">
      <label className="qinput__field">
        <span className="qinput__label">Monthly fee</span>
        <span className="bfld__fee">
          <span className="qinput__money">
            <span className="qinput__currency" aria-hidden="true">
              ₹
            </span>
            <input
              inputMode="numeric"
              className="qinput__text qinput__money-input"
              value={value.price}
              maxLength={6}
              placeholder="2000"
              aria-describedby={note ? 'bfld-fee-note' : undefined}
              onChange={(e) => onChange('price', e.target.value.replace(/\D/g, ''))}
            />
          </span>
          <span className="bfld__per">a month</span>
        </span>
      </label>
      {showProblem && problem && (
        <span className="qinput__error" role="alert">
          {problem}
        </span>
      )}
      {note && (
        <p className="bfld__summary" id="bfld-fee-note">
          {note}
        </p>
      )}
    </div>
  );
}