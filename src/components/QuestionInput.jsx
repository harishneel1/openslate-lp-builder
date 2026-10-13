import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Upload, User } from 'lucide-react';
import './QuestionInput.css';
import SuggestionPicker from './SuggestionPicker';
import ItemsInput from './ItemsInput';
import { defaultCtaLabel } from '../data/webinarQuestions';
import { readPhoto } from '../utils/readPhoto';
import RambleInput from './RambleInput';
import HeadlinePicker from './HeadlinePicker';

const CTA_MAX = 25;

// Button text field under the free/paid choice, always visible.
// Shows the default for Free/Paid until they write their own.
// Only saved as ctaLabel once they change it.
function ButtonTextLine({ pricing, answers, onChange }) {
  const fallback = defaultCtaLabel(pricing);
  const custom = String(answers.ctaLabel ?? '').trim();

  const [draft, setDraft] = useState(custom || fallback);

  // Switching Free/Paid updates the box too, unless they wrote their own
  useEffect(() => {
    if (!custom) setDraft(fallback);
  }, [fallback]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleType = (e) => {
    const text = e.target.value;
    setDraft(text);
    // Typing the default back counts as "no custom text"
    onChange(text.trim() === fallback ? '' : text, 'ctaLabel');
  };

  // An empty box falls back to the default when they leave it
  const handleBlur = () => {
    if (!draft.trim()) setDraft(fallback);
  };

  const useDefault = () => {
    setDraft(fallback);
    onChange('', 'ctaLabel');
  };

  return (
    <label className="qinput__field qinput__cta-text">
      <span className="qinput__label">Button text</span>
      <input
        className="qinput__text qinput__cta-input"
        value={draft}
        maxLength={CTA_MAX}
        placeholder={fallback}
        onChange={handleType}
        onBlur={handleBlur}
      />
      <span className="qinput__cta-under">
        {custom ? (
          <button type="button" className="qinput__change" onClick={useDefault}>
            Use the default
          </button>
        ) : (
          <span />
        )}
        <span className="qinput__count">{draft.length}/{CTA_MAX}</span>
      </span>
    </label>
  );
}

// error: message from the question's validate(). It shows once they've
// pasted, left the box or pressed Enter, not while they're still typing.
function TextInput({ question, value, onChange, onSubmit, error = null }) {
  const { maxLength, example, inputMode } = question;
  const [checked, setChecked] = useState(false);
  const showError = checked && error;
  const errorId = `${question.id}-error`;

  return (
    <div className="qinput">
      <input
        autoFocus
        className={`qinput__text ${showError ? 'qinput__text--error' : ''}`}
        value={value}
        maxLength={maxLength}
        inputMode={inputMode}
        spellCheck={inputMode === 'url' ? false : undefined}
        autoCapitalize={inputMode === 'url' ? 'off' : undefined}
        placeholder={example ? `e.g. ${example}` : ''}
        aria-label={question.question}
        aria-invalid={showError ? true : undefined}
        aria-describedby={showError ? errorId : undefined}
        onChange={(e) => onChange(e.target.value)}
        onPaste={() => setChecked(true)}
        onBlur={() => setChecked(true)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          setChecked(true);
          onSubmit();
        }}
      />
      {showError && (
        <p id={errorId} className="qinput__error qinput__text-error" role="alert">
          {error}
        </p>
      )}
      {maxLength && (
        <span className="qinput__count">
          {value.length}/{maxLength}
        </span>
      )}
      {/* Short how-to for people who haven't set things up yet (e.g. their group). Closed until they ask. */}
      {question.setupSteps && (
        <details className="qinput__setup">
          <summary className="qinput__setup-toggle">
            {question.setupTitle ?? 'Need help?'}
            <ChevronDown size={16} className="qinput__setup-chevron" aria-hidden="true" />
          </summary>
          <ol className="qinput__setup-steps">
            {question.setupSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}

// Rupee amount: digits only, ₹ shown inside the box
function NumberInput({ question, value, answers, onChange, onSubmit }) {
  const { example, mustExceed } = question;
  const floor = mustExceed ? Number(answers[mustExceed]) || 0 : 0;
  const tooLow = floor > 0 && String(value).trim() !== '' && Number(value) <= floor;

  return (
    <div className="qinput">
      <div className="qinput__money">
        <span className="qinput__currency" aria-hidden="true">₹</span>
        <input
          autoFocus
          inputMode="numeric"
          aria-label={question.question}
          className="qinput__text qinput__money-input"
          value={value}
          maxLength={6}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').replace(/^0+/, ''))}
          onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
        />
      </div>
      {tooLow ? (
        <p className="qinput__error qinput__money-note" role="alert">
          This needs to be more than your price (₹{floor}) to show crossed out.
        </p>
      ) : (
        example && <p className="qinput__example qinput__money-note">e.g. ₹{example}</p>
      )}
    </div>
  );
}

function ChoiceInput({ question, value, answers, onChange }) {
  return (
    <>
      <div className="qinput qinput__choices">
        {question.options.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={value === option}
            className={`qinput__choice ${value === option ? 'qinput__choice--selected' : ''}`}
            onClick={() => onChange(option)}
          >
            {option}
          </button>
        ))}
      </div>

      {/* Appears once they've picked, since the default depends on the pick */}
      {question.buttonText && value && (
        <ButtonTextLine pricing={value} answers={answers} onChange={onChange} />
      )}
    </>
  );
}

function SentenceInput({ question, answers, onChange, onSubmit }) {
  const refs = useRef([]);

  // Enter moves to the next blank; on the last one it goes to the next question
  const handleKeyDown = (e, i) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const next = refs.current[i + 1];
    next ? next.focus() : onSubmit();
  };

  return (
    <div className="qinput qinput__sentence">
      {question.parts.map((part, i) => (
        <label key={part.id} className="qinput__part">
          <span className="qinput__lead">{part.lead}</span>
          <textarea
            ref={(el) => (refs.current[i] = el)}
            autoFocus={i === 0}
            rows={1}
            className="qinput__text qinput__blank"
            value={answers[part.id] ?? ''}
            maxLength={part.maxLength}
            onChange={(e) => onChange(e.target.value.replace(/\n/g, ' '), part.id)}
            onKeyDown={(e) => handleKeyDown(e, i)}
          />
          <span className="qinput__example">e.g. {part.example}</span>
        </label>
      ))}
    </div>
  );
}

// Today's date as YYYY-MM-DD in local time, so past dates can't be picked
function todayISO() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function Pills({ field, value, onPick }) {
  return (
    <div className="qinput__pills" role="group" aria-label={field.label}>
      {field.options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          className={`qinput__pill ${value === option ? 'qinput__pill--selected' : ''}`}
          onClick={() => onPick(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

// Round avatar + Upload button. readPhoto checks and shrinks the photo.

function PhotoField({ field, value, initial, onChange }) {
  const inputRef = useRef(null);
  const [error, setError] = useState('');

   const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // lets them pick the same file again
    if (!file) return;

    try {
      setError('');
      onChange(await readPhoto(file));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="qinput__field">
      <span className="qinput__label">{field.label}</span>
      <div className="qinput__photo">
        {value ? (
          <img className="qinput__avatar" src={value} alt="Your photo" />
        ) : (
          <div className="qinput__avatar">{initial || <User size={28} />}</div>
        )}
        <div className="qinput__photo-actions">
          <button
            type="button"
            className="qinput__photo-btn"
            onClick={() => inputRef.current?.click()}
          >
            <Upload size={16} /> {value ? 'Change photo' : 'Upload photo'}
          </button>
          {value && (
            <button type="button" className="qinput__change" onClick={() => onChange('')}>
              Remove
            </button>
          )}
        </div>
        <input ref={inputRef} type="file" accept="image/*" hidden onChange={handleFile} />
      </div>
      {field.helper && <span className="qinput__example">{field.helper}</span>}
      {error && <span className="qinput__error" role="alert">{error}</span>}
    </div>
  );
}

// How their price will look on the page, using their own numbers.
// The regular price only shows crossed out when it's higher.
function PriceExample({ price, oldPrice }) {
  const p = Number(price) || 0;
  const o = Number(oldPrice) || 0;
  if (p <= 0) return null;

  const money = (n) => `₹${n.toLocaleString('en-IN')}`;
  const showOld = o > p;
  const percentOff = showOld ? Math.round((1 - p / o) * 100) : 0;

  return (
    <div className="qinput__price-example">
      <span className="qinput__price-example-label">On your page</span>
      <p className="qinput__price-example-line">
        {showOld && <s className="qinput__price-example-old">{money(o)}</s>}
        <strong className="qinput__price-example-new">{money(p)}</strong>
        {showOld && <span className="qinput__price-example-off">{percentOff}% off</span>}
      </p>
    </div>
  );
}


// Several small fields on one screen; each saves under its own id
function GroupInput({ question, answers, onChange }) {
  const [open, setOpen] = useState({}); // which collapsible fields are expanded
  const valueOf = (f) => answers[f.id] ?? f.default ?? '';

  // Save defaults (IST, Live) right away so the preview shows them
  useEffect(() => {
    question.fields.forEach((f) => {
      if (f.default !== undefined && answers[f.id] === undefined) onChange(f.default, f.id);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Clicking anywhere on a date/time box opens the picker, not just the icon
  const openPicker = (e) => {
    try {
      e.currentTarget.showPicker?.();
    } catch {
      // older browsers: the normal picker still works
    }
  };

  const renderField = (f) => {
    const value = valueOf(f);

        if (f.type === 'image') {
      const initial = String(answers.hostName ?? '').trim().charAt(0).toUpperCase();
      return (
        <PhotoField
          key={f.id}
          field={f}
          value={value}
          initial={initial}
          onChange={(v) => onChange(v, f.id)}
        />
      );
    }

    if (f.type === 'text' || f.type === 'textarea') {
      const isLong = f.type === 'textarea';
      const Box = isLong ? 'textarea' : 'input';
      return (
        <label key={f.id} className="qinput__field">
          <span className="qinput__label">{f.label}</span>
          <Box
            className={`qinput__text qinput__field-input ${isLong ? 'qinput__blank qinput__field-input--long' : ''}`}
            value={value}
            maxLength={f.maxLength}
            onChange={(e) => onChange(e.target.value, f.id)}
          />
          {(f.example || f.maxLength) && (
            <span className="qinput__under">
              <span className="qinput__example">{f.example ? `e.g. ${f.example}` : ''}</span>
              {f.maxLength && (
                <span className="qinput__count">{value.length}/{f.maxLength}</span>
              )}
            </span>
          )}
        </label>
      );
    }

        // Rupee amount: digits only, ₹ inside the box (price, regular price)
    if (f.type === 'number') {
      const floor = f.mustExceed ? Number(answers[f.mustExceed]) || 0 : 0;
      const tooLow = floor > 0 && String(value).trim() !== '' && Number(value) <= floor;
      const note = tooLow ? null : f.helper ?? (f.example ? `e.g. ₹${f.example}` : null);

      return (
        <label key={f.id} className="qinput__field">
          <span className="qinput__label">
            {f.label}
            {!f.required && <span className="qinput__optional"> · Optional</span>}
          </span>
          <span className="qinput__money">
            <span className="qinput__currency" aria-hidden="true">₹</span>
            <input
              inputMode="numeric"
              className="qinput__text qinput__money-input"
              value={value}
              maxLength={6}
              onChange={(e) => onChange(e.target.value.replace(/\D/g, '').replace(/^0+/, ''), f.id)}
            />
          </span>
          {tooLow && (
            <span className="qinput__error" role="alert">
                This needs to be more than your discounted price (₹{floor}) to show crossed out.
            </span>
          )}
          {note && <span className="qinput__example">{note}</span>}
        </label>
      );
    }

    if (f.type === 'date' || f.type === 'time') {
      return (
        <label key={f.id} className="qinput__field">
          <span className="qinput__label">{f.label}</span>
          <input
            type={f.type}
            className="qinput__text qinput__picker"
            value={value}
            min={f.type === 'date' ? todayISO() : undefined}
            onClick={openPicker}
            onChange={(e) => onChange(e.target.value, f.id)}
          />
        </label>
      );
    }

    if (f.collapsible) {
      const isOpen = !!open[f.id];
      return (
        <div key={f.id} className="qinput__field qinput__field--inline">
          <p className="qinput__inline">
            {f.label}: <strong>{value}</strong>
            <button
              type="button"
              className="qinput__change"
              onClick={() => setOpen((o) => ({ ...o, [f.id]: !isOpen }))}
            >
              {isOpen ? 'Done' : 'Change'}
            </button>
          </p>
          {isOpen && <Pills field={f} value={value} onPick={(v) => onChange(v, f.id)} />}
        </div>
      );
    }

    return (
      <div key={f.id} className="qinput__field">
        <span className="qinput__label">{f.label}</span>
        <Pills field={f} value={value} onPick={(v) => onChange(v, f.id)} />
      </div>
    );
  };

  // A helper on any field in the row shows under the whole row.
  const renderBlocks = (fields) => {
    const blocks = [];
    fields.forEach((f) => {
      const last = blocks[blocks.length - 1];
      if (f.half && Array.isArray(last)) last.push(f);
      else blocks.push(f.half ? [f] : f);
    });

    return blocks.map((b) => {
      if (!Array.isArray(b)) return renderField(b);
      const helpers = b.map((f) => f.helper).filter(Boolean);
      return (
        <div key={b[0].id} className="qinput__field">
          <div className="qinput__row">{b.map(renderField)}</div>
          {helpers.map((h) => (
            <span key={h} className="qinput__example">{h}</span>
          ))}
        </div>
      );
    });
  };

  // Fields with the same `card` sit together in one card, in the order they appear
  const cards = [];
  question.fields.forEach((f) => {
    const name = f.card ?? '';
    const existing = cards.find((c) => c.name === name);
    if (existing) existing.fields.push(f);
    else cards.push({ name, fields: [f] });
  });

  return (
    <div className="qinput qinput__group">
      {cards.map((c) => (
        <section key={c.name || 'fields'} className="qinput__card">
          {c.name && <h2 className="qinput__card-title">{c.name}</h2>}
          {renderBlocks(c.fields)}
          {question.pricePreview && (
            <PriceExample price={answers.price} oldPrice={answers.oldPrice} />
          )}
        </section>
      ))}
    </div>
  );
}

export default function QuestionInput(props) {

    // AI-suggested text answers: pick one of a few drafts
  const { suggest, type } = props.question;
  if (suggest && (type === 'text' || type === 'textarea')) {
    return <SuggestionPicker {...props} />;
  }

  
  switch (props.question.type) {
    case 'text':
      return <TextInput {...props} />;
    case 'choice':
      return <ChoiceInput {...props} />;
    case 'number':
      return <NumberInput {...props} />;
    case 'sentence':
      return <SentenceInput {...props} />;
    case 'group':
      return <GroupInput {...props} />;
    case 'items':
      return <ItemsInput {...props} />;
    case 'ramble':
      return <RambleInput {...props} />;  
    case 'headlinePair':
      return <HeadlinePicker {...props} />;
    default:
      return (
        <p className="qinput__todo">
          The "{props.question.type}" input is coming in a later step.
        </p>
      );
  }
}