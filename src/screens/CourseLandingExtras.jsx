import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import {
  DURATION_MAX,
  DURATION_UNITS,
  TRACK_SOURCE_MAX,
  TRACK_STUDENTS_MAX,
  cleanDuration,
  durationOf,
  trackRecordOf,
} from '../data/courseExtras';
import './CourseExtras.css';

// ------------------------------------------------------------
// Two fields on a course's Landing page step (CourseLanding.jsx):
//
// DurationField: "Time to complete (optional)"
//   [ 6 ] [hours ▾]
//   A whole number and hours, days or weeks. Saves when they leave the
//   box or change the unit; an empty box takes it off. Shown on the
//   landing page in the band under the title ("⏱ 6 hours to complete")
//   and as the first row of This course includes.
//
// TrackRecordField: "Your track record", shown open (not behind + Add)
//   Buyers trust a course more when they can see others have taken it…
//   Students  [ 125 ]   Rating [ 4.7 ]   From [ Udemy ]
//   4.7 ★★★★★ (rated on Udemy) · 125 students     (the live preview line)
//   [● Show these on my landing page]  Recommended
//   The fields start filled with 125 and 4.7 (TRACK_DEFAULTS); nothing
//   shows to buyers until the coach turns the switch on, so the coach is
//   the one making the claim. The preview is dimmed while it's off.
//   Each box saves when they leave it (once it's been saved, or the
//   switch has been used); the switch saves straight away. A rating
//   outside 1.0 to 5.0, or a student count that isn't a whole number,
//   says so under its box and doesn't save.
//
// Each carries data-guide (courseAnnotations.js): the guide beside the
// fields highlights that part of the example page.
//
// course, onSave(change) → true if it saved
// ------------------------------------------------------------

const UNIT_LABEL = { hours: 'hours', days: 'days', weeks: 'weeks' };

