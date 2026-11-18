import { useMemo, useRef, useEffect, useState } from 'react';
import { ExternalLink, FileText, Plus, Search } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import { extraContractsOf, includeWith, stopIncludingWith } from '../data/courses';
import { CREATE_SERVICE_URL, getAllServices } from '../data/mockServices';
import { livePageOf } from '../data/contractCheckout';
import { ownerOf } from '../data/tiedProducts';
import { holderCount } from '../data/courseAccess';
import './CourseAlsoIncluded.css';

// ------------------------------------------------------------
// "Give access to people from other contracts", on a course's Price &
// access tab (CoursePricing.jsx), once it's been published: the other
// contracts that give this course (courses.js calls them the ones it's
// "also included with"). Everyone on them can open the course too, but they
// aren't on the course's Students tab: they're on those contracts.
//
//   Give access to people from other contracts         [+ Add contract]
//   People from these 2 contracts can also watch this course.
//                            (with none yet: "Pick a contract. Its people
//                            can also watch this course.")
//   They aren't listed on the Students tab, which is only for buyers.
//   (▣) Vasthu for Wealth           Webinar · 42 people    [Open ↗] [Remove]
//   (▣) Career clarity call         1:1 call · 18 people   [Open ↗] [Remove]
//
// No prices: only what the contract is (a webinar's, a 1:1 call's, a
// batch's, or a plain contract), and how many people hold it now
// (courseAccess.js: cancelled bookings, removed people and refunds don't
// count, since they don't get the course).
// + Add: a pop-up of every other contract, with a search box and a tick on
// each, to add several at once. The course's own contract and the ones
// already here aren't in it.
// Remove asks first when anyone holds the contract ("Its 42 people will
// lose this course"); nobody is refunded. With nobody on it, it goes at once.
// Open ↗: the contract's live page (the one people sign up on: a webinar's
// sign-up page, a call's checkout, its own checkout), in a new tab.
//
// course; onSaved(ok): so the page's save status says Saved, or Couldn't save
// ------------------------------------------------------------

const KIND_WORDS = { webinar: 'Webinar', call: '1:1 call', batch: 'Batch' };
const people = (n) => (n === 0 ? 'No one yet' : `${n.toLocaleString('en-IN')} ${n === 1 ? 'person' : 'people'}`);
// 'Webinar · 42 people', or '42 people' for a plain contract
const metaOf = (contract) => {
  const kind = KIND_WORDS[ownerOf(contract)?.kind];
  return [kind, people(holderCount(contract))].filter(Boolean).join(' · ');
};

