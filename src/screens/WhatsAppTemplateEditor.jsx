import { useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Bold,
  ChevronDown,
  ChevronRight,
  Italic,
  Lock,
  MonitorPlay,
  RotateCcw,
  Strikethrough,
  Users,
  XCircle,
} from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import { usePanel } from '../components/DatePicker';
import TemplatePhone from './TemplatePhone';
import WhatsAppMessageBox from './WhatsAppMessageBox';
import {
  DETAILS,
  LIMITS,
  NAME_EXAMPLE,
  NAME_RULE,
  PRODUCTS,
  buttonsOf,
  cleanName,
  messageProblems,
  rejectionOf,
  momentById,
  momentsOf,
  productById,
  saveDraft,
  submitTemplate,
  suggestName,
  takenBy,
  toMeta,
} from '../data/whatsappTemplates';
import './WhatsAppTemplateEditor.css';

// ------------------------------------------------------------
// Settings → WhatsApp → Templates → Create template: the coach's own
// wording for one of our reminders. Two steps.
//
// 1. What it's for: a 1:1 call or a webinar, then which message.
//
//   ← New template
//   What is it for?
//   ┌ 👥 1:1 calls ──────────┐ ┌ ▶ Webinars ────────────┐
//   │ Reminders before …     │ │ A confirmation …        │
//   └────────────────────────┘ └─────────────────────────┘
//   Which message?
//   ┌ 24 hours before                                   ›┐
//   │ Goes out 24 hours before the call.                 │
//   └────────────────────────────────────────────────────┘
//   …
//
// 2. The words, started from our own for that message, the way a call's
//    reminder emails are edited (CallReminderEditor.jsx):
//
//   ← New template
//     1:1 call · 2 hours before
//   ┌──────────────────────────────────────────┬──────────────┐
//   │ Name [call_2h_reminder_1]                 │ the message  │
//   │ Message   B I S          + Insert detail ▾│ on a phone,  │
//   │ Hi [First name], your *[Call name]* …     │ filled in    │
//   │ Buttons                                   │ for Priya    │
//   │ 🔒 Yes, I’ll be there  🔒 Can’t make it?…  │              │
//   │ [Save as draft]  [Submit for review]      │              │
//   └──────────────────────────────────────────┴──────────────┘
//
// What the moment decides, so the coach doesn't: the category (Utility),
// the buttons (the moment's own, fixed), and which details can go in.
// Details are tags the coach can't type into or change, only delete
// whole, with a hint on hover, as in the reminder emails' editor
// (WhatsAppMessageBox.jsx). Meta's {{1}} blanks and their examples are
// made on submit (toMeta in whatsappTemplates.js).
//
// The name is what Meta gets: lowercase letters, numbers and _ only,
// made so as they type. It's suggested from the message, numbered after
// ours (call_2h_reminder_1), and must be unique across theirs and ours:
// a taken one says whose it is, with the next free name one click away.
// Messages are in English only, for now.
//
// Save as draft: needs only a name. Submit: checks what Meta checks (and
// says what's wrong, beside it), then sends it for review. Submit needs a
// connected number.
//
// initial:     a template to edit, or to start from: has a product and a
//              moment (and copiedFrom, the original's name, for a
//              duplicate). null: start at step 1.
// connected:   a number is connected (Submit allowed)
// sender:      the business name, for the preview and Meta's examples
// taken:       every other template's name, theirs and ours, and whose it
//              is in words: [{ name, whose }]
// onDone():    back to the list
// ------------------------------------------------------------

const PRODUCT_ICON = { call: Users, webinar: MonitorPlay };

// What the buttons are for, in a sentence, by the moment's buttons. A
// message that asks for an answer (a quick reply among its buttons) says
// so, since its words should ask for it too.
const BUTTONS_WHY = {
  call: 'Added to every reminder for a call, so students can always join or change their booking.',
  webinar: 'Added to every webinar message, so people can always find the details and join.',
};
const ASKS_WHY =
  'This message asks students to confirm they’re coming, so its buttons stay as they are. Ask for their answer in your words too.';
