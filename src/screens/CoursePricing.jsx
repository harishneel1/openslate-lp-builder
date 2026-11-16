import { useState } from 'react';
import { AlertTriangle, ExternalLink, IndianRupee } from 'lucide-react';
import { buyContractOf, descriptionText } from '../data/courses';
import { contractEditUrl, contractOf, createContract, servicePrice, updateContract } from '../data/mockServices';
import { formatMoney } from '../data/contractPricing';
import { PriceWithDiscount } from '../components/CallDetailsInput';
import '../components/QuestionInput.css'; // the price boxes and "On your page" (qinput__*)

// ------------------------------------------------------------
// A course's Pricing step (CoursePage.jsx): what it costs.
//
//   Price
//   ┌──────────────────────────────────────────────────────────┐
//   │ ₹  ₹2,499  ₹4,999  50% off · one-time      [Change price] │
//   │    Sold through its contract on your Contracts page ↗     │
//   └──────────────────────────────────────────────────────────┘
//
//   (or, with no price yet, or on Change price)
//   (●) Paid  One payment, then it's theirs   ( ) Free
//   Price            ☐ Discounted price
//   [₹ 4999     ]    [₹          ]
//   ON YOUR PAGE  ₹4,999 crossed out  ₹2,499  50% off
//                                              [Cancel] [Set price]
//
// Price: setting one makes a contract for the course, named after it and
// with its description (createContract in mockServices.js), links it, and
// makes it the one the Buy button sells (buyContractId, buyContractMade in
// courses.js). It shows on the Contracts page like any other; the card's
// second line opens it there (other currencies, GST, checkout questions).
// Changing the price here changes that contract. The course's title stays
// its name (syncContractTitle), and its description the contract's
// description, as plain text (syncContractDescription).
// Paid is one payment in rupees, a whole number from ₹1 to ₹9,99,999,
// with an optional discounted price: the same two boxes as a 1:1 call's
// and a webinar's price (PriceWithDiscount in CallDetailsInput.jsx). The
// discount is saved on the contract the way the contract screen saves it
// (the price, and the discounted price people pay: contractPricing.js),
// so the landing page and checkout show the price crossed out.
// Free: people only sign up. A price changed here keeps any other
// currencies the contract has as they are.
//
// A course that had contracts before prices came in may sell through one
// of those instead (buyContractMade false). The card names it, and links
// to it, since its price is changed there; Change sets a price here, which
// makes the course's own contract (the old one stays linked, so everyone
// on it keeps the course). Linking more contracts isn't offered here any
// more; links made before still give access.
// If the Buy button's contract is deleted, this says so, and asks for a
// price again (publishing needs one).
//
// course; onSave(change) → true if the course saved; onSaved(ok): after a
//   change to the contract alone, so the page can say "Saved"
// syncContractTitle(course, title), syncContractDescription(course, html):
//   keep the course's own contract in step with it
// priceOf(contract) → { now, was, off, free }: how a contract's price
//   reads ("₹2,499", "₹4,999" crossed out or null, 50 (% off) or 0)
// ------------------------------------------------------------

export const PRICE_MAX = 999999;

const isFree = (c) => c.type === 'free' || !(Number(c.price) > 0);
// The rupee price on a contract: { price, discount }
const rupeesOf = (c) => contractOf(c).prices.find((p) => p.currency === 'INR') ?? { price: c.price ?? 0, discount: null };

export function priceOf(contract) {
  if (!contract || isFree(contract)) return { now: 'Free', was: null, off: 0, free: true };
  const main = contractOf(contract).prices[0];
  const sale = main?.discount != null && main.discount > 0 && main.discount < main.price;
  return {
    now: servicePrice(contract),
    was: sale ? formatMoney(main.price, main.currency) : null,
    off: sale ? Math.round((1 - main.discount / main.price) * 100) : 0,
    free: false,
  };
}

