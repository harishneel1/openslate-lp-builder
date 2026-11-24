import { useState } from 'react';
import { AlertTriangle, ExternalLink, IndianRupee, Info } from 'lucide-react';
import { buyContractOf, descriptionText } from '../data/courses';
import { contractEditUrl, contractOf, createContract, servicePrice, updateContract } from '../data/mockServices';
import { formatMoney } from '../data/contractPricing';
import { livePageOf } from '../data/contractCheckout';
import { PriceWithDiscount } from '../components/CallDetailsInput';
import CourseAlsoIncluded from './CourseAlsoIncluded';
import '../components/QuestionInput.css'; // the price boxes and "On your page" (qinput__*)

// ------------------------------------------------------------
// A course's Price & access tab (Pricing while setting it up,
// CoursePage.jsx): what it costs, and, once it's been published, the
// other contracts it comes with.
//
//   Price
//   People pay this to buy the course.
//   ┌──────────────────────────────────────────────────────────┐
//   │ ₹  ₹2,499  ₹4,999  50% off  [Open contract ↗] [Change price] │
//   └──────────────────────────────────────────────────────────┘
//
//   Give access to people from other contracts         [+ Add contract]
//   1 contract gives access to this course. Their people aren't on your
//   Students tab.
//   (▣) Vasthu for Wealth         Webinar · 42 people   [Open ↗] [Remove]
//
//   (or, with no price yet, or on Change price)
//   (●) Paid  One payment, then it's theirs   ( ) Free
//   Price            ☐ Discounted price
//   [₹ 4999     ]    [₹          ]
//   ON YOUR PAGE  ₹4,999 crossed out  ₹2,499  50% off
//                                              [Cancel] [Set price]
//
// A quiet grey line under the price says where it lives (ContractLine):
//   no price yet      ⓘ Setting a price creates a contract for this course,
//                       named after it. Its description comes from your
//                       landing page.
//   price set         ⓘ This price is on a contract made for this course,
//                       named after it. Its description comes from your
//                       landing page.
//   changing it       ⓘ This changes the price on your course's contract.
// (A course sold through an older contract has its own note instead.)
//
// Price: setting one makes a contract for the course, named after it and
// with its description (createContract in mockServices.js), links it, and
// makes it the one the Buy button sells (buyContractId, buyContractMade in
// courses.js). It shows on the Contracts page like any other (other
// currencies, GST, checkout questions are set there); the card doesn't
// link to it, to keep it to the price.
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
// Give access to people from other contracts (CourseAlsoIncluded.jsx): only once it's been
// published (showAccess), so setting a course up stays one simple step.
//
// A course that had contracts before prices came in may sell through one
// of those instead (buyContractMade false). Only then the card names it,
// and links to it, since its price is changed there; Change sets a price here, which
// makes the course's own contract. The old one stays as one that gives
// access (Give access to people from other contracts), so everyone on it
// keeps the course.
// If the Buy button's contract is deleted, this says so, and asks for a
// price again (publishing needs one).
//
// course; onSave(change) → true if the course saved; onSaved(ok): after a
//   change to the contract alone, so the page can say "Saved"
// error: what the price still needs, after Publish was pressed without one
//   (CoursePage.jsx): in red under the form, with a red border on the price
// showAccess: show Give access to people from other contracts (editing a published course)
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

export default function CoursePricing({ course, onSave, onSaved, showAccess = false, error = null }) {
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
        <p className="lrn__help">People pay this to buy the course.</p>

        {lost && (
          <p className="lp__problem" role="alert">
            <AlertTriangle size={16} aria-hidden="true" /> The contract the Buy button sold was deleted. Set a price
            again.
          </p>
        )}

        {buy && !editing && <PriceCard contract={buy} own={own} onChange={() => setEditing(true)} />}
        {buy && !editing && own && (
          <ContractLine>
            This creates a contract named after your course, with this price. Its description comes from your landing page.
          </ContractLine>
        )}

        {showForm && (
          <PriceForm
            key={buy?.id ?? 'new'}
            initial={start()}
            submitLabel={own ? 'Save price' : 'Set price'}
            note={
              buy && !own
                ? `Setting a price here makes a contract for this course. “${buy.title}” stays on as a contract that gives access, so everyone on it keeps the course.`
                : null
            }
            onSubmit={submitPrice}
            onCancel={buy ? () => setEditing(false) : null}
            error={error}
          />
        )}
        {showForm && !buy && (
          <ContractLine>
            Setting a price creates a contract for this course, named after it. Its description comes from your
            landing page.
          </ContractLine>
        )}
        {showForm && own && <ContractLine>This changes the price on your course’s contract.</ContractLine>}
      </section>

      {showAccess && <CourseAlsoIncluded course={course} onSaved={onSaved} />}
    </div>
  );
}

// Where the price lives: one quiet grey line under it
function ContractLine({ children }) {
  return (
    <p className="prc__contract">
      <Info size={15} aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

// The price as it is: what it costs (the full price crossed out when
// there's a discount), Open contract (its live checkout page, in a new
// tab) and Change price. A course sold through one of the coach's older
// contracts also names it, linking to where its price is changed.
function PriceCard({ contract, own, onChange }) {
  const { now, was, off } = priceOf(contract);
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
        </p>
        {/* Only when it sells through another contract: which one, since its price is changed there */}
        {!own && (
          <a className="prc__where" href={contractEditUrl(contract.id)} target="_blank" rel="noopener">
            Sold through your contract <strong>{contract.title}</strong>
            <ExternalLink size={13} aria-hidden="true" />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        )}
      </div>
      <div className="prc__card-actions">
        {/* The live page people pay on, as Open does for the contracts below */}
        <a className="crs-btn crs-btn--quiet crs-btn--small" href={livePageOf(contract).view} target="_blank" rel="noopener">
          Open contract
          <ExternalLink size={14} aria-hidden="true" />
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
        <button type="button" className="crs-btn crs-btn--quiet crs-btn--small" onClick={onChange}>
          {own ? 'Change price' : 'Change'}
        </button>
      </div>
    </div>
  );
}

// Paid or Free; for Paid, the price and an optional discounted price
function PriceForm({ initial, submitLabel, note, onSubmit, onCancel, error }) {
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
  // After Publish with no price: what's typed but not set yet says so
  const typed = free || pay > 0;
  const pageError = error && (typed ? `Press ${submitLabel} to save it` : error);
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
        <div className={`prc__prices ${error && !typed ? 'prc__prices--error' : ''}`}>
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

      {pageError && !(tried && problem) && (
        <p className="lrn__error prc__error" role="alert">
          {pageError}
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