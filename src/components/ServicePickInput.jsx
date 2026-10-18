import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ExternalLink, RotateCw, Search } from 'lucide-react';
import { CREATE_SERVICE_URL, getServices, servicePrice } from '../data/mockServices';
import '../screens/ServicePicker.css'; // same look as the funnel builder's picker

// Show the search box only when the list is long enough to need it
const SEARCH_FROM = 6;

// Pick one of the services made in the Services tab, as a step in a flow
// (the flow's own Next carries on). Works like the funnel builder's
// ServicePicker: "Create a new service" opens the Services page in a new tab;
// when they come back the list refreshes, and a service that wasn't there
// before is marked New and picked for them.
export default function ServicePickInput({ value, onChange }) {
  const [services, setServices] = useState(() => getServices());
  const [query, setQuery] = useState('');
  const [newIds, setNewIds] = useState([]);
  const seen = useRef(new Set(services.map((s) => s.id)));
  const listRef = useRef(null);
  const onChangeRef = useRef(onChange); // the flow passes a new function each render
  onChangeRef.current = onChange;

  const refresh = useCallback(() => {
    const latest = getServices();
    const added = latest.filter((s) => !seen.current.has(s.id));
    added.forEach((s) => seen.current.add(s.id));
    setServices(latest);
    if (added.length > 0) {
      setNewIds((ids) => [...ids, ...added.map((s) => s.id)]);
      onChangeRef.current(added[0].id); // newest first, so this is the one they just made
      setQuery('');
      listRef.current?.scrollTo?.({ top: 0 });
    }
  }, []);

  // Refresh whenever they come back to this tab
  useEffect(() => {
    const onReturn = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onReturn);
    window.addEventListener('focus', onReturn);
    return () => {
      document.removeEventListener('visibilitychange', onReturn);
      window.removeEventListener('focus', onReturn);
    };
  }, [refresh]);

  const q = query.trim().toLowerCase();
  const shown = q ? services.filter((s) => s.title.toLowerCase().includes(q)) : services;

  // No services yet: making one is the only thing to do
  if (services.length === 0) {
    return (
      <div className="qinput service-picker__none">
        <h2 className="service-picker__none-title">You don’t have any services yet</h2>
        <p className="service-picker__none-text">
          Create one in a new tab, free or paid. When you come back here, it’ll be picked for you.
        </p>
        <a className="flow__next service-picker__none-create" href={CREATE_SERVICE_URL} target="_blank" rel="noopener">
          Create your first service <ExternalLink size={16} aria-hidden="true" />
        </a>
        <button type="button" className="service-picker__refresh" onClick={refresh}>
          <RotateCw size={14} aria-hidden="true" /> I’ve made one, refresh
        </button>
      </div>
    );
  }

  return (
    <div className="qinput">
      {services.length >= SEARCH_FROM && (
        <label className="service-picker__search">
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

      <div className="service-picker__tools">
        <span className="service-picker__tools-text">Don’t see it?</span>
        <a className="service-picker__create" href={CREATE_SERVICE_URL} target="_blank" rel="noopener">
          Create a new service <ExternalLink size={14} aria-hidden="true" />
        </a>
        <button type="button" className="service-picker__refresh" onClick={refresh}>
          <RotateCw size={14} aria-hidden="true" /> Refresh
        </button>
      </div>

      {shown.length === 0 ? (
        <p className="service-picker__empty">No services match “{query.trim()}”.</p>
      ) : (
        <div className="service-picker__list" ref={listRef} role="radiogroup" aria-label="Your services">
          {shown.map((s) => {
            const isPicked = s.id === value;
            const isNew = newIds.includes(s.id);
            const price = servicePrice(s);
            return (
              <label
                key={s.id}
                className={`service-picker__row ${isPicked ? 'service-picker__row--picked' : ''} ${isNew ? 'service-picker__row--new' : ''}`}
              >
                <input
                  type="radio"
                  name="my-page-service"
                  className="service-picker__radio"
                  value={s.id}
                  checked={isPicked}
                  onChange={() => onChange(s.id)}
                />
                <span className="service-picker__mark" aria-hidden="true">
                  {isPicked && <Check size={14} strokeWidth={3} />}
                </span>
                <span className="service-picker__name">
                  {s.title}
                  {isNew && <span className="service-picker__new">New</span>}
                </span>
                <span className={`service-picker__price ${price === 'Free' ? 'service-picker__price--free' : ''}`}>
                  {price}
                </span>
              </label>
            );
          })}
        </div>
      )}

      {/* Tells screen readers when a new service has been added and picked */}
      <p className="service-picker__sr" aria-live="polite">
        {newIds.length > 0 ? 'Your new service has been added and selected.' : ''}
      </p>
    </div>
  );
}