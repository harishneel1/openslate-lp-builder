import { useEffect, useState } from 'react';
import { BUTTONS, MESSAGES, RETIRED } from './whatsappMessages';

// ------------------------------------------------------------
// The coach's own WhatsApp templates, made in Settings → WhatsApp →
// Templates → Create template (WhatsAppTemplateEditor.jsx). Our ready-made
// ones live in whatsappMessages.js; these sit beside them in the same list.
//
// Each one is the coach's own wording for one of our reminders (a
// "moment": a 1:1 call's 2 hours before, a webinar's confirmation …). The
// moment decides everything a coach shouldn't have to: the category
// (always Utility: reminders about something they booked), the buttons
// (the moment's own, as on our ready-made message), and which details can
// be filled in.
//
// Kept in this browser (the stand-in):
//   [{
//     id,
//     name: 'call_2h_reminder_1',  lowercase letters, numbers and _ only
//                               (Meta's rule), unique across theirs and
//                               ours (READY_MADE_NAMES)
//     product: 'call' | 'webinar',
//     moment: 'call-2h',        one of MESSAGES[product] (whatsappMessages.js),
//                               or, for an older one, a message we no
//                               longer send (RETIRED: see isRetired)
//     language: 'English',     only English, for now
//     category: 'UTILITY',
//     body: 'Hi {first_name}, …',  WhatsApp's formatting (*bold*, _italic_,
//                               ~strike~); details as {key}, from DETAILS
//     status: 'draft' | 'review' | 'approved' | 'rejected',
//     reason: 'unclear' | …       why Meta turned it down (REJECTIONS)
//     createdAt, sentAt, decidedAt, reviewEndsAt: ISO strings,
//     meta: { … }               what was sent to Meta (toMeta), on submit
//   }]
//
// Older saves (made with the first editor, AiSensy's form) have no
// moment, and keep their own {{1}} body, samples, footer and buttons.
// They still show in the list and on the phone, and can be deleted; to
// change one, the coach starts a new one (isLegacy).
//
// Submit sends one to Meta: "In review", and the stand-in approves it a
// little later (or rejects it, when the prototype controls say so).
// ------------------------------------------------------------

// ---------- What a template can be for ----------
export const PRODUCTS = [
  { id: 'call', label: '1:1 calls', one: '1:1 call', text: 'A confirmation when someone books, then reminders.' },
  { id: 'webinar', label: 'Webinars', one: 'Webinar', text: 'A confirmation when someone registers, then reminders.' },
];
export const productById = (id) => PRODUCTS.find((p) => p.id === id);

// The moments of a product: our ready-made messages (whatsappMessages.js).
// Only the ones we send: a new template can't be made for a retired one.
export const momentsOf = (product) => MESSAGES[product] ?? [];
// Any moment, retired ones too, so an older template still says what it was for
export const momentById = (id) =>
  [...MESSAGES.call, ...MESSAGES.webinar, ...RETIRED.call, ...RETIRED.webinar].find((m) => m.id === id) ?? null;

// Made for a message we no longer send (a 1:1 call's 1 hour before): it
// still shows in Templates and can be deleted, but it can't be picked,
// edited or duplicated. Its row says what replaced it.
export const isRetired = (t) => Boolean(t?.moment && momentById(t.moment)?.retired);

// The buttons a moment's message always has: [{ key, label, hint, type }]
// (type 'reply' for a quick reply; none for a link)
export const buttonsOf = (product, momentId) =>
  (momentById(momentId)?.buttons ?? []).map((key) => ({ key, ...BUTTONS[product][key] }));

