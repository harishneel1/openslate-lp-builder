import { useState } from 'react';
import { ArrowUpRight, Check, ChevronDown, ImageIcon } from 'lucide-react';
import { askedQuestions, hasOptions } from '../data/callQuestions';
import { mockAccount } from '../data/myPage';
import { REGIONS, formatMoney, gstOn, payAmount, priceFor } from '../data/contractPricing';
import { isWebLink, shortLink } from '../utils/links';
import './ContractPreview.css';

// ------------------------------------------------------------
// Beside the contract screen (ContractEditor.jsx): what people will see,
// as the creator fills it in. Two views, picked with the tabs on top
// (the screen also switches them as sections open):
//   checkout  cover, name, description, the form, price and the button
//   success   after they pay: a tick, the button, and where they go next
// Nothing here can be filled in or clicked; it's a picture of the page.
//
// draft: the contract being edited (title, cover, description, type, prices,
//        gstOn, gstIncluded, questions, buttonLabel, buttonUrl, redirectUrl,
//        redirectDelay), as ContractEditor holds it
// With prices in more than one currency, "Visitor from" switches between
// what people in India, Europe and elsewhere see.
// view: 'checkout' | 'success'. onView(view): a tab picked.
// ------------------------------------------------------------

const ALWAYS_ASKED = ['Name', 'Email', 'Phone number'];

