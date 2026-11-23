import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ExternalLink, Search, X } from 'lucide-react';
import { CREATE_SERVICE_URL, getAllServices, servicePrice } from '../data/mockServices';
import { signupCounts } from '../data/contractSignups';
import './ContractPicker.css';

// ------------------------------------------------------------
// Picking the contracts that give access to a course. One plain list of
// every contract, the same as the Contracts page (newest first), with a
// search box. Tick as many as you like.
//
//   [AI Engineering Accelerator ✕] [Vasthu webinar · 7 Nov ✕]
//   [ Choose contracts                                    ⌄ ]
//   ┌──────────────────────────────────────────────────────┐
//   │ 🔍 Search contracts                                   │
//   │ ☑ AI Engineering Accelerator      ₹2,500 · 12 sign-ups │
//   │ ☐ Career clarity call             ₹1,500 · 24 sign-ups │
//   │ + Create a new contract ↗                              │
//   └──────────────────────────────────────────────────────┘
//
// The list opens in place, under the button (pushing what's below down),
// so it's never cut off inside a pop-up. A click anywhere outside the
// picker, or Escape, closes it (the ticks stay). It reads the contracts again when
// the window gets focus, so one made in another tab ("Create a new
// contract") shows straight away.
//
// value: the ticked contract ids, in the order ticked
// onChange(ids)
// startOpen: open the list straight away (the course page's Link contracts)
// ------------------------------------------------------------

function useContracts() {
  const [list, setList] = useState(getAllServices);
  useEffect(() => {
    const refresh = () => setList(getAllServices());
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);
  return list;
}

const plural = (n, word) => `${n.toLocaleString('en-IN')} ${word}${n === 1 ? '' : 's'}`;

export default function ContractPicker({ value, onChange, startOpen = false }) {
  const contracts = useContracts();
  const counts = useMemo(() => signupCounts(contracts), [contracts]);
  const [open, setOpen] = useState(startOpen);
  const [query, setQuery] = useState('');
  const search = useRef(null);
  const listId = useRef(`cpk-${Math.random().toString(36).slice(2)}`).current;
  const wrap = useRef(null);
  const toggleRef = useRef(null);

  useEffect(() => {
    if (open) search.current?.focus();
  }, [open]);

  // While open: a click outside closes it; Escape closes it and puts the
  // keyboard back on the button (the search box handles its own Escape first)
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (wrap.current && !wrap.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      setOpen(false);
      toggleRef.current?.focus();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const byId = useMemo(() => new Map(contracts.map((c) => [c.id, c])), [contracts]);
  const picked = value.map((id) => byId.get(id)).filter(Boolean); // deleted ones drop out
  const shown = useMemo(() => {
    const words = query.trim().toLowerCase();
    return words ? contracts.filter((c) => c.title.toLowerCase().includes(words)) : contracts;
  }, [contracts, query]);

  const toggle = (id) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  const meta = (c) => {
    const n = counts[c.id] ?? 0;
    return `${servicePrice(c)} · ${n === 0 ? 'No sign-ups yet' : plural(n, 'sign-up')}`;
  };

  return (
    <div className="cpk" ref={wrap}>
      {picked.length > 0 && (
        <ul className="cpk__chips" aria-label="Linked contracts">
          {picked.map((c) => (
            <li key={c.id} className="cpk__chip">
              <span className="cpk__chip-text">{c.title}</span>
              <button type="button" className="cpk__chip-x" onClick={() => toggle(c.id)} aria-label={`Unlink ${c.title}`}>
                <X size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        ref={toggleRef}
        type="button"
        className={`cpk__toggle ${open ? 'cpk__toggle--open' : ''}`}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
      >
        <span>{picked.length > 0 ? 'Link more contracts' : 'Choose contracts'}</span>
        <ChevronDown size={18} aria-hidden="true" className="cpk__chevron" />
      </button>

      {open && (
        <div className="cpk__panel" id={listId}>
          {contracts.length > 0 && (
            <label className="cpk__search">
              <Search size={16} aria-hidden="true" />
              <span className="sr-only">Search contracts</span>
              <input
                ref={search}
                type="search"
                value={query}
                placeholder="Search contracts"
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  // Escape clears the search first, then closes the list
                  if (e.key !== 'Escape') return;
                  e.preventDefault();
                  e.stopPropagation();
                  if (query) setQuery('');
                  else setOpen(false);
                }}
              />
            </label>
          )}

          {contracts.length === 0 ? (
            <p className="cpk__none">You don’t have any contracts yet. Make one, then come back to link it.</p>
          ) : shown.length === 0 ? (
            <p className="cpk__none">No contracts match “{query.trim()}”.</p>
          ) : (
            <ul className="cpk__list" role="group" aria-label="Contracts">
              {shown.map((c) => {
                const on = value.includes(c.id);
                return (
                  <li key={c.id}>
                    <label className={`cpk__option ${on ? 'cpk__option--on' : ''}`}>
                      <input type="checkbox" checked={on} onChange={() => toggle(c.id)} />
                      <span className="cpk__option-text">
                        <span className="cpk__option-title">{c.title}</span>
                        <span className="cpk__option-meta">{meta(c)}</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}

          <a className="cpk__create" href={CREATE_SERVICE_URL} target="_blank" rel="noopener">
            Create a new contract
            <ExternalLink size={14} aria-hidden="true" />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>
      )}
    </div>
  );
}