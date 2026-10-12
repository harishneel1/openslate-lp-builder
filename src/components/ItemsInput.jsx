import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Pencil, Plus, Sparkles, Trash2, User, X } from 'lucide-react';
import { getSuggestions } from '../data/mockSuggestions';
import { readPhoto } from '../utils/readPhoto';
import { initials } from '../utils/initials';
import googleIcon from '../assets/google-g.svg'; // Google's official "G" icon
import './SuggestionPicker.css'; // reuses .spick__panel, .spick__heading, .spick__cards, .spick__status, .spick__skeleton, .spick__bar, .spick__link
import './ItemsInput.css';

const isFilled = (v) => String(v ?? '').trim() !== '';
const same = (a, b) =>
  String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();

let counter = 0;
const newId = () => `item-${Date.now()}-${counter++}`;
const withId = (item) => ({ ...item, id: newId() });

// An empty card, and a check for one (every box empty)
const blankItem = (fields) => ({ ...Object.fromEntries(fields.map((f) => [f.id, ''])), id: newId() });
const isBlank = (item, fields) => fields.every((f) => !isFilled(item?.[f.id]));

// Puts the cursor at the end of a box's text
const focusAtEnd = (id) => {
  const box = document.getElementById(id);
  if (!box) return;
  box.focus();
  box.setSelectionRange(box.value.length, box.value.length);
};

// The round picture beside a reviewer's name. Shows, in order:
// their photo → the Google icon → their initials → a plain person icon.
// Clicking it opens a small menu: upload a photo, use the Google icon, remove.
// photo: data URL for now; the real app should upload it and save the link.
// source: 'google' when they chose the Google icon, otherwise ''.
function ItemPicture({ name, photo, source, onChange }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  const hasPhoto = isFilled(photo);
  const isGoogle = !hasPhoto && source === 'google';
  const letters = initials(name);

  // Closes on a click outside or Escape
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // lets them pick the same file again
    if (!file) return;

    try {
      setError('');
      onChange({ photo: await readPhoto(file), source: '' });
    } catch (err) {
      setError(err.message);
    }
  };

  const choose = (patch) => {
    setError('');
    onChange(patch);
    setOpen(false);
  };

  let label;
  if (hasPhoto) label = 'Photo added. Change picture';
  else if (isGoogle) label = 'Google icon. Change picture';
  else label = 'Add a picture';

  return (
    <div className="items__picture" ref={wrapRef}>
      <button
        type="button"
        className={`items__avatar ${isGoogle ? 'items__avatar--icon' : ''}`}
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {hasPhoto ? (
          <img src={photo} alt="" />
        ) : isGoogle ? (
          <img src={googleIcon} alt="" />
        ) : letters ? (
          <span className="items__avatar-letters">{letters}</span>
        ) : (
          <User size={22} />
        )}
      </button>

      <button
        type="button"
        className="items__picture-link"
        aria-hidden="true"
        tabIndex={-1} // the circle above does the same thing
        onClick={() => setOpen((o) => !o)}
      >
        {hasPhoto || isGoogle ? 'Change' : 'Add picture'}
      </button>

      {open && (
        <div className="items__menu" role="menu">
          <button
            type="button"
            role="menuitem"
            className="items__menu-item"
            onClick={() => {
              setOpen(false);
              inputRef.current?.click();
            }}
          >
            <ImagePlus size={16} /> {hasPhoto ? 'Upload a different photo' : 'Upload a photo'}
          </button>
          {!isGoogle && (
            <button
              type="button"
              role="menuitem"
              className="items__menu-item"
              onClick={() => choose({ photo: '', source: 'google' })}
            >
              <img className="items__menu-icon" src={googleIcon} alt="" /> Use Google icon
            </button>
          )}
          {(hasPhoto || isGoogle) && (
            <button
              type="button"
              role="menuitem"
              className="items__menu-item items__menu-item--danger"
              onClick={() => choose({ photo: '', source: '' })}
            >
              <Trash2 size={16} /> Remove picture
            </button>
          )}
        </div>
      )}

      <input ref={inputRef} type="file" accept="image/*" hidden onChange={handleFile} />
      {error && <span className="items__picture-error" role="alert">{error}</span>}
    </div>
  );
}

