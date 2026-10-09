import { Check } from 'lucide-react';
import { landingSections } from '../data/webinarQuestions';
import './SectionProgress.css';

// The final sign-up button is built for them, so it isn't a step
const steps = landingSections.filter((s) => !s.auto);

// questions: the visible questions, in order
// furthest:  index of the furthest question they've reached
// onJump:    go to a question index (used to jump back to a section)
export default function SectionProgress({ currentSection, questions = [], furthest = 0, onJump }) {
  const current = steps.findIndex((s) => s.id === currentSection);

  // Name sits above the current segment: left-aligned to it in the first half,
  // right-aligned to it in the second half, so it never runs off the edge
  const inFirstHalf = current < steps.length / 2;
  const labelPlacement = inFirstHalf
    ? { gridColumn: `${current + 1} / -1`, justifySelf: 'start' }
    : { gridColumn: `1 / ${current + 2}`, justifySelf: 'end' };

  return (
    <div className="sprogress" style={{ '--steps': steps.length }}>
      <div className="sprogress__labels">
        {current !== -1 && (
          <p className="sprogress__label" style={labelPlacement}>
            <span className="sprogress__name">{steps[current].name}</span>
            <span>{current + 1} of {steps.length}</span>
          </p>
        )}
      </div>

      <div className="sprogress__track">
        {steps.map((s, i) => {
          const first = questions.findIndex((q) => q.section === s.id);
          const last = questions.findLastIndex((q) => q.section === s.id);

          const isCurrent = i === current;
          const isDone = !isCurrent && last !== -1 && last < furthest;
          // Any section they've already reached can be opened again
          const canJump = !isCurrent && !!onJump && first !== -1 && first <= furthest;

          const state = isCurrent ? 'current' : isDone ? 'done' : 'todo';

          return (
            <button
              key={s.id}
              type="button"
              className={`sprogress__seg sprogress__seg--${state} ${canJump ? 'sprogress__seg--link' : ''}`}
              aria-current={isCurrent ? 'step' : undefined}
              aria-disabled={!canJump}
              aria-label={`${s.name}${isDone ? ', done' : ''}${isCurrent ? ', you are here' : ''}`}
              onClick={() => canJump && onJump(first)}
            >
              <span className="sprogress__bar" />
              <span className="sprogress__tip" aria-hidden="true">
                {isDone && <Check size={13} strokeWidth={3} className="sprogress__tick" />}
                {s.name}
                {isCurrent && <span className="sprogress__tip-note">You're here</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}