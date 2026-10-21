import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BadgeCheck, Check, ClipboardList, FileText, ImagePlus, IndianRupee, Lock, Plus, Trash2, X } from 'lucide-react';
import EditFrame, { EditPlaceholder, useEditDraft } from './EditFrame';
import QuestionsInput from '../components/QuestionsInput';
import ContractPreview from '../components/ContractPreview';
import { cleanQuestions, questionsProblem, sameQuestions } from '../data/callQuestions';
import {
  DEFAULT_SUCCESS,
  REDIRECT_DELAYS,
  contractOf,
  createContract,
  getService,
  updateContract,
} from '../data/mockServices';
import { CURRENCIES, GST_PERCENT, currencyOf, formatMoney, gstOn } from '../data/contractPricing';
import { photoSize, readPhoto } from '../utils/readPhoto';
import { isWebLink, withScheme } from '../utils/links';
import '../components/QuestionInput.css'; // field styles (qinput__*)
import '../components/CallDetailsInput.css'; // the Free / One-time chips (call__chip)
import './ContractEditor.css';

// ------------------------------------------------------------
// One contract: making a new one, or changing one. Like TagMango's
// create page, in our design: the steps along the top, one step on
// screen at a time, a live preview beside it on wide screens, and
// Back / Next at the bottom.
//
//   1 Details        title, cover image, description
//   2 Price          free, or a one-time payment: a selling price with an
//                    optional discounted price, in up to three currencies
//                    (INR, USD, EUR; contractPricing.js), and GST on INR
//   3 Checkout form  what people fill in before they pay, after their
//                    name, email and phone (QuestionsInput, as for calls)
//   4 Success page   Button (name and link), and Redirect: an optional
//                    page to send them to, after 0–5 seconds
//
// Price has its own step, so each screen asks one kind of thing.
// A new contract: Next is ready once the step is complete ("Add a title to
// continue" until then), and a step on top unlocks once every step before
// it is complete. Create contract is on the last step. Changing a contract:
// any step can be opened from the top, and Save changes is always there.
// Back / Next sit in the step card's footer, which stays at the bottom of
// the screen on a long step until they scroll down to it.
// Nothing else: no advanced settings for now.
//
// contractId: the contract to change, or null for a new one
// backLabel: the back link's words ("Contracts", or "Close" in its own tab)
// onBack(): leave (after asking, if there are changes)
// onCreated(contract): a new one was made
// ------------------------------------------------------------
export default function ContractEditor({ contractId = null, backLabel = 'Contracts', onBack, onCreated }) {
  // Read again after each save, so the screen starts from what's saved
  const [version, setVersion] = useState(0);
  const contract = useMemo(
    () => (contractId ? getService(contractId) : null),
    [contractId, version], // eslint-disable-line react-hooks/exhaustive-deps
  );

  if (contractId && !contract) {
    return (
      <EditPlaceholder
        title="This contract isn’t here"
        sub="It may have been deleted. Go back to see your contracts."
        onBack={onBack}
        backLabel={backLabel}
      />
    );
  }

  return (
    <ContractForm
      key={contractId ?? 'new'}
      contract={contract}
      backLabel={backLabel}
      onBack={onBack}
      onCreated={onCreated}
      onSaved={() => setVersion((v) => v + 1)}
    />
  );
}

// The fields this screen changes, flat, so the draft can tell what's changed
const FIELDS = [
  'title',
  'cover',
  'description',
  'type',
  'prices',
  'gstOn',
  'gstIncluded',
  'questions',
  'buttonLabel',
  'buttonUrl',
  'redirectUrl',
  'redirectDelay',
];

const TITLE_MAX = 100;
const DESCRIPTION_MAX = 2000;
const BUTTON_MAX = 30;

// ---------- Prices, as the draft holds them ----------
// { id, currency, price: '1499', hasDiscount, discount: '999' }: text while typing

