// ------------------------------------------------------------
// The details of the creator's first 1:1 call: the choices offered
// on the setup screen, and the description suggested from its name.
// ------------------------------------------------------------

import { getMockProfile } from './mockProfile';
import { durationLabel } from './serviceKinds';

export const CALL_DEFAULTS = {
  callDuration: 30,
  callFormat: 'video',
  callPricing: 'paid',
};

// In minutes. Shown as "60 min", then "1 hr 30 min", "2 hr", "3 hr"
// (see durationLabel in serviceKinds.js)
export const DURATIONS = [15, 30, 45, 60, 90, 120, 180];

// "Custom" length: hours and minutes picked separately.
// Minutes go in 5s, so 20 min or 1 hr 15 min both work.
export const CUSTOM_HOURS = Array.from({ length: 9 }, (_, i) => i); // 0–8
export const CUSTOM_MINUTES = Array.from({ length: 12 }, (_, i) => i * 5); // 0–55

// Hours + minutes as one length, never zero (0 hr 0 min becomes 15 min)
export function customDuration(hours, minutes) {
  const total = Number(hours) * 60 + Number(minutes);
  return total > 0 ? total : 15;
}

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

// Ready to go on: a name, a length, and a price unless it's free
export function callDetailsComplete(answers) {
  const titled = String(answers.callTitle ?? '').trim() !== '';
  const timed = Number(answers.callDuration ?? CALL_DEFAULTS.callDuration) > 0;
  const pricing = answers.callPricing ?? CALL_DEFAULTS.callPricing;
  const priced = pricing === 'free' || Number(answers.callPrice) > 0;
  return titled && timed && priced;
}

// ------------------------------------------------------------
// The longer description on the booking page, under the call's name.
// Starts as Meera's Discovery call text (the booking page shown in the
// preview beside these screens) for them to edit. Stored as one string,
// paragraphs separated by a blank line.
// ------------------------------------------------------------

export const ABOUT_MAX = 1000;

const EXAMPLE_ABOUT = (getMockProfile().services.find((s) => s.id === 'call-discovery')?.about ?? []).join('\n\n');

export const suggestedAbout = () => EXAMPLE_ABOUT;

// Theirs once they've edited it (even emptied), otherwise the starting text:
// aboutStart when the screen gives one (a new call's text, written from its
// name), or Meera's example during setup
export function callAboutOf(answers) {
  return answers.callAbout ?? answers.aboutStart ?? EXAMPLE_ABOUT;
}

// The starting long description for a call added after setup, written from
// its own details so it fits whatever the call is (Meera's example is a
// discovery call, which wouldn't suit a teaching session, say).
// Follows the name, length and format until they edit it.
export function newCallAbout(answers) {
  const name = String(answers.callTitle ?? '').trim() || 'This call';
  const format = (answers.callFormat ?? CALL_DEFAULTS.callFormat) === 'phone' ? 'phone' : 'video';
  const length = durationLabel(answers.callDuration ?? CALL_DEFAULTS.callDuration);
  return [
    `${name} is a one-on-one ${format} call, ${length} long, just the two of us.`,
    'Bring what you’re working on and the questions you have. We’ll go through them together, at your pace.',
    'You’ll leave knowing exactly what to do next.',
  ].join('\n\n');
}

// As paragraphs for the page: split on blank lines, empty ones dropped
export function aboutParagraphs(answers) {
  return callAboutOf(answers)
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}