import { HANDLE_MAX, HANDLE_MIN, isHandleTaken, mockAccount, suggestedHandle } from './myPage';
import { callAboutOf, callDetailsComplete } from './callDetails';
import { questionsOf, questionsProblem } from './callQuestions';

// ------------------------------------------------------------
// Questions that set up the creator's storefront, one per screen.
// Each id matches an entry in profileAnnotations.js, which points
// at the part of the example page that answer fills in.
//
// Storefront setup is four screens (STOREFRONT_SETUP_IDS): the link,
// about you, their track record, then testimonials (the last two optional).
// After that comes the reveal: their page, live. What goes on
// it is switched on afterwards, on the storefront page (OfferingsHome.jsx,
// storefrontItems.js). Calls aren't made here: they're made in the 1:1
// calls tab.
//
// The call questions further down (callDetails … service) aren't part of
// storefront setup any more. They're kept here because the 1:1 calls
// tab's "Create call" flow uses them (CreateCallFlow.jsx).
// ------------------------------------------------------------

// The call questions, as CreateCallFlow.jsx shows them (it never sets
// callSource, so they always show there)
const MAKING_A_CALL = { field: 'callSource', in: ['new', undefined] };

// The screens storefront setup shows, in order (MyPageSetup.jsx)
export const STOREFRONT_SETUP_IDS = ['handle', 'about', 'trust', 'testimonials'];
export const MY_PAGE_STEPS = STOREFRONT_SETUP_IDS.length;

// The grey line under the two optional screens' titles
const OPTIONAL_HELPER = 'Optional. You can skip this and add it later in Edit profile.';

