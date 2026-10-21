import { useEffect, useRef, useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import './OfferingKindPicker.css'; // the same pop-up frame as "What do you want to offer?"
import './AddToPagePicker.css';

const DESCRIPTION_MAX = 200; // as in the call editor's short description

// ------------------------------------------------------------
// "Add to your page", over the offerings home: their 1:1 calls that
// aren't on the page yet, to tick and add (several at once).
//
//   ┌ Add to your page                                         ✕ ┐
//   │ ☑ Discovery call                       ₹1,500             │
//   │   Video call · 60 min                                      │
//   │   "A short call to get to know…"         Edit card text    │
//   │ ☐ 1:1 session                          Free               │
//   │ ...                                                        │
//   └ [+ Create a new 1:1 call]                    [Add 1 to page] ┘
//
// Each row shows the call as its card will look, including the line
// under its name on the page (its short description). That line isn't
// asked for when a call is made, so this is where it's checked:
// "Edit card text" opens it in place. Cleared, the card has no line.
//
// The rows are CallPickList (below), which setup's "Which of your 1:1
// calls should go on your page?" screen uses too (PickCallsInput.jsx).
//
// calls: the calls not on the page, as on the offerings home (buildProfileJson)
// onAdd({ ids, descriptions }): ids to put on the page, and any card
//   lines they changed ({ [id]: text })
// onCreate(): start a new call instead (the guided flow)
// onClose(): nothing added
// ------------------------------------------------------------
export default function AddToPagePicker({ calls, onAdd, onCreate, onClose }) {
  const ref = useRef(null);
  // Ticked to start with when there's only one to pick
  const [picked, setPicked] = useState(() => (calls.length === 1 ? [calls[0].id] : []));
  const [descriptions, setDescriptions] = useState({}); // changed lines only

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.open && dialog.close();
  }, []);

  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const count = picked.length;

  return (
    <dialog
      ref={ref}
      className="okp atp"
      aria-labelledby="atp-title"
      onCancel={(e) => {
        e.preventDefault(); // Escape: we close it ourselves
        onClose();
      }}
      // A click on the dimmed page around it closes it too
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className="okp__head">
        <div>
          <h2 className="okp__title" id="atp-title">
            Add to your page
          </h2>
          <p className="okp__sub">
            {calls.length > 0
              ? 'Pick the 1:1 calls people should see on your page.'
              : 'All your 1:1 calls are already on your page.'}
          </p>
        </div>
        <button type="button" className="okp__close" onClick={onClose} aria-label="Close">
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      {calls.length > 0 && (
        <CallPickList
          calls={calls}
          picked={picked}
          onToggle={toggle}
          descriptions={descriptions}
          onDescription={(id, text) => setDescriptions((d) => ({ ...d, [id]: text }))}
        />
      )}

      <div className="atp__foot">
        <button type="button" className="atp__create" onClick={onCreate}>
          <Plus size={16} strokeWidth={2.5} aria-hidden="true" /> Create a new 1:1 call
        </button>
        {calls.length > 0 && (
          <button
            type="button"
            className="atp__add"
            disabled={count === 0}
            onClick={() => onAdd({ ids: picked, descriptions })}
          >
            {count === 0 ? 'Add to page' : `Add ${count} to page`}
          </button>
        )}
      </div>
    </dialog>
  );
}

// ------------------------------------------------------------
// The calls to tick, each as its card will look, with its card line
// and "Edit card text". Used here and in setup (PickCallsInput.jsx).
//
// calls: as on the offerings home (buildProfileJson)
// picked: ids ticked
// onToggle(id): tick or untick one
// descriptions: card lines they've changed ({ [id]: text })
// onDescription(id, text): one changed
// ------------------------------------------------------------
export function CallPickList({ calls, picked, onToggle, descriptions, onDescription }) {
  const [editing, setEditing] = useState(null); // the call whose card line is open
  const lineOf = (call) => descriptions[call.id] ?? call.description ?? '';

  return (
    <ul className="atp__list">
      {calls.map((call) => {
        const on = picked.includes(call.id);
        const line = lineOf(call);
        const boxId = `atp-pick-${call.id}`;
        return (
          <li key={call.id} className={`atp__call ${on ? 'atp__call--on' : ''}`}>
            <label className="atp__pick" htmlFor={boxId}>
              <input id={boxId} type="checkbox" checked={on} onChange={() => onToggle(call.id)} />
              <span className="atp__box" aria-hidden="true">
                {on && <Check size={14} strokeWidth={3} />}
              </span>
              <span className="atp__what">
                <span className="atp__title-row">
                  <span className="atp__name">{call.title}</span>
                  <span className={`atp__price ${call.price.isFree ? 'atp__price--free' : ''}`}>{call.price.label}</span>
                </span>
                <span className="atp__detail">{call.facts.map((f) => f.text).join(' · ')}</span>
              </span>
            </label>

            {/* The line under its name on the page */}
            {editing === call.id ? (
              <div className="atp__line-edit">
                <label className="atp__line-label" htmlFor={`atp-line-${call.id}`}>
                  Card text <span className="atp__optional">· Optional</span>
                </label>
                <textarea
                  id={`atp-line-${call.id}`}
                  className="qinput__text atp__line-box"
                  rows={2}
                  maxLength={DESCRIPTION_MAX}
                  value={line}
                  placeholder="A line or two on what happens in the call"
                  onChange={(e) => onDescription(call.id, e.target.value)}
                  autoFocus
                />
                <span className="atp__line-under">
                  <span>Shows under the name on your page.</span>
                  <span>
                    {line.length}/{DESCRIPTION_MAX}
                  </span>
                </span>
                <button type="button" className="atp__text-btn" onClick={() => setEditing(null)}>
                  Done
                </button>
              </div>
            ) : (
              <div className="atp__line">
                <p className={`atp__line-text ${line ? '' : 'atp__line-text--empty'}`}>{line || 'No text under its name'}</p>
                <button type="button" className="atp__text-btn" onClick={() => setEditing(call.id)}>
                  {line ? 'Edit card text' : 'Add card text'}
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}