// ---------- Details: what's filled in for each student ----------
// What "+ Insert detail" offers for each product. The keys are our
// ready-made messages' own, so their wording starts a template as it is.
export const DETAILS = {
  call: [
    { key: 'first_name', label: 'First name', hint: 'Each student’s first name' },
    { key: 'call', label: 'Call name', hint: 'The name of the call they booked' },
    { key: 'date', label: 'Date', hint: 'The call’s date, e.g. Thu 12 Nov' },
    { key: 'time', label: 'Time', hint: 'The call’s time, e.g. 4:00 pm' },
    { key: 'host', label: 'Coach name', hint: 'Your name as the coach' },
  ],
  webinar: [
    { key: 'first_name', label: 'First name', hint: 'Each person’s first name' },
    { key: 'webinar', label: 'Webinar name', hint: 'The webinar’s title' },
    { key: 'date', label: 'Date', hint: 'The webinar’s date, e.g. Thu 12 Nov' },
    { key: 'time', label: 'Time', hint: 'The webinar’s time, e.g. 7:00 pm' },
    { key: 'host', label: 'Coach name', hint: 'Your name as the coach' },
  ],
};

// What the sample booking fills in: the preview's, and the examples Meta asks for
export const sampleValues = (product, sender) => ({
  first_name: 'Priya',
  host: sender,
  call: 'Discovery call',
  webinar: 'Grow your practice',
  batch: 'Morning yoga',
  date: 'Thu 12 Nov',
  next: 'Thu 19 Nov',
  time: product === 'call' ? '4:00 pm' : '7:00 pm',
});

// The coach writes details by name, {First name}; they're kept by key, {first_name}
export function toLabels(body, product) {
  const details = DETAILS[product] ?? [];
  return String(body ?? '').replace(/\{(\w+)\}/g, (all, key) => {
    const d = details.find((x) => x.key === key);
    return d ? `{${d.label}}` : all;
  });
}

export function toKeys(text, product) {
  const details = DETAILS[product] ?? [];
  return String(text ?? '').replace(/\{([^{}\n]+)\}/g, (all, name) => {
    const d = details.find((x) => x.label.toLowerCase() === name.trim().toLowerCase());
    return d ? `{${d.key}}` : all;
  });
}

// Anything in {braces} that isn't a detail we can fill in: ['Course']
export function unknownDetails(text, product) {
  const known = (DETAILS[product] ?? []).map((d) => d.label.toLowerCase());
  return [...String(text ?? '').matchAll(/\{([^{}\n]*)\}/g)]
    .map((m) => m[1].trim())
    .filter((name) => !known.includes(name.toLowerCase()));
}

// ---------- Names ----------
// Meta's rule, and ours: lowercase letters, numbers and _ only, with at
// least one letter or number. What the coach sees is what Meta gets.
export const NAME_RULE = /^(?=.*[a-z0-9])[a-z0-9_]+$/;
export const NAME_EXAMPLE = 'discovery_call_5min_reminder';

// What they type, made into a name Meta takes as they type it: capitals
// become lowercase, spaces and dashes _, anything else is dropped
export const cleanName = (text) =>
  String(text ?? '')
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');

// Our ready-made templates' names, which are always taken:
// [{ name: 'call_24h_reminder', label: '1:1 call · 24 hours before' }]
export const READY_MADE_NAMES = PRODUCTS.flatMap((p) =>
  momentsOf(p.id).map((m) => ({ name: m.template, label: `${p.one} · ${m.name}` })),
).concat((MESSAGES.batch ?? []).map((m) => ({ name: m.template, label: `Live class · ${m.name}` })));

// The template a taken name belongs to, or null
// taken: [{ name, … }], every other template's
export const takenBy = (name, taken = []) => taken.find((t) => t.name === name) ?? null;

// The first free name for a message: its own name numbered, since ours
// always has the plain one: call_24h_reminder_1, then _2 …
export function suggestName(momentId, taken = []) {
  const base = momentById(momentId)?.template ?? 'reminder';
  if (!takenBy(base, taken)) return base;
  let n = 1;
  while (takenBy(`${base}_${n}`, taken)) n += 1;
  return `${base}_${n}`;
}

// ---------- Checks: what gets a reminder turned down ----------
// The common reasons Meta turns down a Utility message, checked as the
// coach writes, so "Not approved" is rare. Each says what's wrong and
// how to fix it, in a line.
//   block: true   Submit waits until it's fixed (Save as draft doesn't)
//   block: false  a warning: Meta may turn it down, but it can go
// body: details as {key}

