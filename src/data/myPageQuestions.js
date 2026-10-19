import { HANDLE_MAX, HANDLE_MIN, isHandleTaken, mockAccount, suggestedHandle } from './myPage';
import { callAboutOf, callDetailsComplete } from './callDetails';

// ------------------------------------------------------------
// Questions that set up the creator's page, one per screen.
// Each id matches an entry in profileAnnotations.js, which points
// at the part of the example page that answer fills in.
//
// The link, about you, what they offer first, its details, when people
// can book it, and the service (registration form) made for it.
// After the last one comes the reveal: their page, built.
// ------------------------------------------------------------

// Shown as "1 of 6"
export const MY_PAGE_STEPS = 7;

export const myPageQuestions = [
  {
    id: 'handle',
    type: 'handle',
    required: true,
    question: 'First, pick the link to your offerings page',
    // The intro already explained what a page is, so this just says what the link is for
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
      { id: 'call', label: '1:1 call', line: 'A video or phone call, one on one' }
    ],
    default: 'call', // the only one open for now, so it starts picked
    // An earlier pick that isn't open yet (from testing) can't be carried on with
    validate: (v) => (v === 'call' ? null : 'Only 1:1 calls are open for now'),
    nextHint: 'Pick one to continue',
  },
  {
    id: 'callDetails',
    type: 'callDetails', // CallDetailsInput: saves callTitle, callDuration, callFormat ('video'), callPricing, callPrice, callDescription
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
    question: 'Set your working hours, and we’ll create the slots',
    helper: '',
    isComplete: (answers) => (answers.hoursStatus ?? 'ok') === 'ok',
    nextHint: 'Add hours to at least one day, and fix any marked in red',
  },
  {
    id: 'callAbout',
    type: 'callAbout', // CallAboutInput: saves callAbout, prefilled with a written description
    required: true,
    question: 'Describe your call',
    helper: 'This shows on your booking page, under the call’s name, while people pick a time.',
    isComplete: (answers) => callAboutOf(answers).trim() !== '',
    nextHint: 'Add a description to continue',
  },
  {
    id: 'service',
    type: 'serviceSummary', // ServiceSummaryInput: makes the service from the call's details
    required: true,
    preview: false, // no example page on this screen
    titleTick: true,
    question: 'We’ve auto-created your contract page',
    helper:
      'The contract page is the checkout page in OpenSlate.',
    isComplete: (answers) => Boolean(answers.serviceId),
    nextHint: 'Setting up your service…',
  },
];