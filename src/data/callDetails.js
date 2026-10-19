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

// ------------------------------------------------------------
// The meeting link: one room (Google Meet, Zoom, Teams...) that every
// video call uses, saved once as answers.meetingLink. Phone calls don't
// need it. Kept as they typed it; read through readMeetingLink.
// ------------------------------------------------------------

// Rooms we can name, by their web address
const MEETING_PROVIDERS = [
  { name: 'Google Meet', test: (host) => host === 'meet.google.com' },
  { name: 'Zoom', test: (host) => host === 'zoom.us' || host.endsWith('.zoom.us') },
  { name: 'Microsoft Teams', test: (host) => host === 'teams.microsoft.com' || host === 'teams.live.com' },
];

export const MEETING_LINK_EXAMPLE = 'https://meet.google.com/abc-defg-hij';

// What a pasted link is:
//   { empty, valid, url, provider, error }
//   url:      the link to use, with https:// added if they left it off
//   provider: 'Google Meet' | 'Zoom' | 'Microsoft Teams', or null for any other room
//   error:    what's wrong, to show under the field (null when fine or empty)
export function readMeetingLink(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return { empty: true, valid: false, url: '', provider: null, error: null };

  const bad = (error) => ({ empty: false, valid: false, url: '', provider: null, error });
  const fullLink = `Paste the full link, like ${MEETING_LINK_EXAMPLE}`;
  if (/\s/.test(text)) return bad(fullLink);

  // "meet.google.com/abc-defg-hij" is fine: add the https:// for them
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`;
  let url;
  try {
    url = new URL(withScheme);
  } catch {
    return bad(fullLink);
  }
  if (url.protocol === 'http:') return bad('Use the secure link, starting with https://');
  if (url.protocol !== 'https:') return bad(fullLink);
  const host = url.hostname.toLowerCase();
  if (!host.includes('.') || host.startsWith('.') || host.endsWith('.')) return bad(fullLink);

  const provider = MEETING_PROVIDERS.find((p) => p.test(host))?.name ?? null;
  return { empty: false, valid: true, url: url.href, provider, error: null };
}

// A video call that can't be joined yet: no link, or one we can't use
export function needsMeetingLink(answers) {
  const video = (answers.callFormat ?? CALL_DEFAULTS.callFormat) === 'video';
  return video && !readMeetingLink(answers.meetingLink).valid;
}

// What's stopping the call's details from being ready, if anything:
//   'basics'  no name, length, or price (unless it's free)
//   'link'    a video call with no usable meeting link
//   null      ready
export function callDetailsProblem(answers) {
  const titled = String(answers.callTitle ?? '').trim() !== '';
  const timed = Number(answers.callDuration ?? CALL_DEFAULTS.callDuration) > 0;
  const pricing = answers.callPricing ?? CALL_DEFAULTS.callPricing;
  const priced = pricing === 'free' || Number(answers.callPrice) > 0;
  if (!(titled && timed && priced)) return 'basics';
  return null;
}

// Ready to go on: a name, a length, a price unless it's free,
// and a meeting link if it's a video call
export const callDetailsComplete = (answers) => callDetailsProblem(answers) === null;

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