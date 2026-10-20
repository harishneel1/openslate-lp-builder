import { useEffect, useRef, useState } from 'react';
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

// A length as a tile: the number big, its unit small. 90 → "90 min", 120 → "2 hr"
function tileParts(mins) {
  if (mins <= 90) return { value: String(mins), unit: 'min' };
  return { value: String(mins / 60), unit: 'hr' };
}

// One group of fields on the setup screen: a white card with a heading and
// what the group is for. On the edit screen (grouped off) the fields sit
// straight in its Basics panel instead, which is already a card.
function Group({ grouped, id, title, sub, children }) {
  if (!grouped) return children;
  return (
    <section className="qinput__card call__group" aria-labelledby={id}>
      <div className="call__group-head">
        <h2 className="call__group-title" id={id}>
          {title}
        </h2>
        <p className="call__group-sub">{sub}</p>
      </div>
      {children}
    </section>
  );
}

// Everything that makes a 1:1 call bookable, on one screen.
// Each part saves under its own id (callTitle, callDuration, ...).
// On the setup screen the fields come in three cards (name, how it works,
// price), and each kind of control has its own look, so the screen reads
// as three questions rather than one long list:
//   name suggestions  quiet "Try:" chips (shortcuts, not a choice)
//   length            one track of tiles
// Every call is a video call (callFormat stays 'video', from CALL_DEFAULTS).
// showDescription: false leaves out the short description (the edit
//   screen shows it in its own section instead).
// grouped: false drops the cards (the edit screen's Basics is one already).
export default function CallDetailsInput({
  answers,
  onChange,
  showDescription = true,
  grouped = true,
}) {
  const valueOf = (id) => answers[id] ?? CALL_DEFAULTS[id] ?? '';
  // Setup starts on the first suggestion ("Discovery call"); the edit screen on what's saved
  const title = String(answers.callTitle ?? (grouped ? TITLE_SUGGESTIONS[0] : ''));
  const titleRef = useRef(null);
  const pricing = valueOf('callPricing');
  const duration = Number(valueOf('callDuration'));

  // Custom is open when they chose it, or came back with a length that isn't a tile
  const [custom, setCustom] = useState(!DURATIONS.includes(duration));
  const hours = Math.floor(duration / 60);
  const minutes = duration % 60;

  // Save the starting choices (30 min, video, paid) so the next steps see them,
  // and on setup the starting name too. Only the first time: a name they
  // cleared stays cleared when they come back.
  useEffect(() => {
    Object.entries(CALL_DEFAULTS).forEach(([id, v]) => {
      if (answers[id] === undefined) onChange(v, id);
    });
    if (grouped && answers.callTitle === undefined) onChange(TITLE_SUGGESTIONS[0], 'callTitle');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Setup: the name box starts focused, with the caret after the name
  useEffect(() => {
    const el = titleRef.current;
    if (!grouped || !el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`qinput call ${grouped ? 'call--grouped' : ''}`}>
      {/* ================= Name ================= */}
      <Group grouped={grouped} id="call-g-name" title="What it’s called" sub="The first thing people read about your call.">
        <div className="qinput__field">
          <label className="qinput__label" htmlFor="call-title">
            {grouped ? 'Name' : 'Name of the call'}
          </label>
          <input
            id="call-title"
            ref={titleRef}
            className="qinput__text"
            value={title}
            maxLength={TITLE_MAX}
            placeholder="e.g. Discovery call"
            onChange={(e) => onChange(e.target.value, 'callTitle')}
          />
          {/* Shortcuts, not a choice: small and quiet */}
          <div className="call__try">
            <span className="call__try-label" id="call-try">
              Try:
            </span>
            <div className="call__try-list" role="group" aria-labelledby="call-try">
              {TITLE_SUGGESTIONS.map((s, i) => (
                <button
                  key={s}
                  type="button"
                  // Setup, nothing typed yet: the first suggestion pulses to show it's there to tap
                  className={`call__try-chip ${title === s ? 'call__try-chip--on' : ''} ${
                    grouped && i === 0 && title.trim() === '' ? 'call__try-chip--pulse' : ''
                  }`}
                  aria-pressed={title === s}
                  onClick={() => onChange(s, 'callTitle')}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {showDescription && <ShortDescriptionField answers={answers} onChange={onChange} />}
      </Group>

      {/* ================= How it works ================= */}
      <Group grouped={grouped} id="call-g-how" title="How it works" sub="How long your video call is.">
        {/* ---------- Length: one track of tiles ---------- */}
        <div className="qinput__field">
          <span className="qinput__label" id="call-duration">
            {grouped ? 'Length' : 'Duration'}
          </span>
          <div className="call__lengths" role="radiogroup" aria-labelledby="call-duration">
            {DURATIONS.map((mins) => {
              const on = !custom && duration === mins;
              const { value, unit } = tileParts(mins);
              return (
                <button
                  key={mins}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={durationLabel(mins)}
                  className={`call__length ${on ? 'call__length--on' : ''}`}
                  onClick={() => {
                    setCustom(false);
                    onChange(mins, 'callDuration');
                  }}
                >
                  <span className="call__length-value">{value}</span>
                  <span className="call__length-unit">{unit}</span>
                </button>
              );
            })}
            <button
              type="button"
              role="radio"
              aria-checked={custom}
              className={`call__length call__length--custom ${custom ? 'call__length--on' : ''}`}
              onClick={() => setCustom(true)}
            >
              <span className="call__length-value">Custom</span>
              <span className="call__length-unit">{custom ? durationLabel(duration) : 'any length'}</span>
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
      </Group>

      {/* ================= Price ================= */}
      <Group grouped={grouped} id="call-g-price" title="Price" sub="Free, or what people pay to book.">
        <div className="qinput__field">
          {/* On the setup screen the card's heading names it */}
          {!grouped && (
            <span className="qinput__label" id="call-price">
              Price
            </span>
          )}
          <div className="call__chips" role="radiogroup" aria-labelledby={grouped ? 'call-g-price' : 'call-price'}>
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

          {/* Paid: the same two boxes and "On your page" line as the webinar price screen */}
          {pricing === 'paid' && <PaidPrices answers={answers} onChange={onChange} />}
        </div>
      </Group>
    </div>
  );
}