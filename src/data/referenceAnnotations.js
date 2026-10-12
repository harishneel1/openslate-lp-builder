// ------------------------------------------------------------
// Annotations on the example landing page (desktop, 1440px wide).
// Shown beside each question so creators see where their answer
// goes on a real, finished page.
//
// box: the area to highlight, as % of the full screenshot
//      (x, w = % of width; y, h = % of height), so it works at
//      any resolution as long as it's the same capture.
// label: names the part (the orange pill).
// tip:   why it matters (the white bubble), one or two short lines.
// Keys match question ids in webinarQuestions.js.
// finalCta is auto, so it has no entry.
// ------------------------------------------------------------

export const referenceImage = {
  src: '/reference/webinar-example.png', // switch to .webp later to make it lighter
  // aspect ratio of the screenshot, for layout before it loads
  width: 1501,
  height: 8000,
};

export const referenceAnnotations = {
  headline: {
    box: { x: 19.99, y: 3.0, w: 59.96, h: 2.56 },
    label: 'This is your headline',
    tip: 'The most important line on your page. Most visitors decide right here whether to keep reading.',
  },
  subheadline: {
    box: { x: 23.45, y: 5.65, w: 53.16, h: 0.6 },
    label: 'This is your subheadline',
    tip: 'It answers their first doubt before they ask it, so they keep reading.',
  },
  eventDetails: {
    box: { x: 28.78, y: 6.48, w: 42.37, h: 0.96 },
    label: 'These are your event details',
    tip: 'When, how long, and in what language. Clear details make it easy to say yes.',
  },
  pricing: {
    box: { x: 35.11, y: 7.62, w: 29.85, h: 1.1 },
    label: 'This is your sign-up button',
    tip: 'The one thing you want every visitor to click. Free or paid changes what it says.',
  },
  priceDetails: {
    box: { x: 46.64, y: 10.82, w: 8.13, h: 0.73 },
    label: 'This is your price',
    tip: 'Showing the regular price next to yours makes the deal easy to see.',
  },
  learnings: {
    box: { x: 13.99, y: 12.35, w: 71.95, h: 16.4 },
    label: "This is what they'll learn",
    tip: 'Specific points make the hour feel worth it. Vague ones get skipped.',
  },
  personas: {
    box: { x: 19.32, y: 40.69, w: 61.43, h: 5.62 },
    label: "This is who it's for",
    tip: 'Visitors sign up when they recognise themselves here.',
  },
  hostDetails: {
    box: { x: 10.99, y: 47.94, w: 78.28, h: 10.44 },
    label: 'This is you, the host',
    tip: 'A real photo and real results. People join people they trust.',
  },
  testimonials: {
    box: { x: 10.99, y: 60.38, w: 78.01, h: 13.81 },
    label: 'These are your reviews',
    tip: 'What others say about you convinces more than anything you say yourself.',
  },
  faqs: {
    box: { x: 21.32, y: 82.75, w: 57.43, h: 5.75 },
    label: 'These are your FAQs',
    tip: 'Answer the doubts that would otherwise stop someone from signing up.',
  },
};