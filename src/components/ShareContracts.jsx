import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Link2 } from 'lucide-react';
import { useCopy } from '../screens/OfferingsHome';
import { getAllServices } from '../data/mockServices';
import { contractCheckoutUrl } from '../data/contractCheckout';
import { formatMoney } from '../data/contractPricing';
import './ShareContracts.css';

// ------------------------------------------------------------
// A class has no link of its own: people join by buying one of its linked
// contracts, as on TagMango, so what the coach shares is a contract's
// checkout page (/web/checkout/<id>). Two ways to get at those links:
//
// ShareButton: in a class's row and on its page, where Copy link was.
//   One contract    [🔗 Copy contract link]   copies it straight away
//   Two or more     [🔗 Share a contract ⌄]   opens the list below
//   None            [🔗 Share a contract]     greyed: link one first
//
// ContractShareList: every linked contract, with its price and its own
// Copy link. On the class's ready screen, under the Share button, and on
// the Students tab while nobody's in yet.
//
//   Yoga monthly    ₹2,000                     [🔗 Copy link]
//   Yoga 6 months   ₹10,000                    [🔗 Copy link]
//
// batch: the class (its contractIds)
// ------------------------------------------------------------

// The class's contracts that still exist, in its order: [{ id, title, price, currency }]
export function linkedContracts(batch) {
  const all = new Map(getAllServices().map((c) => [c.id, c]));
  return (batch.contractIds ?? []).map((id) => all.get(id)).filter(Boolean);
}

const priceOf = (c) => (Number(c.price) > 0 ? formatMoney(c.price, c.currency ?? 'INR') : 'Free');

export function ContractShareList({ batch, compact = false }) {
  const contracts = linkedContracts(batch);
  if (contracts.length === 0) {
    return <p className="shc__none">No contracts linked yet. Edit the class to link one.</p>;
  }
  return (
    <ul className={`shc__list ${compact ? 'shc__list--compact' : ''}`}>
      {contracts.map((c) => (
        <ShareRow key={c.id} contract={c} />
      ))}
    </ul>
  );
}

function ShareRow({ contract }) {
  const [copy, copyLink] = useCopy();
  return (
    <li className="shc__item">
      <span className="shc__what">
        <span className="shc__name">{contract.title}</span>
        <span className="shc__price">{priceOf(contract)}</span>
      </span>
      <button
        type="button"
        className="oh-card__copy shc__copy"
        onClick={() => copyLink(contractCheckoutUrl(contract.id))}
        aria-label={`Copy the link to ${contract.title}`}
      >
        {copy === 'copied' ? <Check size={15} strokeWidth={3} aria-hidden="true" /> : <Link2 size={15} aria-hidden="true" />}
        {copy === 'copied' ? 'Copied' : copy === 'failed' ? 'Couldn’t copy' : 'Copy link'}
      </button>
    </li>
  );
}

export function ShareButton({ batch }) {
  const contracts = linkedContracts(batch);
  const [copy, copyLink] = useCopy();
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);

  // Clicking anywhere else, or Escape, closes the list
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => !wrap.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', away);
    document.addEventListener('touchstart', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('touchstart', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  if (contracts.length === 0) {
    return (
      <span className="shc" data-tip="Link a contract to this class first" data-tip-align="end">
        <button type="button" className="oh-card__copy shc__btn" disabled>
          <Link2 size={16} aria-hidden="true" /> Share a contract
        </button>
      </span>
    );
  }

  if (contracts.length === 1) {
    const [only] = contracts;
    return (
      <span className="shc">
        <button
          type="button"
          className="oh-card__copy shc__btn"
          onClick={() => copyLink(contractCheckoutUrl(only.id))}
          data-tip={`Copies the link to ${only.title}. Anyone who buys it joins this class.`}
          data-tip-align="end"
        >
          {copy === 'copied' ? <Check size={16} strokeWidth={3} aria-hidden="true" /> : <Link2 size={16} aria-hidden="true" />}
          {copy === 'copied' ? 'Copied' : copy === 'failed' ? 'Couldn’t copy' : 'Copy contract link'}
        </button>
      </span>
    );
  }

  return (
    <span className="shc" ref={wrap}>
      <button
        type="button"
        className="oh-card__copy shc__btn"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
      >
        <Link2 size={16} aria-hidden="true" /> Share a contract
        <ChevronDown size={15} aria-hidden="true" className="shc__chevron" />
      </button>
      {open && (
        <div className="shc__pop" role="dialog" aria-label="Share a contract">
          <p className="shc__pop-text">Anyone who buys one of these joins {batch.title}.</p>
          <ContractShareList batch={batch} compact />
        </div>
      )}
    </span>
  );
}
