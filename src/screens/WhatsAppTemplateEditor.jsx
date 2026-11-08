import { useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, Bold, Italic, Plus, Strikethrough, Trash2 } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import TemplatePhone from './TemplatePhone';
import { LIMITS, blanksOf, saveDraft, submitTemplate } from '../data/whatsappTemplates';
import './WhatsAppTemplateEditor.css';

// ------------------------------------------------------------
// Settings → WhatsApp → Templates → Create template: AiSensy's "New
// Template Message" page, in our UI. Same sections, same order, with the
// preview on the right; only what our coaches don't need is left out.
//
//   ← New template message
//   ┌──────────────────────────────────────────┬──────────────┐
//   │ Template category    Template language   │ Template     │
//   │ Template name                            │ preview      │
//   │ Template format  [B][I][S] [+ Variable]  │ (a phone,    │
//   │   samples for {{1}}, {{2}} …             │  live)       │
//   │ Template footer (optional)               │              │
//   │ Interactive actions                      │              │
//   │   ○ None ○ Call to actions ○ Quick replies ○ All        │
//   │ [Save as draft]  [Submit]                │              │
//   └──────────────────────────────────────────┴──────────────┘
//
// Left out from AiSensy's: Time-to-live (premium there; we can set it for
// reminders ourselves), Template type (text only for now), the
// Authentication category and Copy code button (login codes and offers,
// not reminders), and the credits balance.
//
// Save as draft: needs only a name. Submit: checks everything Meta checks
// for (and says what's missing, beside it), then sends it for review.
// Submit needs a connected number.
//
// initial:     a template to edit, or to start from (Duplicate); null: empty
// connected:   a number is connected (Submit allowed)
// sender:      the business name, for the preview
// takenNames:  names already used by their other templates
// onDone():    back to the list
// ------------------------------------------------------------

const CATEGORIES = [
  { id: 'UTILITY', label: 'Utility', hint: 'Reminders and updates about something they booked.' },
  { id: 'MARKETING', label: 'Marketing', hint: 'Offers, announcements and invitations. Costs more per message.' },
];

// India's main languages first, then the rest, as Meta names them
const LANGUAGES = [
  'English',
  'Hindi',
  'Tamil',
  'Telugu',
  'Kannada',
  'Malayalam',
  'Marathi',
  'Bengali',
  'Gujarati',
  'Punjabi',
  'Urdu',
  'Arabic',
  'Chinese (CHN)',
  'Dutch',
  'French',
  'German',
  'Indonesian',
  'Italian',
  'Japanese',
  'Malay',
  'Portuguese (BR)',
  'Russian',
  'Spanish',
  'Swahili',
  'Thai',
  'Turkish',
];

const ACTIONS = [
  { id: 'none', label: 'None' },
  { id: 'cta', label: 'Call to actions' },
  { id: 'replies', label: 'Quick replies' },
  { id: 'all', label: 'All' },
];

const BUTTON_KINDS = {
  reply: { label: 'Quick reply', max: LIMITS.replies, in: ['replies', 'all'] },
  url: { label: 'URL', max: LIMITS.urls, in: ['cta', 'all'] },
  phone: { label: 'Phone number', max: LIMITS.phones, in: ['cta', 'all'] },
};

const EMPTY = {
  category: 'UTILITY',
  language: 'English',
  name: '',
  body: '',
  samples: {},
  footer: '',
  action: 'none',
  buttons: [],
};

const NAME_RULE = /^[a-z0-9_]+$/;