// A list the creator edits: learnings, personas, reviews, FAQs.
// With suggest: true, AI ideas sit below to add, and a first visit opens
// with empty cards to fill in. Nothing is ever put in the list for them.
// With suggest: false (reviews) it's a plain list.
// Each card is numbered by its place in the list ("Point 1", "Point 2"),
// using itemLabel; removing one renumbers the rest.
// A list with a picture field (reviews) shows the picture beside the fields
// marked besidePicture (name, who they are); the rest go full width below.
export default function ItemsInput({ question, answers, onChange }) {
  const {
    id: questionId,
    itemFields,
    mainField,
    minItems = 0,
    maxItems = Infinity,
    suggest,
    suggestLabel = 'ideas',
    itemLabel = 'Item', // what one card is called: "Point", "Review"
  } = question;

  const list = Array.isArray(answers[questionId]) ? answers[questionId] : [];
  const fields = itemFields.filter((f) => f.type !== 'image');
  const photoField = itemFields.find((f) => f.type === 'image'); // optional picture per item
  const besideFields = photoField ? fields.filter((f) => f.besidePicture) : [];
  const belowFields = fields.filter((f) => !besideFields.includes(f));

  // Empty cards only on the first visit; coming back keeps their list
  const [firstVisit] = useState(answers[questionId] === undefined);
  const blankCount = Math.max(minItems, 1);

  const [pool, setPool] = useState([]);
  const [status, setStatus] = useState(suggest ? 'loading' : 'off'); // 'loading' | 'ready' | 'error' | 'off'
  const [hasMore, setHasMore] = useState(false);
  const [nextBatch, setNextBatch] = useState(2);
  const [loadingMore, setLoadingMore] = useState(false);
  const focusId = useRef(null); // the item to focus after "Add your own"

  // First load: 2 batches (6 ideas), all shown under "More ideas".
  // None go into the list on their own.
  useEffect(() => {
    // A first visit opens with empty cards to fill in
    if (firstVisit && suggest) {
      onChange(Array.from({ length: blankCount }, () => blankItem(fields)));
    }
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

      setPool(ideas);
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

  // patch: the fields to change, e.g. { name: 'Priya' } or { photo: '', source: 'google' }
  const updateItem = (id, patch) => {
    onChange(list.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const removeItem = (id) => onChange(list.filter((item) => item.id !== id));

  const addOwn = () => {
    if (atMax) return;
    const item = blankItem(fields);
    focusId.current = item.id;
    onChange([...list, item]);
  };

  // Fills the first empty card if there is one; otherwise adds a new card
  const hasBlank = list.some((item) => isBlank(item, fields));

  const addIdea = (idea) => {
    const blankAt = list.findIndex((item) => isBlank(item, fields));
    if (blankAt !== -1) {
      onChange(list.map((item, i) => (i === blankAt ? withId(idea) : item)));
      return;
    }
    if (atMax) return;
    onChange([...list, withId(idea)]);
  };

  // Ideas already in the list are hidden; removing one brings it back
  const ideas = pool.filter((idea) => !list.some((item) => same(item[mainField], idea[mainField])));

  // One labelled box. The first field in the list is bold and gets the
  // cursor after "Add your own".
  const renderField = (item, f) => {
    const isFirst = f.id === fields[0].id;
    const boxId = `${item.id}-${f.id}`;
    return (
      <div key={f.id} className="items__field">
        <div className="items__field-head">
          <label htmlFor={boxId} className="items__label">{f.label}</label>
        </div>

        {/* Full-width box with its own pencil inside */}
        <div className="items__box">
          <textarea
            id={boxId}
            rows={1}
            className={`items__input ${isFirst ? 'items__input--lead' : ''}`}
            value={item[f.id] ?? ''}
            maxLength={f.maxLength}
            placeholder={f.example ? `e.g. ${f.example}` : f.label}
            ref={(el) => {
              if (el && isFirst && focusId.current === item.id) {
                el.focus();
                focusId.current = null;
              }
            }}
            onChange={(e) => updateItem(item.id, { [f.id]: e.target.value.replace(/\n/g, ' ') })}
            onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
          />
          <button
            type="button"
            className="items__edit"
            aria-label={`Edit ${f.label.toLowerCase()}`}
            tabIndex={-1} // the box itself is already reachable with Tab
            onClick={() => focusAtEnd(boxId)}
          >
            <Pencil size={15} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="items">
      {/* ---------- Their list ---------- */}
      {list.length > 0 && (
        <div className="items__list">
          {list.map((item, index) => (
            <div key={item.id} className="items__card">
              {/* Card number on the left, × on the right */}
              <div className="items__card-head">
                <span className="items__card-title">
                <span className="items__card-number">{index + 1}</span>
                {itemLabel}
              </span>
                <button
                  type="button"
                  className="items__remove"
                  aria-label={`Remove ${itemLabel.toLowerCase()} ${index + 1}`}
                  onClick={() => removeItem(item.id)}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Reviews: picture on the left, name and who they are beside it */}
              {photoField && (
                <div className="items__person">
                  <ItemPicture
                    name={item[(besideFields[0] ?? fields[0]).id]}
                    photo={item[photoField.id] ?? ''}
                    source={item.source ?? ''}
                    onChange={(patch) =>
                      updateItem(item.id, {
                        [photoField.id]: patch.photo,
                        source: patch.source,
                      })
                    }
                  />
                  {besideFields.length > 0 && (
                    <div className="items__person-fields">
                      {besideFields.map((f) => renderField(item, f))}
                    </div>
                  )}
                </div>
              )}

              {belowFields.map((f) => renderField(item, f))}
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

      {/* ---------- More ideas ---------- */}
      {status === 'error' && (
        <p className="items__note">
          We couldn't draft these right now. Add your own above.
        </p>
      )}

      {status === 'ready' && (ideas.length > 0 || hasMore) && (
        <div className="spick__panel items__pool" role="group" aria-label="More ideas">
          <p className="spick__heading">
            <Sparkles size={18} /> More ideas from your answers. Tap one to add it.
          </p>

          <div className="spick__cards">
            {ideas.map((idea) => (
              <button
                key={idea.id}
                type="button"
                className="items__idea"
                disabled={atMax && !hasBlank}
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
                className="spick__link spick__more"
                disabled={loadingMore}
                onClick={showMore}
              >
                <Plus size={14} /> Show 3 more
              </button>
            </div>
          )}
        </div>
      )}

      {/* Ideas still loading under their list */}
      {status === 'loading' && (
        <p className="spick__status">
          <Sparkles size={15} /> Writing more {suggestLabel}…
        </p>
      )}
    </div>
  );
}