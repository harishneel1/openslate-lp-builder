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
// reviewLabel: its short name on review screens (the checkpoint,
//           and the rows of "Edit your landing page")
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
   
  // Ramble question: they write freely, we summarise, they approve.
  // The approved summary saves under its id (audience);
  // everything they wrote saves under audienceRaw.
  {
    id: 'audience',
    reviewLabel: "Who it's for",
    section: 'about',
    type: 'ramble',
    question: 'Who is your webinar for?',
    intro: "Describe them like you're telling a friend. Who are they, what's their life like, why would they show up? Write as much as you like, and we'll tidy it up.",    placeholder: "e.g. Mostly families in their 30s and 40s who are building or buying their first home. Many have already spent a lot on the house and are worried something's off…",
    nextHint: 'Press Done, then approve your answer',
    required: true,
  },

  // TEMPORARY: the other two blanks stay as a sentence until
  // we turn them into ramble questions in the next steps.
    {
    id: 'problem',
    reviewLabel: 'Their struggle',
    section: 'about',
    type: 'ramble',
    question: 'What are they struggling with?',
    intro: "What's going wrong for them right now? What have they already tried, and what keeps them up at night? Write as much as you like, and we'll tidy it up.",
    placeholder: "e.g. Money comes in but never seems to stay. There's constant tension at home and they can't work out why. Some have already spent on remedies that didn't help…",
    required: true,
  },

  // TEMPORARY: the last blank stays as a sentence until it
  // becomes a ramble question in the next step.
  {
    id: 'result',
    reviewLabel: "What they'll get",
    section: 'about',
    type: 'ramble',
    question: 'What will they walk away with?',
    intro: 'Once the webinar ends, what will they be able to do, understand or change in their lives? Think about how their life looks afterwards. Write as much as you like, and we\'ll tidy it up.',
    placeholder: "e.g. They'll be able to walk through their own home and spot the 5 most common Vasthu mistakes. They'll know simple fixes that don't need any walls broken…",
    required: true,
  },

    {
    id: 'teach',
    reviewLabel: "What you'll teach",
    section: 'about',
    type: 'ramble',
    question: 'What will you teach?',
    intro: "Walk us through what you'll cover in the session. The main ideas, the steps, the examples you'll share, anything you'd normally explain. Write as much as you like, and we'll tidy it up.",
    placeholder: "e.g. I'll start with why Vasthu matters for money. Then I'll go room by room: the entrance, the kitchen, the bedroom and the money corner. For each one I'll show the common mistake and a fix that doesn't need any construction…",
    required: true,
  },

  // ---------- 1. Headline ----------
    {
    id: 'headline',
    reviewLabel: 'Headline',
    section: 'hero',
    target: 'hero.title',
    type: 'textarea',
    question: "Let's start with your headline",
    helper: "It's the first thing people read, and it decides whether they stay.",
    example: 'Fix the 5 hidden Vasthu mistakes that block money in your home, without breaking a single wall',
    maxLength: 120,
    suggest: true,
    suggestLabel: 'headlines', // "Writing headlines from your answers…"
     answerLabel: 'Your headline',
    required: true,
  },
  {
    id: 'subheadline',
    reviewLabel: 'Subheadline',
    section: 'hero',
    target: 'hero.subtitle',
    type: 'textarea',
    question: 'Now, your subheadline',
    helper: 'It sits under your headline and gives people a reason to believe it.',
    example: 'Simple remedies you can do this weekend, based on 15 years and 3,000+ homes',
    maxLength: 140,
    suggest: true,
    suggestLabel: 'lines',
     answerLabel: 'Your subheadline',
    required: true,
  },

  // ---------- 2. Event details ----------
    // ---------- 2. Event details (one screen) ----------
  // Each field is saved flat under its own id, like sentence parts.
  // half:        sits side by side with the next half field
  // collapsible: shown as "Label: value · Change" until tapped
  {
    id: 'eventDetails',
    reviewLabel: 'Event details',
    section: 'event',
    type: 'group',
    question: 'Now, your event details',
    helper: 'These show at the top of your page, next to the sign-up button.',
    fields: [
            { id: 'date', card: 'When', target: 'event.start', type: 'date', label: 'Date', half: true, required: true },
            { id: 'time', card: 'When', target: 'event.start', type: 'time', label: 'Start time', half: true, required: true },
      {
        id: 'timeZone',
                card: 'When',
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
                card: 'Format',
        target: 'hero.details',
        type: 'choice',
        label: 'How long',
        options: ['30 min', '60 min', '90 min', '2 hours'],
        required: true,
      },
      {
        id: 'language',
        card: 'Format',
        target: 'hero.details',
        type: 'choice',
        label: 'Language',
        options: ['English', 'Hindi', 'Tamil', 'Telugu', 'Kannada', 'Malayalam'],
        required: true,
      },
      {
        id: 'format',
        card: 'Format',
        target: 'hero.details',
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
    reviewLabel: 'Free or paid',
    section: 'cta',
    type: 'choice',
    question: 'Is it free or paid?',
    options: ['Free', 'Paid'],
    buttonText: true,
    required: true,
  },
    // Price and regular price on one screen. Each still saves under its
  // own id (price, oldPrice), like the other group fields.
  {
    id: 'priceDetails',
    reviewLabel: 'Price',
    section: 'cta',
    type: 'group',
    question: 'Set your price',
    helper: 'You can change it any time.',
    nextHint: 'Add your price to continue',
    showIf: { field: 'pricing', equals: 'Paid' },
    fields: [
      {
        id: 'price',
        target: 'pricing.price',
        type: 'number',
        label: 'Price',
        example: '499',
        required: true,
      },
      {
        id: 'oldPrice',
        target: 'pricing.oldPrice',
        type: 'number',
        label: 'Regular price',
        helper: 'Shown crossed out next to your price.',
        mustExceed: 'price', // must be more than the price to make sense
        required: false,
      },
    ],
    required: true,
  },

  // ---------- 4. What you'll learn ----------
  {
    id: 'learnings',
    reviewLabel: "What they'll learn",
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
    reviewLabel: "Who it's for",
    section: 'audience',
    target: 'personas.items',
    mainField: 'title',
    type: 'items',
    question: 'Who is this webinar for?',
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
    // ---------- 6. Host (one screen) ----------
  {
    id: 'hostDetails',
    reviewLabel: 'About the speaker',
    section: 'host',
    type: 'group',
    question: 'About the speaker',
    helper: "This is how you'll appear on your page.",
    nextHint: 'Add your name and bio to continue',
    fields: [
      {
        id: 'hostPhoto',
        target: 'instructor.photo',
        type: 'image',
        label: 'Photo',
        helper: 'A clear photo of your face works best. JPG or PNG, up to 5 MB.',
        prefill: 'creator.photo',
      },
      {
        id: 'hostName',
        target: 'instructor.name',
        type: 'text',
        label: 'Name',
        maxLength: 40,
        prefill: 'creator.name',
        required: true,
      },
      {
        id: 'hostBio',
        target: 'instructor.paragraphs',
        type: 'textarea',
        label: 'Bio',
        example: "I've practised Vasthu for 15 years and consulted on more than 3,000 homes...",
        maxLength: 600,
        required: true,
      },
    ],
    required: true,
  },
  // ---------- 7. Reviews ----------
    {
    id: 'testimonials',
    reviewLabel: 'Reviews',
    section: 'proof',
    target: 'testimonials.items',
    mainField: 'quote',
    type: 'items',
    question: 'What have people said about working with you?',
    helper: 'Paste real reviews from WhatsApp, Google or Instagram.',
    emptyText: "No reviews yet? That's fine. Skip this for now and add them later.",
    addLabel: 'Add a review',
    itemFields: [
      { id: 'quote', label: 'What they said', example: 'Within a month of moving the tijori, things felt calmer at home' },
      { id: 'name', label: 'Name', example: 'Priya R.' },
      { id: 'from', label: 'Who they are', example: 'Homeowner, Chennai' },
      { id: 'photo', label: 'Photo', type: 'image' },
    ],
    minItems: 0,
    maxItems: 6,
    suggest: false, // never generate reviews: they must be real
    required: false,
  },

  // ---------- 8. Common questions ----------
  {
    id: 'faqs',
    reviewLabel: 'FAQs',
    section: 'faq',
    target: 'faq.items',
    mainField: 'question',
    type: 'items',
    question: 'FAQs',
    helper: "We've drafted the usual questions. Check the answers are right for you.",
    suggestLabel: 'questions', // "Writing questions from your answers…"
    itemFields: [
      { id: 'question', label: 'Question', example: 'Will I need to break any walls?' },
      { id: 'answer', label: 'Answer', example: 'No. Every remedy in this session is non-structural.' },
    ],
    minItems: 3,
    maxItems: 14,
    suggest: true,
    required: true,
  },

  // 9. Final sign-up button: auto, built from event details + price.
];

// The flow runs in two parts with a checkpoint in between
export const aboutQuestions = webinarQuestions.filter((q) => q.section === 'about');
export const landingQuestions = webinarQuestions.filter((q) => q.section !== 'about');