// Words that make a reminder read as an advert (Meta's "marketing")
const PROMO = [
  'offer',
  'offers',
  'discount',
  'discounts',
  'sale',
  'coupon',
  'promo',
  'cashback',
  'deal',
  'deals',
  'hurry',
  'buy now',
  'limited seats',
  'limited time',
  'limited period',
  'early bird',
  'special price',
  'last chance',
  'don’t miss',
  "don't miss",
];

// How many words around each detail, at least, for Meta to see what the
// message is about
export const WORDS_PER_DETAIL = 2;

export function messageProblems(body, product) {
  const text = String(body ?? '');
  const known = (DETAILS[product] ?? []).map((d) => d.key);
  const plain = text.replace(/\{\w+\}/g, ' ').replace(/[*_~]/g, ' ');
  const details = [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
  const words = plain.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
  const out = [];

  if (!words.length && !details.length) return [{ id: 'empty', block: true, text: 'Write the message.' }];
  if (text.length > LIMITS.body) out.push({ id: 'long', block: true, text: `Keep it to ${LIMITS.body} characters.` });
  if (details.some((k) => !known.includes(k)))
    out.push({ id: 'unknown', block: true, text: 'A detail here can’t be filled in. Delete it and add it again with + Insert detail.' });
  if (/^[\s*_~]*\{\w+\}/.test(text) || /\{\w+\}[\s*_~.!?]*$/.test(text))
    out.push({
      id: 'edge',
      block: true,
      text: 'Meta turns down messages that start or end with a detail. Add a few words before or after it.',
    });
  if (/\{\w+\}[\s*_~]*\{\w+\}/.test(text))
    out.push({
      id: 'together',
      block: true,
      text: 'Two details sit side by side. Put a word or two between them, like “with” or “at”.',
    });
  if (details.length && words.length < details.length * WORDS_PER_DETAIL)
    out.push({
      id: 'thin',
      block: true,
      text: 'There are a lot of details for so few words. Add a little more about what the message is for.',
    });
  if (/(https?:\/\/|www\.)\S+|\b[\w-]+\.(com|in|net|org|io|me|co|link|app)\b/i.test(plain))
    out.push({
      id: 'link',
      block: true,
      text: 'Take the link out of the message. The buttons under it already take students where they need to go.',
    });
  const lower = plain.toLowerCase();
  const promo = PROMO.find((w) => new RegExp(`(^|[^\\p{L}])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}])`, 'u').test(lower));
  if (promo || /\d+\s?%\s?off/i.test(plain))
    out.push({
      id: 'promo',
      block: false,
      text: `“${promo ?? '% off'}” reads like an advert. Meta may turn the reminder down as marketing: keep it to the booking.`,
    });
  return out;
}

// callOneHourBefore → call_one_hour_before (older saves only)
const snakeOf = (name) =>
  cleanName(
    String(name ?? '')
      .replace(/([a-z])([A-Z0-9])/g, '$1_$2')
      .replace(/([0-9])([A-Za-z])/g, '$1_$2'),
  );

// A copy's name: the original's with _duplicate, numbered if that's
// taken (call_24h_reminder_duplicate, then _duplicate_2 …), kept within
// the name field's 60 characters
export const NAME_MAX = 60;
export function duplicateName(original, taken = []) {
  const make = (n) => {
    const tail = n === 1 ? '_duplicate' : `_duplicate_${n}`;
    return `${String(original).slice(0, NAME_MAX - tail.length)}${tail}`;
  };
  let n = 1;
  while (takenBy(make(n), taken)) n += 1;
  return make(n);
}

// One made with the first editor: no moment
export const isLegacy = (t) => !t?.moment;

// ---------- What Meta gets ----------
// Our {key} details become Meta's numbered blanks, in order of first
// appearance, each with its example from the sample booking; the buttons
// are the moment's. Only ever built here: the coach never sees {{1}}.
export function toMeta(t, sender = '') {
  if (isLegacy(t)) return t;
  const values = sampleValues(t.product, sender);
  const order = [];
  const body = String(t.body ?? '').replace(/\{(\w+)\}/g, (all, key) => {
    if (!(DETAILS[t.product] ?? []).some((d) => d.key === key)) return all;
    if (!order.includes(key)) order.push(key);
    return `{{${order.indexOf(key) + 1}}}`;
  });
  return {
    name: t.name,
    category: t.category ?? 'UTILITY',
    language: 'English',
    body,
    samples: Object.fromEntries(order.map((key, i) => [i + 1, values[key] ?? ''])),
    footer: '',
    buttons: buttonsOf(t.product, t.moment).map((b) => ({ type: b.type === 'reply' ? 'reply' : 'url', text: b.label })),
  };
}

const KEY = 'pagebuilder:mock-whatsapp-templates';
const NEXT_KEY = 'pagebuilder:mock-whatsapp-next-template-review';
export const TEMPLATES_CHANGED_EVENT = 'whatsapp-templates-changed';

const REVIEW_MS = 15 * 1000;

// Why Meta turns a template down: the stand-in's reasons, in the words
// a coach can act on. The real ones come from our WhatsApp partner;
// these are the common ones for reminders.
export const REJECTIONS = {
  unclear: {
    label: 'Unclear',
    text: 'Meta found it unclear why the message is being sent. Say what it’s about: the booking, and when it is.',
  },
  marketing: {
    label: 'Reads as marketing',
    text: 'Meta read this as marketing. Reminders have to stick to the booking: what, when and how to join.',
  },
  details: {
    label: 'Too many details',
    text: 'Meta found too many details for the words around them. Add a little more about what the message is for.',
  },
};

// Why Meta turned this one down (older saves: Unclear)
export const rejectionOf = (t) => REJECTIONS[t?.reason]?.text ?? REJECTIONS.unclear.text;

export const LIMITS = { body: 1024, footer: 60, button: 25, replies: 3, urls: 2, phones: 1 };

export function loadTemplates() {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    // Saved while names were camelCase (callOneHourBefore): as Meta's
    return Array.isArray(all) ? all.map((t) => (t?.moment && !NAME_RULE.test(t.name) ? { ...t, name: snakeOf(t.name) } : t)) : [];
  } catch {
    return [];
  }
}

