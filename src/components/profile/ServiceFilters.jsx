import './ServiceFilters.css';

// The row of filters above the cards: "All", then one per kind the
// creator offers. Only shown when there are at least two kinds.
// These filter one list rather than switch between panels, so they're
// toggle buttons (aria-pressed) rather than ARIA tabs.
export default function ServiceFilters({ kinds, total, active, onChange }) {
  const options = [{ id: 'all', label: 'All', count: total }, ...kinds];

  return (
    <div className="sf" role="group" aria-label="Show">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className="sf__btn"
          aria-pressed={active === o.id}
          onClick={() => onChange(o.id)}
        >
          {o.label}
          <span className="sf__count">{o.count}</span>
        </button>
      ))}
    </div>
  );
}