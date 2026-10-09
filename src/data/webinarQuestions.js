// ------------------------------------------------------------
// Sections of an opinionated webinar landing page, in order.
// themeSection: which section `type` in the theme JSON this renders
// auto: true means the user answers nothing; we build it for them
// ------------------------------------------------------------
export const landingSections = [
  { id: 'hero', name: 'Headline', themeSection: 'hero' },
  { id: 'event', name: 'Event details', themeSection: 'hero' },
  { id: 'cta', name: 'Sign-up button', themeSection: 'hero' },
  { id: 'learn', name: "What you'll learn", themeSection: 'pillars' },
  { id: 'audience', name: "Who it's for", themeSection: 'personas' },
  { id: 'host', name: 'About you, the host', themeSection: 'instructor' },
  { id: 'proof', name: 'Reviews', themeSection: 'testimonials' },
  { id: 'faq', name: 'Common questions', themeSection: 'faq' },
  { id: 'finalCta', name: 'Final sign-up button', themeSection: 'finalCta', auto: true },
];


// Button text until the creator writes their own (saved as ctaLabel)
export const defaultCtaLabel = (pricing) =>
  pricing === 'Paid' ? 'Reserve my seat' : 'Register for free';

// ------------------------------------------------------------
// Questions. Each answer is stored flat under its `id`.
// section:  'about' (context) or a landingSections id
// target:   where it ends up in the theme JSON (for buildPageJson)
// suggest:  show the "Suggest for me" button (3 AI options)
// prefill:  value we already know from the creator's account
// showIf:   only ask when another answer matches
// ------------------------------------------------------------
export const webinarQuestions = [
  // ---------- About you (context for AI + theme picks) ----------
  {
    id: 'category',
    reviewLabel: 'Topic',
    section: 'about',
    type: 'choice',
    question: 'What is your webinar about?',
    options: [
      'Life Coaching & Personal Growth',
      'Mental Health & Emotional Healing',
      'Leadership & Corporate Training',
      'Career & Communication Skills',
      'Business & Entrepreneurship',
      'Marketing, Sales & Personal Branding',
      'Tech & AI',
      'Finance & Wealth',
      'Health, Nutrition & Holistic Medicine',
      'Yoga, Fitness & Meditation',
      'Spirituality, Astrology & Energy Healing',
      'Parenting & Relationships',
      'Education, Languages & Study Abroad',
      'Arts & Creative Skills',
      'Other',
    ],    
    required: true,
  },
   
    // Sentence questions: one screen, a sentence with blanks.
  // Each part is saved flat under its own id (audience, problem, ...).
  {
    id: 'positioning',
    reviewLabel: 'Your webinar',
    section: 'about',
    type: 'sentence',
    question: 'Finish this sentence about your webinar',
    parts: [
      { id: 'audience', lead: 'This webinar is for', example: 'families building or buying a new home' },
      { id: 'problem', lead: 'who struggle with', example: 'money that keeps leaving, or constant tension at home' },
      { id: 'result', lead: "By the end, they'll be able to", example: 'spot and fix the 5 most common Vasthu mistakes without breaking walls' },
    ],
    required: true,
  },
  {
    id: 'trust',
    reviewLabel: 'You',
    section: 'about',
    type: 'sentence',
    question: 'Finish this sentence about you',
    parts: [
      { id: 'credibility', lead: 'People can trust me because I', example: 'have practised Vasthu for 15 years and consulted on 3,000+ homes' },
    ],
    required: true,
  },


  // ---------- 1. Headline ----------
    {
    id: 'headline',
    section: 'hero',
    target: 'hero.title',
    type: 'textarea',
    question: "Let's start with your headline",
    helper: "It's the first thing people read, and it decides whether they stay.",
    example: 'Fix the 5 hidden Vasthu mistakes that block money in your home, without breaking a single wall',
    maxLength: 120,
    suggest: true,
    suggestLabel: 'headlines', // "Writing headlines from your answers…"
    required: true,
  },
  {
    id: 'subheadline',
    section: 'hero',
    target: 'hero.subtitle',
    type: 'textarea',
    question: 'Now, your subheadline',
    helper: 'It sits under your headline and gives people a reason to believe it.',
    example: 'Simple remedies you can do this weekend, based on 15 years and 3,000+ homes',
    maxLength: 140,
    suggest: true,
    suggestLabel: 'lines',
    required: true,
  },

  // ---------- 2. Event details ----------
    // ---------- 2. Event details (one screen) ----------
  // Each field is saved flat under its own id, like sentence parts.
  // half:        sits side by side with the next half field
  // collapsible: shown as "Label: value · Change" until tapped
  {
    id: 'eventDetails',
    section: 'event',
    type: 'group',
    question: 'Now, your event details',
    helper: 'These show at the top of your page, next to the sign-up button.',
    fields: [
      { id: 'date', target: 'event.start', type: 'date', label: 'Date', half: true, required: true },
      { id: 'time', target: 'event.start', type: 'time', label: 'Start time', half: true, required: true },
      {
        id: 'timeZone',
        target: 'event.timeZone',
        type: 'choice',
        label: 'Time zone',
        options: ['IST', 'GST (Dubai)', 'GMT (London)', 'EST (New York)'],
        default: 'IST',
        collapsible: true,
        required: true,
      },
      {
        id: 'duration',
        target: 'hero.details',
        type: 'choice',
        label: 'How long',
        options: ['30 min', '60 min', '90 min', '2 hours'],
        required: true,
      },
      {
        id: 'language',
        target: 'hero.details',
        type: 'choice',
        label: 'Language',
        options: ['English', 'Hindi', 'Tamil', 'Telugu', 'Kannada', 'Malayalam'],
        required: true,
      },
      {
        id: 'format',
        target: 'finalCta.details',
        type: 'choice',
        label: 'Session',
        options: ['Live', 'Pre-recorded'],
        default: 'Live',
        collapsible: true,
        required: true,
      },
    ],
    required: true,
  },

  // ---------- 3. Price & sign-up button ----------
  {
    id: 'pricing',
    section: 'cta',
    type: 'choice',
    question: 'Is it free or paid?',
    options: ['Free', 'Paid'],
    buttonText: true,
    required: true,
  },
  {
    id: 'price',
    section: 'cta',
    target: 'pricing.price',
    type: 'number',
    question: 'How much will it cost?',
    helper: 'In ₹.',
    example: '99',
    showIf: { field: 'pricing', equals: 'Paid' },
    required: true,
  },
  {
    id: 'oldPrice',
    section: 'cta',
    target: 'pricing.oldPrice',
    type: 'number',
    question: 'Is there a regular price you want to show crossed out?',
    helper: 'Optional. Leave empty to skip.',
    example: '499',
    showIf: { field: 'pricing', equals: 'Paid' },
    required: false,
  },

  // ---------- 4. What you'll learn ----------
  {
    id: 'learnings',
    section: 'learn',
    target: 'pillars.items',
    type: 'items',
    question: 'What will people learn?',
    helper: "We'll draft these for you. Edit, remove or add your own.",
    mainField: 'title', // an item counts once this is filled
    itemFields: [
      { id: 'title', label: 'Point', example: 'The money corner of your home', maxLength: 60 },
      { id: 'description', label: 'One line about it', example: 'Where it is, and what should never be kept there', maxLength: 100 },
    ],
    minItems: 3,
    maxItems: 7,
    suggest: true,
    suggestLabel: 'learning points',
    required: true,
  },

  // ---------- 5. Who it's for ----------
    {
    id: 'personas',
    section: 'audience',
    target: 'personas.items',
    mainField: 'title',
    type: 'items',
    question: 'Who is this webinar perfect for?',
    helper: "We'll draft these for you. Edit, remove or add your own.",
    itemFields: [
      { id: 'title', label: 'Who', example: 'The new homeowner', maxLength: 40 },
      { id: 'text', label: 'Their situation', example: "You've just moved in and want to start right.", maxLength: 90 },
    ],
    minItems: 2,
    maxItems: 4,
    suggest: true,
    suggestLabel: 'profiles', // "Writing profiles from your answers…"
    required: true,
  },

  // ---------- 6. Host ----------
  {
    id: 'hostName',
    section: 'host',
    target: 'instructor.name',
    type: 'text',
    question: 'Is this your name as it should appear?',
    prefill: 'creator.name',
    required: true,
  },
  {
    id: 'hostRole',
    section: 'host',
    target: 'instructor.role',
    type: 'text',
    question: 'How would you describe yourself in one line?',
    example: 'Vasthu consultant, 15 years of practice',
    suggest: true,
    required: true,
  },
  {
    id: 'hostPhoto',
    section: 'host',
    target: 'instructor.photo',
    type: 'image',
    question: 'Is this the photo you want to use?',
    helper: 'A clear photo of your face works best.',
    prefill: 'creator.photo',
    required: false,
  },
  {
    id: 'hostBio',
    section: 'host',
    target: 'instructor.paragraphs',
    type: 'textarea',
    question: 'Tell people a little about your journey',
    helper: "We'll draft this from what you've told us. Edit anything.",
    example: "I've practised Vasthu for 15 years and consulted on more than 3,000 homes...",
    maxLength: 600,
    suggest: true,
    required: true,
  },

  // ---------- 7. Reviews ----------
  {
    id: 'testimonials',
    section: 'proof',
    target: 'testimonials.items',
    mainField: 'quote',
    type: 'items',
    question: 'What have people said about working with you?',
    helper: 'Paste real reviews from WhatsApp, Google or Instagram. Skip if you have none yet.',
    itemFields: [
      { id: 'name', label: 'Name', example: 'Priya R.' },
      { id: 'from', label: 'Who they are', example: 'Homeowner, Chennai' },
      { id: 'quote', label: 'What they said', example: 'Within a month of moving the tijori...' },
      { id: 'photo', label: 'Photo (optional)', type: 'image' },
    ],
    minItems: 0,
    maxItems: 6,
    suggest: false, // never generate reviews: they must be real
    required: false,
  },

  // ---------- 8. Common questions ----------
  {
    id: 'faqs',
    section: 'faq',
    target: 'faq.items',
    mainField: 'question',
    type: 'items',
    question: 'What will people want to ask before signing up?',
    helper: "We've drafted the usual questions. Check the answers are right for you.",
    itemFields: [
      { id: 'question', label: 'Question', example: 'Will I need to break any walls?' },
      { id: 'answer', label: 'Answer', example: 'No. Every remedy in this session is non-structural.' },
    ],
    minItems: 3,
    maxItems: 6,
    suggest: true,
    required: true,
  },

  // 9. Final sign-up button: auto, built from event details + price.
];

// The flow runs in two parts with a checkpoint in between
export const aboutQuestions = webinarQuestions.filter((q) => q.section === 'about');
export const landingQuestions = webinarQuestions.filter((q) => q.section !== 'about');