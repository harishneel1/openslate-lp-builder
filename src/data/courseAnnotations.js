import { PAGE_DOMAIN } from './myPage';

// ------------------------------------------------------------
// The guide beside a course's Landing page and Pricing steps
// (CoursePage.jsx): Meera's example course (exampleCourse.js), on the real
// landing page, with the part the coach is filling in boxed, named and
// explained. The same frame and marks as the storefront's setup
// (ProfileExample.jsx, with these as its page.annotations).
//
// The example is the real landing page (CourseLandingPage.jsx), rendered
// live in the frame at ?mock=course-example&embed=1, so each part is found
// by its CSS selector rather than measured by hand. If the landing page's
// class names change, update the targets here.
//
// Keys are the fields' data-guide names (CourseLanding.jsx,
// CoursePricing.jsx): whichever one the coach is in, its part shows.
//   target  a selector inside the example page
//   label   names the part (the orange pill)
//   tip     why it matters (the white bubble), one or two short lines
//   labelAt optional, as in profileAnnotations.js
//
// Testimonials have no part of their own on the example, which has
// students' reviews instead: their note points at the reviews and says
// testimonials take that spot until students rate the course.
//
// COURSE_EXAMPLE_PAGE: the page prop for ProfileExample
// ------------------------------------------------------------

export const courseAnnotations = {
  title: {
    target: '.cld__title',
    label: 'This is your title',
    tip: 'Say the result people get, not just the topic.',
  },
  subtitle: {
    target: '.cld__subtitle',
    label: 'This is your subtitle',
    tip: 'One line on how it works and who it suits.',
  },
  outcomes: {
    target: '.cld__box',
    label: 'This is what students will learn',
    tip: 'Things they’ll be able to do. At least 3; 6 to 8 reads best.',
  },
  cover: {
    target: '.cld__card .cvr',
    label: 'This is your cover image',
    labelAt: 'left',
    tip: 'A bright, clear photo beats text. 16:9, like 1280 × 720.',
  },
  description: {
    target: 'section[aria-labelledby="cld-desc"]',
    label: 'This is your description',
    tip: 'The problem, how the course works, and what changes by the end.',
  },
  requirements: {
    target: 'section[aria-labelledby="cld-req"]',
    label: 'These are your requirements',
    tip: 'If nothing’s needed, say so. It reassures beginners.',
  },
  audience: {
    target: 'section[aria-labelledby="cld-who"]',
    label: 'This is who it’s for',
    tip: 'Name the people who’ll get the most from it, so they see themselves.',
  },
  testimonials: {
    target: '#cld-reviews',
    label: 'Your testimonials show here',
    tip: 'Until students rate your course, the testimonials you add sit in this spot, as quotes.',
  },
  price: {
    target: '.cld__card-body',
    label: 'This is your price',
    labelAt: 'left',
    tip: 'People see it here, beside the page as they scroll, and in a bar that follows them down it.',
  },
};

export const COURSE_EXAMPLE_PAGE = {
  src: `${window.location.pathname}?mock=course-example&embed=1`,
  link: `${PAGE_DOMAIN}/web/course/yoga-for-everyday-strength`,
  caption: 'Meera Joshi’s example course',
  tag: 'Example: Meera Joshi’s course',
  annotations: courseAnnotations,
};