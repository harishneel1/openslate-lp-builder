import { useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { LESSON_TITLE_MAX } from '../data/courses';
import InlineTitle from '../components/InlineTitle';
import LessonPanel from './LessonPanel';

// ------------------------------------------------------------
// The lesson being worked on, in a panel to the right of the curriculum
// (CourseContent.jsx). One lesson at a time.
//
//   ┌──────────────────────────────────────────────────────────┐
//   │ SECTION 1: INTRODUCTION · LESSON 2              ‹  ›  │ ✕ │
//   │ How servers work ✎                                        │
//   ├──────────────────────────────────────────────────────────┤
//   │ What goes in this lesson? Pick one.                       │
//   │ [Cloud] [Upload video] [PDF] [Embedded video] │ [Text]    │
//   │ …its description and resources, once it has content       │
//   ├──────────────────────────────────────────────────────────┤
//   │ ✓ Changes save as you go          [Done] [+ Add next lesson] │
//   └──────────────────────────────────────────────────────────┘
//
// The head stays put; only the body scrolls, so a long text lesson
// never pushes ‹ › and ✕ away. On most screens it's the right column of
// the Curriculum workspace, the full height of the step's card, beside
// the outline (CoursesPage.css). On short screens it stays in view as the
// page scrolls; on narrow ones it covers the page from the right.
// The content tiles' hints show as a line under the tiles, not a bubble
// (which the scrolling body would cut off).
//
// Head: where the lesson sits (its section, and its number there, as in
// the outline), then its name, renamed in place (InlineTitle).
//   ‹ ›  the lesson before or after it, across sections, in the order
//        students take them. Disabled at either end.
//   ✕    closes the panel (so does Escape, unless they're typing or a
//        pop-up is open)
// Moving to another lesson or closing asks first when something isn't
// saved (CourseContent's guard).
//
// Body: what goes in the lesson, as before (LessonPanel.jsx): the content
// tiles, then the content, its description and resources. Keyed by the
// lesson, so each lesson starts fresh, scrolled to the top.
//
// Foot: the lesson's own ending, so finishing one never sends the eye to
// the step's Continue (top right, CoursePage.jsx). The bottom of the
// screen is the lesson's alone. Everything here saves as it's made, and the foot says so; while
// something isn't saved yet (text being written), it says that instead.
//   + Add next lesson  the one solid button: closes the panel and opens a
//                      new lesson's title box right under this one
//                      (CourseContent.jsx)
//   Done               closes the panel
//
// Opening it puts the keyboard in it; ‹ › keep focus on themselves.
//
// course; entry: { lesson, section, sectionNumber, number } (CourseContent)
// prev, next: entries, or null at either end
// onGo(lessonId), onClose(), onAddNext(), onRename(title) → saved or not
// onSaved(ok), onDirtyChange(dirty): passed on to the lesson's content
// ------------------------------------------------------------

export default function LessonPane({ course, entry, prev, next, onGo, onClose, onAddNext, onRename, onSaved, onDirtyChange }) {
  const { lesson, section, sectionNumber, number } = entry;
  const pane = useRef(null);
  const body = useRef(null);
  const [dirty, setDirty] = useState(false); // something in the lesson isn't saved yet
  const dirtyChange = (d) => {
    setDirty(d);
    onDirtyChange(d);
  };

  // A new lesson in the panel: its top, and the keyboard in the panel
  // unless it's already there (‹ › keep it on themselves)
  useEffect(() => {
    if (body.current) body.current.scrollTop = 0;
    if (!pane.current?.contains(document.activeElement)) pane.current?.focus({ preventScroll: true });
  }, [lesson.id]);

  // Escape closes, except while typing (the box handles its own Escape)
  // or with a pop-up open over the page
  const onKeyDown = (e) => {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    if (e.target.closest?.('input, textarea, select, [contenteditable="true"], dialog')) return;
    if (document.querySelector('dialog[open]')) return;
    e.preventDefault();
    onClose();
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <aside
      id="cct-pane"
      ref={pane}
      className="cct__pane"
      tabIndex={-1}
      aria-label={`Lesson ${number}: ${lesson.title}`}
      onKeyDown={onKeyDown}
    >
      <header className="cct__pane-head">
        <div className="cct__pane-top">
          <p className="cct__pane-where">
            <span className="cct__pane-section">
              Section {sectionNumber}: {section.title}
            </span>
            <span className="cct__pane-dot" aria-hidden="true">
              ·
            </span>
            <span className="cct__pane-num">Lesson {number}</span>
          </p>
          <div className="cct__pane-tools">
            <button
              type="button"
              className="cct__pane-btn"
              disabled={!prev}
              aria-label={prev ? `Previous lesson: ${prev.lesson.title}` : 'Previous lesson'}
              title={prev ? `Previous: ${prev.lesson.title}` : undefined}
              onClick={() => prev && onGo(prev.lesson.id)}
            >
              <ChevronLeft size={19} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="cct__pane-btn"
              disabled={!next}
              aria-label={next ? `Next lesson: ${next.lesson.title}` : 'Next lesson'}
              title={next ? `Next: ${next.lesson.title}` : undefined}
              onClick={() => next && onGo(next.lesson.id)}
            >
              <ChevronRight size={19} aria-hidden="true" />
            </button>
            <span className="cct__pane-sep" aria-hidden="true" />
            <button type="button" className="cct__pane-btn" aria-label="Close lesson" title="Close (Esc)" onClick={onClose}>
              <X size={19} aria-hidden="true" />
            </button>
          </div>
        </div>
        <InlineTitle
          key={lesson.id}
          id={`pane-title-${lesson.id}`}
          label="Lesson name"
          variant="pane"
          value={lesson.title}
          maxLength={LESSON_TITLE_MAX}
          onSave={onRename}
        />
      </header>

      <div className="cct__pane-body" ref={body}>
        <LessonPanel key={lesson.id} course={course} lesson={lesson} onSaved={onSaved} onDirtyChange={dirtyChange} />
      </div>

      <footer className="cct__pane-foot">
        <p className={`cct__pane-saved ${dirty ? 'cct__pane-saved--unsaved' : ''}`} aria-live="polite">
          {dirty ? (
            'Not saved yet'
          ) : (
            <>
              <Check size={15} strokeWidth={2.5} aria-hidden="true" /> Changes save as you go
            </>
          )}
        </p>
        <button type="button" className="crs-btn crs-btn--quiet crs-btn--small" onClick={onClose}>
          Done
        </button>
        <button type="button" className="crs-btn crs-btn--primary crs-btn--small" onClick={onAddNext}>
          <Plus size={16} aria-hidden="true" />
          Add next lesson
        </button>
      </footer>
    </aside>
  );
}