const buttonsWhy = (product, buttons) =>
  buttons.some((b) => b.type === 'reply') ? ASKS_WHY : BUTTONS_WHY[product];

// A template being written: its name and words (details as {key})
function startFrom(initial, taken) {
  const { product, moment } = initial;
  return {
    id: initial.id,
    createdAt: initial.createdAt,
    product,
    moment,
    name: initial.name ?? suggestName(moment, taken),
    body: initial.body ?? momentById(moment)?.body ?? '',
  };
}

export default function WhatsAppTemplateEditor({ initial, connected, sender, taken = [], onDone }) {
  const [draft, setDraft] = useState(() => (initial?.moment ? startFrom(initial, taken) : null));
  const [product, setProduct] = useState(initial?.product ?? 'call'); // step 1's choice

  // Step 1: no message chosen yet
  if (!draft) {
    return (
      <MomentPicker
        product={product}
        onProduct={setProduct}
        onBack={onDone}
        onPick={(moment) => setDraft(startFrom({ product, moment }, taken))}
      />
    );
  }

  return (
    <Writer
      key={draft.moment}
      start={draft}
      fresh={!initial?.moment}
      editing={Boolean(initial?.id)}
      copiedFrom={initial?.copiedFrom ?? null}
      rejected={initial?.status === 'rejected' ? rejectionOf(initial) : null}
      connected={connected}
      sender={sender}
      taken={taken}
      onChangeMoment={() => {
        setProduct(draft.product);
        setDraft(null);
      }}
      onDone={onDone}
    />
  );
}

