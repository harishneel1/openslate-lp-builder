import { useEffect, useState } from 'react';
import { Phone, Video } from 'lucide-react';
import {
  CALL_DEFAULTS,
  CUSTOM_HOURS,
  CUSTOM_MINUTES,
  DURATIONS,
  customDuration,
  TITLE_SUGGESTIONS,
  callDescriptionOf,
} from '../data/callDetails';
import { durationLabel } from '../data/serviceKinds';
import PriceExample from './PriceExample';
import './CallDetailsInput.css';

const TITLE_MAX = 60;
const DESCRIPTION_MAX = 200;

// The short description: a line or two on the offering card.
// Its own piece so the edit screen can show it with the long description.
// note: shown under the box, beside the count (in place of the suggestion hint)
export function ShortDescriptionField({ answers, onChange, note = null }) {
  const description = callDescriptionOf(answers);
  const suggested = answers.callDescription === undefined && description !== '';

  return (
    <div className="qinput__field">
      <label className="qinput__label" htmlFor="call-description">
        Short description
        <span className="qinput__optional"> · Optional</span>
      </label>
      <textarea
        id="call-description"
        className="qinput__text call__description"
        rows={3}
        maxLength={DESCRIPTION_MAX}
        placeholder="A line or two on what happens in the call"
        value={description}
        onChange={(e) => onChange(e.target.value, 'callDescription')}
      />
      <span className="qinput__under">
        <span className="qinput__example">
          {note ?? (suggested ? 'Suggested from the name. Change it, or clear it to leave it out.' : '')}
        </span>
        <span className="qinput__count">{description.length}/{DESCRIPTION_MAX}</span>
      </span>
    </div>
  );
}

// Rupee amount: digits only, no leading zeros
const rupees = (text) => text.replace(/\D/g, '').replace(/^0+/, '');

// Discounted price (callPrice) and an optional regular price (callComparePrice),
// shown crossed out. Same fields, wording and rules as the webinar flow's
// "Set your price": a regular price that isn't higher gets a note, and simply
// doesn't show on the page.
function PaidPrices({ answers, onChange }) {
  const price = answers.callPrice ?? '';
  const regular = answers.callComparePrice ?? '';
  const floor = Number(price) || 0;
  const tooLow = floor > 0 && String(regular).trim() !== '' && Number(regular) <= floor;

  return (
    <div className="call__prices">
      <div className="call__price-fields">
        <label className="qinput__field">
          <span className="qinput__label">Discounted price</span>
          <span className="qinput__money">
            <span className="qinput__currency" aria-hidden="true">₹</span>
            <input
              inputMode="numeric"
              className="qinput__text qinput__money-input"
              value={price}
              maxLength={6}
              onChange={(e) => onChange(rupees(e.target.value), 'callPrice')}
            />
          </span>
          <span className="qinput__example">e.g. ₹1500</span>
        </label>

        <label className="qinput__field">
          <span className="qinput__label">
            Regular price
            <span className="qinput__optional"> · Optional</span>
          </span>
          <span className="qinput__money">
            <span className="qinput__currency" aria-hidden="true">₹</span>
            <input
              inputMode="numeric"
              className="qinput__text qinput__money-input"
              value={regular}
              maxLength={6}
              onChange={(e) => onChange(rupees(e.target.value), 'callComparePrice')}
            />
          </span>
          {tooLow ? (
            <span className="qinput__error" role="alert">
              This needs to be more than your discounted price (₹{floor}) to show crossed out.
            </span>
          ) : (
            <span className="qinput__example">Shown crossed out next to your discounted price.</span>
          )}
        </label>
      </div>

      <PriceExample price={price} oldPrice={regular} />
    </div>
  );
}

