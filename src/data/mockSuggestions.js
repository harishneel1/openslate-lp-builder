// ------------------------------------------------------------
// MOCK AI suggestions. Replace getSuggestions with a real API
// call later; the screen doesn't need to change.
// Rule for the real version: never invent facts, numbers or
// credentials the creator didn't give us.
// ------------------------------------------------------------
const MOCKS = {
  headline: [
    {
      text: 'Fix the 5 hidden Vasthu mistakes that block money in your home, without breaking a single wall',
      reason: 'Leads with the result',
      pick: true,
    },
    {
      text: 'Money keeps leaving and home feels tense? Your Vasthu may be why',
      reason: 'Names the problem they feel',
    },
    {
      text: 'What 3,000+ homes taught me about Vasthu and money',
      reason: 'Uses your experience',
    },
    {
      text: 'Simple Vasthu fixes for more money and less tension at home',
      reason: 'Makes it feel easy',
    },
    {
      text: 'Building or buying a new home? Get the Vasthu right before you move in',
      reason: 'Speaks to who it’s for',
    },
    {
      text: 'Stop money from leaving your home, no walls broken',
      reason: 'Short and direct',
    },
  ],

  subheadline: [
    {
      text: 'Simple remedies from 15 years of practice and 3,000+ homes, with no walls broken',
      reason: 'Backs it with your experience',
      pick: true,
    },
    {
      text: 'For families building or buying a new home who want money to stay and peace at home',
      reason: 'Says who it’s for',
    },
    {
      text: 'No breaking walls. Just small changes in the right places',
      reason: 'Removes the big worry',
    },
    {
      text: 'Learn to spot the mistakes yourself, so you never have to guess again',
      reason: 'Shows what they’ll be able to do',
    },
    {
      text: 'The same checks I’ve used in over 3,000 homes, explained step by step',
      reason: 'Feels proven',
    },
    {
      text: 'If money keeps leaving or home feels tense, these fixes are for you',
      reason: 'Speaks to their problem',
    },
  ],
};

const BATCH_SIZE = 3;

// Returns { items, hasMore } after a short fake delay
export function getSuggestions(questionId, answers, batch = 0) {
  const all = MOCKS[questionId] ?? [];
  const start = batch * BATCH_SIZE;
  const items = all.slice(start, start + BATCH_SIZE);

  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (!items.length) reject(new Error('No suggestions'));
      else resolve({ items, hasMore: all.length > start + BATCH_SIZE });
    }, 1000);
  });
}