import { useEffect, useRef } from 'react';
import { Layers, Plus, Trash2, X } from 'lucide-react';
import { SECTION_TITLE_MAX } from '../data/courses';
import InlineTitle from '../components/InlineTitle';

// ------------------------------------------------------------
// A section, in the panel to the right of the curriculum
// (CourseContent.jsx), the same panel a lesson opens in. It opens when a
// section's name is clicked in the outline, or a section is added. This
// is the one place a section is renamed or deleted.
//
//   ┌──────────────────────────────────────────────────────────┐
//   │ SECTION 2                                             🗑 │
//   │ Building your server ✎                                    │
//   ├──────────────────────────────────────────────────────────┤
//   │ 3 lessons in this section                                 │
//   │ Students see its name above its lessons.                  │
//   │ [+ Add lesson]                                            │
//   └──────────────────────────────────────────────────────────┘
//
// A new section ("Untitled section") opens with its name selected, ready
// to type over (selectTitle). An empty name puts the old one back.
// 🗑 Delete section: asks first when it has lessons (CourseContent.jsx).
// + Add lesson: a new "Untitled lesson" at the end of this section,
// opened in the panel with its name selected.
// On narrow screens, where the panel covers the page, ✕ and Escape close it.
//
// section, number (its place in the course, from 1)
// onRename(title), onAddLesson(), onDelete()
// selectTitle, onTitleSelected(): select its name straight away
// closable, onClose(): narrow screens only
// ------------------------------------------------------------

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export default function SectionPane({ section, number, onRename, onAddLesson, onDelete, selectTitle = false, onTitleSelected, closable = false, onClose }) {
  const pane = useRef(null);
  const count = section.lessons.length;

  // A section opened: the keyboard in the panel (unless its name has it)
  useEffect(() => {
    if (!pane.current?.contains(document.activeElement)) pane.current?.focus({ preventScroll: true });
  }, [section.id]);

  const onKeyDown = (e) => {
    if (!closable || e.key !== 'Escape' || e.defaultPrevented) return;
    if (e.target.closest?.('input, textarea, select, [contenteditable="true"], dialog')) return;
    if (document.querySelector('dialog[open]')) return;
    e.preventDefault();
    onClose?.();
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <aside id="cct-pane" ref={pane} className="cct__pane" tabIndex={-1} aria-label={`Section ${number}: ${section.title}`} onKeyDown={onKeyDown}>
      <header className="cct__pane-head">
        <div className="cct__pane-top">
          <p className="cct__pane-where">
            <span className="cct__pane-num">Section {number}</span>
          </p>
          <div className="cct__pane-tools">
            <button
              type="button"
              className="cct__pane-btn cct__pane-btn--delete"
              aria-label={`Delete section: ${section.title}`}
              title="Delete section"
              onClick={onDelete}
            >
              <Trash2 size={18} aria-hidden="true" />
            </button>
            {closable && (
              <button type="button" className="cct__pane-btn" aria-label="Close section" title="Close (Esc)" onClick={onClose}>
                <X size={19} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
        <InlineTitle
          key={section.id}
          id={`pane-section-${section.id}`}
          label="Section name"
          variant="pane"
          value={section.title}
          maxLength={SECTION_TITLE_MAX}
          onSave={onRename}
          autoFocus={selectTitle}
          onFocused={onTitleSelected}
        />
      </header>

      <div className="cct__pane-body">
        <div className="cct__sec-view">
          <span className="cct__sec-icon" aria-hidden="true">
            <Layers size={22} />
          </span>
          <p className="cct__sec-count">{count > 0 ? `${plural(count, 'lesson')} in this section` : 'No lessons yet'}</p>
          <p className="cct__sec-help">
            {count > 0
              ? 'Students see this name above its lessons. Click a lesson on the left to work on it.'
              : 'Add the first lesson, then pick what goes in it: a video, a PDF or text.'}
          </p>
          <button type="button" className="crs-btn crs-btn--primary crs-btn--small" onClick={onAddLesson}>
            <Plus size={16} aria-hidden="true" />
            Add lesson
          </button>
        </div>
      </div>
    </aside>
  );
}