const newPriceId = () => `p-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const newPrice = (currency) => ({ id: newPriceId(), currency, price: '', hasDiscount: false, discount: '' });

const toDraftPrice = (p, i) => ({
  id: `p-${i}`,
  currency: p.currency,
  price: p.price > 0 ? String(p.price) : '',
  hasDiscount: p.discount != null && p.discount > 0,
  discount: p.discount != null && p.discount > 0 ? String(p.discount) : '',
});

// As it's saved (and as the preview needs it)
const fromDraftPrice = (p) => ({
  currency: p.currency,
  price: Number(p.price) || 0,
  discount: p.hasDiscount && Number(p.discount) > 0 ? Number(p.discount) : null,
});

const samePrices = (a, b) =>
  JSON.stringify(a.map((p) => [p.currency, p.price, p.hasDiscount, p.hasDiscount ? p.discount : ''])) ===
  JSON.stringify(b.map((p) => [p.currency, p.price, p.hasDiscount, p.hasDiscount ? p.discount : '']));

// What's wrong with the prices, if anything (null when they're fine)
function pricesProblem(prices, verb) {
  for (let i = 0; i < prices.length; i += 1) {
    const p = prices[i];
    const amount = Number(p.price);
    if (!(amount > 0)) {
      return prices.length === 1 ? `Add a price, or make it free, to ${verb}` : `Add the ${p.currency} selling price`;
    }
    if (p.hasDiscount) {
      const discount = Number(p.discount);
      if (!(discount > 0)) return `Add the ${p.currency} discounted price, or untick it`;
      if (discount >= amount) return `The ${p.currency} discounted price should be lower than its selling price`;
    }
  }
  return null;
}

const NEW_CONTRACT = {
  title: '',
  cover: null,
  description: '',
  type: 'onetime',
  prices: [newPrice('INR')],
  gstOn: false,
  gstIncluded: false,
  questions: [],
  ...DEFAULT_SUCCESS,
};

// A saved contract, flat, as the draft holds it
function flatten(contract) {
  const c = contractOf(contract);
  return {
    title: c.title ?? '',
    cover: c.cover,
    description: c.description,
    type: c.type === 'subscription' ? 'subscription' : c.type === 'free' || !(c.price > 0) ? 'free' : 'onetime',
    // A free one starts with an empty INR price, ready if they switch to paid
    prices: c.prices.some((p) => p.price > 0) ? c.prices.map(toDraftPrice) : [toDraftPrice({ currency: 'INR', price: 0 }, 0)],
    gstOn: c.gst.enabled,
    gstIncluded: c.gst.included,
    questions: c.questions,
    ...c.success,
  };
}

// The draft, ready to save
function toContract(d) {
  return {
    title: d.title,
    cover: d.cover,
    description: d.description,
    type: d.type,
    prices: d.prices.map(fromDraftPrice),
    gst: { enabled: d.gstOn && d.prices.some((p) => p.currency === 'INR'), included: d.gstIncluded },
    questions: cleanQuestions(d.questions),
    success: {
      buttonLabel: String(d.buttonLabel ?? '').trim(),
      buttonUrl: withScheme(d.buttonUrl),
      redirectUrl: withScheme(d.redirectUrl),
      redirectDelay: d.redirectDelay,
    },
  };
}

const delayLabel = (n) => (n === 0 ? 'Straight away' : `${n} second${n === 1 ? '' : 's'}`);


// The steps, in order. Each is one screen with its own fields.
const STEPS = [
  {
    id: 'details',
    label: 'Details',
    icon: FileText,
    title: 'Contract details',
    sub: 'The title, cover and description people see at the top of the page.',
  },
  {
    id: 'price',
    label: 'Price',
    icon: IndianRupee,
    title: 'Price',
    sub: null,
  },
  {
    id: 'questions',
    label: 'Checkout form',
    icon: ClipboardList,
    title: 'Checkout form',
    sub: 'What people fill in before they pay.',
  },
  {
    id: 'after',
    label: 'Success page',
    icon: BadgeCheck,
    title: 'Success page',
    sub: 'What people see once they’ve paid, and where they go next.',
  },
];

function ContractForm({ contract, backLabel, onBack, onCreated, onSaved }) {
  const isNew = contract === null;
  const saved = useMemo(() => (isNew ? NEW_CONTRACT : flatten(contract)), [isNew, contract]);
  const edit = useEditDraft(saved, FIELDS);
  const { draft, handleChange, formKey } = edit;
  const [failed, setFailed] = useState(null); // why the last save didn't work

  // Change a field; back to what's saved counts as unchanged
  const change = (id) => (value) => {
    handleChange(value, id);
    setFailed(null);
  };
  const changeQuestions = (next) => change('questions')(sameQuestions(next, saved.questions) ? saved.questions : next);
  const changePrices = (next) => change('prices')(samePrices(next, saved.prices) ? saved.prices : next);

  // ---------- What's stopping each step, if anything ----------
  const title = String(draft.title ?? '').trim();
  const label = String(draft.buttonLabel ?? '').trim();
  const verb = isNew ? 'continue' : 'save';
  const problems = {
    details: !title
      ? `Add a title to ${verb}`
      : !String(draft.description ?? '').trim()
        ? `Add a description to ${verb}`
        : null,
    price: draft.type !== 'free' ? pricesProblem(draft.prices, verb) : null,
    questions: questionsProblem(draft.questions)?.text ?? null,
    after:
      draft.buttonUrl.trim() && !isWebLink(draft.buttonUrl)
        ? 'Check the button’s link'
        : draft.buttonUrl.trim() && !label
          ? 'Give the button a name'
          : draft.redirectUrl.trim() && !isWebLink(draft.redirectUrl)
            ? 'Check the link to send people to'
            : null,
  };
  // The first step with a problem, for the final button
  const firstProblem = STEPS.findIndex((st) => problems[st.id]);

  // ---------- Where they are ----------
  // A new contract: a step opens once every step before it is complete
  // (Next, or a click on it at the top). Editing: any step, any time.
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(isNew ? 0 : STEPS.length - 1); // furthest step opened
  const current = STEPS[step];
  const last = step === STEPS.length - 1;
  const canOpen = (i) => !isNew || i <= step || STEPS.slice(0, i).every((st) => !problems[st.id]);
  // Why a step can't be opened yet: "Finish Price first"
  const lockedBy = (i) => STEPS.slice(0, i).find((st) => problems[st.id]);

  const top = useRef(null);
  const goTo = (i) => {
    if (i < 0 || i >= STEPS.length || !canOpen(i)) return;
    setStep(i);
    setReached((r) => Math.max(r, i));
  };
  // Leaving with changes: EditFrame asks at the top, so bring them there
  const leave = () => {
    if (edit.dirty) {
      edit.setLeaving(true);
      window.requestAnimationFrame(() => document.querySelector('.es__leave')?.scrollIntoView({ block: 'center' }));
    } else {
      onBack();
    }
  };

  // A new step starts at its top
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    top.current?.scrollIntoView({ block: 'start' });
  }, [step]);

  // The preview follows the step: Success page shows the success page
  const [view, setView] = useState('checkout');
  useEffect(() => setView(current.id === 'after' ? 'success' : 'checkout'), [current.id]);

  const next = () => {
    if (problems[current.id]) return;
    goTo(step + 1);
  };

  const save = () => {
    if (!edit.dirty || firstProblem !== -1) return;
    if (!updateContract(contract.id, toContract(draft))) {
      setFailed('We couldn’t save your changes just now. Try again.');
      return;
    }
    edit.saved();
    onSaved();
  };

  const create = () => {
    if (firstProblem !== -1) return;
    const made = createContract(toContract(draft));
    if (!made) {
      setFailed('We couldn’t create the contract just now. Try again.');
      return;
    }
    onCreated(made);
  };

  // ---------- The step's footer: Back, Next, and Create / Save ----------
  // Part of the step's card, right under its last field. On a long step it
  // stays at the bottom of the screen until they scroll down to it.
  const nextStep = STEPS[step + 1];
  // What the bar says, on the left
  const status = failed ? (
    <span className="es__message">{failed}</span>
  ) : problems[current.id] ? (
    problems[current.id]
  ) : last && firstProblem !== -1 ? (
    `${STEPS[firstProblem].label}: ${problems[STEPS[firstProblem].id]}`
  ) : !isNew && !edit.dirty && edit.justSaved ? (
    <span className="es__saved">
      <Check size={16} strokeWidth={3} aria-hidden="true" /> Changes saved
    </span>
  ) : !isNew && edit.dirty ? (
    'You have unsaved changes'
  ) : null;

  const footer = (
    <div className="ce-step__foot">
      <p className={`ce-step__status ${problems[current.id] || failed ? 'ce-step__status--todo' : ''}`} aria-live="polite">
        {status}
      </p>
      <div className="ce-step__actions">
        {step > 0 ? (
          <button type="button" className="es__btn es__btn--quiet" onClick={() => goTo(step - 1)}>
            <ArrowLeft size={16} aria-hidden="true" />
            Back
          </button>
        ) : (
          isNew && (
            <button type="button" className="es__btn es__btn--quiet" onClick={leave}>
              Cancel
            </button>
          )
        )}

        {isNew ? (
          last ? (
            <button type="button" className="es__btn es__btn--primary" onClick={create} disabled={firstProblem !== -1}>
              Create contract
            </button>
          ) : (
            <button type="button" className="es__btn es__btn--primary" onClick={next} disabled={Boolean(problems[current.id])}>
              Next: {nextStep.label}
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          )
        ) : (
          <>
            {!last && (
              <button type="button" className="es__btn es__btn--quiet" onClick={() => goTo(step + 1)}>
                Next: {nextStep.label}
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            )}
            {edit.dirty ? (
              <button type="button" className="es__btn es__btn--primary" onClick={save} disabled={firstProblem !== -1}>
                Save changes
              </button>
            ) : (
              <button type="button" className="es__btn es__btn--primary" onClick={onBack}>
                Done
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );

  return (
    <EditFrame
      edit={edit}
      title={isNew ? 'New contract' : saved.title || 'Your contract'}
      sub={
        isNew
          ? 'The page people sign up and pay on. You can change anything later.'
          : 'Changes show up on its checkout page once you save them.'
      }
      backLabel={backLabel}
      onBack={onBack}
      onSave={isNew ? create : save}
      viewHref={null}
      createLabel={isNew ? 'Create contract' : null}
      leaveNew="This contract isn’t created yet."
      aside={<ContractPreview draft={draft} view={view} onView={setView} />}
      bar={false}
    >
      <Steps
        steps={STEPS}
        step={step}
        reached={reached}
        problems={problems}
        canOpen={canOpen}
        lockedBy={lockedBy}
        onOpen={goTo}
        isNew={isNew}
      />

      <section className="es__panel ce-step" aria-labelledby="ce-step-title" ref={top}>
        <div className="ce-step__head">
          <span className="ce-step__icon" aria-hidden="true">
            <current.icon size={20} />
          </span>
          <div>
            <p className="ce-step__count">
              Step {step + 1} of {STEPS.length}
            </p>
            <h2 className="ce-step__title" id="ce-step-title">
              {current.title}
            </h2>
            {current.sub && <p className="ce-step__sub">{current.sub}</p>}
          </div>
        </div>

        {/* Every step stays mounted, so nothing typed resets; only this one shows */}
        <div className="es__panel-body es__fields" hidden={current.id !== 'details'}>
          <div className="qinput__field">
            {/* The count sits on the label's line, so the gap under the field
                matches every other field's */}
            <span className="ce-label-row">
              <label className="qinput__label" htmlFor="ce-title">
                Title
              </label>
              <span className="qinput__count">
                {draft.title.length}/{TITLE_MAX}
              </span>
            </span>
            <input
              id="ce-title"
              className="qinput__text"
              value={draft.title}
              maxLength={TITLE_MAX}
              placeholder="e.g. Career clarity call"
              onChange={(e) => change('title')(e.target.value)}
            />
          </div>

          <CoverField key={`cover-${formKey}`} value={draft.cover} onChange={change('cover')} />

          <div className="qinput__field">
            <span className="ce-label-row">
              <label className="qinput__label" htmlFor="ce-description">
                Description
              </label>
              <span className="qinput__count">
                {draft.description.length}/{DESCRIPTION_MAX}
              </span>
            </span>
            <textarea
              id="ce-description"
              className="qinput__text ce__description"
              rows={6}
              value={draft.description}
              maxLength={DESCRIPTION_MAX}
              placeholder="What people get, who it’s for, and what happens after they sign up."
              onChange={(e) => change('description')(e.target.value)}
            />
            <span className="qinput__example">Leave a blank line between paragraphs.</span>
          </div>
        </div>

        {/* One section: how they pay, and (for a one-time payment) its prices and
            GST, spaced like any other fields, with no lines between */}
        <div className="es__panel-body es__fields" hidden={current.id !== 'price'}>
          <div className="qinput__field">
            <span className="qinput__label" id="ce-type">
              How do people pay?
            </span>
            <div className="call__chips" role="radiogroup" aria-labelledby="ce-type">
              {[
                ['onetime', 'One-time payment'],
                ['free', 'Free'],
              ].map(([id, text]) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={draft.type === id}
                  className={`call__chip call__chip--big ${draft.type === id ? 'call__chip--on' : ''}`}
                  onClick={() => change('type')(id)}
                >
                  {text}
                </button>
              ))}
            </div>
            {draft.type === 'subscription' && (
              <p className="qinput__example">This contract charges every month. Pick one above to change that.</p>
            )}
          </div>

          {draft.type !== 'free' && (
            <>
              <PricesInput prices={draft.prices} onChange={changePrices} />
              {draft.prices.some((p) => p.currency === 'INR') && (
                <GstInput
                  on={draft.gstOn}
                  included={draft.gstIncluded}
                  inrPrice={fromDraftPrice(draft.prices.find((p) => p.currency === 'INR'))}
                  onOn={change('gstOn')}
                  onIncluded={change('gstIncluded')}
                />
              )}
            </>
          )}
        </div>

        <div className="es__panel-body" hidden={current.id !== 'questions'}>
          <QuestionsInput
            key={`questions-${formKey}`}
            value={draft.questions}
            onChange={changeQuestions}
            note="Shows on this contract’s checkout page."
          />
        </div>

        <div className="es__panel-body es__fields ce-step__groups" hidden={current.id !== 'after'}>
          {/* The button */}
          <div className="ce-group" role="group" aria-labelledby="ce-group-button">
            <div className="ce-group__head">
              <h3 className="ce-group__title" id="ce-group-button">
                Button
              </h3>
              <p className="ce-group__sub">Shown on the success page. Leave the link empty for no button.</p>
            </div>
            <div className="ce-group__row">
              <div className="qinput__field">
                <label className="qinput__label" htmlFor="ce-button-label">
                  Name
                </label>
                <input
                  id="ce-button-label"
                  className="qinput__text ce__input"
                  value={draft.buttonLabel}
                  maxLength={BUTTON_MAX}
                  placeholder="Login now"
                  onChange={(e) => change('buttonLabel')(e.target.value)}
                />
              </div>
              <LinkField
                key={`button-${formKey}`}
                id="ce-button-url"
                label="Link"
                value={draft.buttonUrl}
                placeholder="academy.yoursite.com"
                onChange={change('buttonUrl')}
              />
            </div>
          </div>

          {/* Where to send them next */}
          <div className="ce-group" role="group" aria-labelledby="ce-group-redirect">
            <div className="ce-group__head">
              <h3 className="ce-group__title" id="ce-group-redirect">
                Redirect <span className="ce-group__tag">Optional</span>
              </h3>
              <p className="ce-group__sub">Send people to another URL after they pay instead of the default payment-success page.</p>
            </div>
            <LinkField
              key={`redirect-${formKey}`}
              id="ce-redirect-url"
              label="Link"
              value={draft.redirectUrl}
              placeholder="yoursite.com/welcome"
              onChange={change('redirectUrl')}
            />

            {draft.redirectUrl.trim() && (
              <div className="qinput__field">
                <span className="qinput__label" id="ce-delay">
                  Wait before sending them
                </span>
                <div className="call__chips" role="radiogroup" aria-labelledby="ce-delay">
                  {REDIRECT_DELAYS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={draft.redirectDelay === n}
                      className={`call__chip ${draft.redirectDelay === n ? 'call__chip--on' : ''}`}
                      onClick={() => change('redirectDelay')(n)}
                    >
                      {delayLabel(n)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {footer}
      </section>
    </EditFrame>
  );
}

// The steps along the top: four tabs with a line between each. Ones that
// can be opened light up on hover; the one they're on is filled; done ones
// show a tick; one they've been to that now needs fixing shows a dot. One
// that isn't open yet shows a lock, and on hover or focus says what to
// finish first ("Finish Details first").
function Steps({ steps, step, reached, problems, canOpen, lockedBy, onOpen, isNew }) {
  return (
    <nav className="ce-steps" aria-label="Steps">
      <ol className="ce-steps__list">
        {steps.map((st, i) => {
          const isCurrent = i === step;
          const openable = canOpen(i);
          const done = !isCurrent && (!isNew || i < Math.max(reached, step)) && !problems[st.id];
          const warn = !isCurrent && i <= reached && Boolean(problems[st.id]);
          const why = openable ? null : `Finish ${lockedBy(i)?.label ?? 'the step before'} first`;
          const tipId = `ce-step-tip-${st.id}`;
          return (
            <li key={st.id} className="ce-steps__item">
              <button
                type="button"
                className={[
                  'ce-steps__step',
                  isCurrent && 'ce-steps__step--on',
                  done && 'ce-steps__step--done',
                  !openable && 'ce-steps__step--locked',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-current={isCurrent ? 'step' : undefined}
                aria-disabled={!openable || undefined}
                aria-describedby={why ? tipId : undefined}
                onClick={() => openable && !isCurrent && onOpen(i)}
              >
                <span className="ce-steps__num" aria-hidden="true">
                  {!openable ? <Lock size={13} strokeWidth={2.5} /> : done && !warn ? <Check size={14} strokeWidth={3} /> : i + 1}
                </span>
                <span className="ce-steps__label">{st.label}</span>
                {warn && <span className="ce-steps__warn" aria-hidden="true" />}
                <span className="sr-only">
                  {isCurrent ? ' (you’re here)' : warn ? ' (something to fix)' : done ? ' (done)' : ''}
                </span>
              </button>
              {why && (
                <span className="ce-steps__tip" id={tipId} role="tooltip">
                  {why}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// A web link. Adds https:// when they leave the box, and says if it isn't one.
function LinkField({ id, label, value, placeholder, onChange }) {
  const [left, setLeft] = useState(false); // they've left the box at least once
  const bad = left && value.trim() !== '' && !isWebLink(value);
  return (
    <div className="qinput__field">
      <label className="qinput__label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className={`qinput__text ce__input ${bad ? 'qinput__text--error' : ''}`}
        type="url"
        inputMode="url"
        autoComplete="off"
        spellCheck={false}
        value={value}
        placeholder={placeholder}
        aria-invalid={bad || undefined}
        aria-describedby={bad ? `${id}-error` : undefined}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          setLeft(true);
          if (value.trim() && isWebLink(value)) onChange(withScheme(value));
        }}
      />
      {bad && (
        <span className="qinput__error" id={`${id}-error`} role="alert">
          That doesn’t look like a web link. It should look like yoursite.com/page.
        </span>
      )}
    </div>
  );
}

// The cover: a drop area until there's one, then the picture with Change and Remove.
// Shrunk in the browser for now (readPhoto.js); the real app uploads it.
function CoverField({ value, onChange }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [tall, setTall] = useState(false); // taller than wide: it'll be cropped
  const [over, setOver] = useState(false); // a file is being dragged over it

  const take = async (file) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const photo = await readPhoto(file, { maxSide: 1280 });
      const size = await photoSize(photo);
      setTall(Boolean(size && size.height >= size.width));
      onChange(photo);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  const fileInput = (
    <input
      ref={input}
      type="file"
      accept="image/*"
      className="ce-cover__file"
      tabIndex={-1}
      aria-hidden="true"
      onChange={(e) => take(e.target.files?.[0])}
    />
  );

  return (
    <div className="qinput__field">
      <span className="qinput__label" id="ce-cover">
        Cover image <span className="qinput__optional">· Optional</span>
      </span>

      {value ? (
        <div className="ce-cover__has">
          <img className="ce-cover__img" src={value} alt="Your cover" />
          <div className="ce-cover__actions">
            <button type="button" className="ce-btn" onClick={() => input.current?.click()} disabled={busy}>
              <ImagePlus size={16} aria-hidden="true" />
              {busy ? 'Adding…' : 'Change cover'}
            </button>
            <button
              type="button"
              className="ce-btn ce-btn--quiet"
              onClick={() => {
                onChange(null);
                setTall(false);
              }}
            >
              <Trash2 size={16} aria-hidden="true" />
              Remove
            </button>
          </div>
          {fileInput}
        </div>
      ) : (
        <div
          className={`ce-cover__drop ${over ? 'ce-cover__drop--over' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            take(e.dataTransfer.files?.[0]);
          }}
        >
          <span className="ce-cover__icon" aria-hidden="true">
            <ImagePlus size={22} />
          </span>
          <button
            type="button"
            className="ce-btn"
            aria-describedby="ce-cover-hint"
            onClick={() => input.current?.click()}
            disabled={busy}
          >
            {busy ? 'Adding…' : 'Choose a picture'}
          </button>
          <span className="ce-cover__hint" id="ce-cover-hint">
            Or drop one here. A wide picture works best, at least 1280 × 720.
          </span>
          {fileInput}
        </div>
      )}

      {error && (
        <span className="qinput__error" role="alert">
          {error}
        </span>
      )}
      {tall && !error && (
        <span className="qinput__example">
          This picture is taller than it is wide, so its top and bottom will be cut off. A wide one works best.
        </span>
      )}
    </div>
  );
}

