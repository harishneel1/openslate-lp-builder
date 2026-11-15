import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check, ChevronDown, ImageIcon } from 'lucide-react';
import { askedQuestions, hasOptions } from '../data/callQuestions';
import { mockAccount } from '../data/myPage';
import { REGIONS, formatMoney, gstOn, payAmount, priceFor } from '../data/contractPricing';
import { isWebLink, shortLink } from '../utils/links';
import LinkedText from './LinkedText';
import './ContractPreview.css';

// ------------------------------------------------------------
// Beside the contract screen (ContractEditor.jsx): what people will see,
// as the creator fills it in. Two views, picked with the tabs on top
// (the screen also switches them as sections open):
//   checkout  cover, name, description, the form, price and the button
//   success   after they pay: a tick, the button, and where they go next
// Nothing here can be filled in or clicked; it's a picture of the page.
//
// The phone scrolls, like the real page: the cover, title, the full
// description and the form scroll; the price and button stay pinned at
// the bottom. A fade at the bottom shows only while there's more below.
//
// It follows the step they're on (focus):
//   'details'    back to the top
//   'questions'  down to the form
//   anything else: left where it is (the price bar is always in view)
// and on the Checkout form step, a question they add or change is
// scrolled to and lit up for a moment, so they see which one it is.
//
// No price typed yet: a grey "Your price" in its place, not ₹0.
// Links in the description look like links (LinkedText), as on the live page.
//
// draft: the contract being edited (title, cover, description, type, prices,
//        gstOn, gstIncluded, questions, buttonLabel, buttonUrl, redirectUrl,
//        redirectDelay), as ContractEditor holds it
// With prices in more than one currency, "Visitor from" switches between
// what people in India, Europe and elsewhere see.
// view: 'checkout' | 'success'. onView(view): a tab picked.
// focus: the step they're on (see above)
// ------------------------------------------------------------