// What the contract saves for a price: one in rupees first (with its
// discounted price, if any), any other currencies it already had kept after it
function priceFields(existing, { free, amount, was }) {
  if (free) return { type: 'free', prices: [] };
  const others = existing ? contractOf(existing).prices.filter((p) => p.currency !== 'INR') : [];
  const inr = was ? { currency: 'INR', price: was, discount: amount } : { currency: 'INR', price: amount, discount: null };
  return { type: 'onetime', prices: [inr, ...others] };
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

export default function CoursePricing({ course, onSave, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [, setTick] = useState(0); // the contract changed, not the course: read it again
  const buy = buyContractOf(course);
  const lost = Boolean(course.buyContractId) && !buy;
  const own = Boolean(buy && course.buyContractMade);
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

  // The form starts from what's set: the price, and the discounted price
  const start = () => {
    if (!own) return { free: false, amount: '', was: '' };
    if (isFree(buy)) return { free: true, amount: '', was: '' };
    const { price, discount } = rupeesOf(buy);
    return discount > 0 ? { free: false, amount: discount, was: price } : { free: false, amount: price, was: '' };
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
            again.
          </p>
        )}

        {buy && !editing && <PriceCard contract={buy} own={own} onChange={() => setEditing(true)} />}

        {showForm && (
          <PriceForm
            key={buy?.id ?? 'new'}
            initial={start()}
            submitLabel={own ? 'Save price' : 'Set price'}
            note={
              buy && !own
                ? `Setting a price here makes a contract for this course. “${buy.title}” stays linked, so everyone on it keeps the course.`
                : null
            }
            onSubmit={submitPrice}
            onCancel={buy ? () => setEditing(false) : null}
          />
        )}
      </section>
    </div>
  );
}

// The price as it is, in two lines: what it costs (the full price crossed
// out when there's a discount), and where it's sold, linking there
function PriceCard({ contract, own, onChange }) {
  const { now, was, off, free } = priceOf(contract);
  return (
    <div className="prc__card">
      <span className="prc__icon" aria-hidden="true">
        <IndianRupee size={20} />
      </span>
      <div className="prc__text">
        <p className="prc__amount">
          {now}
          {was && (
            <>
              <span className="sr-only">, was </span>
              <s className="prc__was">{was}</s>
              <span className="prc__off">{off}% off</span>
            </>
          )}
          {!free && contract.type !== 'subscription' && <span className="prc__type"> · one-time</span>}
        </p>
        <a className="prc__where" href={contractEditUrl(contract.id)} target="_blank" rel="noopener">
          {own ? (
            'Sold through its contract on your Contracts page'
          ) : (
            <>
              Sold through your contract <strong>{contract.title}</strong>
            </>
          )}
          <ExternalLink size={13} aria-hidden="true" />
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </div>
      <button type="button" className="crs-btn crs-btn--quiet crs-btn--small" onClick={onChange}>
        {own ? 'Change price' : 'Change'}
      </button>
    </div>
  );
}

// Paid or Free; for Paid, the price and an optional discounted price
function PriceForm({ initial, submitLabel, note, onSubmit, onCancel }) {
  const [free, setFree] = useState(initial.free);
  // PriceWithDiscount's answers: price is what people pay; oldPrice, the
  // full price crossed out (empty without a discount)
  const [answers, setAnswers] = useState({
    price: initial.amount ? String(initial.amount) : '',
    oldPrice: initial.was ? String(initial.was) : '',
  });
  const [tried, setTried] = useState(false);
  const pay = Number(answers.price) || 0;
  const was = Number(answers.oldPrice) || 0;
  let problem = null;
  if (!free) {
    if (was > 0 && pay === 0) problem = 'Add the discounted price, or untick it.';
    else if (pay === 0) problem = 'Enter a price of ₹1 or more.';
    else if (was > 0 && pay >= was) problem = 'The discounted price needs to be lower than the price.';
  }

  const submit = (e) => {
    e.preventDefault();
    setTried(true);
    if (problem) return;
    onSubmit({
      free,
      amount: free ? 0 : Math.min(PRICE_MAX, pay),
      was: !free && was > pay ? Math.min(PRICE_MAX, was) : null,
    });
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
        <div className="prc__prices">
          <PriceWithDiscount
            answers={answers}
            onChange={(value, id) => setAnswers((a) => ({ ...a, [id]: value }))}
            ids={{ price: 'price', compare: 'oldPrice' }}
            label="Price"
            example="4999"
          />
        </div>
      )}

      {/* The discount's own problems show under its box (PriceWithDiscount) */}
      {tried && problem && pay === 0 && was === 0 && (
        <p className="lp__error" role="alert">
          {problem}
        </p>
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