function saveAll(all) {
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    return false;
  }
  window.dispatchEvent(new Event(TEMPLATES_CHANGED_EVENT));
  return true;
}

const now = () => new Date().toISOString();

// Saved as a draft: new, or changes to one not yet with Meta
export function saveDraft(template) {
  const all = loadTemplates();
  const saved = {
    ...template,
    id: template.id ?? `tpl-${Date.now()}`,
    status: 'draft',
    createdAt: template.createdAt ?? now(),
  };
  const at = all.findIndex((t) => t.id === saved.id);
  if (at >= 0) all[at] = saved;
  else all.unshift(saved);
  return saveAll(all) ? saved : null;
}

// Submitted to Meta: saved, and in review
export function submitTemplate(template, sender = '') {
  const draft = saveDraft(template);
  if (!draft) return null;
  const all = loadTemplates().map((t) =>
    t.id === draft.id
      ? {
          ...t,
          status: 'review',
          sentAt: now(),
          decidedAt: null,
          reviewEndsAt: new Date(Date.now() + REVIEW_MS).toISOString(),
          outcome: takeNextOutcome(),
          meta: isLegacy(t) ? undefined : toMeta(t, sender),
        }
      : t,
  );
  return saveAll(all) ? all.find((t) => t.id === draft.id) : null;
}

// Deleted: and every reminder that sent it goes back to our default,
// with a note on the row saying so (choices below)
export function deleteTemplate(id) {
  const gone = loadTemplates().find((t) => t.id === id);
  const ok = saveAll(loadTemplates().filter((t) => t.id !== id));
  if (ok && gone) dropChoicesOf(gone);
  return ok;
}