export function DurationField({ course, onSave }) {
  const saved = durationOf(course);
  const [amount, setAmount] = useState(saved ? String(saved.amount) : '');
  const [unit, setUnit] = useState(saved?.unit ?? 'hours');
  const savedKey = saved ? `${saved.amount}|${saved.unit}` : '';
  useEffect(() => {
    setAmount(saved ? String(saved.amount) : '');
    if (saved) setUnit(saved.unit);
  }, [savedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = (a = amount, u = unit) => {
    const next = String(a).trim() ? cleanDuration({ amount: a, unit: u }) : null;
    const nextKey = next ? `${next.amount}|${next.unit}` : '';
    if (nextKey !== savedKey) onSave({ duration: next });
    if (next) setAmount(String(next.amount));
  };

  return (
    <section className="lnd__part" aria-labelledby="dur-title" data-guide="duration">
      <h3 className="lrn__title" id="dur-title">
        Time to complete <span className="crs-field__optional">(optional)</span>
      </h3>
      <p className="lrn__help" id="dur-help">
        Roughly how long it takes to finish. It shows at the top of your landing page.
      </p>
      <div className="dur__row">
        <span className="lrn__box dur__amount">
          <label className="sr-only" htmlFor="dur-amount">
            How long
          </label>
          <input
            id="dur-amount"
            className="lrn__input"
            type="number"
            inputMode="numeric"
            min={1}
            max={DURATION_MAX}
            step={1}
            value={amount}
            placeholder="6"
            aria-describedby="dur-help"
            onChange={(e) => setAmount(e.target.value)}
            onBlur={() => commit()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
          />
        </span>
        <label className="sr-only" htmlFor="dur-unit">
          Unit
        </label>
        <select
          id="dur-unit"
          className="dur__unit"
          value={unit}
          onChange={(e) => {
            setUnit(e.target.value);
            if (amount.trim()) commit(amount, e.target.value);
          }}
        >
          {DURATION_UNITS.map((u) => (
            <option key={u} value={u}>
              {UNIT_LABEL[u]}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}

// ★★★★☆, to the nearest half
function Stars({ value }) {
  return (
    <span className="trk__stars" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i + 1));
        return (
          <span key={i} className="trk__star">
            <Star size={14} className="trk__star-empty" />
            {fill > 0 && (
              <span className="trk__star-fill" style={{ width: `${Math.round(fill * 2) * 50}%` }}>
                <Star size={14} />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

export function TrackRecordField({ course, onSave }) {
  const saved = trackRecordOf(course);
  const stored = Boolean(course.trackRecord); // saved at least once (else the defaults)
  const [students, setStudents] = useState(String(saved.students));
  const [rating, setRating] = useState(String(saved.rating));
  const [source, setSource] = useState(saved.source);
  const [tried, setTried] = useState(false);
  const on = saved.on;

  const savedKey = `${saved.students}|${saved.rating}|${saved.source}`;
  useEffect(() => {
    setStudents(String(saved.students));
    setRating(String(saved.rating));
    setSource(saved.source);
  }, [savedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const studentsNum = Number(students);
  const ratingNum = Number(rating);
  const studentsOk = students.trim() !== '' && Number.isInteger(studentsNum) && studentsNum >= 0 && studentsNum <= TRACK_STUDENTS_MAX;
  const ratingOk = rating.trim() !== '' && ratingNum >= 1 && ratingNum <= 5;
  const valid = studentsOk && ratingOk;

  const values = (extra = {}) => ({ students: studentsNum, rating: Math.round(ratingNum * 10) / 10, source: source.trim(), on, ...extra });

  // Leaving a box: saves when something changed (and it's been saved before,
  // or they've changed the defaults)
  const commit = () => {
    if (!valid) {
      setTried(true);
      return;
    }
    const next = values();
    const changed = `${next.students}|${next.rating}|${next.source}` !== savedKey;
    if (changed || (stored && next.on !== saved.on)) onSave({ trackRecord: next });
  };

  const toggle = () => {
    if (!on && !valid) {
      setTried(true);
      return;
    }
    onSave({ trackRecord: values({ on: !on }) });
  };

  const shownRating = ratingOk ? (Math.round(ratingNum * 10) / 10).toFixed(1) : '–';
  const shownStudents = studentsOk ? studentsNum.toLocaleString('en-IN') : '–';
  const from = source.trim();

  return (
    <section className="lnd__part trk" aria-labelledby="trk-title" data-guide="trackRecord">
      <div className="lrn__head">
        <h3 className="lrn__title" id="trk-title">
          Your track record
        </h3>
      </div>
      <p className="trk__why">
        <strong>Buyers trust a course more when they can see others have taken it.</strong> Showing your rating and how many
        students you’ve taught is one of the simplest ways to get more sales.
      </p>

      <div className="trk__fields">
        <label className="trk__field">
          <span className="trk__label">Students you’ve taught</span>
          <span className="lrn__box">
            <input
              className="lrn__input"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={students}
              aria-invalid={(tried && !studentsOk) || undefined}
              onChange={(e) => setStudents(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            />
          </span>
          {tried && !studentsOk && <span className="trk__error">A whole number, like 125</span>}
        </label>

        <label className="trk__field trk__field--rating">
          <span className="trk__label">Rating</span>
          <span className="lrn__box">
            <input
              className="lrn__input"
              type="number"
              inputMode="decimal"
              min={1}
              max={5}
              step={0.1}
              value={rating}
              aria-invalid={(tried && !ratingOk) || undefined}
              onChange={(e) => setRating(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            />
            <span className="trk__out-of">/ 5</span>
          </span>
          {tried && !ratingOk && <span className="trk__error">From 1.0 to 5.0</span>}
        </label>
      </div>

      {/* How it will look on the landing page: dimmed while it's off */}
      <p className={`trk__preview ${on ? '' : 'trk__preview--off'}`}>
        <span className="trk__preview-label">{on ? 'On your page' : 'Not on your page yet'}</span>
        <span className="trk__preview-line">
          <strong>{shownRating}</strong>
          {ratingOk && <Stars value={ratingNum} />}
          <span aria-hidden="true">·</span>
          <span>{shownStudents} students</span>
        </span>
      </p>

      <div className="trk__switch-row">
        <button type="button" role="switch" aria-checked={on} className={`trk__switch ${on ? 'trk__switch--on' : ''}`} onClick={toggle}>
          <span className="trk__switch-track" aria-hidden="true">
            <span className="trk__switch-thumb" />
          </span>
          Show these on my landing page
        </button>
        <span className="trk__pill">Recommended</span>
      </div>
    </section>
  );
}