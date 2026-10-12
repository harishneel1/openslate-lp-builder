import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Check, Plus, RotateCcw, Sparkles } from 'lucide-react';
import { getSuggestions } from '../data/mockSuggestions';
import './QuestionInput.css'; // reuses .qinput__text, .qinput__blank
import './SuggestionPicker.css';

const isFilled = (v) => String(v ?? '').trim() !== '';
const COUNT_FROM_END = 20; // only show the character count this close to the limit

// One text box at the top, AI suggestions below in their own panel.
// The box starts empty. Clicking a suggestion copies it into the box; typing edits it.
// Reusable for any text/textarea question with `suggest: true`.
export default function SuggestionPicker({ question, value, answers, onChange, onSubmit }) {
  const { maxLength, suggestLabel = 'suggestions' } = question;
  const answerLabel = question.answerLabel ?? 'Your answer';

  const [options, setOptions] = useState([]);
  const [batch, setBatch] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [ownDraft, setOwnDraft] = useState('');    // last thing they typed themselves
  const boxRef = useRef(null);

  // Load the first 3, and 3 more each time "Show 3 more" is pressed
  useEffect(() => {
    let cancelled = false;
    setStatus('loading');

    getSuggestions(question.id, answers, batch)
      .then(({ items, hasMore: more }) => {
        if (cancelled) return;
        setOptions((prev) => (batch === 0 ? items : [...prev, ...items]));
        setHasMore(more);
        setStatus('ready');

        // Coming back with their own text: remember it as their draft
        if (batch === 0 && isFilled(value) && !items.some((o) => o.text === value)) {
          setOwnDraft(value);
        }
      })
      .catch(() => {
        if (cancelled) return;
        if (batch === 0) setStatus('error'); // no suggestions at all: just the text box
        else {
          setHasMore(false);
          setStatus('ready');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [question.id, batch]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleType = (e) => {
    const text = e.target.value.replace(/\n/g, ' ');
    onChange(text);
    setOwnDraft(text);
  };

  // Copy a suggestion into the box, then put the cursor at the end
  // so it's obvious the text now lives in the box and can be edited
  const useSuggestion = (text) => {
    onChange(text);
    requestAnimationFrame(() => {
      const box = boxRef.current;
      if (!box) return;
      box.focus();
      box.setSelectionRange(text.length, text.length);
    });
  };

  const firstLoad = status === 'loading' && options.length === 0;
  const loadingMore = status === 'loading' && options.length > 0;
  const canRestore = isFilled(ownDraft) && ownDraft !== value;
  const showCount = maxLength && value.length >= maxLength - COUNT_FROM_END;

  return (
    <div className="spick">
      {/* ---------- The answer itself ---------- */}
      {/* No visible label: the question title above already names it */}
      <textarea
        ref={boxRef}
        id={`answer-${question.id}`}
        aria-label={answerLabel}
        autoFocus
        rows={2}
        className="qinput__text qinput__blank spick__textarea"
        value={value}
        maxLength={maxLength}
        placeholder={`Start typing ${answerLabel.toLowerCase()} here…`}
        onChange={handleType}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onSubmit();
          }
        }}
      />

      <div className="spick__under">
        {canRestore ? (
          <button type="button" className="spick__link" onClick={() => onChange(ownDraft)}>
            <RotateCcw size={14} /> Bring back my text
          </button>
        ) : (
          <span />
        )}
        {showCount && <span className="spick__count">{value.length}/{maxLength}</span>}
      </div>

      {/* ---------- Suggestions: one panel ---------- */}
      {status === 'error' ? (
        <p className="spick__note">We couldn't write suggestions right now.</p>
      ) : (
        <section className="spick__panel" aria-label="Suggestions">
          <p className="spick__heading">
            <Sparkles size={16} />
            {firstLoad
              ? `Writing ${suggestLabel} from your answers…`
              : 'We wrote these from your answers. You can pick one!'}
          </p>

          <div className="spick__cards">
            {options.map((o, i) => {
              const isSelected = o.text === value;
              return (
                <button
                  key={i}
                  type="button"
                  aria-pressed={isSelected}
                  className={`spick__card ${isSelected ? 'spick__card--selected' : ''}`}
                  onClick={() => useSuggestion(o.text)}
                >
                  <span className="spick__text">{o.text}</span>

                  <span className="spick__footer">
                    <span className="spick__tags">
                      {o.pick && <span className="spick__badge">Our pick</span>}
                      {o.tag && <span className="spick__tag">{o.tag}</span>}
                    </span>

                    {/* Looks like a button; the whole card is the real button */}
                    <span className="spick__use" aria-hidden="true">
                      {isSelected ? (
                        <>
                          <Check size={14} strokeWidth={3} /> Using this
                        </>
                      ) : (
                        <>
                          Use this <ArrowUp size={14} strokeWidth={2.5} />
                        </>
                      )}
                    </span>
                  </span>
                </button>
              );
            })}

            {(firstLoad || loadingMore) &&
              [0, 1, 2].map((i) => (
                <div key={`skeleton-${i}`} className="spick__skeleton">
                  <div className="spick__bar" />
                  <div className="spick__bar spick__bar--short" />
                </div>
              ))}
          </div>

          {hasMore && !firstLoad && (
            <button
              type="button"
              className="spick__link spick__more"
              disabled={loadingMore}
              onClick={() => setBatch((b) => b + 1)}
            >
              <Plus size={14} /> Show 3 more
            </button>
          )}
        </section>
      )}
    </div>
  );
}