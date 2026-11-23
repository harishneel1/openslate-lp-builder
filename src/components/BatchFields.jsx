import { useRef, useState } from 'react';
import { ExternalLink, ImagePlus, Trash2, Video } from 'lucide-react';
import DatePicker, { todayISO } from './DatePicker';
import TimePicker from './TimePicker';
import { keepPreview, previewOf } from '../data/imagePreviews';
import { CREATE_SERVICE_URL } from '../data/mockServices';
import { toInstant } from '../utils/slots';
import {
  DESCRIPTION_MAX,
  LENGTH_HOURS,
  LENGTH_MINUTES,
  NAME_EXAMPLES,
  TITLE_MAX,
  WEEKDAYS,
  lengthLine,
} from '../data/batches';
import './QuestionInput.css';
import './CallDetailsInput.css';
import '../screens/WebinarReminders.css'; // the on/off switch (rm__switch)
import './BatchFields.css';

// ------------------------------------------------------------
// A live class's fields, shared by "Create a class" (CreateBatchFlow.jsx)
// and its editor (EditBatch.jsx), so both look and check the same. The
// same fields as TagMango's Create Workshop, in the same order:
//
//   TitleField        [Add title                         0/100]
//                     For example: Bharatanatyam for Beginners, …
//   ThumbnailField    [ picture ]  Upload image · Remove
//   MeetingField      🎥 Zoom · A meeting link is made for you   (fixed)
//   DescriptionField  [                                  ]
//
// No date or time here: a class's sessions are scheduled one by one on
// its page (Classes tab), with SessionFields below, in a pop-up.
//
// The linked contracts (ContractPicker) sit between Meeting and Description
// on both screens.
//
// value: the class draft (data/batches.js shape)
// onChange(field, value)
// showProblem: show what's wrong under a field (after they press Create or Save)
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

// What's wrong with each part, or null
export const titleProblem = (d) => (d.title.trim() ? null : 'Give your class a title.');
// One session: { date, startTime, durationMins }, on the class's clock
export const sessionProblem = (s, timeZone, now = Date.now()) => {
  if (!s.date) return 'Pick a date.';
  if (!s.startTime) return 'Pick a start time.';
  if (s.durationMins < 15) return 'A class needs to be at least 15 minutes.';
  if (toInstant(s.date, s.startTime, timeZone) <= now) return 'That time has passed. Pick a later one.';
  return null;
};
export const contractsProblem = (d) => (d.contractIds.length === 0 ? 'Link at least one contract, so people can join.' : null);

// The first thing stopping a save, or null
export const classProblem = (d) => titleProblem(d) ?? contractsProblem(d);

function Problem({ show, text }) {
  if (!show || !text) return null;
  return (
    <span className="qinput__error" role="alert">
      {text}
    </span>
  );
}

// An on/off row, as TagMango's toggles
function SwitchRow({ id, label, on, onChange }) {
  return (
    <div className="bfld__switch-row">
      <span id={id}>{label}</span>
      <button type="button" role="switch" aria-checked={on} aria-labelledby={id} className="rm__switch" onClick={() => onChange(!on)}>
        <span className="rm__switch-thumb" aria-hidden="true" />
      </button>
    </div>
  );
}

// ---------- Title ----------
export function TitleField({ value, onChange, showProblem = false, autoFocus = false }) {
  return (
    <div className="qinput__field">
      <label className="qinput__label" htmlFor="bfld-title">
        Title
      </label>
      <span className="bfld__count-wrap">
        <input
          id="bfld-title"
          className="qinput__text"
          value={value.title}
          maxLength={TITLE_MAX}
          placeholder="Morning Yoga"
          autoFocus={autoFocus}
          onChange={(e) => onChange('title', e.target.value)}
        />
        <span className="bfld__count" aria-hidden="true">
          {value.title.length}/{TITLE_MAX}
        </span>
      </span>
      <p className="bfld__summary">For example: {NAME_EXAMPLES.join(', ')}</p>
      <Problem show={showProblem} text={titleProblem(value)} />
    </div>
  );
}

