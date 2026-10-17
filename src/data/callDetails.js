// ------------------------------------------------------------
// The details of the creator's first 1:1 call: the choices offered
// on the setup screen, and the description suggested from its name.
// ------------------------------------------------------------

export const CALL_DEFAULTS = {
  callDuration: 30,
  callFormat: 'video',
  callPricing: 'paid',
};

export const DURATIONS = [15, 30, 45, 60];

// Names to tap, each with a description to start from
const SUGGESTED = {
  'Discovery call': 'A short call to get to know each other and see if working together is a good fit.',
  '1:1 session': 'A focused session on what matters most to you right now, with clear next steps to take away.',
  'Career clarity call': 'Talk through where you are in your career and leave knowing your next move.',
};

export const TITLE_SUGGESTIONS = Object.keys(SUGGESTED);

// A starting description for whatever name they gave the call
export function suggestedDescription(title) {
  const name = String(title ?? '').trim();
  if (!name) return '';
  const known = Object.keys(SUGGESTED).find((k) => k.toLowerCase() === name.toLowerCase());
  return known ? SUGGESTED[known] : 'A one-on-one call, focused on you and your questions.';
}

// The description that goes on the page: theirs if they changed it
// (an emptied box means none), otherwise the suggestion
export function callDescriptionOf(answers) {
  return answers.callDescription ?? suggestedDescription(answers.callTitle);
}

// Ready to go on: a name, and a price unless it's free
export function callDetailsComplete(answers) {
  const titled = String(answers.callTitle ?? '').trim() !== '';
  const pricing = answers.callPricing ?? CALL_DEFAULTS.callPricing;
  const priced = pricing === 'free' || Number(answers.callPrice) > 0;
  return titled && priced;
}