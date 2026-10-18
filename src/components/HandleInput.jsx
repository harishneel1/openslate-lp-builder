import { useState } from 'react';
import { Check } from 'lucide-react';
import { PAGE_DOMAIN, cleanHandle, handleSuggestions, isHandleTaken } from '../data/myPage';
import './HandleInput.css';

// The link to their page: the address is fixed, they type the end.
// "Taken" shows straight away, with free links close to theirs to tap.
// "Too short" waits until they leave the box or press Enter.
// autoFocus: false when it isn't the first thing on the screen (editing).
// current: their link today, if they have one: it says so rather than "available".
export default function HandleInput({ question, value, error, onChange, onSubmit, autoFocus = true, current = null }) {
  const [checked, setChecked] = useState(false);
  const taken = isHandleTaken(value);
  const showError = Boolean(error) && (checked || taken);
  const ideas = taken ? handleSuggestions(value) : [];
  const statusId = `${question.id}-status`;

  return (
    <div className="qinput hdl">
      <div className={`hdl__box ${showError ? 'hdl__box--error' : ''}`}>
        <span className="hdl__prefix" aria-hidden="true">{PAGE_DOMAIN}/</span>
        <input
          autoFocus={autoFocus}
          className="hdl__input"
          value={value}
          maxLength={question.maxLength}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          aria-label={`Your link, after ${PAGE_DOMAIN}/`}
          aria-invalid={showError ? true : undefined}
          aria-describedby={statusId}
          onChange={(e) => onChange(cleanHandle(e.target.value))}
          onBlur={() => setChecked(true)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            setChecked(true);
            onSubmit();
          }}
        />
      </div>

      <div id={statusId} className="hdl__status" aria-live="polite">
        {showError ? (
          <p className="qinput__error">{error}</p>
        ) : current && value === current ? (
          <p className="hdl__hint">This is your link now.</p>
        ) : value && !error ? (
          <p className="hdl__ok">
            <Check size={15} strokeWidth={2.5} aria-hidden="true" /> {PAGE_DOMAIN}/{value} is available
          </p>
        ) : (
          <p className="hdl__hint">{question.hint}</p>
        )}
      </div>

      {ideas.length > 0 && (
        <div className="hdl__ideas">
          {ideas.map((idea) => (
            <button key={idea} type="button" className="hdl__idea" onClick={() => onChange(idea)}>
              {idea}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}