// ---------- Price section parts ----------

// The prices: one card each (currency, selling price, discounted price),
// the main one first. "+ Add a price in another currency" until all three are used.
function PricesInput({ prices, onChange }) {
  const used = prices.map((p) => p.currency);
  const unused = CURRENCIES.filter((c) => !used.includes(c.id));
  const update = (id, change) => onChange(prices.map((p) => (p.id === id ? { ...p, ...change } : p)));
  const digits = (text) => text.replace(/[^\d]/g, '').slice(0, 7);

  return (
    <div className="ce-prices">
      {prices.map((p, i) => {
        const cur = currencyOf(p.currency);
        return (
          <div key={p.id} className="ce-price" role="group" aria-label={i === 0 ? 'Main price' : `Price in ${p.currency}`}>
            <div className="ce-price__head">
              <span className="ce-price__name">{i === 0 ? 'Main price' : `Price in ${p.currency}`}</span>
              {i > 0 && (
                <button
                  type="button"
                  className="ce-btn ce-btn--quiet ce-btn--small"
                  onClick={() => onChange(prices.filter((q) => q.id !== p.id))}
                >
                  <X size={15} aria-hidden="true" />
                  Remove<span className="sr-only"> the {p.currency} price</span>
                </button>
              )}
            </div>

            <div className="ce-price__row">
              <label className="qinput__field">
                <span className="qinput__label">Currency</span>
                <select
                  className="qinput__text ce__input ce__select"
                  value={p.currency}
                  onChange={(e) => update(p.id, { currency: e.target.value })}
                >
                  {CURRENCIES.filter((c) => c.id === p.currency || !used.includes(c.id)).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.id} ({c.symbol})
                    </option>
                  ))}
                </select>
              </label>

              <label className="qinput__field">
                <span className="qinput__label">Selling price</span>
                <span className="qinput__money ce-money">
                  <span className="qinput__currency" aria-hidden="true">
                    {cur.symbol}
                  </span>
                  <input
                    className="qinput__text qinput__money-input ce__input"
                    inputMode="numeric"
                    value={p.price}
                    placeholder="Enter amount"
                    onChange={(e) => update(p.id, { price: digits(e.target.value) })}
                  />
                </span>
              </label>

              <div className="qinput__field">
                <label className="ce-check">
                  <input
                    type="checkbox"
                    checked={p.hasDiscount}
                    onChange={(e) => update(p.id, { hasDiscount: e.target.checked })}
                  />
                  <span className="qinput__label">Discounted price</span>
                </label>
                <span className={`qinput__money ce-money ${p.hasDiscount ? '' : 'ce-money--off'}`}>
                  <span className="qinput__currency" aria-hidden="true">
                    {cur.symbol}
                  </span>
                  <input
                    className="qinput__text qinput__money-input ce__input"
                    inputMode="numeric"
                    value={p.discount}
                    placeholder="Enter amount"
                    disabled={!p.hasDiscount}
                    aria-label={`Discounted price in ${p.currency}`}
                    onChange={(e) => update(p.id, { discount: digits(e.target.value) })}
                  />
                </span>
              </div>
            </div>

            {p.hasDiscount && Number(p.discount) > 0 && Number(p.discount) < Number(p.price) && (
              <p className="qinput__example">
                People see <s>{formatMoney(p.price, p.currency)}</s> crossed out, and pay {formatMoney(p.discount, p.currency)}.
              </p>
            )}
          </div>
        );
      })}

      {unused.length > 0 && (
        <button type="button" className="ce-btn ce-prices__add" onClick={() => onChange([...prices, newPrice(unused[0].id)])}>
          <Plus size={16} aria-hidden="true" />
          Add a price in another currency
        </button>
      )}
      <p className="qinput__example">
        Visitors from India see your INR price, from Europe your EUR price, and everyone else your USD price. Anyone without
        a price in their currency sees the main price.
      </p>
    </div>
  );
}

