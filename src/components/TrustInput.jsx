import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { TrackRecordField } from '../screens/CourseLandingExtras';
import TestimonialsField from '../screens/CourseTestimonials';
import '../screens/CoursePage.css'; // the editors' frames and boxes (lnd__part, lrn__box)
import './TrustInput.css';

// ------------------------------------------------------------
// The coach's track record and testimonials, on their profile, with the
// same editors as a course's landing page (CourseLandingExtras.jsx,
// CourseTestimonials.jsx) in a coach's words, kept short:
//
//   Setup screen 3, "Show people you're trusted": TrackRecordInput
//     Clients you've helped [ 125 ]   Rating [ 4.7 ] / 5   Reviews [ 12 ]
//     4.7 ★★★★★ · 12 reviews · 125 clients
//     [● Show these on my storefront]  Recommended
//
//   Setup screen 4, "What do past clients say?": TestimonialsInput
//     (photo) Name / Who they are / What they said / LinkedIn
//     + Add another
//     Focusing a field tells setup which one (question.onFocusField), so
//     the example page beside it highlights that part of a testimonial.
//
//   Edit profile: TrackRecordInput and TestimonialsInput, each in its own
//   panel, saved with Edit profile's Save (so no "Saved" here: showSaved).
//
// No headings of their own: the screen's title (or the panel's) names them.
// In setup, each change saves straight away, and a grey "✓ Saved" shows
// under the form for a moment, so they can see it's kept.
//
// Both are optional. The track record shows nothing until it's switched on.
// On the storefront: the numbers under the bio (buildProfileJson.js, until
// real ratings take over) and the testimonials in "What clients say".
//
// Saves (as answers):
//   trackRecord   { students, rating, reviews, source, on }
//   testimonials  [{ id, name, from, text, photo, source, linkedin }]
// answers, onChange(value, id): as any setup question
// ------------------------------------------------------------

const TRACK_COPY = {
  title: null,
  why: null,
  countLabel: 'Clients you’ve helped',
  unit: 'clients',
  switchLabel: 'Show these on my storefront',
  showSource: false,
  showReviews: true, // Reviews [ 12 ], beside clients and rating
};

const TESTIMONIAL_COPY = {
  title: null,
  help: null,
  textPlaceholder: 'One call with her and I finally knew what to say in my salary negotiation.',
};

const SAVED_MS = 2500;

// The editors save a change as { trackRecord } or { testimonials }.
// Returns the save, and whether "Saved" is showing.
function useSave(onChange, showSaved) {
  const [saved, setSaved] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const save = (change) => {
    Object.entries(change).forEach(([id, value]) => onChange(value, id));
    if (showSaved) {
      setSaved(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setSaved(false), SAVED_MS);
    }
    return true;
  };
  return [save, saved];
}

// "✓ Saved", for a moment after each change. The line keeps its room, so
// nothing jumps.
function SavedNote({ show }) {
  return (
    <p className="trust__saved" aria-live="polite">
      {show && (
        <>
          <Check size={14} strokeWidth={3} aria-hidden="true" /> Saved
        </>
      )}
    </p>
  );
}

// showSaved: false in Edit profile, where Save does the saving
export function TrackRecordInput({ answers, onChange, showSaved = true }) {
  const [save, saved] = useSave(onChange, showSaved);
  return (
    <div>
      <TrackRecordField course={answers} onSave={save} copy={TRACK_COPY} />
      {showSaved && <SavedNote show={saved} />}
    </div>
  );
}

// onFocusField(field): 'photo' | 'name' | 'from' | 'text' | 'linkedin', or
// null when focus leaves the testimonials (from question.onFocusField)
export function TestimonialsInput({ question, answers, onChange, showSaved = true }) {
  const onFocusField = question?.onFocusField;
  const [save, saved] = useSave(onChange, showSaved);
  return (
    <div
      onFocus={(e) => onFocusField?.(e.target.closest?.('[data-field]')?.dataset.field ?? null)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && onFocusField?.(null)}
    >
      <TestimonialsField course={answers} onSave={save} copy={TESTIMONIAL_COPY} />
      {showSaved && <SavedNote show={saved} />}
    </div>
  );
}
