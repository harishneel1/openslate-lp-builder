// ------------------------------------------------------------
// MOCK AI suggestions. Replace getSuggestions with a real API
// call later; the screen doesn't need to change.
// Rule for the real version: never invent facts, numbers or
// credentials the creator didn't give us.
// ------------------------------------------------------------

// Drops trailing full stops so drafted sentences don't end in ".."
const noStop = (text) => String(text ?? '').trim().replace(/[.\s]+$/, '');

// Lists for the "Suggest for me" screens, keyed by question id.
// (The headline and the line under it have their own mock: getHeadlinePairs, below.)
const MOCKS = {
  // Items: one object per point, using the question's itemFields ids.
  // The first 3 prefill the list, the rest show under "More ideas".
  learnings: [
    { title: 'The 5 most common Vasthu mistakes', description: 'How to spot each one in your own home' },
    { title: 'Why money keeps leaving', description: 'The Vasthu patterns that are often behind it' },
    { title: 'Fixes that need no broken walls', description: 'Simple remedies using placement, colour and objects' },
    { title: 'The money corner of your home', description: 'Where it is, and what should never be kept there' },
    { title: 'Bringing calm back home', description: 'Changes that ease constant tension in the family' },
    { title: 'Checking a home before you move in', description: 'What to look at before you buy or build' },
    { title: 'Your main entrance', description: 'Which way it should face, and how to correct it if it can’t' },
    { title: 'The kitchen and the bedroom', description: 'Where they should sit, and what to do if they don’t' },
    { title: 'Reading your own floor plan', description: 'A simple way to check any home yourself' },
  ],

  // Written to the visitor ("you"), so they recognise themselves.
  // The first 2 prefill the list, the rest show under "More ideas".
  personas: [
    { title: 'The new homebuyer', text: "You're about to buy a home and want to know it's right before you sign." },
    { title: 'The family building a house', text: 'You want the layout right from day one, not fixed later.' },
    { title: 'The home where money won’t stay', text: 'You earn well, but money keeps leaving faster than it comes in.' },
    { title: 'The home that feels tense', text: "There's constant friction at home and you can't say why." },
    { title: 'The one who can’t break walls', text: 'You rent or live in a flat, so big changes aren’t an option.' },
    { title: 'The curious learner', text: 'You want to understand Vasthu yourself, not depend on someone else.' },
  ],
  // Built from their answers, so answers are never made up.
  // Questions we have no answer for yet are left out.
  faqs: (a) =>
    [
      a.audience && {
        question: 'Who is this webinar for?',
        answer: `It's for ${noStop(a.audience)}.`,
      },
      {
        question: 'Will I need to break any walls?',
        answer: 'No. Every fix in this session uses placement, colour and objects, not construction.',
      },
      a.duration && {
        question: 'How long is the session?',
        answer: `About ${a.duration}.`,
      },
      a.format && {
        question: 'Is it live?',
        answer: a.format === 'Live' ? "Yes, it's a live session." : "No, it's a pre-recorded session.",
      },
      a.language && {
        question: 'What language is it in?',
        answer: `It's in ${a.language}.`,
      },
      a.pricing && {
        question: 'Does it cost anything?',
        answer:
          a.pricing === 'Free'
            ? "No, it's free. Just register to save your seat."
            : a.price
              ? `It costs ₹${a.price}.`
              : "Yes, it's a paid session.",
      },
    ].filter(Boolean),
};

const BATCH_SIZE = 3;

// Returns { items, hasMore } after a short fake delay
export function getSuggestions(questionId, answers, batch = 0) {
    // A mock can be a fixed list, or a function that builds the list from their answers
  const source = MOCKS[questionId];
  const all = typeof source === 'function' ? source(answers) : source ?? [];
  const start = batch * BATCH_SIZE;
  const items = all.slice(start, start + BATCH_SIZE);

  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (!items.length) reject(new Error('No suggestions'));
      else resolve({ items, hasMore: all.length > start + BATCH_SIZE });
    }, 1000);
  });
}

// ------------------------------------------------------------
// Headline + the line under it, written together as pairs.
// Same shape the real AI prompt returns, so swapping in the real
// call later doesn't change the screen:
//   { core_promise, options: [{ angle, pick, headline, subheadline }] }
// angle is one of: 'outcome' | 'pain' | 'method_or_proof'
// pick is true on exactly one option: the one the AI recommends
//
// round: 0 for the first set, 1+ each time they press "Write 3 new ones".
// For the real call, send the headlines they've already seen so the
// AI doesn't repeat them.
// ------------------------------------------------------------
const HEADLINE_SETS = [
  [
    {
      angle: 'outcome',
      pick: true,
      headline: 'Fix the Vasthu mistakes that block money in your home, without breaking a single wall',
      subheadline: 'A webinar for families who want money to stay and calm at home, using simple changes to placement, colour and objects.',
    },
    {
      angle: 'pain',
      headline: 'Money keeps leaving and home feels tense? Your Vasthu may be why',
      subheadline: 'Learn to spot the common mistakes in your own home and the simple fixes you can do this weekend.',
    },
    {
      angle: 'method_or_proof',
      headline: 'What 3,000 homes taught me about Vasthu and money',
      subheadline: 'In this webinar, I share the same room-by-room checks I use with every family, built on 15 years of practice.',
    },
  ],
  [
    {
      angle: 'outcome',
      headline: 'Bring money and calm back into your home with simple Vasthu fixes',
      subheadline: 'For families who have spent on remedies before, with nothing to break or rebuild. Just changes you can make yourself.',
    },
    {
      angle: 'pain',
      pick: true,
      headline: 'Earning well but money never stays? Check these spots in your home first',
      subheadline: 'A webinar on the Vasthu mistakes most families miss, and how to correct them without construction.',
    },
    {
      angle: 'method_or_proof',
      headline: 'The room-by-room Vasthu check I use in every home I visit',
      subheadline: 'Go through your entrance, kitchen, bedroom and money corner with me, and leave knowing exactly what to change.',
    },
  ],
];

// Resolves after a short fake delay, like a real call would
export function getHeadlinePairs(answers, round = 0) {
  const options = HEADLINE_SETS[round % HEADLINE_SETS.length];
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        core_promise: 'Families learn to fix the Vasthu mistakes that block money and calm, without construction.',
        options,
      });
    }, 1200);
  });
}