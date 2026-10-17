// ------------------------------------------------------------
// Annotations on the example page shown beside each setup question.
// The example is the real profile page (?mock=profile), rendered
// live, so each part is found by its CSS selector rather than
// measured by hand. If the profile's class names change, update
// the targets here.
//
// target: a selector inside the example page, or 'link' for the
//         address in the browser bar above it.
// page:   which of Meera's pages to show: 'profile' (default) or 'book',
//         the booking page for her Discovery call.
// label:  names the part (the orange pill).
// tip:    why it matters (the white bubble), one or two short lines.
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
  },
  dm: {
    target: '.pf__services > li[data-kind="dm"]',
    label: 'This is a Priority DM',
    tip: 'People send a question and pay. You reply in writing, when it suits you.',
  },
  webinar: {
    target: '.pf__services > li[data-kind="webinar"]',
    label: 'This is a webinar',
    tip: 'One live session for a group. People save a seat and pay.',
  },
  course: {
    target: '.pf__services > li[data-kind="course"]',
    label: 'This is a course',
    tip: 'Lessons people buy once and go through at their own pace.',
  },
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