// ------------------------------------------------------------
// Step 1: what it's for
// ------------------------------------------------------------
function MomentPicker({ product, onProduct, onPick, onBack }) {
  return (
    <>
      <div className="oh__panel-head wte__head">
        <button type="button" className="wte__back" onClick={onBack} aria-label="Back to templates">
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <div>
          <h2 className="oh__panel-title">New template</h2>
          <p className="oh__panel-sub">Pick a message, and we’ll start you off with a default message.</p>
        </div>
      </div>

      <div className="settings__body wtk">
        <fieldset className="wtk__step">
          <legend className="wte__title">What is it for?</legend>
          <div className="wtk__products">
            {PRODUCTS.map((p) => {
              const Icon = PRODUCT_ICON[p.id];
              return (
                <label key={p.id} className={`wtk__product ${product === p.id ? 'wtk__product--on' : ''}`}>
                  <input
                    type="radio"
                    name="wtk-product"
                    className="wtk__radio"
                    value={p.id}
                    checked={product === p.id}
                    onChange={() => onProduct(p.id)}
                  />
                  <span className="wtk__product-icon" aria-hidden="true">
                    <Icon size={20} />
                  </span>
                  <span className="wtk__product-words">
                    <span className="wtk__product-name">{p.label}</span>
                    <span className="wtk__product-text">{p.text}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <section className="wtk__step" aria-labelledby="wtk-moments">
          <h3 id="wtk-moments" className="wte__title">
            Which message?
          </h3>
          <ul className="wtk__moments">
            {momentsOf(product).map((m) => (
              <li key={m.id}>
                <button type="button" className="wtk__moment" onClick={() => onPick(m.id)}>
                  <span className="wtk__moment-words">
                    <span className="wtk__moment-name">{m.name}</span>
                    <span className="wtk__moment-when">{m.when}</span>
                  </span>
                  <ChevronRight size={18} className="wtk__moment-go" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

// ------------------------------------------------------------
// Step 2: the words
// ------------------------------------------------------------
// start: { id?, createdAt?, product, moment, name, body }
// fresh: a new template, so ← goes back to step 1 to pick another message
// editing: one of theirs, saved before
// copiedFrom: the original's name, when it's a duplicate (the title says so)
// rejected: Meta's reason, when it's one Meta turned down (shown at the top)
function Writer({ start, fresh, editing, copiedFrom, rejected, connected, sender, taken, onChangeMoment, onDone }) {
  const [t, setT] = useState(start);
  const [errors, setErrors] = useState({});
  const [leaving, setLeaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const first = useRef(JSON.stringify(start));
  const box = useRef(null); // the message: wrap(), insertDetail()
  const [boxKey, setBoxKey] = useState(0); // a new one fills the box again (Reset to default message)

  const moment = momentById(t.moment);
  const product = productById(t.product);
  const ours = moment.body;
  const buttons = buttonsOf(t.product, t.moment);
  const changed = JSON.stringify(t) !== first.current;

  const set = (key, value) => {
    setT((x) => ({ ...x, [key]: value }));
    setErrors((e) => ({ ...e, [key]: null }));
  };

  // The template as it's kept
  const kept = () => ({
    id: t.id,
    createdAt: t.createdAt,
    name: t.name,
    product: t.product,
    moment: t.moment,
    language: 'English',
    category: 'UTILITY',
    body: t.body,
  });

  // ---------- Checks ----------
  // Whose the name is, when it's taken (said as they type, not only on submit)
  const owner = takenBy(t.name, taken);
  const checkName = () => {
    if (!t.name) return 'Give it a name.';
    if (!NAME_RULE.test(t.name)) return `Use lowercase letters, numbers and underscores, like ${NAME_EXAMPLE}.`;
    if (owner) return 'taken';
    return null;
  };
  // What would get it turned down, checked as they write (messageProblems)
  const problems = messageProblems(t.body, t.product);
  const blocking = problems.filter((p) => p.block);
  const [tried, setTried] = useState(false); // pressed Submit: the box shows as invalid

  const checkAll = () => {
    const name = checkName();
    const e = { name: name === 'taken' ? null : name };
    if (blocking.length) e.body = true;
    Object.keys(e).forEach((k) => e[k] ?? delete e[k]);
    return name === 'taken' ? { ...e, taken: true } : e;
  };

  const onSaveDraft = () => {
    const nameError = checkName();
    if (nameError) {
      setErrors({ name: nameError === 'taken' ? null : nameError });
      document.getElementById('wte-name')?.focus();
      return;
    }
    if (saveDraft(kept())) onDone();
  };
  const onSubmit = () => {
    setTried(true);
    const e = checkAll();
    setErrors(e);
    if (Object.keys(e).length) {
      const { taken: _, ...shown } = e;
      setErrors(shown);
      requestAnimationFrame(() => document.querySelector('.wte [aria-invalid="true"]')?.focus());
      return;
    }
    if (submitTemplate(kept(), sender)) onDone();
  };

  return (
    <>
      <div className="oh__panel-head wte__head">
        <button
          type="button"
          className="wte__back"
          // A new one goes back to step 1 (another message); a saved one, to the list
          onClick={() => (changed ? setLeaving(fresh ? 'moment' : true) : fresh ? onChangeMoment() : onDone())}
          aria-label={fresh ? 'Back to choosing the message' : 'Back to templates'}
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <div className="wte__head-words">
          <h2 className="oh__panel-title">
            {editing ? 'Edit template' : copiedFrom ? (
              <>
                Duplicate of <code className="wte__code wte__code--title">{copiedFrom}</code>
              </>
            ) : (
              'New template'
            )}
          </h2>
          <p className="wte__for">
            <span className="wte__for-what">
              {product.one} · {moment.name}
            </span>
          </p>
        </div>
      </div>

      <div className="settings__body wte">
        <div className="wte__form">
          {rejected && (
            <div className="wte__rejected" role="status">
              <XCircle size={18} className="wte__rejected-icon" aria-hidden="true" />
              <div>
                <p className="wte__rejected-title">Meta didn’t approve this template</p>
                <p className="wte__rejected-text">{rejected}</p>
                <p className="wte__rejected-text">Change it, then submit it again.</p>
              </div>
            </div>
          )}

          <Field id="wte-name" title="Template name" text={<NameRule />}>
            <input
              id="wte-name"
              className="wte__input wte__input--name"
              value={t.name}
              maxLength={60}
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="none"
              placeholder={NAME_EXAMPLE}
              // Made into a name Meta takes as they type
              onChange={(e) => set('name', cleanName(e.target.value))}
              aria-invalid={Boolean(owner || errors.name)}
              aria-describedby="wte-name-rule wte-name-error"
            />
            {owner ? (
              <NameTaken
                name={t.name}
                owner={owner}
                next={suggestName(t.moment, taken)}
                onUse={(name) => set('name', name)}
              />
            ) : (
              errors.name && (
                <p id="wte-name-error" className="wte__error">
                  {errors.name}
                </p>
              )
            )}
          </Field>

          <Field
            id="wte-body"
            title="Message"
            text="Change the default message or write your own. Add details with + Insert detail: they’re filled in for each student."
          >
            {/* Pressing these keeps the cursor in the message (as any editor's toolbar) */}
            <div
              className="wte__tools"
              role="toolbar"
              aria-label="Format the message"
              onMouseDown={(e) => e.target.closest('.wte__tool') && e.preventDefault()}
            >
              <button type="button" className="wte__tool" onClick={() => box.current.wrap('*')} aria-label="Bold" title="Bold">
                <Bold size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="wte__tool"
                onClick={() => box.current.wrap('_')}
                aria-label="Italic"
                title="Italic"
              >
                <Italic size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="wte__tool"
                onClick={() => box.current.wrap('~')}
                aria-label="Strikethrough"
                title="Strikethrough"
              >
                <Strikethrough size={16} aria-hidden="true" />
              </button>
              <DetailMenu details={DETAILS[t.product]} onPick={(d) => box.current.insertDetail(d.key)} />
            </div>
            <WhatsAppMessageBox
              key={boxKey}
              ref={box}
              initial={t.body}
              product={t.product}
              onChange={(body) => set('body', body)}
              labelledBy="wte-body-label"
              describedBy={problems.length ? 'wte-body-rule wte-body-problems' : 'wte-body-rule'}
              invalid={tried && blocking.length > 0}
            />
            <div className="wte__under">
              {t.body !== ours ? (
                <button type="button" className="wte__link wte__reset" onClick={() => setResetting(true)}>
                  <RotateCcw size={14} aria-hidden="true" />
                  Reset to default message
                </button>
              ) : (
                <span />
              )}
              <p className={`wte__count ${t.body.length > LIMITS.body ? 'wte__count--over' : ''}`}>
                {t.body.length}/{LIMITS.body}
              </p>
            </div>
            <Problems problems={problems} tried={tried} />
          </Field>

          {buttons.length > 0 && (
            <section className="wte__field" aria-labelledby="wte-buttons">
              <h3 id="wte-buttons" className="wte__title">
                Buttons
              </h3>
              <p className="wte__text">{buttonsWhy(t.product, buttons)}</p>
              <ul className="wte__locked">
                {buttons.map((b) => (
                  <li
                    key={b.key}
                    className="wte__lock"
                    tabIndex={0}
                    data-tip="Buttons can’t be edited"
                    data-tip-align="start"
                  >
                    <Lock size={15} className="wte__lock-icon" aria-hidden="true" />
                    <span className="wte__lock-name">{b.label}</span>
                    <span className="wte__lock-hint">{b.hint}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="wte__submit">
            <button type="button" className="es__btn es__btn--quiet" onClick={onSaveDraft}>
              Save as draft
            </button>
            <button type="button" className="oh__add" onClick={onSubmit} disabled={!connected}>
              {rejected ? 'Submit again' : 'Submit for review'}
            </button>
            <p className="wte__hint">
              {connected
                ? 'Meta checks it before it can be sent. Usually a few minutes, up to 24 hours.'
                : 'Connect your WhatsApp number to submit it to Meta.'}
            </p>
          </div>
        </div>

        <aside className="wte__preview" aria-label="Preview">
          <p className="wte__title">Preview</p>
          <p className="wte__text">What Priya gets, with her details filled in.</p>
          <div className="wte__phone">
            <TemplatePhone template={toMeta(kept(), sender)} sender={sender} />
          </div>
        </aside>
      </div>

      {leaving && (
        <ConfirmDialog
          title="Leave without saving?"
          confirmLabel="Leave"
          cancelLabel="Keep editing"
          onCancel={() => setLeaving(false)}
          onConfirm={leaving === 'moment' ? onChangeMoment : onDone}
        >
          <p>Your changes to this template will be lost.</p>
        </ConfirmDialog>
      )}

      {resetting && (
        <ConfirmDialog
          title="Reset to default message?"
          confirmLabel="Reset"
          onCancel={() => setResetting(false)}
          onConfirm={() => {
            set('body', ours);
            setBoxKey((k) => k + 1);
            setResetting(false);
          }}
        >
          <p>Your changes will be replaced with the default message for {moment.name.toLowerCase()}.</p>
        </ConfirmDialog>
      )}
    </>
  );
}

// "+ Insert detail": the details this product can fill in, each with what it fills in
function DetailMenu({ details, onPick }) {
  const { open, setOpen, close, wrapRef, triggerRef, onPanelKeyDown } = usePanel();
  return (
    <div className="wte__detail" ref={wrapRef}>
      <button
        type="button"
        ref={triggerRef}
        className="wte__tool wte__tool--text"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
      >
        + Insert detail
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div className="wte__menu" role="menu" aria-label="Insert a detail" onKeyDown={onPanelKeyDown}>
          {details.map((d, i) => (
            <button
              key={d.key}
              type="button"
              role="menuitem"
              className="wte__menu-item"
              autoFocus={i === 0}
              // Keeps the cursor where it was in the message
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                close(false);
                onPick(d);
              }}
            >
              <span className="wte__menu-name">{d.label}</span>
              <span className="wte__menu-hint">{d.hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// What would get the message turned down, as they write: one line each,
// red for what Submit waits on, amber for a warning. Once they've pressed
// Submit, the list is announced, so a screen reader hears why it waited.
function Problems({ problems, tried }) {
  if (!problems.length) return null;
  return (
    <ul id="wte-body-problems" className="wte__problems" role={tried ? 'alert' : undefined}>
      {problems.map((p) => {
        const Icon = p.block ? XCircle : AlertTriangle;
        return (
          <li key={p.id} className={`wte__problem ${p.block ? 'wte__problem--block' : 'wte__problem--warn'}`}>
            <Icon size={16} className="wte__problem-icon" aria-hidden="true" />
            <span>{p.text}</span>
          </li>
        );
      })}
    </ul>
  );
}

// What a name can be, as AiSensy says it, with one of ours as the example
function NameRule() {
  return (
    <>
      Lowercase letters, numbers and underscores only. No spaces or special characters. For example:{' '}
      <code className="wte__code">{NAME_EXAMPLE}</code>
    </>
  );
}

// The name is another template's: whose, and the next free one, one click away
function NameTaken({ name, owner, next, onUse }) {
  return (
    <div id="wte-name-error" className="wte__taken" role="alert">
      <p>
        <code className="wte__code">{name}</code> is already used by {owner.whose ?? 'another template'}.
      </p>
      {next !== name && (
        <button type="button" className="wte__use" onClick={() => onUse(next)}>
          Use {next}
        </button>
      )}
    </div>
  );
}

// A section: a title, a line under it, then the field
function Field({ id, title, text, error, children }) {
  return (
    <div className="wte__field">
      <label className="wte__title" htmlFor={id} id={`${id}-label`}>
        {title}
      </label>
      {text && (
        <p className="wte__text" id={`${id}-rule`}>
          {text}
        </p>
      )}
      {children}
      {error && (
        <p id={`${id}-error`} className="wte__error">
          {error}
        </p>
      )}
    </div>
  );
}