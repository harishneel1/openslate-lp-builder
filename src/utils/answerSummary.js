import { landingQuestions } from '../data/webinarQuestions';

// ------------------------------------------------------------
// Helpers for the "Edit your landing page" screen: one row per
// question screen, each with a short summary of its answer.
// ------------------------------------------------------------

const text = (v) => String(v ?? '').trim();
const isFilled = (v) => text(v) !== '';

// Items only count once their main field (title, quote...) is filled
const filledCount = (list, key) =>
  Array.isArray(list) ? list.filter((item) => isFilled(item?.[key])).length : 0;

const formatPrice = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Lists: "4 points: The money corner, Kitchen placement, …"
// (the row cuts it off neatly if it's long)
function listSummary(items, word, field) {
  if (items.length === 0) return null;
  const names = items.map((item) => item[field]).filter(Boolean).join(', ');
  return names ? `${plural(items.length, word)}: ${names}` : plural(items.length, word);
}

// The screens one row opens: the screen itself, then any screens that only
// show because of it (Free or paid → Price and Crossed-out price, when Paid).
export function editGroup(questionId, questions = landingQuestions) {
  const own = questions.find((q) => q.id === questionId);
  if (!own) return [];
  return [own, ...questions.filter((q) => q.showIf?.field === questionId)];
}

// True when a required screen is missing something.
// Same rules as the question screen's Next button (QuestionFlow).
export function needsAnswer(question, answers) {
  if (!question.required) return false;
  if (question.type === 'items') {
    return filledCount(answers[question.id], question.mainField) < (question.minItems ?? 0);
  }
  if (question.fields) {
    return !question.fields.every((f) => !f.required || isFilled(answers[f.id] ?? f.default));
  }
  if (question.parts) {
    return !question.parts.every((p) => isFilled(answers[p.id]));
  }
  return !isFilled(answers[question.id]);
}

// One line describing a screen's current answer, or null if nothing's filled in.
// page: buildPageJson(answers), so the row says exactly what the page shows.
export function answerSummary(question, answers, page) {
  switch (question.id) {
    case 'headline': {
      const lines = [page.hero.title, page.hero.subtitle].filter(Boolean);
      return lines.length > 0 ? lines.join(' / ') : null;
    }

    // "Tue, 20 Oct at 7:00 pm IST · 60 min · English · Live"
    case 'eventDetails': {
      const parts = [page.event.label, ...page.hero.details].filter(Boolean);
      return parts.length > 0 ? parts.join(' · ') : null;
    }

    // "Paid · Button: Reserve my seat"
    case 'pricing':
      return isFilled(answers.pricing)
        ? `${answers.pricing} · Button: ${page.pricing.ctaLabel}`
        : null;

        // "₹499 (was ₹999)"
    case 'priceDetails': {
      const { price, oldPrice } = page.pricing;
      if (price === null) return null;
      return oldPrice !== null
        ? `${formatPrice(price)} (was ${formatPrice(oldPrice)})`
        : formatPrice(price);
    }

    // "Priya Raman · with photo"
    case 'hostDetails': {
      const { name, photo } = page.instructor;
      if (!name) return photo ? 'Photo added' : null;
      return photo ? `${name} · with photo` : name;
    }

    case 'learnings':
      return listSummary(page.pillars.items, 'point', 'title');

    case 'personas':
      return listSummary(page.personas.items, 'profile', 'title');

    case 'testimonials':
      return listSummary(page.testimonials.items, 'review', 'name');

    case 'faqs':
      return listSummary(page.faq.items, 'question', 'question');

    // A screen added later without its own summary: show the plain answer
    default:
      return isFilled(answers[question.id]) ? text(answers[question.id]) : null;
  }
}