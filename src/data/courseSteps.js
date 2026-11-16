import { OUTCOMES_MIN, publishCheck } from './courses';

// ------------------------------------------------------------
// The three steps on a course's page (CoursePage.jsx), in the stepper
// across its top bar: which are done (a tick), and what publishing still
// needs. Publishing's own rules are publishCheck in courses.js; this only
// says which step, and which field, each belongs to.
//
//   ① Curriculum     a lesson with something in it
//   ② Landing page   a subtitle, and at least 3 things students will learn
//   ③ Pricing        a price, or Free
//
// A cover, a description, requirements and who it's for are optional:
// the landing page leaves out what's empty.
//
// STEPS → [{ id, label }], in order
// courseSteps(course) → { [step]: { done } }
// missingToPublish(course) → [{ step, field, text }]: what's left before it
//   can be published, in step order, each with the step and field that
//   fix it ('lessons' | 'subtitle' | 'outcomes' | 'price'); [] when ready
// ------------------------------------------------------------

export const STEPS = [
  { id: 'curriculum', label: 'Curriculum' },
  { id: 'landing', label: 'Landing page' },
  { id: 'pricing', label: 'Pricing' },
];

export function missingToPublish(course) {
  const check = publishCheck(course);
  const missing = [];
  if (check.lessons === 0) missing.push({ step: 'curriculum', field: 'lessons', text: 'add a video, PDF or text to a lesson' });
  if (!check.subtitle) missing.push({ step: 'landing', field: 'subtitle', text: 'add a subtitle' });
  if (check.outcomes < OUTCOMES_MIN) {
    const left = OUTCOMES_MIN - check.outcomes;
    missing.push({
      step: 'landing',
      field: 'outcomes',
      text: check.outcomes === 0 ? `add ${OUTCOMES_MIN} things students will learn` : `add ${left} more thing${left === 1 ? '' : 's'} students will learn`,
    });
  }
  if (!check.priced) missing.push({ step: 'pricing', field: 'price', text: 'set a price, or make it free' });
  return missing;
}

export function courseSteps(course) {
  const missing = missingToPublish(course);
  return Object.fromEntries(STEPS.map(({ id }) => [id, { done: !missing.some((m) => m.step === id) }]));
}