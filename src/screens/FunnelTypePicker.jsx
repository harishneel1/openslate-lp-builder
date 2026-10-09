import FunnelTypeCard from '../components/FunnelTypeCard';
import SavedFunnelCard from '../components/SavedFunnelCard';
import { funnelTypes } from '../data/funnelTypes';
import './FunnelTypePicker.css';

// savedFunnels: funnels they've started (shown first, most recently edited first).
// onOpen(id): reopen one. onSelect(typeId): start a new one.
export default function FunnelTypePicker({ onSelect, savedFunnels = [], onOpen, onDelete }) {  const sorted = [...savedFunnels].sort((a, b) => b.updatedAt - a.updatedAt);
  const hasSaved = sorted.length > 0;

  return (
    <div className="picker">
      <header className="picker__header">
        <h1 className="picker__title">What are you building today?</h1>
        <p className="picker__subtitle">
          Pick a funnel and we'll walk you through it, one question at a time.
          You bring the content. We handle the design.
        </p>
      </header>

      {hasSaved && (
        <section className="picker__section" aria-labelledby="picker-saved">
          <h2 id="picker-saved" className="picker__section-title">Your funnels</h2>
          <div className="picker__grid">
            {sorted.map((f) => (
              <SavedFunnelCard key={f.id} funnel={f} onOpen={onOpen} onDelete={onDelete} />
            ))}
          </div>
        </section>
      )}

      <section className="picker__section" aria-labelledby={hasSaved ? 'picker-new' : undefined}>
        {/* First visit: no heading, so the screen looks as it always did */}
        {hasSaved && (
          <h2 id="picker-new" className="picker__section-title">Start a new funnel</h2>
        )}
        <div className="picker__grid">
          {funnelTypes.map((funnel) => (
            <FunnelTypeCard key={funnel.id} funnel={funnel} onSelect={onSelect} />
          ))}
        </div>
      </section>
    </div>
  );
}