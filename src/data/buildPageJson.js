import { defaultCtaLabel } from './webinarQuestions';

// ------------------------------------------------------------
// Turns the flat answers into a basic page JSON, one key per
// page section. Designs render from this, never from answers.
// ------------------------------------------------------------

const text = (v) => String(v ?? '').trim();
const isFilled = (v) => text(v) !== '';
const toNumber = (v) => (isFilled(v) ? Number(v) : null);

// Keeps items whose main field is filled, drops our internal ids
function cleanItems(list, mainField, fields) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((item) => isFilled(item?.[mainField]))
    .map((item) => Object.fromEntries(fields.map((f) => [f, text(item[f])])));
}

// "2026-10-20" → "Tue, 20 Oct". Built from parts so the day never shifts with time zones.
function formatDate(date) {
  const [y, m, d] = date.split('-').map(Number);
  const value = new Date(y, m - 1, d);
  return Number.isNaN(value.getTime())
    ? date
    : value.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

// "19:00" → "7:00 pm"
function formatTime(time) {
  const [h, min] = time.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(min)) return time;
  const suffix = h >= 12 ? 'pm' : 'am';
  return `${h % 12 || 12}:${String(min).padStart(2, '0')} ${suffix}`;
}

// date + time both target event.start, so they're combined here
function buildEvent(a) {
  const date = text(a.date);
  const time = text(a.time);
  const timeZone = text(a.timeZone) || 'IST';

  const when = [date && formatDate(date), time && `${formatTime(time)} ${timeZone}`]
    .filter(Boolean)
    .join(' at ');

  return {
    start: date ? (time ? `${date}T${time}` : date) : null,
    timeZone,
    label: when || null, // "Tue, 20 Oct at 7:00 pm IST"
  };
}

function buildPricing(a) {
  const isPaid = a.pricing === 'Paid';
  const price = isPaid ? toNumber(a.price) : null;
  const oldPrice = isPaid ? toNumber(a.oldPrice) : null;

  return {
    type: isPaid ? 'paid' : 'free',
    currency: 'INR',
    price,
    // Only worth showing crossed out when it's higher than the price
    oldPrice: price !== null && oldPrice !== null && oldPrice > price ? oldPrice : null,
    // Their own button text, or the Free/Paid default
    ctaLabel: text(a.ctaLabel) || defaultCtaLabel(a.pricing),
  };
}

export function buildPageJson(a, themeId = null) {
  const event = buildEvent(a);
  const pricing = buildPricing(a);

  return {
    meta: {
      funnel: 'webinar',
      page: 'landing',
      theme: themeId, // the design they picked (an id from themes.js)
    },

    hero: {
      title: text(a.headline),
      subtitle: text(a.subheadline),
      // duration, language and format all show as chips at the top
      details: [a.duration, a.language, a.format].map(text).filter(Boolean),
    },

    event,
    pricing,

    pillars: {
      items: cleanItems(a.learnings, 'title', ['title', 'description']),
    },

    personas: {
      items: cleanItems(a.personas, 'title', ['title', 'text']),
    },

    instructor: {
      name: text(a.hostName),
      role: text(a.hostRole) || null, // no longer asked, kept in case it exists
      photo: text(a.hostPhoto) || null,
      // Each line break in the bio starts a new paragraph
      paragraphs: text(a.hostBio).split(/\n+/).map(text).filter(Boolean),
    },

    testimonials: {
      items: cleanItems(a.testimonials, 'quote', ['quote', 'name', 'from', 'photo', 'source']),
    },

    faq: {
      items: cleanItems(a.faqs, 'question', ['question', 'answer']),
    },

    // Built for them from the event and price
    finalCta: {
      title: 'Save your seat',
      when: event.label,
      ctaLabel: pricing.ctaLabel,
    },
  };
}