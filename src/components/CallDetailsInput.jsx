import { useEffect } from 'react';
import { Phone, Video } from 'lucide-react';
import {
  CALL_DEFAULTS,
  DURATIONS,
  TITLE_SUGGESTIONS,
  callDescriptionOf,
} from '../data/callDetails';
import './CallDetailsInput.css';

const TITLE_MAX = 60;
const DESCRIPTION_MAX = 200;

// Everything that makes a 1:1 call bookable, on one screen.
// Each part saves under its own id (callTitle, callDuration, ...).
export default function CallDetailsInput({ answers, onChange }) {
  const valueOf = (id) => answers[id] ?? CALL_DEFAULTS[id] ?? '';
  const title = String(valueOf('callTitle'));
  const pricing = valueOf('callPricing');
  const description = callDescriptionOf(answers);
  const suggested = answers.callDescription === undefined && description !== '';

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
            const on = Number(valueOf('callDuration')) === mins;
            return (
              <button
                key={mins}
                type="button"
                role="radio"
                aria-checked={on}
                className={`call__chip call__chip--big ${on ? 'call__chip--on' : ''}`}
                onClick={() => onChange(mins, 'callDuration')}
              >
                {mins} min
              </button>
            );
          })}
        </div>
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
          {pricing === 'paid' && (
            <span className="call__money">
              <span className="call__rupee" aria-hidden="true">₹</span>
              <input
                className="qinput__text call__money-input"
                inputMode="numeric"
                aria-label="Price in rupees"
                placeholder="1,500"
                maxLength={6}
                value={valueOf('callPrice')}
                onChange={(e) =>
                  onChange(e.target.value.replace(/\D/g, '').replace(/^0+/, ''), 'callPrice')
                }
              />
            </span>
          )}
        </div>
      </div>

      {/* ---------- Description (optional) ---------- */}
      <div className="qinput__field">
        <label className="qinput__label" htmlFor="call-description">
          What will you talk about?
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
            {suggested ? 'Suggested from the name. Change it, or clear it to leave it out.' : ''}
          </span>
          <span className="qinput__count">{description.length}/{DESCRIPTION_MAX}</span>
        </span>
      </div>
    </div>
  );
}