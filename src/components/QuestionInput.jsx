import { useEffect, useRef, useState } from 'react';
import { Upload, User } from 'lucide-react';
import './QuestionInput.css';
import SuggestionPicker from './SuggestionPicker';
import ItemsInput from './ItemsInput';
import { defaultCtaLabel } from '../data/webinarQuestions';
import { readPhoto } from '../utils/readPhoto';

const CTA_MAX = 25;

// "Button text: Reserve my seat · Change" under the free/paid choice.
// Only saved as ctaLabel once they change it; until then it follows Free/Paid.
function ButtonTextLine({ pricing, answers, onChange }) {
  const fallback = defaultCtaLabel(pricing);
  const custom = String(answers.ctaLabel ?? '').trim();
  const shown = custom || fallback;

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(shown);

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

  const useDefault = () => {
    setDraft(fallback);
    onChange('', 'ctaLabel');
  };

  return (
    <div className="qinput__field qinput__cta-text">
      <p className="qinput__inline">
        Button text: <strong>{shown}</strong>
        <button
          type="button"
          className="qinput__change"
          onClick={() => {
            if (!open) setDraft(shown);
            setOpen(!open);
          }}
        >
          {open ? 'Done' : 'Change'}
        </button>
      </p>

      {open && (
        <>
          <input
            autoFocus
            className={`qinput__text qinput__picker ${value ? '' : 'qinput__picker--empty'}`}
            value={draft}
            maxLength={CTA_MAX}
            placeholder={fallback}
            onChange={handleType}
            onKeyDown={(e) => e.key === 'Enter' && setOpen(false)}
          />
          <div className="qinput__cta-under">
            {custom ? (
              <button type="button" className="qinput__change" onClick={useDefault}>
                Use the default
              </button>
            ) : (
              <span />
            )}
            <span className="qinput__count">{draft.length}/{CTA_MAX}</span>
          </div>
        </>
      )}
    </div>
  );
}

function TextInput({ question, value, onChange, onSubmit }) {
  const { maxLength, example } = question;

  return (
    <div className="qinput">
      <input
        autoFocus
        className="qinput__text"
        value={value}
        maxLength={maxLength}
        placeholder={example ? `e.g. ${example}` : ''}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
      />
      {maxLength && (
        <span className="qinput__count">
          {value.length}/{maxLength}
        </span>
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

    // Consecutive `half` fields share a row (date + time)
  const renderBlocks = (fields) => {
    const blocks = [];
    fields.forEach((f) => {
      const last = blocks[blocks.length - 1];
      if (f.half && Array.isArray(last)) last.push(f);
      else blocks.push(f.half ? [f] : f);
    });

    return blocks.map((b) =>
      Array.isArray(b) ? (
        <div key={b[0].id} className="qinput__row">{b.map(renderField)}</div>
      ) : (
        renderField(b)
      )
    );
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
    default:
      return (
        <p className="qinput__todo">
          The "{props.question.type}" input is coming in a later step.
        </p>
      );
  }
}