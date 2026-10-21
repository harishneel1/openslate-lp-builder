import { useEffect, useMemo, useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { buildProfileJson } from '../data/buildProfileJson';
import { addedCallsOf, getMyProfile } from '../data/myProfile';
import './PickCallsInput.css';

// ------------------------------------------------------------
// Setup's "Which calls go on your page?", only for someone who made
// calls in the 1:1 calls tab before setting up their page.
//
// Picking is a choice; creating is an action, and they look it:
//
//   YOUR CALLS · 2
//   ┌ ☑  Discovery call                                         ┐
//   │    Video call · 30 min · ₹400                              │
//   ├ ☐  Career clarity call                                    ┤
//   └    Video call · 30 min · Free                              ┘
//   Tick at least one call to continue.
//
//   [+ Create a new 1:1 call instead]       ← a button, not a choice
//                                    [Continue →]  ← for the ticked calls
//
// The calls are a checklist (square boxes: tick as many as you like),
// and Continue puts them on the page. "Create a new 1:1 call instead"
// has no tick: pressing it goes straight into the call questions.
// Coming back here from those questions, it's a fresh choice again.
// Card text isn't asked for here: it's changed from "Add to your page"
// on My offerings, where the cards are.
//
// Saves:
//   callSource    'existing' (ticked some) or 'new' (pressed create);
//                 the call questions only show for 'new'
//   pickedCalls   the ids ticked
// Setup puts the ticked calls on the page when it finishes (MyPageSetup.jsx).
// onSubmit: the flow's Next, used to move on once "create" has been saved
// ------------------------------------------------------------
export default function PickCallsInput({ answers, onChange, onSubmit }) {
  // Every call they've made, newest first (the setup call doesn't exist yet)
  const calls = useMemo(() => {
    const all = buildProfileJson(getMyProfile(answers)).services;
    return addedCallsOf(answers)
      .map((c) => all.find((s) => s.id === c.id))
      .filter(Boolean);
  }, [answers]);

  const picked = Array.isArray(answers.pickedCalls) ? answers.pickedCalls : [];

  // Back from the call questions: not committed to making one any more
  useEffect(() => {
    if (answers.callSource === 'new') onChange(undefined, 'callSource');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // "Create instead" saves first, then moves on once the flow has the
  // answer (so the call questions are there to move on to)
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    if (creating && answers.callSource === 'new') {
      setCreating(false);
      onSubmit();
    }
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id) => {
    const next = picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id];
    onChange(next, 'pickedCalls');
    onChange(next.length > 0 ? 'existing' : undefined, 'callSource');
  };

  const createInstead = () => {
    onChange([], 'pickedCalls');
    onChange('new', 'callSource');
    setCreating(true);
  };

  return (
    <div className="qinput pick">
      <p className="pick__label" id="pick-label">
        Your calls <span className="pick__count">{calls.length}</span>
      </p>

      <ul className="pick__list" aria-labelledby="pick-label">
        {calls.map((call) => {
          const on = picked.includes(call.id);
          const boxId = `pick-${call.id}`;
          return (
            <li key={call.id}>
              <label className={`pick__row ${on ? 'pick__row--on' : ''}`} htmlFor={boxId}>
                <input id={boxId} type="checkbox" checked={on} onChange={() => toggle(call.id)} />
                <span className="pick__box" aria-hidden="true">
                  {on && <Check size={14} strokeWidth={3} />}
                </span>
                <span className="pick__text">
                  <span className="pick__name">{call.title}</span>
                  <span className="pick__meta">
                    {call.facts.map((f) => f.text).join(' · ')}
                    {' · '}
                    <span className={call.price.isFree ? 'pick__free' : ''}>{call.price.label}</span>
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      {/* Why Continue is waiting, right under what unlocks it */}
      <p className="pick__hint" aria-live="polite">
        {picked.length === 0 ? 'Tick at least one call to continue.' : ''}
      </p>

      <button type="button" className="pick__create" onClick={createInstead}>
        <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
        Create a new 1:1 call instead
      </button>
    </div>
  );
}