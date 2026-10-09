import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Plus, Sparkles, X } from 'lucide-react';
import { getSuggestions } from '../data/mockSuggestions';
import './SuggestionPicker.css'; // reuses .spick__status, .spick__skeleton, .spick__bar, .spick__link
import './ItemsInput.css';

const isFilled = (v) => String(v ?? '').trim() !== '';
const same = (a, b) =>
  String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();

let counter = 0;
const newId = () => `item-${Date.now()}-${counter++}`;
const withId = (item) => ({ ...item, id: newId() });

// Optional photo for one item (a reviewer's face).
// Saved as a data URL for now; the real app should upload it and save the link.
const PHOTO_MAX_MB = 5;

function ItemPhoto({ value, onChange }) {
  const inputRef = useRef(null);
  const [error, setError] = useState('');

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // lets them pick the same file again
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file (JPG or PNG).');
      return;
    }
    if (file.size > PHOTO_MAX_MB * 1024 * 1024) {
      setError(`That photo is over ${PHOTO_MAX_MB} MB. Please choose a smaller one.`);
      return;
    }

    setError('');
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result);
    reader.onerror = () => setError("We couldn't read that file. Please try another.");
    reader.readAsDataURL(file);
  };

  const pick = () => inputRef.current?.click();

  return (
    <div className="items__photo">
      {value ? (
        <>
          <img className="items__photo-img" src={value} alt="Reviewer" />
          <button type="button" className="items__photo-link" onClick={pick}>Change</button>
          <button type="button" className="items__photo-link" onClick={() => onChange('')}>Remove</button>
        </>
      ) : (
        <button type="button" className="items__photo-add" onClick={pick}>
          <ImagePlus size={15} /> Add their photo <span className="items__optional">(optional)</span>
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={handleFile} />
      {error && <span className="items__photo-error" role="alert">{error}</span>}
    </div>
  );
}

// A list the creator edits: learnings, personas, reviews, FAQs.
// With suggest: true, the first visit is prefilled with AI drafts and
// more ideas sit below to add. With suggest: false (reviews) it's a plain list.
export default function ItemsInput({ question, answers, onChange }) {
  const {
    id: questionId,
    itemFields,
    mainField,
    minItems = 0,
    maxItems = Infinity,
    suggest,
    suggestLabel = 'ideas',
  } = question;

  const list = Array.isArray(answers[questionId]) ? answers[questionId] : [];
    const fields = itemFields.filter((f) => f.type !== 'image');
  const photoField = itemFields.find((f) => f.type === 'image'); // optional photo per item


  // Only draft into the list the first time; coming back keeps their list
  const [firstVisit] = useState(answers[questionId] === undefined);
  const prefillCount = Math.max(minItems, 1);

  const [pool, setPool] = useState([]);
  const [status, setStatus] = useState(suggest ? 'loading' : 'off'); // 'loading' | 'ready' | 'error' | 'off'
  const [hasMore, setHasMore] = useState(false);
  const [nextBatch, setNextBatch] = useState(2);
  const [loadingMore, setLoadingMore] = useState(false);
  const focusId = useRef(null); // the item to focus after "Add your own"

  // First load: 2 batches (6 ideas). On a first visit the first few go
  // straight into the list; the rest become "More ideas".
  useEffect(() => {
    if (!suggest) return;
    let cancelled = false;

    Promise.allSettled([
      getSuggestions(questionId, answers, 0),
      getSuggestions(questionId, answers, 1),
    ]).then(([a, b]) => {
      if (cancelled) return;
      const ideas = [a, b]
        .filter((r) => r.status === 'fulfilled')
        .flatMap((r) => r.value.items)
        .map(withId);

      if (!ideas.length) {
        setStatus('error');
        return;
      }

      if (firstVisit) {
        onChange(ideas.slice(0, prefillCount));
        setPool(ideas.slice(prefillCount));
      } else {
        setPool(ideas);
      }
      setHasMore(b.status === 'fulfilled' && b.value.hasMore);
      setStatus('ready');
    });

    return () => {
      cancelled = true;
    };
  }, [questionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const showMore = () => {
    setLoadingMore(true);
    getSuggestions(questionId, answers, nextBatch)
      .then(({ items, hasMore: more }) => {
        setPool((p) => [...p, ...items.map(withId)]);
        setHasMore(more);
        setNextBatch((n) => n + 1);
      })
      .catch(() => setHasMore(false))
      .finally(() => setLoadingMore(false));
  };

  // ---------- List edits ----------
  const atMax = list.length >= maxItems;

  const updateItem = (id, fieldId, value) => {
    onChange(list.map((item) => (item.id === id ? { ...item, [fieldId]: value } : item)));
  };

  const removeItem = (id) => onChange(list.filter((item) => item.id !== id));

  const addOwn = () => {
    if (atMax) return;
    const blank = Object.fromEntries(fields.map((f) => [f.id, '']));
    const item = { ...blank, id: newId() };
    focusId.current = item.id;
    onChange([...list, item]);
  };

  const addIdea = (idea) => {
    if (atMax) return;
    onChange([...list, withId(idea)]);
  };

  // Ideas already in the list are hidden; removing one brings it back
  const ideas = pool.filter((idea) => !list.some((item) => same(item[mainField], idea[mainField])));

  const firstLoad = firstVisit && status === 'loading';

  return (
    <div className="items">
      {/* ---------- Their list ---------- */}
      {firstLoad ? (
        <>
          <p className="spick__status items__status">
            <Sparkles size={15} /> Writing {suggestLabel} from your answers…
          </p>
          <div className="items__list">
            {Array.from({ length: prefillCount }, (_, i) => (
              <div key={i} className="spick__skeleton items__skeleton">
                <div className="spick__bar" />
                <div className="spick__bar spick__bar--short" />
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          {list.length > 0 && (
            <div className="items__list">
              {list.map((item) => (
                <div key={item.id} className="items__card">
                  <div className="items__fields">
                    {fields.map((f, i) => (
                      <textarea
                        key={f.id}
                        rows={1}
                        aria-label={f.label}
                        className={`items__input ${i === 0 ? 'items__input--lead' : ''}`}
                        value={item[f.id] ?? ''}
                        maxLength={f.maxLength}
                        placeholder={f.example ? `e.g. ${f.example}` : f.label}
                        ref={(el) => {
                          if (el && i === 0 && focusId.current === item.id) {
                            el.focus();
                            focusId.current = null;
                          }
                        }}
                        onChange={(e) => updateItem(item.id, f.id, e.target.value.replace(/\n/g, ' '))}
                        onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                      />
                    ))}
                                      {photoField && (
                      <ItemPhoto
                        value={item[photoField.id] ?? ''}
                        onChange={(v) => updateItem(item.id, photoField.id, v)}
                      />
                    )}
                  </div>
                  <button
                    type="button"
                    className="items__remove"
                    aria-label="Remove"
                    onClick={() => removeItem(item.id)}
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}

                    {list.length === 0 && question.emptyText && (
            <p className="items__empty">{question.emptyText}</p>
          )}

          <button type="button" className="items__add" onClick={addOwn} disabled={atMax}>
                        <Plus size={16} /> {question.addLabel ?? 'Add your own'}
          </button>
          {atMax && <p className="items__note">{maxItems} is the most for this section.</p>}
        </>
      )}

      {/* ---------- More ideas ---------- */}
      {status === 'error' && (
        <p className="items__note">
          We couldn't draft these right now. Add your own above.
        </p>
      )}

      {status === 'ready' && (ideas.length > 0 || hasMore) && (
        <div className="items__pool">
          <p className="spick__status">
            <Sparkles size={15} /> More ideas
          </p>

          <div className="items__list">
            {ideas.map((idea) => (
              <button
                key={idea.id}
                type="button"
                className="items__idea"
                disabled={atMax}
                onClick={() => addIdea(idea)}
              >
                <span className="items__idea-body">
                  <span className="items__idea-title">{idea[fields[0].id]}</span>
                  {fields.slice(1).map((f) =>
                    isFilled(idea[f.id]) ? (
                      <span key={f.id} className="items__idea-text">{idea[f.id]}</span>
                    ) : null
                  )}
                </span>
                <span className="items__idea-add">
                  <Plus size={14} /> Add
                </span>
              </button>
            ))}

            {loadingMore &&
              [0, 1, 2].map((i) => (
                <div key={`more-${i}`} className="spick__skeleton items__skeleton">
                  <div className="spick__bar" />
                  <div className="spick__bar spick__bar--short" />
                </div>
              ))}
          </div>

          {hasMore && (
            <div className="spick__links">
              <button
                type="button"
                className="spick__link"
                disabled={loadingMore}
                onClick={showMore}
              >
                <Plus size={14} /> Show 3 more
              </button>
            </div>
          )}
        </div>
      )}

      {/* Revisit: ideas still loading under their list */}
      {!firstVisit && status === 'loading' && (
        <p className="spick__status">
          <Sparkles size={15} /> Writing more {suggestLabel}…
        </p>
      )}
    </div>
  );
}