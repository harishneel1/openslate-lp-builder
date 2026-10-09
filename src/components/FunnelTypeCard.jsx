import { ArrowRight } from 'lucide-react';
import './FunnelTypeCard.css';

export default function FunnelTypeCard({ funnel, onSelect }) {
const { title, description, icon: Icon, available } = funnel;
  return (
    <button
      type="button"
      className={`funnel-card ${available ? '' : 'funnel-card--disabled'}`}
      onClick={() => available && onSelect(funnel.id)}
      disabled={!available}
    >
      <div className="funnel-card__top">
        <div className="funnel-card__icon">
          <Icon size={22} strokeWidth={2} />
        </div>
        {!available && <span className="funnel-card__badge">Coming soon</span>}
      </div>

      <h3 className="funnel-card__title">{title}</h3>
      <p className="funnel-card__description">{description}</p>

      {available && (
  <div className="funnel-card__footer">
    <span className="funnel-card__cta">
      Start <ArrowRight size={16} />
    </span>
  </div>
)}
    </button>
  );
}