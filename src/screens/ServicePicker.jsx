import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, ExternalLink, RotateCw, Search } from 'lucide-react';
import { CREATE_SERVICE_URL, getServices, servicePrice } from '../data/mockServices';
import './QuestionFlow.css'; // reuses .flow__back, .flow__next
import './ServicePicker.css';

// Show the search box only when the list is long enough to need it
const SEARCH_FROM = 6;

// Registration page: pick one of the services they made in the Services tab.
// selectedId: the service this funnel already uses (when they come back to change it).
// onUse(id): save the pick and go back to the overview. onBack: leave without changing anything.
//
// "Create a new service" opens the Services page in a new tab. When they come
// back to this tab the list refreshes, and a service that wasn't there before
// is marked New and picked for them (they almost certainly made it for this).
export default function ServicePicker({ selectedId = null, onUse, onBack }) {
  const [services, setServices] = useState(() => getServices());
  const [picked, setPicked] = useState(selectedId);
  const [query, setQuery] = useState('');
  const [newIds, setNewIds] = useState([]); // created since this screen opened

  // Every service we've shown, so we can tell which ones are new
  const seen = useRef(new Set(services.map((s) => s.id)));
  const listRef = useRef(null);

  const refresh = useCallback(() => {
    const latest = getServices();
    const added = latest.filter((s) => !seen.current.has(s.id));
    added.forEach((s) => seen.current.add(s.id));
    setServices(latest);
    if (added.length > 0) {
      setNewIds((ids) => [...ids, ...added.map((s) => s.id)]);
      setPicked(added[0].id); // newest first, so this is the one they just made
      setQuery(''); // a search could hide it
      listRef.current?.scrollTo?.({ top: 0 }); // new ones are at the top
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
  const changing = selectedId !== null;
  const hasServices = services.length > 0;

  const use = () => {
    if (picked) onUse?.(picked);
  };

  return (
    <div className="service-picker">
      <button type="button" className="flow__back flow__back--top" onClick={onBack}>
        <ArrowLeft size={16} /> Overview
      </button>

      <h1 className="service-picker__title">
        {changing ? 'Change your service' : 'Pick your service'}
      </h1>

      {!hasServices ? (
        <div className="service-picker__none">
          <h2 className="service-picker__none-title">You don't have any services yet</h2>
          <p className="service-picker__none-text">
            A service is the page people sign up on, and pay on if it's paid. Create one, then
            come back here to pick it.
          </p>
          <a className="flow__next service-picker__none-create" href={CREATE_SERVICE_URL} target="_blank" rel="noopener">
            Create your first service <ExternalLink size={16} aria-hidden="true" />
          </a>
          <button type="button" className="service-picker__refresh" onClick={refresh}>
            <RotateCw size={14} aria-hidden="true" /> I've made one, refresh
          </button>
        </div>
      ) : (
        <>
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
            <span className="service-picker__tools-text">Don't see it?</span>
            <a className="service-picker__create" href={CREATE_SERVICE_URL} target="_blank" rel="noopener">
              Create a new service <ExternalLink size={14} aria-hidden="true" />
            </a>
            <button type="button" className="service-picker__refresh" onClick={refresh}>
              <RotateCw size={14} aria-hidden="true" /> Refresh
            </button>
          </div>

          {shown.length === 0 ? (
            <p className="service-picker__empty">No services match "{query.trim()}".</p>
          ) : (
            <div className="service-picker__list" ref={listRef} role="radiogroup" aria-label="Your services">
              {shown.map((s) => {
                const isPicked = s.id === picked;
                const isNew = newIds.includes(s.id);
                const price = servicePrice(s);
                return (
                  <label
                    key={s.id}
                    className={`service-picker__row ${isPicked ? 'service-picker__row--picked' : ''} ${isNew ? 'service-picker__row--new' : ''}`}
                  >
                    <input
                      type="radio"
                      name="service"
                      className="service-picker__radio"
                      value={s.id}
                      checked={isPicked}
                      onChange={() => setPicked(s.id)}
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
        </>
      )}

      {hasServices && (
        <div className="service-picker__actions">
          <button type="button" className="flow__next" onClick={use} aria-disabled={!picked}>
            Use this service
          </button>
          {!picked && <span className="service-picker__hint">Pick a service first</span>}
        </div>
      )}

      {/* Tells screen readers when a new service has been added and picked */}
      <p className="service-picker__sr" aria-live="polite">
        {newIds.length > 0 ? 'Your new service has been added and selected.' : ''}
      </p>
    </div>
  );
}