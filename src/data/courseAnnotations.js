import { PAGE_DOMAIN } from './myPage';

// ------------------------------------------------------------
// The guide beside a course's Landing page and Pricing steps
// (CoursePage.jsx): Meera's example course (exampleCourse.js), on the real
// landing page, with the part the coach is filling in boxed and named.
// The same frame and marks as the storefront's setup (ProfileExample.jsx,
// with these as its page.annotations).
//
// Kept simple on purpose: the part is boxed, the rest of the page only
// lightly dimmed (dim, below) so the whole landing page still reads, and
// an orange pill names the part. No teaching bubbles, and no tag on the
// frame: the page and the pill say enough.
//
// The example is the real landing page (CourseLandingPage.jsx), rendered
// live in the frame at ?mock=course-example&embed=1, so each part is found
// by its CSS selector rather than measured by hand. If the landing page's
// class names change, update the targets here.
//
// Keys are the fields' data-guide names (CourseLanding.jsx,
// CourseLandingExtras.jsx, CoursePricing.jsx): whichever one the coach is
// in, its part shows.
//   target   a selector inside the example page
//   label    names the part (the orange pill)
//   labelAt  optional, as in profileAnnotations.js. 'under' (with under:
//            a selector) puts the pill below that part of the page, with
//            its arrow running up the margin to the box: the parts in the
//            band use it, so their pill sits below What you'll learn,
//            off the band, covering nothing.
//
// Testimonials have no part of their own on the example, which has
// students' reviews instead: their pill points at the reviews, where
// testimonials sit until students rate the course.
// Your track record points at the rating line in the band: on the
// example it's Meera's course rating, which is where a coach's own
// numbers show until their course has its own.
//
// COURSE_EXAMPLE_PAGE: the page prop for ProfileExample
//   dim: how much the rest of the page is shaded (0–1), lighter than the
//   storefront guide's, so the coach sees the landing page as a whole
// ------------------------------------------------------------

export const courseAnnotations = {
  title: {
    target: '.cld__title',
    label: 'This is your title',
    labelAt: 'under',
    under: '.cld__box',
  },
  subtitle: {
    target: '.cld__subtitle',
    label: 'This is your subtitle',
    labelAt: 'under',
    under: '.cld__box',
  },
  duration: {
    target: '.cld__duration',
    label: 'This is how long it takes',
    labelAt: 'under',
    under: '.cld__box',
  },
  trackRecord: {
    target: '.cld__rating',
    label: 'This is your track record',
    labelAt: 'under',
    under: '.cld__box',
  },
  outcomes: {
    target: '.cld__box',
    label: 'This is what students will learn',
  },
  cover: {
    target: '.cld__card .cvr',
    label: 'This is your cover',
    labelAt: 'left',
  },
  description: {
    target: 'section[aria-labelledby="cld-desc"]',
    label: 'This is your description',
  },
  requirements: {
    target: 'section[aria-labelledby="cld-req"]',
    label: 'These are your requirements',
  },
  audience: {
    target: 'section[aria-labelledby="cld-who"]',
    label: 'This is who it’s for',
  },
  testimonials: {
    target: '#cld-reviews',
    label: 'Your testimonials show here',
  },
  price: {
    target: '.cld__card-body',
    label: 'This is your price',
    labelAt: 'left',
  },
};

export const COURSE_EXAMPLE_PAGE = {
  src: `${window.location.pathname}?mock=course-example&embed=1`,
  link: `${PAGE_DOMAIN}/web/course/yoga-for-everyday-strength`,
  caption: 'Meera Joshi’s example course',
  dim: 0.1,
  annotations: courseAnnotations,
};