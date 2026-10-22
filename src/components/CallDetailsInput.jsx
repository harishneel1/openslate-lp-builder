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
// label: the field's name (the call editor calls it the line on the page's card)
export function ShortDescriptionField({ answers, onChange, note = null, label = 'Short description' }) {
  const description = callDescriptionOf(answers);
  const suggested = answers.callDescription === undefined && description !== '';

  return (
    <div className="qinput__field">
      <label className="qinput__label" htmlFor="call-description">
        {label}
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

// What people pay, and an optional discount, the same way as the contracts
// flow: one Amount box (the card is already headed "Price"), then a "Discounted price" box that stays off until
// it's ticked. Saved as before, so nothing else changes:
//   no discount   callPrice = the price, callComparePrice = ''
//   discount      callComparePrice = the price (shown crossed out),
//                 callPrice = the discounted price (what they pay)
// Ticking moves the price into callComparePrice; unticking moves it back.
// It can only be ticked once there's a price, and clearing the price unticks it.
// A ticked discount that's empty or not lower than the price stops them
// going on (callDetailsProblem in callDetails.js).
//
// Also the webinar's "Set your price" screen (question type 'priceDiscount'),
// which saves under its own ids: ids = { price: 'price', compare: 'oldPrice' }.
// label: the first box's name ("Amount" here, "Price" on the webinar)
export function PriceWithDiscount({ answers, onChange, ids = { price: 'callPrice', compare: 'callComparePrice' }, label = 'Amount', example = '1500' }) {
  const { price: PRICE, compare: COMPARE } = ids;
  const [hasDiscount, setHasDiscount] = useState(() => String(answers[COMPARE] ?? '').trim() !== '');
  const price = (hasDiscount ? answers[COMPARE] : answers[PRICE]) ?? '';
  const discount = hasDiscount ? (answers[PRICE] ?? '') : '';
  const priceNum = Number(price) || 0;
  const discountNum = Number(discount) || 0;
  const tooHigh = hasDiscount && priceNum > 0 && discountNum > 0 && discountNum >= priceNum;

  // Ticked: straight into the discount box
  const discountRef = useRef(null);
  const ticked = useRef(false);
  useEffect(() => {
    if (ticked.current && hasDiscount) discountRef.current?.focus();
    ticked.current = false;
  }, [hasDiscount]);

  const toggle = (on) => {
    if (on) {
      onChange(answers[PRICE] ?? '', COMPARE);
      onChange('', PRICE);
      ticked.current = true;
    } else {
      onChange(answers[COMPARE] ?? '', PRICE);
      onChange('', COMPARE);
    }
    setHasDiscount(on);
  };

  // A discount needs a price to come off: clearing the price unticks it
  const changePrice = (value) => {
    if (hasDiscount && value === '') {
      onChange('', COMPARE);
      onChange('', PRICE);
      setHasDiscount(false);
    } else {
      onChange(value, hasDiscount ? COMPARE : PRICE);
    }
  };

  return (
    <div className="call__prices">
      <div className="call__price-fields">
        <label className="qinput__field">
          <span className="qinput__label">{label}</span>
          <span className="qinput__money">
            <span className="qinput__currency" aria-hidden="true">₹</span>
            <input
              inputMode="numeric"
              className="qinput__text qinput__money-input"
              value={price}
              maxLength={6}
              placeholder={`e.g. ${example}`}
              onChange={(e) => changePrice(rupees(e.target.value))}
            />
          </span>
        </label>

        <div className="qinput__field">
          <label className={`call__check ${!hasDiscount && priceNum === 0 ? 'call__check--off' : ''}`}>
            <input
              type="checkbox"
              checked={hasDiscount}
              disabled={!hasDiscount && priceNum === 0} // add the price first
              onChange={(e) => toggle(e.target.checked)}
            />
            <span className="qinput__label">Discounted price</span>
          </label>
          <span className={`qinput__money ${hasDiscount ? '' : 'call__money--off'}`}>
            <span className="qinput__currency" aria-hidden="true">₹</span>
            <input
              ref={discountRef}
              inputMode="numeric"
              className="qinput__text qinput__money-input"
              value={discount}
              maxLength={6}
              disabled={!hasDiscount}
              aria-label="Discounted price"
              onChange={(e) => onChange(rupees(e.target.value), PRICE)}
            />
          </span>
          {tooHigh ? (
            <span className="qinput__error" role="alert">
              This needs to be lower than the {label.toLowerCase()} (₹{priceNum.toLocaleString('en-IN')}).
            </span>
          ) : hasDiscount && discountNum === 0 ? (
            <span className="qinput__example">Add the discounted price, or untick it.</span>
          ) : null}
        </div>
      </div>

      <PriceExample price={hasDiscount ? discount : price} oldPrice={hasDiscount ? price : ''} />
    </div>
  );
}

// The 1:1 call's prices
function PaidPrices({ answers, onChange }) {
  return <PriceWithDiscount answers={answers} onChange={onChange} />;
}

// A length as a tile: the number big, its unit small. 90 → "90 min", 120 → "2 hr"
function tileParts(mins) {
  if (mins <= 90) return { value: String(mins), unit: 'min' };
  return { value: String(mins / 60), unit: 'hr' };
}

// One group of fields on the setup screen: a white card whose heading names
// the field in it ("Name of the call"), so the field has no label of its own;
// it points at the heading instead (aria-labelledby). On the edit screen
// (grouped off) the fields sit straight in its Basics panel, which is already
// a card, with their own labels.
function Group({ grouped, id, title, children }) {
  if (!grouped) return children;
  return (
    <section className="qinput__card call__group" aria-labelledby={id}>
      <h2 className="call__group-title" id={id}>
        {title}
      </h2>
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
//   screen shows it in its own section instead). A question can set it
//   too (question.showDescription): "Create a 1:1 call" leaves it out,
//   since it's the offerings card's line and that flow makes a call, not a card.
// grouped: false drops the cards (the edit screen's Basics is one already).
export default function CallDetailsInput({
  answers,
  onChange,
  question = null,
  showDescription = question?.showDescription ?? true,
  grouped = true,
  afterName = null, // shown right under the name (the call editor puts the description there)
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
      <Group grouped={grouped} id="call-g-name" title="Name of the call">
        <div className="qinput__field">
          {!grouped && (
            <label className="qinput__label" htmlFor="call-title">
              Name of the call
            </label>
          )}
          <input
            id="call-title"
            aria-labelledby={grouped ? 'call-g-name' : undefined}
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

        {afterName}
        {showDescription && <ShortDescriptionField answers={answers} onChange={onChange} />}
      </Group>

      {/* ================= Duration: one track of tiles ================= */}
      <Group grouped={grouped} id="call-g-duration" title="Duration of the call">
        <div className="qinput__field">
          {!grouped && (
            <span className="qinput__label" id="call-duration">
              Duration of the call
            </span>
          )}
          <div className="call__lengths" role="radiogroup" aria-labelledby={grouped ? 'call-g-duration' : 'call-duration'}>
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
      <Group grouped={grouped} id="call-g-price" title="Price">
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