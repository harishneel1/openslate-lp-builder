import { landingSections } from '../data/webinarQuestions';
import './SectionProgress.css';

// The final sign-up button is built for them, so it isn't a step
const steps = landingSections.filter((s) => !s.auto);

export default function SectionProgress({ currentSection }) {
  const current = steps.findIndex((s) => s.id === currentSection);

  return (
    <div className="sprogress">
      <div className="sprogress__label">
        <span className="sprogress__name">{steps[current]?.name}</span>
        <span>Section {current + 1} of {steps.length}</span>
      </div>
      <div className="sprogress__track">
        {steps.map((s, i) => (
          <span
            key={s.id}
            className={`sprogress__seg ${
              i < current ? 'sprogress__seg--done' : i === current ? 'sprogress__seg--current' : ''
            }`}
          />
        ))}
      </div>
    </div>
  );
}