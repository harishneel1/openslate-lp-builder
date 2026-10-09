import { useEffect, useState } from 'react';
import { Check, Plus, RotateCcw, Sparkles } from 'lucide-react';
import { getSuggestions } from '../data/mockSuggestions';
import './QuestionInput.css'; // reuses .qinput__text, .qinput__blank, .qinput__count
import './SuggestionPicker.css';

const isFilled = (v) => String(v ?? '').trim() !== '';

// One text box at the top, AI suggestions below.
// Clicking a suggestion fills the box; typing edits it.
// Reusable for any text/textarea question with `suggest: true`.
export default function SuggestionPicker({ question, value, answers, onChange, onSubmit }) {
  const { maxLength, suggestLabel = 'suggestions' } = question;

  const [options, setOptions] = useState([]);
  const [batch, setBatch] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [ownDraft, setOwnDraft] = useState('');    // last thing they typed themselves

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

  const firstLoad = status === 'loading' && options.length === 0;
  const loadingMore = status === 'loading' && options.length > 0;
  const canRestore = isFilled(ownDraft) && ownDraft !== value;

  return (
    <div className="spick">
      {/* ---------- The answer itself ---------- */}
      <textarea
        rows={1}
        className="qinput__text qinput__blank spick__textarea"
        value={value}
        maxLength={maxLength}
        placeholder={status === 'error' ? 'Write it here' : 'Pick one below, or write your own'}
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
        {maxLength && <span className="spick__count">{value.length}/{maxLength}</span>}
      </div>

      {/* ---------- Suggestions ---------- */}
      {status === 'error' ? (
        <p className="spick__note">We couldn't write suggestions right now.</p>
      ) : (
        <>
          <p className="spick__status">
            <Sparkles size={15} />
            {firstLoad ? `Writing ${suggestLabel} from your answers…` : 'Suggestions for you'}
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
                  onClick={() => onChange(o.text)}
                >
                  <span className="spick__radio">
                    {isSelected && <Check size={13} strokeWidth={3} />}
                  </span>
                  <span className="spick__body">
                    <span className="spick__text">{o.text}</span>
                    <span className="spick__reason">{o.reason}</span>
                  </span>
                  {o.pick && <span className="spick__badge">Our pick</span>}
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
            <div className="spick__links">
              <button
                type="button"
                className="spick__link"
                disabled={loadingMore}
                onClick={() => setBatch((b) => b + 1)}
              >
                <Plus size={14} /> Show 3 more
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}