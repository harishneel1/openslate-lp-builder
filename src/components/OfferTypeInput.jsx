import { BookOpen, Check, MessageSquare, Users, Video } from 'lucide-react';
import './OfferTypeInput.css';

const ICONS = { call: Video, dm: MessageSquare, webinar: Users, course: BookOpen };

// Big cards for the kinds of things a creator can offer. The answer is the
// kind's id ('call', 'dm', 'webinar', 'course'), the same ids the page uses.
// Options marked soon are shown greyed out with a "Coming soon" label.
export default function OfferTypeInput({ question, value, onChange }) {
  return (
    <div className="qinput offer" role="radiogroup" aria-label={question.question}>
      {question.options.map(({ id, label, line, soon }) => {
        const Icon = ICONS[id] ?? Video;
        const selected = value === id && !soon;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={soon}
            className={`offer__card ${selected ? 'offer__card--selected' : ''} ${soon ? 'offer__card--soon' : ''}`}
            onClick={() => onChange(id)}
          >
            <span className="offer__icon" aria-hidden="true"><Icon size={20} /></span>
            <span className="offer__label">
              {label}
              {soon && <span className="offer__soon">Coming soon</span>}
            </span>
            <span className="offer__line">{line}</span>
            {selected && (
              <span className="offer__check" aria-hidden="true"><Check size={14} strokeWidth={3} /></span>
            )}
          </button>
        );
      })}
    </div>
  );
}