export default function ContractPreview({ draft, view, onView }) {
  const [region, setRegion] = useState('IN');
  const paid = draft.type !== 'free';
  const prices = paid ? draft.prices.map(toPrice) : [];
  const price = priceFor(prices, region);
  const gst = gstOn(price, { enabled: draft.gstOn, included: draft.gstIncluded });
  const shown = { price, gst };

  return (
    <div className="cpv">
      <div className="cpv__tabs" role="tablist" aria-label="Preview">
        {[
          ['checkout', 'Checkout page'],
          ['success', 'After they pay'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={view === id}
            className={`cpv__tab ${view === id ? 'cpv__tab--on' : ''}`}
            onClick={() => onView(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {prices.length > 1 && (
        <div className="cpv__region">
          <span className="cpv__region-label" id="cpv-region">
            Visitor from
          </span>
          <div className="cpv__region-options" role="radiogroup" aria-labelledby="cpv-region">
            {REGIONS.map((r) => (
              <button
                key={r.id}
                type="button"
                role="radio"
                aria-checked={region === r.id}
                className={`cpv__region-option ${region === r.id ? 'cpv__region-option--on' : ''}`}
                onClick={() => setRegion(r.id)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="cpv__screen" aria-label="Preview of the page people see">
        {view === 'success' ? <SuccessView draft={draft} shown={shown} /> : <CheckoutView draft={draft} shown={shown} />}
      </div>

      <p className="cpv__note">A preview. People see this on their phone or computer.</p>
    </div>
  );
}

const isFree = (draft) => draft.type === 'free';

// A draft price (text while typing) as a price
const toPrice = (p) => ({
  currency: p.currency,
  price: Number(p.price) || 0,
  discount: p.hasDiscount && Number(p.discount) > 0 && Number(p.discount) < Number(p.price) ? Number(p.discount) : null,
});

// What they pay in all: GST on top when it isn't in the price
const total = ({ price, gst }) => payAmount(price) + (gst && !gst.included ? gst.amount : 0);

function CheckoutView({ draft, shown }) {
  const title = String(draft.title ?? '').trim();
  const paragraphs = String(draft.description ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const questions = askedQuestions(draft.questions ?? []);
  const monthly = draft.type === 'subscription';

  return (
    <div className="cpv-page">
      {draft.cover ? (
        <img className="cpv-page__cover" src={draft.cover} alt="" />
      ) : (
        <div className="cpv-page__cover cpv-page__cover--empty" aria-hidden="true">
          <ImageIcon size={22} />
          <span>Your cover</span>
        </div>
      )}

      <div className="cpv-page__body">
        <p className={`cpv-page__title ${title ? '' : 'cpv-page__title--empty'}`}>{title || 'Your contract’s title'}</p>
        <p className="cpv-page__by">by {mockAccount.name}</p>

        <div className="cpv-page__about">
          {paragraphs.length > 0 ? (
            paragraphs.map((p, i) => <p key={i}>{p}</p>)
          ) : (
            <p className="cpv-page__placeholder">Your description shows here.</p>
          )}
        </div>

        <div className="cpv-form">
          {ALWAYS_ASKED.map((label) => (
            <FakeField key={label} label={label} />
          ))}
          {questions.map((q) => (
            <FakeQuestion key={q.id} q={q} />
          ))}
        </div>
      </div>

      <div className="cpv-page__buy">
        {isFree(draft) ? (
          <span className="cpv-page__price cpv-page__price--free">Free</span>
        ) : (
          <span className="cpv-page__price">
            <span className="cpv-page__amount">
              {shown.price.discount != null && <s>{formatMoney(shown.price.price, shown.price.currency)}</s>}
              {formatMoney(payAmount(shown.price), shown.price.currency)}
              {monthly && <small>/month</small>}
            </span>
            {shown.gst && (
              <span className="cpv-page__gst">
                {shown.gst.included ? 'incl. GST' : `+ ${formatMoney(shown.gst.amount)} GST`}
              </span>
            )}
          </span>
        )}
        <span className="cpv-page__cta">{isFree(draft) ? 'Register now' : 'Pay now'}</span>
      </div>
    </div>
  );
}

function FakeField({ label, required = true, long = false }) {
  return (
    <div className="cpv-field">
      <span className="cpv-field__label">
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </span>
      <span className={`cpv-field__box ${long ? 'cpv-field__box--long' : ''}`} />
    </div>
  );
}

// One of their questions, drawn the way checkout asks it
function FakeQuestion({ q }) {
  const text = q.text.trim() || 'Your question';
  if (!hasOptions(q.type)) return <FakeField label={text} required={q.required} long={q.type === 'long'} />;

  const options = q.options.map((o, i) => o.trim() || `Choice ${i + 1}`);
  return (
    <div className="cpv-field">
      <span className="cpv-field__label">
        {text}
        {q.required && <span aria-hidden="true"> *</span>}
      </span>
      {q.type === 'dropdown' ? (
        <span className="cpv-field__box cpv-field__box--select">
          <span>Select</span>
          <ChevronDown size={14} aria-hidden="true" />
        </span>
      ) : (
        <span className="cpv-field__choices">
          {options.slice(0, 4).map((o, i) => (
            <span key={i} className="cpv-field__choice">
              <span className={q.type === 'multi' ? 'cpv-field__tick' : 'cpv-field__dot'} aria-hidden="true" />
              {o}
            </span>
          ))}
          {options.length > 4 && <span className="cpv-field__more">+ {options.length - 4} more</span>}
        </span>
      )}
    </div>
  );
}

function SuccessView({ draft, shown }) {
  const title = String(draft.title ?? '').trim() || 'Your contract’s title';
  const label = String(draft.buttonLabel ?? '').trim();
  const showButton = Boolean(label) && isWebLink(draft.buttonUrl);
  const redirect = isWebLink(draft.redirectUrl) ? shortLink(draft.redirectUrl) : null;
  const delay = Number(draft.redirectDelay) || 0;

  return (
    <div className="cpv-done">
      <div className="cpv-done__top">
        <span className="cpv-done__tick" aria-hidden="true">
          <Check size={26} strokeWidth={3} />
        </span>
        <p className="cpv-done__title">{isFree(draft) ? 'You’re registered' : 'Payment successful'}</p>
      </div>

      <div className="cpv-done__card">
        <span className="cpv-done__label">Contract</span>
        <span className="cpv-done__value">{title}</span>
        <span className="cpv-done__label">{isFree(draft) ? 'Price' : 'Paid'}</span>
        <span className="cpv-done__value">
          {isFree(draft) ? 'Free' : formatMoney(total(shown), shown.price.currency)}
          {shown.gst && <small> incl. GST</small>}
        </span>
      </div>

      {redirect && (
        <p className="cpv-done__redirect">
          {delay === 0 ? `Taking you to ${redirect}…` : `Taking you to ${redirect} in ${delay} second${delay === 1 ? '' : 's'}…`}
        </p>
      )}

      <div className="cpv-done__foot">
        {showButton ? (
          <span className="cpv-done__button">
            {label}
            <ArrowUpRight size={15} aria-hidden="true" />
          </span>
        ) : (
          <span className="cpv-done__nobutton">No button. Add a link to show one.</span>
        )}
      </div>
    </div>
  );
}