import { HANDLE_MAX, HANDLE_MIN, isHandleTaken, mockAccount, suggestedHandle } from './myPage';
import { callAboutOf, callDetailsComplete } from './callDetails';
import { questionsOf, questionsProblem } from './callQuestions';

// ------------------------------------------------------------
// Questions that set up the creator's page, one per screen.
// Each id matches an entry in profileAnnotations.js, which points
// at the part of the example page that answer fills in.
//
// The link, about you, what they offer first, then either which of their
// existing calls go on the page, or a new call: its details, their Google
// Calendar, when people can book it, its description, what checkout asks,
// and the service (registration form) made for it.
// After the last one comes the reveal: their page, built.
// ------------------------------------------------------------

// The call questions: for everyone with no calls yet, and for those who
// chose "Create a new 1:1 call" over their existing ones (callSource)
const MAKING_A_CALL = { field: 'callSource', in: ['new', undefined] };

// The most screens there can be. The progress counts the ones actually
// showing, since picking existing calls skips the call questions and a
// connected calendar skips its screen.
export const MY_PAGE_STEPS = 10;

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
    // Only for someone who made calls in the 1:1 calls tab before setting up
    // their page (MyPageSetup.jsx leaves it out otherwise). Ticking calls
    // and Continue skips the call questions; the "Create a new 1:1 call
    // instead" button goes straight into them.
    id: 'callSource',
    type: 'pickCalls', // PickCallsInput: saves callSource ('existing' or 'new') and pickedCalls
    required: true,
    onlyWithCalls: true,
    question: 'Which calls go on your page?',
    helper: 'You’ve made these already. Tick the ones people should see.',
    isComplete: (answers) =>
      answers.callSource === 'new' || (Array.isArray(answers.pickedCalls) && answers.pickedCalls.length > 0),
    nextHint: 'Tick at least one call to continue',
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
    // removing it are all fine. Only a half-written question stops them.
    // The preview beside it is an example checkout, not theirs
    // (profileAnnotations.js, and CreateCallFlow.jsx).
    id: 'callQuestions',
    showIf: MAKING_A_CALL,
    type: 'callQuestions', // QuestionsInput: saves callQuestions (callQuestions.js)
    required: true, // always complete when nothing's half-written, so it says Next, not Skip
    question: 'Ask additional questions during checkout',
    helper: 'Name, email and phone are always asked by default.',
    isComplete: (answers) => questionsProblem(questionsOf(answers)) === null,
    nextHint: (answers) => questionsProblem(questionsOf(answers))?.text ?? 'Finish your questions to continue',
  },
  {
    id: 'service',
    showIf: MAKING_A_CALL,
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