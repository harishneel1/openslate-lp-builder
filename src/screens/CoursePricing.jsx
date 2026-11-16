import { useState } from 'react';
import { AlertTriangle, IndianRupee, Plus } from 'lucide-react';
import { buyContractOf, descriptionText } from '../data/courses';
import { contractOf, createContract, servicePrice, updateContract } from '../data/mockServices';
import { CourseAccess } from './CourseSettings';

// ------------------------------------------------------------
// A course's Pricing step (CoursePage.jsx): what it costs, and who else
// gets it.
//
//   Price
//   ┌──────────────────────────────────────────────────────────┐
//   │ ₹  ₹4,999 one-time payment                [Change price] │
//   │    Sold through its own contract, “Healthy cooking”…     │
//   └──────────────────────────────────────────────────────────┘
//
//   (or, with no price yet, or on Change price)
//   (●) Paid  One payment, then it's theirs   ( ) Free
//   Price  [₹ 4999        ]
//                                              [Cancel] [Set price]
//   Or sell it through a contract that's already linked
//   [Vasthu webinar · ₹99            ⌄] [Use this contract]
//
//   + Also give it through another contract (a webinar, a 1:1 package…)
//   (or, once there are some)
//   Also given through                                [Link contracts]
//   ▣ Monthly Vasthu Circle   ₹299/month · 27 sign-ups   [Remove]
//
// Price: setting one makes a contract for the course, named after it and
// with its description (createContract in mockServices.js), links it, and
// makes it the one the Buy button sells (buyContractId, buyContractMade in
// courses.js). It shows on the Contracts page like any other. Changing
// the price here changes that contract. The course's title stays its name
// (syncContractTitle, when the title changes), and its description stays
// the contract's description, as plain text (syncContractDescription,
// when the description changes; descriptionText in courses.js).
// Paid is one payment in rupees, a whole number from ₹1 to ₹9,99,999.
// Free: people only sign up. Prices in other currencies, GST, discounts
// and the checkout questions are set on the contract, on the Contracts
// page; a price changed here keeps the other currencies as they are.
//
// Or, instead, one of the linked contracts can be what the Buy button
// sells (a course that had contracts before prices came in, say). Its
// price is then changed wherever that contract is managed, so here it
// only says which one it is, with Change. Its title and description are
// its own: the course never changes them. Setting a price here later
// makes the course's own contract; the old one stays linked, so everyone
// on it keeps the course.
// If the Buy button's contract is deleted, this says so, and asks for a
// price again (publishing needs one).
//
// Also give access through other contracts: the linked contracts other
// than the Buy button's (the old Access tab): a webinar, a 1:1 package,
// a bundle. Link contracts and Remove work as before (CoursePage.jsx).
//
// course, contracts (linked, still existing), counts (sign-ups per contract)
// onSave(change) → true if the course saved; onSaved(ok): after a change
//   to the contract alone, so the page can say "Saved"
// onLink(): open Link contracts; onUnlink(contractId)
// syncContractTitle(course, title): keeps the course's own contract named
//   after it
// syncContractDescription(course, html): keeps the course's own
//   contract's description the course's, as plain text
// ------------------------------------------------------------

export const PRICE_MAX = 999999;

const isFree = (c) => c.type === 'free' || !(Number(c.price) > 0);
// The rupee price on a contract, for the form
const rupeesOf = (c) => contractOf(c).prices.find((p) => p.currency === 'INR')?.price ?? c.price ?? 0;

// What the contract saves for a price: one in rupees first, any other
// currencies it already had kept after it
function priceFields(existing, { free, amount }) {
  if (free) return { type: 'free', prices: [] };
  const others = existing ? contractOf(existing).prices.filter((p) => p.currency !== 'INR') : [];
  return { type: 'onetime', prices: [{ currency: 'INR', price: amount, discount: null }, ...others] };
}

export function syncContractTitle(course, title) {
  if (!course?.buyContractMade) return;
  const contract = buyContractOf(course);
  if (contract && contract.title !== title) updateContract(contract.id, { ...contractOf(contract), title });
}