const ALWAYS_ASKED = ['Name', 'Email', 'Phone number'];
const HIGHLIGHT_MS = 1400;

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function ContractPreview({ draft, view, onView, focus = null }) {
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
        {view === 'success' ? (
          <SuccessView draft={draft} shown={shown} />
        ) : (
          <CheckoutView draft={draft} shown={shown} focus={focus} />
        )}
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

// No price typed yet (paid, but nothing to pay)
const noPrice = (shown) => !shown.price || !(payAmount(shown.price) > 0);

// What they pay in all: GST on top when it isn't in the price
const total = ({ price, gst }) => payAmount(price) + (gst && !gst.included ? gst.amount : 0);

// ---------- Scrolling inside the phone ----------

// Whether there's more to scroll to below, kept up to date as they scroll,
// as the content changes and as the phone resizes
function useMoreBelow(ref, deps) {
  const [more, setMore] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const check = () => setMore(el.scrollTop + el.clientHeight < el.scrollHeight - 4);
    check();
    el.addEventListener('scroll', check, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(check) : null;
    ro?.observe(el);
    if (el.firstElementChild) ro?.observe(el.firstElementChild);
    return () => {
      el.removeEventListener('scroll', check);
      ro?.disconnect();
    };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return more;
}

// Scrolls the phone (only the phone, never the page) so `target` sits near
// the top, or in the middle with center: true
function scrollWithin(box, target, { center = false } = {}) {
  if (!box) return;
  const behavior = reducedMotion() ? 'auto' : 'smooth';
  if (!target) {
    box.scrollTo({ top: 0, behavior });
    return;
  }
  const boxRect = box.getBoundingClientRect();
  const rect = target.getBoundingClientRect();
  const offset = rect.top - boxRect.top + box.scrollTop;
  const top = center ? offset - (box.clientHeight - rect.height) / 2 : offset - 12;
  box.scrollTo({ top: Math.max(0, top), behavior });
}

// The question that was just added or changed, by comparing with last time
function changedQuestion(before, now) {
  const old = new Map(before.map((q) => [q.id, JSON.stringify(q)]));
  return now.find((q) => old.get(q.id) !== JSON.stringify(q))?.id ?? null;
}

function CheckoutView({ draft, shown, focus }) {
  const title = String(draft.title ?? '').trim();
  const paragraphs = String(draft.description ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const questions = askedQuestions(draft.questions ?? []);
  const monthly = draft.type === 'subscription';

  const scroller = useRef(null);
  const form = useRef(null);
  const more = useMoreBelow(scroller, [draft.description, draft.cover, title, questions.length]);

  // Follow the step they're on (not on first show: it starts at the top)
  const firstFocus = useRef(true);
  useEffect(() => {
    if (firstFocus.current) {
      firstFocus.current = false;
      if (focus !== 'questions') return;
    }
    if (focus === 'details') scrollWithin(scroller.current, null);
    else if (focus === 'questions') scrollWithin(scroller.current, form.current);
  }, [focus]);

  // A question added or changed on the Checkout form step: scroll to it and light it up
  const [lit, setLit] = useState(null);
  const lastQuestions = useRef(questions);
  useEffect(() => {
    const id = changedQuestion(lastQuestions.current, questions);
    lastQuestions.current = questions;
    if (!id || focus !== 'questions') return undefined;
    setLit(id);
    // After it's drawn, so a new one has a place to scroll to
    const frame = window.requestAnimationFrame(() => {
      const el = scroller.current?.querySelector(`[data-question="${CSS.escape(id)}"]`);
      scrollWithin(scroller.current, el, { center: true });
    });
    const timer = window.setTimeout(() => setLit(null), HIGHLIGHT_MS);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [questions]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="cpv-page">
      <div ref={scroller} className={`cpv-page__scroll ${more ? 'cpv-page__scroll--more' : ''}`}>
        <div className="cpv-page__content">
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
                paragraphs.map((p, i) => (
                  <p key={i}>
                    <LinkedText text={p} live={false} />
                  </p>
                ))
              ) : (
                <p className="cpv-page__placeholder">Your description shows here.</p>
              )}
            </div>

            <div className="cpv-form" ref={form}>
              {ALWAYS_ASKED.map((label) => (
                <FakeField key={label} label={label} />
              ))}
              {questions.map((q) => (
                <FakeQuestion key={q.id} q={q} lit={lit === q.id} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="cpv-page__buy">
        {isFree(draft) ? (
          <span className="cpv-page__price cpv-page__price--free">Free</span>
        ) : noPrice(shown) ? (
          <span className="cpv-page__price">
            <span className="cpv-page__amount cpv-page__amount--empty">Your price</span>
          </span>
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
            {/* Monthly: when it charges again, under the price like GST */}
            {monthly && <span className="cpv-page__gst">Renews monthly from the day you join</span>}
          </span>
        )}
        <span className="cpv-page__cta">{isFree(draft) ? 'Register now' : 'Pay now'}</span>
      </div>
    </div>
  );
}

function FakeField({ label, required = true, long = false, lit = false, id }) {
  return (
    <div className={`cpv-field ${lit ? 'cpv-field--lit' : ''}`} data-question={id}>
      <span className="cpv-field__label">
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </span>
      <span className={`cpv-field__box ${long ? 'cpv-field__box--long' : ''}`} />
    </div>
  );
}

// One of their questions, drawn the way checkout asks it
function FakeQuestion({ q, lit }) {
  const text = q.text.trim() || 'Your question';
  if (!hasOptions(q.type)) {
    return <FakeField id={q.id} label={text} required={q.required} long={q.type === 'long'} lit={lit} />;
  }

  const options = q.options.map((o, i) => o.trim() || `Choice ${i + 1}`);
  return (
    <div className={`cpv-field ${lit ? 'cpv-field--lit' : ''}`} data-question={q.id}>
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
          {options.map((o, i) => (
            <span key={i} className="cpv-field__choice">
              <span className={q.type === 'multi' ? 'cpv-field__tick' : 'cpv-field__dot'} aria-hidden="true" />
              {o}
            </span>
          ))}
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
        {isFree(draft) ? (
          <span className="cpv-done__value">Free</span>
        ) : noPrice(shown) ? (
          <span className="cpv-done__value cpv-done__value--empty">Your price</span>
        ) : (
          <span className="cpv-done__value">
            {formatMoney(total(shown), shown.price.currency)}
            {shown.gst && <small> incl. GST</small>}
          </span>
        )}
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