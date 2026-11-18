import { useEffect, useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { TESTIMONIALS_MAX, TESTIMONIAL_NAME_MAX, TESTIMONIAL_TEXT_MAX, testimonialsOf } from '../data/courses';
import { LINKEDIN_MAX, TESTIMONIAL_FROM_MAX, readLinkedIn } from '../data/courseExtras';
import { ItemPicture } from '../components/ItemsInput';
import './CourseTestimonials.css';

// ------------------------------------------------------------
// Testimonials on a course's Landing page step (CourseLanding.jsx), made
// the same way as a webinar's reviews ("Add your reviews",
// webinarQuestions.js and ItemsInput.jsx), with a LinkedIn link added.
//
//   Testimonials
//   What past students have said, in their words…
//   ┌──────────────────────────────────────────────────────────┐
//   │ (PR)   Name            [Priya R.                ]      ✕ │
//   │ Change Who they are    [Software Engineer, Pune ]        │
//   │ What they said                                           │
//   │ [The course got me the hike…                           ] │
//   │ LinkedIn profile (optional)                              │
//   │ [linkedin.com/in/priya-r                               ] │
//   └──────────────────────────────────────────────────────────┘
//   + Add another
//
// The round picture is the webinar's own (ItemPicture in ItemsInput.jsx):
// a click opens Upload a photo, Use Google icon, Remove picture. It shows
// their photo, else the Google icon, else their initials, else a person.
// The photo is kept with the testimonial itself (the real product stores
// it in the database), not in Cloud Storage.
//
// LinkedIn profile: optional. Only a profile link (linkedin.com/in/…) is
// kept; anything else says so under the box and isn't saved. On the
// landing page it's a "View LinkedIn" button at the foot of the card.
//
// Up to 6. A testimonial needs what they said; everything else is
// optional. Never suggested by AI: they must be real. Each box saves when
// they leave it; a picture saves as soon as it's picked.
//
// course, onSave(change) → true if it saved
// ------------------------------------------------------------

let seed = 0;
const blank = () => ({ id: `tst-new-${Date.now().toString(36)}-${(seed += 1)}`, name: '', from: '', text: '', photo: '', source: '', linkedin: '' });

// What a row saves as: words trimmed, the LinkedIn link only when it's one
const toSaved = (r) => ({
  id: r.id,
  name: r.name.trim(),
  from: r.from.trim(),
  text: r.text.trim(),
  photo: r.photo,
  source: r.source,
  linkedin: readLinkedIn(r.linkedin) ?? '',
});

export default function TestimonialsField({ course, onSave }) {
  const saved = testimonialsOf(course);
  const [rows, setRows] = useState(() => (saved.length ? saved.map((t) => ({ ...t })) : [blank()]));
  const [focusId, setFocusId] = useState(null);

  useEffect(() => {
    if (!focusId) return;
    document.getElementById(`ctm-name-${focusId}`)?.focus();
    setFocusId(null);
  }, [focusId]);

  // Saves the rows with words in them, when they're not what's saved
  const commit = (next) => {
    const list = next.map(toSaved).filter((r) => r.text);
    if (JSON.stringify(list) !== JSON.stringify(saved)) onSave({ testimonials: list });
  };

  const edit = (id, patch) => setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  // A picture saves straight away
  const setPicture = (id, patch) => {
    const next = rows.map((r) => (r.id === id ? { ...r, ...patch } : r));
    setRows(next);
    commit(next);
  };

  const add = () => {
    const row = blank();
    setRows((prev) => [...prev, row]);
    setFocusId(row.id);
  };

  const remove = (id) => {
    const next = rows.filter((r) => r.id !== id);
    setRows(next.length ? next : [blank()]);
    commit(next);
  };

  return (
    <section className="lnd__part lrn--testimonials" aria-labelledby="lrn-testimonials" data-guide="testimonials">
      <div className="lrn__head">
        <h3 className="lrn__title" id="lrn-testimonials">
          Testimonials
        </h3>
      </div>
      <p className="lrn__help">
        What past students have said, in their words: copy real reviews from Google, WhatsApp, LinkedIn or Instagram. Add their
        photo if you have it. They show as testimonials, not star ratings.
      </p>

      <ul className="ctm__list">
        {rows.map((row, i) => {
          const linkedin = row.linkedin.trim();
          const linkOk = linkedin ? Boolean(readLinkedIn(linkedin)) : null;
          return (
            <li key={row.id} className="ctm__card">
              <div className="ctm__person">
                <ItemPicture name={row.name} photo={row.photo} source={row.source} onChange={(patch) => setPicture(row.id, patch)} />
                <div className="ctm__person-fields">
                  <label className="ctm__field">
                    <span className="ctm__label">Name</span>
                    <span className="lrn__box">
                      <input
                        id={`ctm-name-${row.id}`}
                        className="lrn__input"
                        value={row.name}
                        maxLength={TESTIMONIAL_NAME_MAX}
                        placeholder="Priya R."
                        autoComplete="off"
                        onChange={(e) => edit(row.id, { name: e.target.value })}
                        onBlur={() => commit(rows)}
                        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                      />
                    </span>
                  </label>
                  <label className="ctm__field">
                    <span className="ctm__label">Who they are</span>
                    <span className="lrn__box">
                      <input
                        className="lrn__input"
                        value={row.from}
                        maxLength={TESTIMONIAL_FROM_MAX}
                        placeholder="Software Engineer, Pune"
                        autoComplete="off"
                        onChange={(e) => edit(row.id, { from: e.target.value })}
                        onBlur={() => commit(rows)}
                        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                      />
                    </span>
                  </label>
                </div>
                {(rows.length > 1 || row.text) && (
                  <button
                    type="button"
                    className="ilt__tool ilt__tool--delete ctm__remove"
                    title="Remove"
                    aria-label={`Remove testimonial ${i + 1}`}
                    onClick={() => remove(row.id)}
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                )}
              </div>

              <label className="ctm__field">
                <span className="ctm__label">What they said</span>
                <span className="lrn__box tst__quote">
                  <textarea
                    className="lrn__input tst__text"
                    rows={3}
                    value={row.text}
                    maxLength={TESTIMONIAL_TEXT_MAX}
                    placeholder="The course got me the hike. It goes deep on exactly what interviewers ask about."
                    onChange={(e) => edit(row.id, { text: e.target.value })}
                    onBlur={() => commit(rows)}
                  />
                </span>
              </label>

              <label className="ctm__field">
                <span className="ctm__label">
                  LinkedIn profile <span className="crs-field__optional">(optional)</span>
                </span>
                <span className="lrn__box">
                  <input
                    className="lrn__input"
                    type="url"
                    inputMode="url"
                    value={row.linkedin}
                    maxLength={LINKEDIN_MAX}
                    placeholder="linkedin.com/in/priya-r"
                    autoComplete="off"
                    aria-invalid={linkOk === false || undefined}
                    aria-describedby={`ctm-li-${row.id}`}
                    onChange={(e) => edit(row.id, { linkedin: e.target.value })}
                    onBlur={() => commit(rows)}
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                  />
                </span>
                <span id={`ctm-li-${row.id}`} className={linkOk ? 'ctm__ok' : 'ctm__error'} aria-live="polite">
                  {linkOk === true && (
                    <>
                      <Check size={14} strokeWidth={3} aria-hidden="true" /> A View LinkedIn button shows on their testimonial.
                    </>
                  )}
                  {linkOk === false && 'Paste a LinkedIn profile link, like linkedin.com/in/priya-r. It isn’t saved until it is one.'}
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      {rows.length < TESTIMONIALS_MAX && (
        <button type="button" className="lnd__extra lrn__add" onClick={add}>
          <Plus size={16} aria-hidden="true" />
          Add another
        </button>
      )}
    </section>
  );
}