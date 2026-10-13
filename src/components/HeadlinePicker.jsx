import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Check, RefreshCw, RotateCcw, Sparkles } from 'lucide-react';
import { getHeadlinePairs } from '../data/mockSuggestions';
import './QuestionInput.css';   // reuses .qinput__text, .qinput__blank, .qinput__label
import './SuggestionPicker.css'; // reuses the suggestion panel, cards and links
import './HeadlinePicker.css';

const isFilled = (v) => String(v ?? '').trim() !== '';
const COUNT_FROM_END = 20; // only show the character count this close to the limit


// Headline and the line under it, on one screen.
// Two boxes at the top; AI pairs below. Picking a pair fills both boxes.
// Each box still saves under its own id (headline, subheadline),
// so the page, the preview and the funnel name work as before.
export default function HeadlinePicker({ question, answers, onChange, onSubmit }) {
  const [titleField, subField] = question.fields;
  const current = {
    [titleField.id]: answers[titleField.id] ?? '',
    [subField.id]: answers[subField.id] ?? '',
  };

  const [options, setOptions] = useState([]);
  const [round, setRound] = useState(0);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [ownDraft, setOwnDraft] = useState(null);  // last pair they typed themselves
  const titleRef = useRef(null);
  const subRef = useRef(null);

  const matches = (o) =>
    o.headline === current[titleField.id] && o.subheadline === current[subField.id];

  // First set on arrival; a fresh set each time they press "Write 3 new ones"
  useEffect(() => {
    let cancelled = false;
    setStatus('loading');

    getHeadlinePairs(answers, round)
      .then(({ options: pairs }) => {
        if (cancelled) return;
        // Our pick goes first, like on the other suggestion screens
        setOptions([...pairs].sort((a, b) => Number(!!b.pick) - Number(!!a.pick)));
        setStatus('ready');

        // Coming back with their own text: remember it as their draft
        const hasText = isFilled(current[titleField.id]) || isFilled(current[subField.id]);
        if (round === 0 && hasText && !pairs.some(matches)) setOwnDraft(current);
      })
      .catch(() => {
        if (cancelled) return;
        // Keep the old set if a refresh fails; with nothing at all, just the boxes
        setStatus(options.length ? 'ready' : 'error');
      });

    return () => {
      cancelled = true;
    };
  }, [round]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleType = (id) => (e) => {
    const text = e.target.value.replace(/\n/g, ' ');
    onChange(text, id);
    setOwnDraft({ ...current, [id]: text });
  };

  // Fill both boxes, then put the cursor at the end of the headline
  // so it's obvious the text now lives in the boxes and can be edited
  const usePair = (o) => {
    onChange(o.headline, titleField.id);
    onChange(o.subheadline, subField.id);
    requestAnimationFrame(() => {
      const box = titleRef.current;
      if (!box) return;
      box.focus();
      box.setSelectionRange(o.headline.length, o.headline.length);
    });
  };

  const bringBack = () => {
    onChange(ownDraft[titleField.id], titleField.id);
    onChange(ownDraft[subField.id], subField.id);
  };

  const loading = status === 'loading';
  const canRestore =
    ownDraft &&
    (isFilled(ownDraft[titleField.id]) || isFilled(ownDraft[subField.id])) &&
    (ownDraft[titleField.id] !== current[titleField.id] ||
      ownDraft[subField.id] !== current[subField.id]);

  const renderBox = (field, ref, onEnter, isTitle) => {
    const value = current[field.id];
    const showCount = field.maxLength && value.length >= field.maxLength - COUNT_FROM_END;
    return (
      <label className="qinput__field hpick__field">
        <span className="qinput__label">{field.label}</span>
        <textarea
          ref={ref}
          autoFocus={isTitle}
          rows={2}
          className={`qinput__text qinput__blank spick__textarea ${
            isTitle ? 'hpick__title' : 'hpick__sub'
          }`}
          value={value}
          maxLength={field.maxLength}
          placeholder={field.placeholder}
          onChange={handleType(field.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onEnter();
            }
          }}
        />
        {showCount && (
          <span className="spick__count hpick__count">
            {value.length}/{field.maxLength}
          </span>
        )}
      </label>
    );
  };

  return (
    <div className="spick hpick">
      {/* ---------- The answer: both lines together ---------- */}
      <div className="hpick__boxes">
        {/* Enter in the headline moves to the line under it; Enter there moves on */}
        {renderBox(titleField, titleRef, () => subRef.current?.focus(), true)}
        {renderBox(subField, subRef, onSubmit, false)}
      </div>

      <div className="spick__under">
        {canRestore ? (
          <button type="button" className="spick__link" onClick={bringBack}>
            <RotateCcw size={14} /> Bring back my text
          </button>
        ) : (
          <span />
        )}
      </div>

      {/* ---------- Suggestions: pairs, in one panel ---------- */}
      {status === 'error' ? (
        <p className="spick__note">We couldn't write suggestions right now. You can write your own above.</p>
      ) : (
        <section className="spick__panel" aria-label="Suggestions" aria-busy={loading}>
          <p className="spick__heading">
            <Sparkles size={16} />
            {loading
              ? 'Writing headlines from your answers…'
              : 'We wrote these from your answers. Pick one to start.'}
          </p>

          <div className="spick__cards">
            {loading
              ? [0, 1, 2].map((i) => (
                  <div key={`skeleton-${i}`} className="spick__skeleton hpick__skeleton">
                    <div className="spick__bar" />
                    <div className="spick__bar spick__bar--short" />
                  </div>
                ))
              : options.map((o, i) => {
                  const isSelected = matches(o);
                  return (
                    <button
                      key={`${round}-${i}`}
                      type="button"
                      aria-pressed={isSelected}
                      className={`spick__card hpick__card ${isSelected ? 'spick__card--selected' : ''}`}
                      onClick={() => usePair(o)}
                    >
                      {/* Styled like the top of their page: big line, then the line under it */}
                      <span className="hpick__pair">
                        <span className="hpick__headline">{o.headline}</span>
                        <span className="hpick__subheadline">{o.subheadline}</span>
                      </span>

                      <span className="spick__footer">
                        <span className="spick__tags">
                          {o.pick && <span className="spick__badge">Our pick</span>}

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
          </div>

          {!loading && (
            <button
              type="button"
              className="spick__link spick__more"
              onClick={() => setRound((r) => r + 1)}
            >
              <RefreshCw size={14} /> Write 3 new ones
            </button>
          )}
        </section>
      )}
    </div>
  );
}