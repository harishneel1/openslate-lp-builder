import { HANDLE_MAX, HANDLE_MIN, isHandleTaken, mockAccount, suggestedHandle } from './myPage';
import { callDetailsComplete } from './callDetails';

// ------------------------------------------------------------
// Questions that set up the creator's page, one per screen.
// Each id matches an entry in profileAnnotations.js, which points
// at the part of the example page that answer fills in.
//
// The link, about you, what they offer first, its details, and when
// people can book it.
// After the last one comes the reveal: their page, built.
// ------------------------------------------------------------

// Shown as "1 of 5"
export const MY_PAGE_STEPS = 5;

export const myPageQuestions = [
  {
    id: 'handle',
    type: 'handle',
    required: true,
    question: 'First, pick the link to your offerings page',
    // The intro already explained what a page is, so this just says what the link is for
    helper: 'This is the link you’ll share so people can find your offerings page: in your Instagram bio, on WhatsApp, anywhere.',
    hint: 'Letters, numbers and underscores. Short and easy to say works best.',
    maxLength: HANDLE_MAX,
    default: suggestedHandle(mockAccount.name), // their name, ready to accept
    validate: (v) =>
      v.length < HANDLE_MIN
        ? `Use at least ${HANDLE_MIN} letters or numbers.`
        : isHandleTaken(v)
          ? 'Someone already has this link. Try one of these, or type another.'
          : null,
    nextHint: 'Pick a link to continue',
  },
  {
    id: 'about',
    type: 'group',
    required: true,
    question: 'Tell people who you are',
    helper: 'This is the top of your page, the first thing visitors read.',
    nextHint: 'Add your name and a few lines about you to continue',
    fields: [
      {
        id: 'photo',
        type: 'image',
        label: 'Photo',
        helper: 'A clear photo of your face works best. JPG or PNG, up to 5 MB.',
        initialFrom: 'name', // their initial shows until they add a photo
      },
      {
        id: 'name',
        type: 'text',
        label: 'Name',
        maxLength: 40,
        default: mockAccount.name, // from signup, ready to accept
        required: true,
      },
      {
        id: 'bio',
        type: 'textarea',
        label: 'About you',
        example:
          'I spent 10 years as a corporate trainer before becoming a career coach. I help people find work they actually enjoy.',
        maxLength: 600,
        required: true,
      },
    ],
  },
  {
    id: 'offerType',
    type: 'offerType',
    required: true,
    question: 'What’s the first thing people can book from you?',
    helper: 'Start with a 1:1 call. The others are on their way.',
    // ids match the kinds on the page (serviceKinds.js).
    // soon: shown, but can't be picked yet
    options: [
      { id: 'call', label: '1:1 call', line: 'A video or phone call, one on one' },
      { id: 'dm', label: 'Priority DM', line: 'Answer questions in writing, on your own time', soon: true },
      { id: 'webinar', label: 'Webinar', line: 'A live session for a group', soon: true },
      { id: 'course', label: 'Course', line: 'Recorded lessons people buy once', soon: true },
    ],
    default: 'call', // the only one open for now, so it starts picked
    // An earlier pick that isn't open yet (from testing) can't be carried on with
    validate: (v) => (v === 'call' ? null : 'Only 1:1 calls are open for now'),
    nextHint: 'Pick one to continue',
  },
  {
    id: 'callDetails',
    type: 'callDetails', // CallDetailsInput: saves callTitle, callDuration, callFormat, callPricing, callPrice, callDescription
    required: true,
    question: 'Set up your 1:1 call',
    helper: 'Just the basics. You can change any of it later.',
    isComplete: callDetailsComplete,
    nextHint: 'Give it a name and a price (or make it free) to continue',
  },
  {
    id: 'availability',
    type: 'weeklyHours', // WeeklyHoursInput: saves to the Availability store, reports hoursStatus
    required: true,
    question: 'When can people book you?',
    helper: '',
    isComplete: (answers) => (answers.hoursStatus ?? 'ok') === 'ok',
    nextHint: 'Switch on at least one day, and fix any hours marked in red',
  },
];