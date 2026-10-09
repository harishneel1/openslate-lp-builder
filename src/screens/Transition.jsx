import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { landingSections } from '../data/webinarQuestions';
import './QuestionFlow.css'; // reuses flow-in animation, .flow__back, .flow__next
import './Transition.css';

// Same count as the progress bar (final sign-up is built for them)
const sectionCount = landingSections.filter((s) => !s.auto).length;

export default function Transition({ onBack, onContinue }) {
  return (
    <div className="transition">
      <div className="transition__tick">
        <Check size={28} strokeWidth={3} />
      </div>

      <h1 className="transition__title">OpenSlate AI bot has understood your webinar requirements</h1>
      <p className="transition__text">
        Next, let's build your page in {sectionCount} short sections.
      </p>

      <div className="transition__nav">
        <button type="button" className="flow__next" onClick={onContinue}>
          Start with the headline <ArrowRight size={18} />
        </button>
        <button type="button" className="flow__back" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
      </div>
    </div>
  );
}