// The stand-in for Meta: reviews that are due, decided
export function settleTemplates() {
  const all = loadTemplates();
  let changed = false;
  const settled = all.map((t) => {
    if (t.status !== 'review' || !t.reviewEndsAt || Date.now() < Date.parse(t.reviewEndsAt)) return t;
    changed = true;
    const [verdict, reason] = String(t.outcome ?? 'approve').split(':');
    return verdict === 'reject'
      ? { ...t, status: 'rejected', reason: REJECTIONS[reason] ? reason : 'unclear', decidedAt: t.reviewEndsAt }
      : { ...t, status: 'approved', reason: undefined, decidedAt: t.reviewEndsAt };
  });
  if (changed) saveAll(settled);
}

// Prototype: how Meta's next review goes: 'approve', or 'reject:<reason>'
// (a REJECTIONS id)
export function nextOutcome() {
  try {
    const saved = localStorage.getItem(NEXT_KEY) ?? 'approve';
    if (saved === 'reject') return 'reject:unclear'; // older saves
    const [verdict, reason] = saved.split(':');
    return verdict === 'reject' && REJECTIONS[reason] ? saved : 'approve';
  } catch {
    return 'approve';
  }
}

export function setNextOutcome(outcome) {
  try {
    localStorage.setItem(NEXT_KEY, outcome);
  } catch {
    // fine: the choice just won't stick
  }
  window.dispatchEvent(new Event(TEMPLATES_CHANGED_EVENT));
}

function takeNextOutcome() {
  const outcome = nextOutcome();
  if (outcome !== 'approve') setNextOutcome('approve'); // once, so trying again goes through
  return outcome;
}

// Prototype: decide every review now
export function decideReviewsNow() {
  saveAll(loadTemplates().map((t) => (t.status === 'review' ? { ...t, reviewEndsAt: now() } : t)));
  settleTemplates();
}

// Prototype: remove every template of their own
export const clearTemplates = () => saveAll([]);