// GST on the INR price: always 18%, either added on top or already in the price
function GstInput({ on, included, inrPrice, onOn, onIncluded }) {
  const gst = gstOn(inrPrice, { enabled: true, included });
  const pay = inrPrice.discount ?? inrPrice.price;
  return (
    <div className="ce-gst">
      <label className="ce-switch">
        <input type="checkbox" role="switch" checked={on} onChange={(e) => onOn(e.target.checked)} />
        <span className="ce-switch__track" aria-hidden="true" />
        <span className="ce-switch__text">
          Add GST ({GST_PERCENT})
          <span className="ce-switch__note">Only on your INR price.</span>
        </span>
      </label>

      {on && (
        <div className="qinput__field ce-gst__how">
          <span className="qinput__label" id="ce-gst-how">
            Is GST already in your price?
          </span>
          <div className="call__chips" role="radiogroup" aria-labelledby="ce-gst-how">
            {[
              [false, 'No, add it on top'],
              [true, 'Yes, it’s included'],
            ].map(([value, text]) => (
              <button
                key={text}
                type="button"
                role="radio"
                aria-checked={included === value}
                className={`call__chip ${included === value ? 'call__chip--on' : ''}`}
                onClick={() => onIncluded(value)}
              >
                {text}
              </button>
            ))}
          </div>
          {pay > 0 && gst && (
            <p className="qinput__example">
              {included
                ? `People pay ${formatMoney(pay)}, of which ${formatMoney(gst.amount)} is GST.`
                : `People pay ${formatMoney(pay)} + ${formatMoney(gst.amount)} GST = ${formatMoney(pay + gst.amount)}.`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}