import FunnelTypeCard from '../components/FunnelTypeCard';
import { funnelTypes } from '../data/funnelTypes';
import './FunnelTypePicker.css';

export default function FunnelTypePicker({ onSelect }) {
  return (
    <div className="picker">
      <header className="picker__header">
        <h1 className="picker__title">What are you building today?</h1>
        <p className="picker__subtitle">
          Pick a funnel and we'll walk you through it, one question at a time.
          You bring the content. We handle the design.
        </p>
      </header>

      <div className="picker__grid">
        {funnelTypes.map((funnel) => (
          <FunnelTypeCard key={funnel.id} funnel={funnel} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}