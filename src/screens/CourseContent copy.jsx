import { useState } from 'react';
import { ChevronRight, Layers, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  LESSON_TITLE_MAX,
  SECTION_TITLE_MAX,
  addLesson,
  addSection,
  deleteLesson,
  deleteSection,
  lessonKind,
  renameSection,
  sectionsOf,
  updateLesson,
} from '../data/courses';
import ConfirmDialog from '../components/ConfirmDialog';
import InlineTitle from '../components/InlineTitle';
import LessonPanel, { KIND, KindTile } from './LessonPanel';

// ------------------------------------------------------------
// A course's content, in the Content tab of its page (CoursePage.jsx):
// sections, each with its lessons, all on this one page, as on TagMango.
// Boxy, like Cloud Storage: each section a white panel with a grey head,
// its lessons full-width rows split by thin lines.
//
//   Sections and their lessons, in the order…           [+ Add section]
//   ┌────────────────────────────────────────────────────────────────┐
//   │ Section 1: Introduction ✎ 🗑                        3 lessons │
//   ├────────────────────────────────────────────────────────────────┤
//   │ ›  [¶] 1. What is MCP? ✎ 🗑                             Text  │
//   │ ⌄  [ ] 2. Untitled lesson ✎ 🗑                Nothing added yet │
//   │      the lesson's content, edited right here (LessonPanel.jsx)  │
//   ├────────────────────────────────────────────────────────────────┤
//   │ [+ Add lesson]                                                  │
//   └────────────────────────────────────────────────────────────────┘
//   [+ Add section]
//
// Sections: "Section 1:" then the name, with a pencil to rename it (saved
// on leaving it or Enter) and a bin to delete it (asks first when it has
// lessons, saying how many go with it). A new section ("Section 2", or
// the next free number) goes at the end with its name selected.
// Students see only the name; the number is for the coach.
//
// Lessons: a click on a row (anywhere but its buttons) opens it in place,
// and closes the one that was open: one at a time. Its tile says what it
// has (KindTile; grey while empty). The pencil renames it in the row; the
// bin deletes it (asks first).
// Add lesson makes "Untitled lesson", opens it, and selects its name,
// ready to type over; the panel under it asks what goes in it.
//
// No reordering for now (it comes later, as dragging).
//
// Unsaved text in an open lesson: opening another lesson, closing it,
// adding a lesson, or deleting its section asks first, through guard().
//
// course: the course (with its sections)
// onSaved(ok): after each change, so the page can say "Saved" or that it failed
// guard(fn): runs fn, or first asks "Leave without saving?" when an open
//   lesson has unsaved changes (CoursePage.jsx keeps that question)
// onDirtyChange(dirty): the open lesson has (or no longer has) unsaved changes
// ------------------------------------------------------------

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export default function CourseContent({ course, onSaved, guard, onDirtyChange }) {
  const sections = sectionsOf(course);
  const [openId, setOpenId] = useState(null); // the lesson open in place
  const [renamingId, setRenamingId] = useState(null); // the lesson whose name is being changed
  const [focusSection, setFocusSection] = useState(null); // a new section, to rename straight away
  const [deletingSection, setDeletingSection] = useState(null);
  const [deletingLesson, setDeletingLesson] = useState(null);

  const did = (result) => {
    onSaved(Boolean(result));
    return result;
  };

  const add = () => {
    const made = did(addSection(course.id));
    if (made) setFocusSection(made.section.id);
  };

  const toggle = (id) => guard(() => setOpenId((open) => (open === id ? null : id)));

  const addTo = (section) =>
    guard(() => {
      const made = did(addLesson(course.id, section.id));
      if (!made) return;
      setOpenId(made.lesson.id);
      setRenamingId(made.lesson.id);
    });

  const askDeleteSection = (section) => {
    if (section.lessons.length === 0) did(deleteSection(course.id, section.id));
    else setDeletingSection(section);
  };

  return (
    <div className="cct">
      <div className="cpg__bar">
        <p className="cpg__bar-text">Sections and their lessons, in the order students see them.</p>
        <button type="button" className="crs-btn crs-btn--quiet crs-btn--small" onClick={add}>
          <Plus size={16} aria-hidden="true" />
          Add section
        </button>
      </div>

      {sections.length === 0 ? (
        <div className="cct__none">
          <Layers size={22} aria-hidden="true" />
          <p className="cct__none-title">No sections yet</p>
          <p className="cct__none-text">Add a section, then add lessons to it.</p>
        </div>
      ) : (
        <ol className="cct__sections">
          {sections.map((section, i) => (
            <li key={section.id} className="cct__section">
              <div className="cct__section-head">
                <span className="cct__section-label" aria-hidden="true">
                  Section {i + 1}:
                </span>
                <InlineTitle
                  id={`sec-${section.id}`}
                  label={`Section ${i + 1} name`}
                  variant="section"
                  value={section.title}
                  maxLength={SECTION_TITLE_MAX}
                  onSave={(title) => did(renameSection(course.id, section.id, title))}
                  autoFocus={focusSection === section.id}
                  onFocused={() => setFocusSection(null)}
                  onDelete={() => askDeleteSection(section)}
                  deleteLabel="Delete section"
                />
                {section.lessons.length > 0 && (
                  <span className="cct__count">{plural(section.lessons.length, 'lesson')}</span>
                )}
              </div>

              {section.lessons.length > 0 && (
                <ol className="cct__lessons">
                  {section.lessons.map((lesson, j) => (
                    <LessonRow
                      key={lesson.id}
                      number={j + 1}
                      lesson={lesson}
                      open={openId === lesson.id}
                      renaming={renamingId === lesson.id}
                      onToggle={() => toggle(lesson.id)}
                      onRename={() => setRenamingId(lesson.id)}
                      onRenamed={(title) => did(updateLesson(course.id, lesson.id, { title }))}
                      onRenameEnd={() => setRenamingId(null)}
                      onDelete={() => setDeletingLesson(lesson)}
                    >
                      <LessonPanel course={course} lesson={lesson} onSaved={onSaved} onDirtyChange={onDirtyChange} />
                    </LessonRow>
                  ))}
                </ol>
              )}

              <div className="cct__section-foot">
                {section.lessons.length === 0 && <span className="cct__foot-note">No lessons yet.</span>}
                <button type="button" className="crs-btn crs-btn--quiet crs-btn--small" onClick={() => addTo(section)}>
                  <Plus size={16} aria-hidden="true" />
                  Add lesson
                  <span className="sr-only"> to {section.title}</span>
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <button type="button" className="crs-btn crs-btn--quiet cct__add-section" onClick={add}>
        <Plus size={18} aria-hidden="true" />
        {sections.length === 0 ? 'Add your first section' : 'Add section'}
      </button>

      {deletingSection && (
        <ConfirmDialog
          title="Delete this section?"
          confirmLabel="Delete section"
          danger
          onCancel={() => setDeletingSection(null)}
          onConfirm={() => {
            const section = deletingSection;
            setDeletingSection(null);
            if (section.lessons.some((l) => l.id === openId)) {
              setOpenId(null);
              onDirtyChange(false);
            }
            did(deleteSection(course.id, section.id));
          }}
        >
          <p>
            <strong>{deletingSection.title}</strong> and its {plural(deletingSection.lessons.length, 'lesson')} will be
            deleted. This can’t be undone.
          </p>
        </ConfirmDialog>
      )}

      {deletingLesson && (
        <ConfirmDialog
          title="Delete this lesson?"
          confirmLabel="Delete lesson"
          danger
          onCancel={() => setDeletingLesson(null)}
          onConfirm={() => {
            const lesson = deletingLesson;
            setDeletingLesson(null);
            if (lesson.id === openId) {
              setOpenId(null);
              onDirtyChange(false);
            }
            did(deleteLesson(course.id, lesson.id));
          }}
        >
          <p>
            <strong>{deletingLesson.title}</strong> and what’s in it will be deleted. This can’t be undone.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}

// One lesson's row: › or ⌄, its tile, number and name, then the pencil
// and bin, and what it has on the right. A click anywhere on the row but
// its buttons opens or closes it; the name's button does the same for the
// keyboard. While renaming, the name is a box (InlineTitle) in the row.
// children: the open lesson's panel
function LessonRow({ number, lesson, open, renaming, onToggle, onRename, onRenamed, onRenameEnd, onDelete, children }) {
  const kind = lessonKind(lesson);
  const panelId = `les-panel-${lesson.id}`;

  return (
    <li className={`cct__lesson ${open ? 'cct__lesson--open' : ''}`}>
      {/* The row itself takes a click too, for the space around the words */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div className="cct__lesson-row" onClick={(e) => e.target === e.currentTarget && onToggle()}>
        <button
          type="button"
          className="cct__lesson-open"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          onClick={onToggle}
        >
          <ChevronRight size={18} className="cct__chev" aria-hidden="true" />
          <KindTile kind={kind} />
          <span className="cct__lesson-num">{number}.</span>
          {!renaming && <span className="cct__lesson-title">{lesson.title}</span>}
          {renaming && <span className="sr-only">{lesson.title}</span>}
        </button>

        {renaming ? (
          <InlineTitle
            id={`les-name-${lesson.id}`}
            label="Lesson name"
            variant="lesson"
            value={lesson.title}
            maxLength={LESSON_TITLE_MAX}
            onSave={onRenamed}
            autoFocus
            onEditEnd={onRenameEnd}
          />
        ) : (
          <span className="cct__tools">
            <button type="button" className="ilt__tool" title="Rename" aria-label={`Rename ${lesson.title}`} onClick={onRename}>
              <Pencil size={15} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="ilt__tool ilt__tool--delete"
              title="Delete lesson"
              aria-label={`Delete lesson: ${lesson.title}`}
              onClick={onDelete}
            >
              <Trash2 size={15} aria-hidden="true" />
            </button>
          </span>
        )}

        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
        <span className={`cct__lesson-has ${kind ? '' : 'cct__lesson-has--empty'}`} onClick={onToggle}>
          {kind ? KIND[kind].label : 'Nothing added yet'}
        </span>
      </div>

      {open && (
        <div className="cct__lesson-panel" id={panelId}>
          {children}
        </div>
      )}
    </li>
  );
}