// Everything that makes a 1:1 call bookable, on one screen.
// Each part saves under its own id (callTitle, callDuration, ...).
// showDescription: false leaves out the short description (the edit
// screen shows it in its own section instead).
export default function CallDetailsInput({ answers, onChange, showDescription = true }) {
  const valueOf = (id) => answers[id] ?? CALL_DEFAULTS[id] ?? '';
  const title = String(valueOf('callTitle'));
  const pricing = valueOf('callPricing');
  const duration = Number(valueOf('callDuration'));

  // Custom is open when they chose it, or came back with a length that isn't a chip
  const [custom, setCustom] = useState(!DURATIONS.includes(duration));
  const hours = Math.floor(duration / 60);
  const minutes = duration % 60;

  // Save the starting choices (30 min, video, paid) so the next steps see them
  useEffect(() => {
    Object.entries(CALL_DEFAULTS).forEach(([id, v]) => {
      if (answers[id] === undefined) onChange(v, id);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="qinput call">
      {/* ---------- Name ---------- */}
      <div className="qinput__field">
        <label className="qinput__label" htmlFor="call-title">Name of the call</label>
        <input
          id="call-title"
          autoFocus
          className="qinput__text"
          value={title}
          maxLength={TITLE_MAX}
          placeholder="e.g. Discovery call"
          onChange={(e) => onChange(e.target.value, 'callTitle')}
        />
        <div className="call__chips" aria-label="Suggestions">
          {TITLE_SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              className={`call__chip ${title === s ? 'call__chip--on' : ''}`}
              aria-pressed={title === s}
              onClick={() => onChange(s, 'callTitle')}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ---------- How long ---------- */}
      <div className="qinput__field">
        <span className="qinput__label" id="call-duration">How long</span>
        <div className="call__chips" role="radiogroup" aria-labelledby="call-duration">
          {DURATIONS.map((mins) => {
            const on = !custom && duration === mins;
            return (
              <button
                key={mins}
                type="button"
                role="radio"
                aria-checked={on}
                className={`call__chip call__chip--big ${on ? 'call__chip--on' : ''}`}
                onClick={() => {
                  setCustom(false);
                  onChange(mins, 'callDuration');
                }}
              >
                {durationLabel(mins)}
              </button>
            );
          })}
          <button
            type="button"
            role="radio"
            aria-checked={custom}
            className={`call__chip call__chip--big ${custom ? 'call__chip--on' : ''}`}
            onClick={() => setCustom(true)}
          >
            Custom
          </button>
        </div>

        {/* Starts from the length they had, so switching to Custom changes nothing until they pick */}
        {custom && (
          <div className="call__custom">
            <label className="call__custom-part">
              <select
                className="call__select"
                autoFocus
                value={hours}
                onChange={(e) => onChange(customDuration(e.target.value, minutes), 'callDuration')}
              >
                {CUSTOM_HOURS.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
              hr
            </label>
            <label className="call__custom-part">
              <select
                className="call__select"
                value={minutes}
                onChange={(e) => onChange(customDuration(hours, e.target.value), 'callDuration')}
              >
                {/* No 0 min when it's 0 hr: a call needs some length */}
                {CUSTOM_MINUTES.filter((m) => hours > 0 || m > 0).map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              min
            </label>
            <span className="call__custom-total" aria-live="polite">{durationLabel(duration)} call</span>
          </div>
        )}
      </div>

      {/* ---------- Video or phone ---------- */}
      <div className="qinput__field">
        <span className="qinput__label" id="call-format">How you’ll talk</span>
        <div className="call__chips" role="radiogroup" aria-labelledby="call-format">
          {[
            { id: 'video', label: 'Video call', Icon: Video },
            { id: 'phone', label: 'Phone call', Icon: Phone },
          ].map(({ id, label, Icon }) => {
            const on = valueOf('callFormat') === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={on}
                className={`call__chip call__chip--big ${on ? 'call__chip--on' : ''}`}
                onClick={() => onChange(id, 'callFormat')}
              >
                <Icon size={16} aria-hidden="true" /> {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ---------- Price ---------- */}
      <div className="qinput__field">
        <span className="qinput__label" id="call-price">Price</span>
        <div className="call__price">
          <div className="call__chips" role="radiogroup" aria-labelledby="call-price">
            {[
              { id: 'free', label: 'Free' },
              { id: 'paid', label: 'Paid' },
            ].map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={pricing === id}
                className={`call__chip call__chip--big ${pricing === id ? 'call__chip--on' : ''}`}
                onClick={() => onChange(id, 'callPricing')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Paid: the same two boxes and "On your page" line as the webinar price screen */}
        {pricing === 'paid' && <PaidPrices answers={answers} onChange={onChange} />}
      </div>

      {/* ---------- Description (optional) ---------- */}
      {showDescription && <ShortDescriptionField answers={answers} onChange={onChange} />}
    </div>
  );
}