export function syncContractDescription(course, html) {
  if (!course?.buyContractMade) return;
  const contract = buyContractOf(course);
  const description = descriptionText(html);
  if (contract && contractOf(contract).description !== description) {
    updateContract(contract.id, { ...contractOf(contract), description });
  }
}

export default function CoursePricing({ course, contracts, counts, onSave, onSaved, onLink, onUnlink }) {
  const [editing, setEditing] = useState(false);
  const [, setTick] = useState(0); // the contract changed, not the course: read it again
  const buy = buyContractOf(course);
  const lost = Boolean(course.buyContractId) && !buy;
  const own = Boolean(buy && course.buyContractMade);
  const others = contracts.filter((c) => c.id !== buy?.id);
  const showForm = editing || !buy;
  // The course's description, as its contract keeps it
  const description = descriptionText(course.description);

  const submitPrice = (value) => {
    if (own) {
      const current = contractOf(buy);
      const ok = updateContract(buy.id, {
        ...current,
        title: course.title,
        description: description || current.description,
        ...priceFields(buy, value),
      });
      onSaved(ok);
      if (ok) {
        setEditing(false);
        setTick((n) => n + 1);
      }
      return;
    }
    const made = createContract({ title: course.title, description, ...priceFields(null, value) });
    if (!made) {
      onSaved(false);
      return;
    }
    const ok = onSave({
      buyContractId: made.id,
      buyContractMade: true,
      contractIds: [made.id, ...(course.contractIds ?? []).filter((id) => id !== made.id)],
    });
    if (ok) setEditing(false);
  };

  const useExisting = (id) => {
    if (onSave({ buyContractId: id, buyContractMade: false })) setEditing(false);
  };

  return (
    <div className="prc">
      <section className="lnd__part" aria-labelledby="prc-price" data-guide="price">
        <h3 className="lrn__title" id="prc-price">
          Price
        </h3>
        <p className="lrn__help">What the Buy button on its landing page charges.</p>

        {lost && (
          <p className="lp__problem" role="alert">
            <AlertTriangle size={16} aria-hidden="true" /> The contract the Buy button sold was deleted. Set a price
            again, or pick another contract.
          </p>
        )}

        {buy && !editing && (
          <div className="prc__card">
            <span className="prc__icon" aria-hidden="true">
              <IndianRupee size={20} />
            </span>
            <div className="prc__text">
              <p className="prc__amount">
                {servicePrice(buy)}
                {!isFree(buy) && buy.type !== 'subscription' && <span className="prc__type"> one-time payment</span>}
              </p>
              <p className="prc__meta">
                {own ? (
                  <>
                    Sold through its own contract, <strong>{buy.title}</strong>, which shows on your Contracts page too,
                    with the course’s description. Other currencies, GST and checkout questions are set there.
                  </>
                ) : (
                  <>
                    Sold through your contract <strong>{buy.title}</strong>. Its price is changed wherever that contract is
                    managed.
                  </>
                )}
              </p>
            </div>
            <button type="button" className="crs-btn crs-btn--quiet crs-btn--small" onClick={() => setEditing(true)}>
              {own ? 'Change price' : 'Change'}
            </button>
          </div>
        )}

        {showForm && (
          <>
            <PriceForm
              key={buy?.id ?? 'new'}
              initial={own ? { free: isFree(buy), amount: rupeesOf(buy) } : { free: false, amount: '' }}
              submitLabel={own ? 'Save price' : 'Set price'}
              note={
                buy && !own
                  ? `Setting a price here makes a contract for this course. “${buy.title}” stays linked, so everyone on it keeps the course.`
                  : null
              }
              onSubmit={submitPrice}
              onCancel={buy ? () => setEditing(false) : null}
            />
            {others.length > 0 && <UseExisting contracts={others} onUse={useExisting} />}
          </>
        )}
      </section>

      {/* Other contracts: only a quiet link until there are some */}
      {others.length > 0 ? (
        <div className="lnd__part">
          <CourseAccess
            contracts={others}
            counts={counts}
            onLink={onLink}
            onUnlink={onUnlink}
            title="Also given through"
            sub="People who sign up on any of these get the course too, without buying it here."
          />
        </div>
      ) : (
        <div className="lnd__extras">
          <button type="button" className="lnd__extra" onClick={onLink}>
            <Plus size={16} aria-hidden="true" />
            Also give it through another contract (a webinar, a 1:1 package…)
          </button>
        </div>
      )}
    </div>
  );
}

