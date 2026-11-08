import { useEffect, useState } from 'react';

// ------------------------------------------------------------
// The coach's own WhatsApp templates, made in Settings → WhatsApp →
// Templates → Create template (WhatsAppTemplateEditor.jsx), as in AiSensy.
// Our ready-made ones live in whatsappMessages.js; these sit beside them
// in the same list.
//
// Kept in this browser (the stand-in):
//   [{
//     id, name,                 name: lowercase letters, numbers, _ (Meta's rule)
//     category: 'UTILITY' | 'MARKETING',
//     language: 'English',
//     body: 'Hi {{1}}, …',      WhatsApp's formatting; {{1}}, {{2}} … blanks
//     samples: { 1: 'Priya' },  an example for each blank (Meta asks for one)
//     footer: '',
//     action: 'none' | 'cta' | 'replies' | 'all',
//     buttons: [{ type: 'url', text, url } | { type: 'phone', text, phone } | { type: 'reply', text }],
//     status: 'draft' | 'review' | 'approved' | 'rejected',
//     createdAt, sentAt, decidedAt, reviewEndsAt: ISO strings,
//   }]
//
// Submit sends one to Meta: "In review", and the stand-in approves it a
// little later (or rejects it, when the prototype controls say so).
// ------------------------------------------------------------

const KEY = 'pagebuilder:mock-whatsapp-templates';
const NEXT_KEY = 'pagebuilder:mock-whatsapp-next-template-review';
export const TEMPLATES_CHANGED_EVENT = 'whatsapp-templates-changed';

const REVIEW_MS = 15 * 1000;

// The kind of reason Meta gives
export const MOCK_TEMPLATE_REJECTION =
  'Meta found the message unclear about why it’s being sent. Say what it’s about, and keep blanks inside the sentence.';

export const LIMITS = { body: 1024, footer: 60, button: 25, replies: 3, urls: 2, phones: 1 };

export function loadTemplates() {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(all) ? all : [];
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
export function submitTemplate(template) {
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
        }
      : t,
  );
  return saveAll(all) ? all.find((t) => t.id === draft.id) : null;
}

export function deleteTemplate(id) {
  return saveAll(loadTemplates().filter((t) => t.id !== id));
}

// The stand-in for Meta: reviews that are due, decided
export function settleTemplates() {
  const all = loadTemplates();
  let changed = false;
  const settled = all.map((t) => {
    if (t.status !== 'review' || !t.reviewEndsAt || Date.now() < Date.parse(t.reviewEndsAt)) return t;
    changed = true;
    return { ...t, status: t.outcome === 'reject' ? 'rejected' : 'approved', decidedAt: t.reviewEndsAt };
  });
  if (changed) saveAll(settled);
}

// Prototype: how Meta's next review goes ('approve' | 'reject')
export function nextOutcome() {
  try {
    return localStorage.getItem(NEXT_KEY) === 'reject' ? 'reject' : 'approve';
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
  if (outcome === 'reject') setNextOutcome('approve'); // once, so trying again goes through
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