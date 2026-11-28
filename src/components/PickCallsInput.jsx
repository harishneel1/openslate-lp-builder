import { useMemo } from 'react';
import { ArrowRight } from 'lucide-react';
import { pickedCallIds, setupCallsOf, setupLineOf } from '../data/myPageQuestions';
import './PickCallsInput.css';

const DESCRIPTION_MAX = 200; // as the card line everywhere else (CallDetailsInput.jsx)

// ------------------------------------------------------------
// Storefront setup's "Which 1:1 calls go on your storefront?".
// Calls aren't made here: this lists the ones made in the 1:1 calls
// tab, each with a switch. Switched on, a call goes on the storefront,
// and a box opens under it for the short description on its card
// (the only thing asked here, since nothing else asks for it):
//
//   YOUR 1:1 CALLS · 2
//   ┌ Discovery call                                  [● On ] ┐
//   │ Video call · 30 min · ₹400                              │
//   │ Short description                                       │
//   │ ┌ A short call to get to know each other and see… ┐     │
//   │ └─────────────────────────────────────────────────┘     │
//   │ Shows under the call’s name on your storefront.  88/200 │
//   ├ Career clarity call                              [○ Off] ┤
//   └ Video call · 30 min · Free                              ┘
//
// The box starts with the call's own line (a suggestion from its name,
// until one's written), so most can just switch on and go.
// None switched on is fine: the page goes live with just their profile.
// No calls at all: a note, and a way to the 1:1 calls tab to make one.
//
// Saves:
//   pickedCalls   the ids switched on
//   pickedLines   { [id]: text }, the lines they've changed here
// Setup puts the calls on the page, with their lines, when it finishes
// (MyPageSetup.jsx).
// question.onGoToCalls(): opens the 1:1 calls tab (from MyPageSetup.jsx)
// ------------------------------------------------------------
export default function PickCallsInput({ question, answers, onChange }) {
  const calls = useMemo(() => setupCallsOf(answers), [answers]);
  const picked = pickedCallIds(answers);
  const lines = answers.pickedLines ?? {};

  const toggle = (id) => {
    const next = picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id];
    onChange(next, 'pickedCalls');
  };

  const setLine = (id, text) => onChange({ ...lines, [id]: text }, 'pickedLines');

  // ---------- No calls yet ----------
  if (calls.length === 0) {
    return (
      <div className="qinput pick">
        <div className="pick__empty">
          <p className="pick__empty-title">You don’t have any 1:1 calls yet</p>
          <p className="pick__empty-text">
            Make one in the 1:1 calls tab and come back here to switch it on. Or continue without one: your
            storefront goes live with just your profile, and you can add calls to it anytime.
          </p>
          {question.onGoToCalls && (
            <button type="button" className="pick__go" onClick={question.onGoToCalls}>
              Go to 1:1 calls <ArrowRight size={16} strokeWidth={2.5} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="qinput pick">
      <p className="pick__label" id="pick-label">
        Your 1:1 calls <span className="pick__count">{calls.length}</span>
      </p>

      <ul className="pick__list" aria-labelledby="pick-label">
        {calls.map((call) => {
          const on = picked.includes(call.id);
          const line = setupLineOf(answers, call);
          const boxId = `pick-line-${call.id}`;
          const empty = on && line.trim() === '';
          return (
            <li key={call.id} className={`pick__row ${on ? 'pick__row--on' : ''}`}>
              <div className="pick__head">
                <span className="pick__text">
                  <span className="pick__name">{call.title}</span>
                  <span className="pick__meta">
                    {call.facts.map((f) => f.text).join(' · ')}
                    {' · '}
                    <span className={call.price.isFree ? 'pick__free' : ''}>{call.price.label}</span>
                  </span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={`Show ${call.title} on your storefront`}
                  className="pick__switch"
                  onClick={() => toggle(call.id)}
                >
                  <span className="pick__switch-track" aria-hidden="true">
                    <span className="pick__switch-thumb" />
                  </span>
                  <span className="pick__switch-label" aria-hidden="true">
                    {on ? 'On' : 'Off'}
                  </span>
                </button>
              </div>

              {/* Only for calls going on the storefront: the line on its card */}
              {on && (
                <div className="pick__line">
                  <label className="qinput__label pick__line-label" htmlFor={boxId}>
                    Short description
                  </label>
                  <textarea
                    id={boxId}
                    className={`qinput__text pick__line-box ${empty ? 'qinput__text--error' : ''}`}
                    rows={2}
                    maxLength={DESCRIPTION_MAX}
                    value={line}
                    placeholder="A line or two on what happens in the call"
                    aria-invalid={empty || undefined}
                    onChange={(e) => setLine(call.id, e.target.value)}
                  />
                  <span className="pick__line-under">
                    <span className={empty ? 'pick__line-error' : ''}>
                      {empty ? 'Add a short description, or switch this call off.' : 'Shows under the call’s name on your storefront.'}
                    </span>
                    <span>
                      {line.length}/{DESCRIPTION_MAX}
                    </span>
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* What Continue does with nothing switched on, so it isn't a surprise */}
      <p className="pick__hint" aria-live="polite">
        {picked.length === 0
          ? 'Nothing switched on yet. You can still continue: your storefront goes live with just your profile.'
          : ''}
      </p>
    </div>
  );
}
