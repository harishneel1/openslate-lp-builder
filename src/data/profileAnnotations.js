// ------------------------------------------------------------
// Annotations on the example page shown beside each setup question.
// The example is the real profile page (?mock=profile), rendered
// live, so each part is found by its CSS selector rather than
// measured by hand. If the profile's class names change, update
// the targets here.
//
// target: a selector inside the example page, or 'link' for the
//         address in the browser bar above it.
// page:   which of Meera's pages to show: 'profile' (default), 'book',
//         the booking page for her Discovery call, or 'checkout', its
//         checkout with the example questions.
// label:  names the part (the orange pill).
// labelAt: optional, for parts surrounded by things that shouldn't be covered.
//         'top' pins the pill to the top of the page, with an arrow down
//         the left edge to the box. 'under' puts it in the empty space
//         below the page's content (the bottom of `under`, a selector, or
//         the lowest of a list of them), with an arrow up the left edge.
//         'left' puts it level with the box, in the space to its left,
//         with a short arrow across. Each falls back to beside the box
//         when there isn't room.
// stayAtTop: optional. Don't scroll the example to bring the part into view.
// header: optional. false hides the caption and note above the example.
// tip:    optional. Why it matters (the white bubble), one or two short lines.
// Keys match question ids in myPageQuestions.js. An entry can also be a
// function of that question's answer, to point at something that depends
// on what they picked.
// ------------------------------------------------------------

// One of Meera's cards of each kind, found by the kind on its list item
const offerNotes = {
  call: {
    target: '.pf__services > li[data-kind="call"]',
    label: 'This is a 1:1 call',
    tip: 'People pick a time that suits them and pay when they book.',
  }
};

export const profileAnnotations = {
  handle: {
    target: 'link',
    label: 'This is your link',
    tip: 'People tap it from your bio or type it in. Short and easy to say out loud works best.',
  },
  // Before they pick: the kinds of things on offer. After: a card of that kind.
  offerType: (kind) =>
    offerNotes[kind] ?? {
      target: '.sf',
      label: 'These are the things people can book',
      tip: 'Meera offers four kinds. You’ll start with one and can add the rest anytime.',
    },
  availability: {
    page: 'book',
    target: '.bk__picker-card',
    label: 'This is where people pick a time',
    tip: 'The times they see come from the hours you set here.',
  },
  callAbout: {
    page: 'book',
    target: '.cd__about',
    label: 'This is your 1:1 call event’s description',
    labelAt: 'under', // in the space below the page: beside the box it would cover the call's details
    under: '.bk__details, .bk__picker-card',
  },
  // An example checkout (Meera's call, with EXAMPLE_QUESTIONS), the same
  // whatever they type: it shows what questions look like to people booking
  callQuestions: {
    page: 'checkout',
    target: '.co__questions',
    label: 'People answer these when they book',
    labelAt: 'left', // in the empty space left of the form: above or below it would cover fields
    stayAtTop: true, // the top of checkout always in view, so it reads as checkout
    header: false, // no caption or note above the frame: the page speaks for itself
  },
  // Shown on their own page (not Meera's), filling in as they pick: see
  // MyPageSetup.jsx. The whole calls section, so it's there even before
  // anything is picked. No bubble: the cards appearing say enough.
  callSource: {
    target: 'section[aria-labelledby="pf-services"]',
    label: 'Your calls show here',
  },
  callDetails: {
    target: '.pf__services > li[data-kind="call"]',
    label: 'This is your call',
    tip: 'People see its name, how long it is and the price, then pick a time.',
  },
  about: {
    target: '.cp',
    label: 'This is the top of your page',
    tip: 'Your photo, your name and a few lines about you. It’s the first thing visitors read.',
  },
  name: {
    target: '.cp__name',
    label: 'This is your name',
    tip: 'Use the name people already know you by.',
  },
  service: {
    target: '.pf__services > li:first-child',
    label: 'This is what people book',
    tip: 'Start with one; you can add more anytime. Ratings show up here as people book you.',
  },
  photo: {
    target: '.cp__photo',
    label: 'This is your photo',
    tip: 'People book people. A real face gets far more bookings than initials.',
  },
  headline: {
    target: '.cp__headline',
    label: 'This is what you help with',
    tip: 'A few words on who you help. Visitors decide in seconds if this is for them.',
  },
  bio: {
    target: '.cp__about',
    label: 'This is about you',
    tip: 'Why should someone trust you with their time? Your background, and what a session with you is like.',
  },
};