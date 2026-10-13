import { useMemo, useState } from 'react';
import { ArrowLeft, Check, Search } from 'lucide-react';
import { getServices, servicePrice } from '../data/mockServices';
import './QuestionFlow.css'; // reuses .flow__back, .flow__next
import './ServicePicker.css';

// Show the search box only when the list is long enough to need it
const SEARCH_FROM = 6;

// Registration page: pick one of the services they made in the Services tab.
// selectedId: the service this funnel already uses (when they come back to change it).
// onUse(id): save the pick and go back to the overview. onBack: leave without changing anything.
export default function ServicePicker({ selectedId = null, onUse, onBack }) {
  const services = useMemo(() => getServices(), []);
  const [picked, setPicked] = useState(selectedId);
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const shown = q ? services.filter((s) => s.title.toLowerCase().includes(q)) : services;
  const changing = selectedId !== null;

  const use = () => {
    if (picked) onUse?.(picked);
  };

  return (
    <div className="picker">
      <button type="button" className="flow__back flow__back--top" onClick={onBack}>
        <ArrowLeft size={16} /> Overview
      </button>

      <h1 className="picker__title">
        {changing ? 'Change your registration page' : 'Pick your registration page'}
      </h1>
      <p className="picker__subtitle">
        Choose the service people sign up for. If it's paid, they pay on the same page.
      </p>

      {services.length === 0 ? (
        <p className="picker__empty">You don't have any services yet.</p>
      ) : (
        <>
          {services.length >= SEARCH_FROM && (
            <label className="picker__search">
              <Search size={18} aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search your services"
                aria-label="Search your services"
              />
            </label>
          )}

          {shown.length === 0 ? (
            <p className="picker__empty">No services match "{query.trim()}".</p>
          ) : (
            <div className="picker__list" role="radiogroup" aria-label="Your services">
              {shown.map((s) => {
                const isPicked = s.id === picked;
                const price = servicePrice(s);
                return (
                  <label
                    key={s.id}
                    className={`picker__row ${isPicked ? 'picker__row--picked' : ''}`}
                  >
                    <input
                      type="radio"
                      name="service"
                      className="picker__radio"
                      value={s.id}
                      checked={isPicked}
                      onChange={() => setPicked(s.id)}
                    />
                    <span className="picker__mark" aria-hidden="true">
                      {isPicked && <Check size={14} strokeWidth={3} />}
                    </span>
                    <span className="picker__name">{s.title}</span>
                    <span className={`picker__price ${price === 'Free' ? 'picker__price--free' : ''}`}>
                      {price}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </>
      )}

      <div className="picker__actions">
        <button
          type="button"
          className="flow__next"
          onClick={use}
          aria-disabled={!picked}
        >
          Use this service
        </button>
        {!picked && services.length > 0 && (
          <span className="picker__hint">Pick a service first</span>
        )}
      </div>
    </div>
  );
}