// The coach's templates, kept up to date (and reviews settled as they're due)
export function useTemplates() {
  const [all, setAll] = useState(loadTemplates);
  useEffect(() => {
    const refresh = () => setAll(loadTemplates());
    window.addEventListener(TEMPLATES_CHANGED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    settleTemplates();
    const id = setInterval(settleTemplates, 2000);
    return () => {
      window.removeEventListener(TEMPLATES_CHANGED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
      clearInterval(id);
    };
  }, []);
  return all;
}

// ---------- Blanks ----------
// The numbers of the blanks in a message, in order: 'Hi {{1}}, {{2}}' → [1, 2]
export function blanksOf(body) {
  const found = [...String(body).matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
  return [...new Set(found)].sort((a, b) => a - b);
}
// ---------- Which template each reminder sends ----------
// A webinar's or a 1:1 call's Reminders → WhatsApp tab picks, for each of
// its messages, our default or one of the coach's approved templates made
// for that same message (WhatsAppTemplatePicker.jsx). Picked per webinar
// session or call, the same keys as the on/off switches (whatsappMessages.js).
//
// Kept in this browser (the stand-in):
//   { 'call:<id>': {
//       name: 'Discovery call',          for "Used on …" in Templates
//       picks: { 'call-24h': 'tpl-…' },  missing: our default
//       fellBack: { 'call-24h': 'discovery_call_24h_reminder' },
//                                         a picked one was deleted: our
//                                         default goes now, and the row says so
//   } }
const CHOICES_KEY = 'pagebuilder:mock-whatsapp-choices';
export const CHOICES_CHANGED_EVENT = 'whatsapp-choices-changed';

function loadChoices() {
  try {
    const all = JSON.parse(localStorage.getItem(CHOICES_KEY) ?? '{}');
    return all && typeof all === 'object' && !Array.isArray(all) ? all : {};
  } catch {
    return {};
  }
}

function saveChoices(all) {
  try {
    localStorage.setItem(CHOICES_KEY, JSON.stringify(all));
  } catch {
    return false;
  }
  window.dispatchEvent(new Event(CHOICES_CHANGED_EVENT));
  return true;
}

// One webinar session's or call's choices: { picks, fellBack, retired }
//   retired: { 'call-2h': { name: 'call_1h_reminder_1', was: '1 hour before' } }
//     a template of theirs picked for a message we no longer send: ours
//     goes for the message that replaced it, and the row says so until
//     they pick one for it (worked out, not saved)
export function choicesOf(offering) {
  const c = loadChoices()[offering] ?? {};
  const picks = c.picks ?? {};
  const retired = {};
  for (const old of [...RETIRED.call, ...RETIRED.webinar]) {
    if (!picks[old.id] || picks[old.replacedBy]) continue;
    const t = loadTemplates().find((x) => x.id === picks[old.id]);
    if (t) retired[old.replacedBy] = { name: t.name, was: old.name };
  }
  return { picks, fellBack: c.fellBack ?? {}, retired };
}

// The retired message a message took over from, if any ('call-2h' → 'call-1h')
const retiredFor = (momentId) =>
  [...RETIRED.call, ...RETIRED.webinar].find((old) => old.replacedBy === momentId)?.id ?? null;

// Pick a template for one message (templateId null: our default). Clears
// the "went back to our default" note for it.
export function setChoice(offering, offeringName, momentId, templateId) {
  const all = loadChoices();
  const c = all[offering] ?? {};
  const picks = { ...(c.picks ?? {}) };
  const fellBack = { ...(c.fellBack ?? {}) };
  if (templateId) picks[momentId] = templateId;
  else delete picks[momentId];
  delete fellBack[momentId];
  // Chosen now for the message that replaced a retired one: the old pick goes
  const old = retiredFor(momentId);
  if (old) delete picks[old];
  all[offering] = { name: offeringName ?? c.name, picks, fellBack };
  return saveChoices(all);
}

// Where a template is picked: ['Discovery call', 'Coaching session']
// (not picks for a message we no longer send: nothing sends those)
export function usesOf(templateId) {
  const live = (momentId) => !momentById(momentId)?.retired;
  return Object.values(loadChoices())
    .filter((c) => Object.entries(c.picks ?? {}).some(([momentId, id]) => id === templateId && live(momentId)))
    .map((c) => c.name ?? 'A call');
}

// A deleted template's picks: our default instead, with a note
function dropChoicesOf(t) {
  const all = loadChoices();
  let changed = false;
  for (const c of Object.values(all)) {
    for (const [momentId, id] of Object.entries(c.picks ?? {})) {
      if (id !== t.id) continue;
      delete c.picks[momentId];
      c.fellBack = { ...(c.fellBack ?? {}), [momentId]: t.name };
      changed = true;
    }
  }
  if (changed) saveChoices(all);
}

// The coach's templates that a product's reminders can send: approved,
// made for that product (newest first)
export const pickableOf = (own, product) =>
  own.filter((t) => !isLegacy(t) && t.product === product && t.status === 'approved');

// What one message of a webinar or call sends: our ready-made message, or
// their picked template in its place (same shape, for the phone preview):
//   { …moment, momentId, templateName, own, body, buttons }
// A pick that isn't there or isn't approved any more: ours.
export function messageFor(momentId, picks, own) {
  const moment = momentById(momentId);
  const t = own.find((x) => x.id === picks[momentId] && x.status === 'approved' && !isLegacy(x));
  if (!t) return { ...moment, momentId, templateName: moment.template, own: false };
  const madeFor = momentById(t.moment);
  return {
    ...moment,
    id: t.id,
    momentId,
    templateName: t.name,
    own: true,
    body: t.body,
    // Its own buttons: the ones of the message it was made for
    buttons: madeFor?.buttons ?? moment.buttons,
  };
}

// A webinar session's or call's choices, kept up to date
export function useChoices(offering) {
  const [c, setC] = useState(() => choicesOf(offering));
  useEffect(() => {
    const refresh = () => setC(choicesOf(offering));
    refresh();
    window.addEventListener(CHOICES_CHANGED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(CHOICES_CHANGED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [offering]);
  return c;
}