// ---------- Thumbnail ----------
// The picture is kept in this browser (imagePreviews.js), as a course's
// cover is; the class keeps its id and the file's name.
export function ThumbnailField({ value, onChange }) {
  const input = useRef(null);
  const [note, setNote] = useState(null);
  const picture = value.thumbnail ? previewOf(value.thumbnail.previewId) : null;

  const pick = async (file) => {
    if (!file) return;
    if (!String(file.type).startsWith('image/')) {
      setNote('That isn’t an image. Pick a JPG, PNG or WEBP.');
      return;
    }
    const previewId = `${value.id}-thumb-${Date.now().toString(36)}`;
    const kept = await keepPreview(previewId, file);
    setNote(kept ? null : 'Added. It’s too big to show here (over 1.5 MB), but it’s saved.');
    onChange('thumbnail', { previewId, name: file.name });
  };

  return (
    <div className="qinput__field">
      <span className="qinput__label">
        Thumbnail <span className="qinput__optional">· Optional</span>
      </span>
      <div className="bfld__thumb">
        <div className="bfld__thumb-box" aria-hidden="true">
          {picture ? <img src={picture} alt="" /> : <ImagePlus size={28} />}
        </div>
        <div className="bfld__thumb-side">
          <p className="bfld__summary">Images should be horizontal. 1280 × 720 works best.</p>
          {value.thumbnail && <p className="bfld__thumb-name">{value.thumbnail.name}</p>}
          <div className="bfld__thumb-actions">
            <button type="button" className="bfld__btn" onClick={() => input.current?.click()}>
              <ImagePlus size={16} aria-hidden="true" /> {value.thumbnail ? 'Change image' : 'Upload image'}
            </button>
            {value.thumbnail && (
              <button type="button" className="bfld__btn bfld__btn--plain" onClick={() => onChange('thumbnail', null)}>
                <Trash2 size={16} aria-hidden="true" /> Remove
              </button>
            )}
          </div>
          {note && <p className="bfld__summary">{note}</p>}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}

// ---------- Meeting ----------
// Always Zoom, made for them: shown, nothing to pick
export function MeetingField() {
  return (
    <div className="bfld__meeting">
      <span className="bfld__meeting-icon" aria-hidden="true">
        <Video size={18} />
      </span>
      <span>
        <span className="bfld__meeting-name">Zoom</span>
        <span className="bfld__summary"> · A meeting link is made for you for every class.</span>
      </span>
    </div>
  );
}

// ---------- One class: date, time, length ----------
// For Schedule a class and Change time (ScheduleClassDialog.jsx).
// value: { date, startTime, durationMins }; timeZone: the class's
// onChange(field, value). showProblem: after they press Schedule.
export function SessionFields({ value, timeZone, onChange, showProblem = false, minDate = todayISO(), now = Date.now() }) {
  const hours = Math.floor(value.durationMins / 60);
  const minutes = value.durationMins % 60;
  const setLength = (h, m) => onChange('durationMins', Number(h) * 60 + Number(m));
  const zone = zoneShort(timeZone);

  return (
    <div className="bfld">
      <div className="bfld__pair">
        <div className="qinput__field">
          <label className="qinput__label" htmlFor="bfld-date">
            Date
          </label>
          <DatePicker
            id="bfld-date"
            value={value.date ?? ''}
            min={minDate}
            onChange={(d) => onChange('date', d)}
            className="qinput__text qinput__picker bfld__picker"
          />
        </div>
        <div className="qinput__field">
          <label className="qinput__label" htmlFor="bfld-start">
            Starts at
          </label>
          <TimePicker
            id="bfld-start"
            value={value.startTime}
            onChange={(t) => onChange('startTime', t)}
            zone={zone}
            className="qinput__text qinput__picker bfld__picker"
          />
        </div>
      </div>

      <div className="qinput__field">
        <span className="qinput__label" id="bfld-length">
          Length
        </span>
        <div className="call__custom bfld__length" role="group" aria-labelledby="bfld-length">
          <label className="call__custom-part">
            <select className="call__select" value={hours} onChange={(e) => setLength(e.target.value, minutes)}>
              {LENGTH_HOURS.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
            hr
          </label>
          <label className="call__custom-part">
            <select className="call__select" value={minutes} onChange={(e) => setLength(hours, e.target.value)}>
              {LENGTH_MINUTES.map((m) => (
                <option key={m} value={m}>
                  {String(m).padStart(2, '0')}
                </option>
              ))}
            </select>
            min
          </label>
          <span className="call__custom-total" aria-live="polite">
            {value.durationMins >= 15 ? lengthLine(value.durationMins) : ''}
          </span>
        </div>
      </div>

      <Problem show={showProblem} text={sessionProblem(value, timeZone, now)} />
    </div>
  );
}

// ---------- Repeat weekly ----------
// Under SessionFields in Schedule a class: off, just the switch. On, the
// days it repeats on and the date it runs until.
// value: { repeat, days: ['mon', …], until: 'YYYY-MM-DD' }; minDate: the first class's date
export const repeatProblem = (r, from) => {
  if (!r.repeat) return null;
  if (r.days.length === 0) return 'Pick at least one day.';
  if (!r.until || r.until < from) return 'Pick an end date after the first class.';
  return null;
};

export function RepeatFields({ value, onChange, minDate, showProblem = false }) {
  const toggleDay = (day) => {
    const on = value.days.includes(day);
    onChange('days', on ? value.days.filter((d) => d !== day) : [...value.days, day]);
  };
  return (
    <div className={`bfld__repeat ${value.repeat ? 'bfld__repeat--on' : ''}`}>
      <SwitchRow id="bfld-repeat" label="Repeat weekly" on={value.repeat} onChange={(on) => onChange('repeat', on)} />
      {value.repeat && (
        <div className="bfld__repeat-body">
          <div className="call__chips bfld__days" role="group" aria-label="Repeat on">
            {WEEKDAYS.map(([id, label]) => {
              const on = value.days.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={on}
                  className={`call__chip bfld__day bfld__day--small ${on ? 'call__chip--on' : ''}`}
                  onClick={() => toggleDay(id)}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div className="bfld__until">
            <label className="qinput__label" htmlFor="bfld-until">
              Until
            </label>
            <DatePicker
              id="bfld-until"
              value={value.until ?? ''}
              min={minDate}
              onChange={(d) => onChange('until', d)}
              className="qinput__text qinput__picker bfld__picker"
            />
          </div>
          <Problem show={showProblem} text={repeatProblem(value, minDate)} />
        </div>
      )}
    </div>
  );
}

// ---------- Who can join ----------
// The line under "Who can join", and a way to make a contract when they
// have none (opens Create contract in a new tab; the picker reads the
// contracts again when they come back)
export const WHO_CAN_JOIN = 'People who bought any of these contracts can join.';

export function CreateContractLink() {
  return (
    <p className="bfld__summary">
      Don’t have one yet?{' '}
      <a
        className="bfld__link"
        href={CREATE_SERVICE_URL}
        target="_blank"
        rel="noopener"
        aria-label="Create a contract (opens in a new tab)"
      >
        Create a contract
        <ExternalLink size={13} aria-hidden="true" />
      </a>
    </p>
  );
}

// ---------- Description ----------
export function DescriptionField({ value, onChange }) {
  return (
    <div className="qinput__field">
      <label className="qinput__label" htmlFor="bfld-about">
        Description <span className="qinput__optional">· Optional</span>
      </label>
      <textarea
        id="bfld-about"
        className="qinput__text bfld__about"
        rows={5}
        value={value.description}
        maxLength={DESCRIPTION_MAX}
        placeholder="What happens in class, who it’s for, and anything they need (a mat, an empty stomach)."
        onChange={(e) => onChange('description', e.target.value)}
      />
    </div>
  );
}