export const myPageQuestions = [
  {
    id: 'handle',
    type: 'handle',
    required: true,
    question: 'First, pick the link to your services page',
    // The intro already explained what a page is, so this just says what the link is for
    helper: 'This is the link you’ll share so people can find your services page: in your Instagram bio, on WhatsApp, anywhere.',
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
    // Their track record: optional (shows nothing until switched on), so
    // Next always works. The same editor as a course's landing page
    // (TrustInput.jsx), and the same in Edit profile.
    id: 'trust',
    type: 'trackRecord', // TrackRecordInput: saves trackRecord
    question: 'Show people you’re trusted',
    helper: OPTIONAL_HELPER,
    isComplete: () => true,
    // It saves as they go ("Saved"); the button says so. Skipping leaves it
    // off, even if they'd switched it on.
    nextLabel: 'Save and continue',
    skipLabel: 'Skip for now',
    skipAnswers: (answers) => (answers.trackRecord ? { trackRecord: { ...answers.trackRecord, on: false } } : {}),
  },
  {
    // Testimonials: optional, so Continue always works. Focusing a field
    // highlights that part of a testimonial on the example page beside it
    // (MyPageSetup.jsx passes onFocusField; profileAnnotations.js).
    id: 'testimonials',
    type: 'testimonials', // TestimonialsInput: saves testimonials
    question: 'What do past clients say about you?',
    helper: OPTIONAL_HELPER,
    isComplete: () => true,
    nextLabel: 'Save and finish',
    // Only while nothing's saved, so skipping never throws one away
    skipLabel: 'Skip for now',
    skipAnswers: () => ({}),
    showSkip: (answers) => !(Array.isArray(answers.testimonials) && answers.testimonials.some((t) => String(t?.text ?? '').trim())),
  },
  {
    id: 'callDetails',
    showIf: MAKING_A_CALL,
    type: 'callDetails', // CallDetailsInput: saves callTitle, callDuration, callFormat ('video'), callPricing, callPrice, callDescription
    required: true,
    question: 'Set up your 1:1 call',
    helper: 'Just the basics. You can change any of it later.',
    isComplete: callDetailsComplete,
    nextHint: 'Give it a name and a price (or make it free) to continue',
  },
  {
    // Just before working hours: that's when it's obvious why we need to
    // know when they're busy. Required, with no skip.
    id: 'calendar',
    showIf: MAKING_A_CALL,
    type: 'calendar', // CalendarConnectInput: connects Google Calendar (calendarStore.js), reports calendarStatus
    required: true,
    preview: false, // the step explains itself; no example page beside it
    question: 'Connect your Google Calendar',
    helper: 'We check when you’re busy, so no one can book over your other plans.',
    isComplete: (answers) => answers.calendarStatus === 'connected',
    // The Google button is the way on; a faded Next beside it only asks
    // which to press. Next appears once they're connected.
    hideNextUntilComplete: true,
  },
  {
    id: 'availability',
    showIf: MAKING_A_CALL,
    type: 'weeklyHours', // WeeklyHoursInput: saves the first call's hours (availabilityStore.js), reports hoursStatus
    required: true,
    question: 'Set your working hours, and we’ll create the slots',
    helper: '',
    isComplete: (answers) => (answers.hoursStatus ?? 'ok') === 'ok',
    nextHint: 'Add hours to at least one day, and fix any marked in red',
  },
  {
    id: 'callAbout',
    showIf: MAKING_A_CALL,
    type: 'callAbout', // CallAboutInput: saves callAbout, prefilled with a written description
    required: true,
    question: 'Describe your call',
    helper: 'This shows on your booking page, under the call’s name, while people pick a time.',
    isComplete: (answers) => callAboutOf(answers).trim() !== '',
    nextHint: 'Add a description to continue',
  },
  {
    // What checkout asks besides name, email and phone. Starts with the one
    // question every call asks (DEFAULT_QUESTIONS); keeping, changing or
    // removing it are all fine. Only a half-written question stops Next.
    // The preview beside it is an example checkout, not theirs
    // (profileAnnotations.js, and CreateCallFlow.jsx).
    // Optional: "Skip for now" moves on asking nothing extra (no questions
    // at all, not even the default), whatever is on the screen.
    id: 'callQuestions',
    showIf: MAKING_A_CALL,
    type: 'callQuestions', // QuestionsInput: saves callQuestions (callQuestions.js)
    // Kept "required" only so the main button always says Next (the screen is
    // never empty: it starts with the default question). Skipping is "Skip for now".
    required: true,
    question: 'What would you like to know about your clients?',
    helper: 'Their answers help you prepare before the call. Name, email and phone are already asked.',
    // The (i) beside the title: examples teach faster than explanations
    info: {
      label: 'Examples of questions to ask',
      title: 'For example',
      examples: [
        ['Career coach', 'What’s your current role?'],
        ['Fitness coach', 'Any injuries or health conditions?'],
        ['Astrologer', 'Your date, time and place of birth'],
        ['Business coach', 'What’s your monthly revenue?'],
      ],
      footer: 'You’ll see their answers in your calendar, before the call.',
    },
    skipLabel: 'Skip for now',
    skipValue: [], // nothing extra: only name, email and phone
    skipHint: 'You can add questions later, in the call’s settings under Booking questions.',
    // Not when there are no questions left: then Next already means the same
    showSkip: (answers) => questionsOf(answers).length > 0,
    isComplete: (answers) => questionsProblem(questionsOf(answers)) === null,
    nextHint: (answers) => questionsProblem(questionsOf(answers))?.text ?? 'Finish your questions to continue',
  },
  {
    id: 'service',
    showIf: MAKING_A_CALL,
    type: 'serviceSummary', // ServiceSummaryInput: makes the contract from the call's details
    required: true,
    // No example page here in setup. "Create a 1:1 call" shows the creator's
    // own contract beside this screen instead (CreateCallFlow.jsx).
    preview: false,
    titleTick: true,
    question: 'We’ve set up the contract for your call',
    // "contract" in the title is marked with an asterisk and explained
    // under the card (QuestionFlow.jsx). Most creators don't know the word yet.
    footnoteWord: 'contract',
    footnote:
      'A contract is the checkout page for anything you sell on OpenSlate. Every 1:1 call, webinar and course has a contract associated with it.',
    isComplete: (answers) => Boolean(answers.serviceId),
    nextHint: 'Setting up your contract…',
  },
];