export default function CourseAlsoIncluded({ course, onSaved }) {
  const included = extraContractsOf(course);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(null); // { contract, count }

  const remove = (contract) => {
    const count = holderCount(contract);
    if (count > 0) setRemoving({ contract, count });
    else onSaved(Boolean(stopIncludingWith(course.id, contract.id)));
  };

  return (
    <section className="lnd__part inc" aria-labelledby="inc-title">
      <div className="inc__head">
        <h3 className="lrn__title" id="inc-title">
          Give access to people from other contracts
        </h3>
        <button type="button" className="crs-btn crs-btn--quiet crs-btn--small" onClick={() => setAdding(true)}>
          <Plus size={16} aria-hidden="true" /> Add contract
        </button>
      </div>
      <p className="lrn__help inc__note">
        {included.length === 0
          ? 'Pick a contract. Its people can also watch this course.'
          : included.length === 1
            ? 'People from this contract can also watch this course.'
            : `People from these ${included.length} contracts can also watch this course.`}
      </p>

      {included.length > 0 && (
        <ul className="inc__list">
          {included.map((c) => (
            <li key={c.id} className="inc__row">
              <span className="inc__icon" aria-hidden="true">
                <FileText size={18} />
              </span>
              <div className="inc__text">
                <p className="inc__name">{c.title}</p>
                <p className="inc__meta">{metaOf(c)}</p>
              </div>
              <div className="inc__actions">
                <a className="crs-btn crs-btn--quiet crs-btn--small" href={livePageOf(c).view} target="_blank" rel="noopener">
                  Open
                  <ExternalLink size={14} aria-hidden="true" />
                  <span className="sr-only"> {c.title} (opens in a new tab)</span>
                </a>
                <button type="button" className="crs-btn crs-btn--quiet crs-btn--small inc__remove" onClick={() => remove(c)}>
                  Remove
                  <span className="sr-only"> {c.title}</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}


      {adding && (
        <AddDialog
          course={course}
          onCancel={() => setAdding(false)}
          onAdd={(ids) => {
            setAdding(false);
            onSaved(Boolean(includeWith(course.id, ids)));
          }}
        />
      )}

      {removing && (
        <ConfirmDialog
          title={`Remove ${removing.contract.title}?`}
          confirmLabel="Remove"
          cancelLabel="Keep it"
          danger
          stayOpen
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            const { contract } = removing;
            setRemoving(null);
            onSaved(Boolean(stopIncludingWith(course.id, contract.id)));
          }}
        >
          <p>
            {removing.count === 1 ? 'Its 1 person' : `Its ${removing.count.toLocaleString('en-IN')} people`} will lose this
            course. Nobody is refunded.
          </p>
        </ConfirmDialog>
      )}
    </section>
  );
}

// ---------- + Add: pick contracts ----------
// Every contract except the course's own and the ones already here, newest
// first (as on the Contracts page), with a search box and a tick on each.
function AddDialog({ course, onCancel, onAdd }) {
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState([]);
  const search = useRef(null);
  useEffect(() => {
    const id = requestAnimationFrame(() => search.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  // Read once, when it opens: names, kinds and people don't change underneath it
  const choices = useMemo(() => {
    const taken = new Set([course.buyContractId, ...(course.contractIds ?? [])]);
    return getAllServices()
      .filter((c) => !taken.has(c.id))
      .map((c) => ({ contract: c, meta: metaOf(c) }));
  }, [course]);

  const words = query.trim().toLowerCase();
  const shown = words ? choices.filter(({ contract }) => contract.title.toLowerCase().includes(words)) : choices;
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <ConfirmDialog
      title="Give access to people from these contracts"
      confirmLabel={picked.length > 1 ? `Add ${picked.length} contracts` : 'Add'}
      confirmDisabled={picked.length === 0}
      closeButton
      stayOpen
      onCancel={onCancel}
      onConfirm={() => picked.length > 0 && onAdd(picked)}
    >
      {choices.length === 0 ? (
        <p className="inc-pick__empty">
          You don’t have any other contracts yet.{' '}
          <a className="inc-pick__make" href={CREATE_SERVICE_URL} target="_blank" rel="noopener">
            Make one on the Contracts page
            <ExternalLink size={13} aria-hidden="true" />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </p>
      ) : (
        <div className="inc-pick">
          <p className="inc-pick__intro">Everyone on the contracts you tick can open this course too.</p>
          <label className="inc-pick__search">
            <Search size={16} aria-hidden="true" />
            <span className="sr-only">Search contracts</span>
            <input
              ref={search}
              type="search"
              value={query}
              placeholder="Search contracts"
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          {shown.length === 0 ? (
            <p className="inc-pick__none">No contracts match “{query.trim()}”.</p>
          ) : (
            <ul className="inc-pick__list">
              {shown.map(({ contract: c, meta }) => (
                <li key={c.id}>
                  <label className={`inc-pick__item ${picked.includes(c.id) ? 'inc-pick__item--on' : ''}`}>
                    <input type="checkbox" checked={picked.includes(c.id)} onChange={() => toggle(c.id)} />
                    <span className="inc-pick__text">
                      <span className="inc-pick__name">{c.title}</span>
                      <span className="inc-pick__meta">{meta}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </ConfirmDialog>
  );
}