// Paid or Free, and the price in rupees
function PriceForm({ initial, submitLabel, note, onSubmit, onCancel }) {
  const [free, setFree] = useState(initial.free);
  const [amount, setAmount] = useState(initial.amount ? String(initial.amount) : '');
  const [tried, setTried] = useState(false);
  const n = Number(amount);
  const problem = !free && !(n >= 1) ? 'Enter a price of ₹1 or more' : null;

  const submit = (e) => {
    e.preventDefault();
    setTried(true);
    if (problem) return;
    onSubmit({ free, amount: free ? 0 : Math.min(PRICE_MAX, Math.round(n)) });
  };

  return (
    <form className="prc__form" onSubmit={submit} noValidate>
      <fieldset className="prc__kinds">
        <legend className="sr-only">How people get it</legend>
        <label className={`prc__kind ${!free ? 'prc__kind--on' : ''}`}>
          <input type="radio" name="prc-kind" checked={!free} onChange={() => setFree(false)} />
          <span className="prc__kind-text">
            <span className="prc__kind-title">Paid</span>
            <span className="prc__kind-sub">One payment, then it’s theirs</span>
          </span>
        </label>
        <label className={`prc__kind ${free ? 'prc__kind--on' : ''}`}>
          <input type="radio" name="prc-kind" checked={free} onChange={() => setFree(true)} />
          <span className="prc__kind-text">
            <span className="prc__kind-title">Free</span>
            <span className="prc__kind-sub">They sign up with their details</span>
          </span>
        </label>
      </fieldset>

      {!free && (
        <div className="crs-field prc__field">
          <label className="crs-field__label" htmlFor="prc-amount">
            Price
          </label>
          <span className={`prc__money ${tried && problem ? 'prc__money--error' : ''}`}>
            <span className="prc__symbol" aria-hidden="true">
              ₹
            </span>
            <input
              id="prc-amount"
              className="prc__input"
              inputMode="numeric"
              value={amount}
              placeholder="4999"
              autoComplete="off"
              aria-invalid={Boolean(tried && problem) || undefined}
              aria-describedby={tried && problem ? 'prc-amount-error' : undefined}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
          </span>
          {tried && problem && (
            <p className="lp__error" id="prc-amount-error" role="alert">
              {problem}
            </p>
          )}
        </div>
      )}

      {note && <p className="prc__note">{note}</p>}

      <div className="prc__actions">
        {onCancel && (
          <button type="button" className="crs-btn crs-btn--quiet crs-btn--small" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className="crs-btn crs-btn--primary crs-btn--small">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

// One of the linked contracts as the Buy button's, instead of a price here
function UseExisting({ contracts, onUse }) {
  const [picked, setPicked] = useState(contracts[0].id);
  const id = contracts.some((c) => c.id === picked) ? picked : contracts[0].id;
  return (
    <div className="prc__existing">
      <p className="prc__existing-title">Or sell it through a contract that’s already linked</p>
      <p className="lrn__help">The Buy button goes to that contract’s checkout, at its price.</p>
      <div className="prc__existing-row">
        <select className="crs-input prc__select" value={id} aria-label="Linked contract" onChange={(e) => setPicked(e.target.value)}>
          {contracts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title} · {servicePrice(c)}
            </option>
          ))}
        </select>
        <button type="button" className="crs-btn crs-btn--quiet crs-btn--small" onClick={() => onUse(id)}>
          Use this contract
        </button>
      </div>
    </div>
  );
}