export default function WhatsAppTemplateEditor({ initial, connected, sender, takenNames = [], onDone }) {
  const [t, setT] = useState(() => ({ ...EMPTY, ...initial }));
  const [errors, setErrors] = useState({});
  const [leaving, setLeaving] = useState(false);
  const start = useRef(JSON.stringify({ ...EMPTY, ...initial }));
  const body = useRef(null);
  const editing = Boolean(initial?.id);

  const set = (key, value) => {
    setT((x) => ({ ...x, [key]: value }));
    setErrors((e) => ({ ...e, [key]: null }));
  };
  const changed = JSON.stringify(t) !== start.current;

  // Where the cursor goes once the message has changed: placed as it
  // updates, so typing straight after a toolbar button lands right there
  const caret = useRef(null);
  useLayoutEffect(() => {
    if (!caret.current) return;
    const [a, b] = caret.current;
    caret.current = null;
    body.current?.setSelectionRange(a, b);
  });
  const blanks = blanksOf(t.body);

  // ---------- The message: formatting and variables, at the cursor ----------
  const wrap = (mark) => {
    const el = body.current;
    const [a, b] = [el.selectionStart, el.selectionEnd];
    const next = t.body.slice(0, a) + mark + t.body.slice(a, b) + mark + t.body.slice(b);
    caret.current = [a + 1, b + 1];
    set('body', next.slice(0, LIMITS.body));
    el.focus();
  };
  const addVariable = () => {
    const el = body.current;
    const n = (blanks.at(-1) ?? 0) + 1;
    const token = `{{${n}}}`;
    const at = el.selectionStart ?? t.body.length;
    caret.current = [at + token.length, at + token.length];
    set('body', (t.body.slice(0, at) + token + t.body.slice(at)).slice(0, LIMITS.body));
    el.focus();
  };

  // ---------- Buttons ----------
  const kindsFor = (action) => Object.keys(BUTTON_KINDS).filter((k) => BUTTON_KINDS[k].in.includes(action));
  const setAction = (action) => {
    const allowed = kindsFor(action);
    setT((x) => ({ ...x, action, buttons: x.buttons.filter((b) => allowed.includes(b.type)) }));
    setErrors((e) => ({ ...e, buttons: null }));
  };
  const count = (type) => t.buttons.filter((b) => b.type === type).length;
  const addButton = (type) => set('buttons', [...t.buttons, { type, text: '', url: '', phone: '' }]);
  const setButton = (i, key, value) =>
    set(
      'buttons',
      t.buttons.map((b, j) => (j === i ? { ...b, [key]: value } : b)),
    );
  const removeButton = (i) =>
    set(
      'buttons',
      t.buttons.filter((_, j) => j !== i),
    );

  // ---------- Checks ----------
  const checkName = () => {
    if (!t.name) return 'Give it a name.';
    if (!NAME_RULE.test(t.name)) return 'Only lowercase letters, numbers and underscores.';
    if (takenNames.includes(t.name)) return 'You already have a template with this name.';
    return null;
  };
  const checkAll = () => {
    const e = { name: checkName() };
    if (!t.body.trim()) e.body = 'Write the message.';
    else if (/^\s*\{\{\d+\}\}/.test(t.body) || /\{\{\d+\}\}\s*$/.test(t.body))
      e.body = 'Meta rejects messages that start or end with a variable. Add words before or after it.';
    else if (blanks.some((n, i) => n !== i + 1)) e.body = 'Number the variables in order: {{1}}, {{2}}, {{3}} …';
    if (blanks.some((n) => !t.samples[n]?.trim())) e.samples = 'Give an example for each variable. Meta asks for them.';
    if (t.footer.length > LIMITS.footer) e.footer = `Up to ${LIMITS.footer} characters.`;
    t.buttons.forEach((b, i) => {
      if (!b.text.trim()) e[`button${i}`] = 'Add the button’s words.';
      else if (b.type === 'url' && !/^https?:\/\/\S+\.\S+/.test(b.url))
        e[`button${i}`] = 'Add a full link, starting https://';
      else if (b.type === 'phone' && b.phone.replace(/\D/g, '').length < 8)
        e[`button${i}`] = 'Add a phone number, with its country code.';
    });
    if (t.action !== 'none' && t.buttons.length === 0) e.buttons = 'Add a button, or choose None.';
    Object.keys(e).forEach((k) => e[k] ?? delete e[k]);
    return e;
  };

  // Only the samples for blanks still in the message are kept
  const cleaned = () => ({ ...t, samples: Object.fromEntries(blanks.map((n) => [n, t.samples[n] ?? ''])) });

  const onSaveDraft = () => {
    const nameError = checkName();
    if (nameError) return setErrors({ name: nameError });
    if (saveDraft(cleaned())) onDone();
  };
  const onSubmit = () => {
    const e = checkAll();
    setErrors(e);
    if (Object.keys(e).length) {
      requestAnimationFrame(() => document.querySelector('.wte [aria-invalid="true"]')?.focus());
      return;
    }
    if (submitTemplate(cleaned())) onDone();
  };

  return (
    <>
      <div className="oh__panel-head wte__head">
        <button
          type="button"
          className="wte__back"
          onClick={() => (changed ? setLeaving(true) : onDone())}
          aria-label="Back to templates"
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <h2 className="oh__panel-title">{editing ? 'Edit template message' : 'New template message'}</h2>
      </div>

      <div className="settings__body wte">
        <div className="wte__form">
          <div className="wte__pair">
            <Field
              id="wte-category"
              title="Template category"
              text="Your template should fall under one of these categories."
            >
              <select
                id="wte-category"
                className="wte__input"
                value={t.category}
                onChange={(e) => set('category', e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <p className="wte__hint">{CATEGORIES.find((c) => c.id === t.category).hint}</p>
            </Field>

            <Field id="wte-language" title="Template language" text="The language the message is written in.">
              <select
                id="wte-language"
                className="wte__input"
                value={t.language}
                onChange={(e) => set('language', e.target.value)}
              >
                {LANGUAGES.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field
            id="wte-name"
            title="Template name"
            text="Lowercase letters, numbers and underscores only. For example: session_reminder_tamil"
            error={errors.name}
          >
            <input
              id="wte-name"
              className="wte__input"
              value={t.name}
              maxLength={60}
              placeholder="Enter name"
              // Typed spaces and capitals become what Meta allows
              onChange={(e) => set('name', e.target.value.toLowerCase().replace(/[\s-]+/g, '_'))}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'wte-name-error' : undefined}
            />
          </Field>

          <Field
            id="wte-body"
            title="Template format"
            text="Use *bold*, _italic_ and ~strikethrough~. Add a variable for anything that changes per student, like their name: {{1}}."
            error={errors.body}
          >
            {/* Pressing these keeps the cursor in the message (as any editor's toolbar) */}
            <div
              className="wte__tools"
              role="toolbar"
              aria-label="Format the message"
              onMouseDown={(e) => e.target.closest('button') && e.preventDefault()}
            >
              <button type="button" className="wte__tool" onClick={() => wrap('*')} aria-label="Bold">
                <Bold size={16} aria-hidden="true" />
              </button>
              <button type="button" className="wte__tool" onClick={() => wrap('_')} aria-label="Italic">
                <Italic size={16} aria-hidden="true" />
              </button>
              <button type="button" className="wte__tool" onClick={() => wrap('~')} aria-label="Strikethrough">
                <Strikethrough size={16} aria-hidden="true" />
              </button>
              <button type="button" className="wte__tool wte__tool--text" onClick={addVariable}>
                <Plus size={15} aria-hidden="true" />
                Add variable
              </button>
            </div>
            <textarea
              id="wte-body"
              ref={body}
              className="wte__input wte__textarea"
              value={t.body}
              maxLength={LIMITS.body}
              rows={6}
              placeholder="Enter your message in here…"
              onChange={(e) => set('body', e.target.value)}
              aria-invalid={Boolean(errors.body)}
              aria-describedby={errors.body ? 'wte-body-error' : undefined}
            />
            <p className="wte__count">
              {t.body.length}/{LIMITS.body}
            </p>

            {blanks.length > 0 && (
              <div className="wte__samples">
                <p className="wte__label">Sample values</p>
                <p className="wte__hint">An example for each variable, so Meta can see how the message reads.</p>
                {blanks.map((n) => (
                  <label key={n} className="wte__sample">
                    <span className="wte__sample-tag">{`{{${n}}}`}</span>
                    <input
                      className="wte__input"
                      value={t.samples[n] ?? ''}
                      maxLength={60}
                      placeholder={n === 1 ? 'e.g. Priya' : 'e.g. Thu 12 Nov, 4:00 pm'}
                      onChange={(e) => set('samples', { ...t.samples, [n]: e.target.value })}
                      aria-invalid={Boolean(errors.samples && !t.samples[n]?.trim())}
                    />
                  </label>
                ))}
                {errors.samples && <p className="wte__error">{errors.samples}</p>}
              </div>
            )}
          </Field>

          <Field
            id="wte-footer"
            title="Template footer"
            optional
            text={`A short line under the message. Up to ${LIMITS.footer} characters.`}
            error={errors.footer}
          >
            <input
              id="wte-footer"
              className="wte__input"
              value={t.footer}
              maxLength={LIMITS.footer}
              placeholder="Enter footer text here"
              onChange={(e) => set('footer', e.target.value)}
            />
          </Field>

          <fieldset className="wte__field wte__actions">
            <legend className="wte__title">Interactive actions</legend>
            <p className="wte__text">Buttons under your message. Up to {LIMITS.button} characters on each.</p>
            <div className="wte__radios">
              {ACTIONS.map((a) => (
                <label key={a.id} className="wte__radio">
                  <input
                    type="radio"
                    name="wte-action"
                    value={a.id}
                    checked={t.action === a.id}
                    onChange={() => setAction(a.id)}
                  />
                  {a.label}
                </label>
              ))}
            </div>

            {t.action !== 'none' && (
              <div className="wte__adds">
                {kindsFor(t.action).map((type) => (
                  <button
                    key={type}
                    type="button"
                    className="wte__add"
                    onClick={() => addButton(type)}
                    disabled={count(type) >= BUTTON_KINDS[type].max}
                  >
                    <Plus size={15} aria-hidden="true" />
                    {BUTTON_KINDS[type].label}
                    <span className="wte__add-count">{BUTTON_KINDS[type].max - count(type)}</span>
                  </button>
                ))}
              </div>
            )}
            {errors.buttons && <p className="wte__error">{errors.buttons}</p>}

            {t.buttons.map((b, i) => (
              <div key={i} className="wte__button">
                <span className="wte__button-kind">{BUTTON_KINDS[b.type].label}</span>
                <input
                  className="wte__input"
                  value={b.text}
                  maxLength={LIMITS.button}
                  placeholder="Button text"
                  aria-label={`${BUTTON_KINDS[b.type].label} button text`}
                  onChange={(e) => setButton(i, 'text', e.target.value)}
                  aria-invalid={Boolean(errors[`button${i}`] && !b.text.trim())}
                />
                {b.type === 'url' && (
                  <input
                    className="wte__input"
                    value={b.url}
                    placeholder="https://"
                    inputMode="url"
                    aria-label="Link"
                    onChange={(e) => setButton(i, 'url', e.target.value)}
                  />
                )}
                {b.type === 'phone' && (
                  <input
                    className="wte__input"
                    value={b.phone}
                    placeholder="+91 98765 43210"
                    inputMode="tel"
                    aria-label="Phone number"
                    onChange={(e) => setButton(i, 'phone', e.target.value)}
                  />
                )}
                <button
                  type="button"
                  className="wte__remove"
                  onClick={() => removeButton(i)}
                  aria-label="Remove button"
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
                {errors[`button${i}`] && <p className="wte__error wte__button-error">{errors[`button${i}`]}</p>}
              </div>
            ))}
          </fieldset>

          <div className="wte__submit">
            <button type="button" className="es__btn es__btn--quiet" onClick={onSaveDraft}>
              Save as draft
            </button>
            <button type="button" className="oh__add" onClick={onSubmit} disabled={!connected}>
              Submit
            </button>
            {!connected && <p className="wte__hint">Connect your WhatsApp number to submit to Meta.</p>}
          </div>
        </div>

        <aside className="wte__preview" aria-label="Template preview">
          <p className="wte__title">Template preview</p>
          <p className="wte__text">It updates as you fill in the form.</p>
          <div className="wte__phone">
            <TemplatePhone template={t} sender={sender} />
          </div>
        </aside>
      </div>

      {leaving && (
        <ConfirmDialog
          title="Leave without saving?"
          confirmLabel="Leave"
          cancelLabel="Keep editing"
          onCancel={() => setLeaving(false)}
          onConfirm={onDone}
        >
          <p>Your changes to this template will be lost.</p>
        </ConfirmDialog>
      )}
    </>
  );
}

// A section, as AiSensy's: a title, a line under it, then the field
function Field({ id, title, text, optional = false, error, children }) {
  return (
    <div className="wte__field">
      <label className="wte__title" htmlFor={id}>
        {title}
        {optional && <span className="wte__optional"> (optional)</span>}
      </label>
      <p className="wte__text">{text}</p>
      {children}
      {error && (
        <p id={`${id}-error`} className="wte__error">
          {error}
        </p>
      )}
    </div>
  );
}