import { Check } from 'lucide-react';
import './SectionProgress.css';

// Progress through the landing page questions: one segment per screen,
// named like the rows of "Edit your landing page" (reviewLabel).
// questions: the visible screens, in order (Price only shows when Paid)
// current:   index of the screen they're on
// furthest:  index of the furthest screen they've reached
// onJump:    go to a screen index (any screen they've already reached)
export default function SectionProgress({ questions = [], current = 0, furthest = 0, onJump }) {
  const steps = questions;
  const name = (q) => q.reviewLabel ?? q.question;
  const here = steps[current];

  return (
    <div className="sprogress" style={{ '--steps': steps.length }}>
           {/* Always at the left edge, so it's in the same place on every screen */}
      <div className="sprogress__labels">
        {here && (
          <p className="sprogress__label">
            <span className="sprogress__name">{name(here)}</span>
            <span aria-hidden="true">·</span>
            <span>Step {current + 1} of {steps.length}</span>
          </p>
        )}
      </div>

      <div className="sprogress__track">
        {steps.map((q, i) => {
          const isCurrent = i === current;
          const isDone = !isCurrent && i < furthest;
          // Any screen they've already reached can be opened again
          const canJump = !isCurrent && !!onJump && i <= furthest;

          const state = isCurrent ? 'current' : isDone ? 'done' : 'todo';

          return (
            <button
              key={q.id}
              type="button"
              className={`sprogress__seg sprogress__seg--${state} ${canJump ? 'sprogress__seg--link' : ''}`}
              aria-current={isCurrent ? 'step' : undefined}
              aria-disabled={!canJump}
              aria-label={`${name(q)}${isDone ? ', done' : ''}${isCurrent ? ', you are here' : ''}`}
              onClick={() => canJump && onJump(i)}
            >
              <span className="sprogress__bar" />
              <span className="sprogress__tip" aria-hidden="true">
                {isDone && <Check size={13} strokeWidth={3} className="sprogress__tick" />}
                {name(q)}
                {isCurrent && <span className="sprogress__tip-note">You're here</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}