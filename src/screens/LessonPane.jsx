import { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2, X } from 'lucide-react';
import { LESSON_TITLE_MAX } from '../data/courses';
import InlineTitle from '../components/InlineTitle';
import LessonPanel from './LessonPanel';

// ------------------------------------------------------------
// The lesson being worked on, in the panel to the right of the curriculum
// (CourseContent.jsx). One lesson at a time. The panel stays open: there's
// no ✕ or Done here (only on narrow screens, where it covers the page).
// This is the one place a lesson is renamed or deleted.
//
//   ┌──────────────────────────────────────────────────────────┐
//   │ INTRODUCTION · LESSON 2                       ‹  ›  │ 🗑 │
//   │ How servers work ✎                                        │
//   ├──────────────────────────────────────────────────────────┤
//   │ What goes in this lesson? Pick one.                       │
//   │ [Cloud] [Upload video] [PDF] [Embedded video] │ [Text]    │
//   │ …its description and resources, once it has content       │
//   ├──────────────────────────────────────────────────────────┤
//   │                                     [+ Add next lesson]   │
//   └──────────────────────────────────────────────────────────┘
//
// The head stays put; only the body scrolls, so a long text lesson
// never pushes ‹ › away. On most screens it's the right column of the
// Curriculum workspace, the full height of the step's card, beside the
// outline (CoursesPage.css, CourseCurriculum.css). On short screens it
// stays in view as the page scrolls; on narrow ones it covers the page
// from the right, with ✕ (and Escape) to close it.
//
// Head: where the lesson sits (its section's name, and its number there,
// as in the outline), then its name, renamed in place (InlineTitle, its
// pencil always shown). A new lesson ("Untitled lesson") opens with its
// name selected, ready to type over (selectTitle).
//   ‹ ›  the lesson before or after it, across sections, in the order
//        students take them. Disabled at either end.
//   🗑    Delete lesson (asks first; CourseContent.jsx)
// Moving to another lesson asks first when something isn't saved
// (CourseContent's guard).
//
// Body: what goes in the lesson (LessonPanel.jsx): the content tiles,
// then the content, its description and resources. Keyed by the lesson,
// so each lesson starts fresh, scrolled to the top.
//
// Foot: + Add next lesson, the one solid button: a new "Untitled lesson"
// right after this one, opened here with its name selected
// (CourseContent.jsx). Whether things are saved is said once, in the
// course page's steps row, not here.
//
// course; entry: { lesson, section, sectionNumber, number } (CourseContent)
// prev, next: entries, or null at either end
// onGo(lessonId), onAddNext(), onDelete(), onRename(title) → saved or not
// onSaved(ok), onDirtyChange(dirty): passed on to the lesson's content
// selectTitle, onTitleSelected(): select its name straight away (a new lesson)
// closable, onClose(): narrow screens only: ✕ and Escape close the panel
// ------------------------------------------------------------

export default function LessonPane({
  course,
  entry,
  prev,
  next,
  onGo,
  onAddNext,
  onDelete,
  onRename,
  onSaved,
  onDirtyChange,
  selectTitle = false,
  onTitleSelected,
  closable = false,
  onClose,
}) {
  const { lesson, section, number } = entry;
  const pane = useRef(null);
  const body = useRef(null);

  // A new lesson in the panel: its top, and the keyboard in the panel
  // unless it's already there (‹ › keep it on themselves; a new lesson's
  // name has it)
  useEffect(() => {
    if (body.current) body.current.scrollTop = 0;
    if (!pane.current?.contains(document.activeElement)) pane.current?.focus({ preventScroll: true });
  }, [lesson.id]);

  // Narrow screens: Escape closes, except while typing (the box handles
  // its own Escape) or with a pop-up open over the page
  const onKeyDown = (e) => {
    if (!closable || e.key !== 'Escape' || e.defaultPrevented) return;
    if (e.target.closest?.('input, textarea, select, [contenteditable="true"], dialog')) return;
    if (document.querySelector('dialog[open]')) return;
    e.preventDefault();
    onClose?.();
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
            <span className="cct__pane-section">{section.title}</span>
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
            <button
              type="button"
              className="cct__pane-btn cct__pane-btn--delete"
              aria-label={`Delete lesson: ${lesson.title}`}
              title="Delete lesson"
              onClick={onDelete}
            >
              <Trash2 size={18} aria-hidden="true" />
            </button>
            {closable && (
              <button type="button" className="cct__pane-btn" aria-label="Close lesson" title="Close (Esc)" onClick={onClose}>
                <X size={19} aria-hidden="true" />
              </button>
            )}
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
          autoFocus={selectTitle}
          onFocused={onTitleSelected}
        />
      </header>

      <div className="cct__pane-body" ref={body}>
        <LessonPanel key={lesson.id} course={course} lesson={lesson} onSaved={onSaved} onDirtyChange={onDirtyChange} />
      </div>

      <footer className="cct__pane-foot">
        <button type="button" className="crs-btn crs-btn--primary crs-btn--small" onClick={onAddNext}>
          <Plus size={16} aria-hidden="true" />
          Add next lesson
        </button>
      </footer>
    </aside>
  );
}