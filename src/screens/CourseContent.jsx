import { useState } from 'react';
import { Layers, Pencil, Plus, Trash2 } from 'lucide-react';
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
import LessonPanel from './LessonPanel';
import { KIND } from './lessonKinds';

// ------------------------------------------------------------
// A course's content, in the Content tab of its page (CoursePage.jsx):
// sections, each with its lessons, all on this one page. Laid out as
// TagMango's curriculum: each lesson a plain grey bar, "Lesson 1:" then
// its name, opening in place.
//
//   ┌────────────────────────────────────────────────────────────────┐
//   │ Section 1: Introduction ✎ 🗑                         2 lessons │
//   ├────────────────────────────────────────────────────────────────┤
//   │ ┌────────────────────────────────────────────────────────────┐ │
//   │ │ ▸ Lesson 1:  ¶ What is MCP?                          ✎ 🗑  │ │
//   │ └────────────────────────────────────────────────────────────┘ │
//   │ ┌────────────────────────────────────────────────────────────┐ │
//   │ │ ▾ Lesson 2:  How servers work          [+ Content]  ✎ 🗑  │ │
//   │ │   what goes in it, edited right here (LessonPanel.jsx)     │ │
//   │ └────────────────────────────────────────────────────────────┘ │
//   │ ┌────────────────────────────────────────────────────────────┐ │
//   │ │ ▸ Lesson 3  [Add a title…                              ]  │ │  a new one
//   │ │                                          [Cancel] [Save]  │ │
//   │ └────────────────────────────────────────────────────────────┘ │
//   │ + Add lesson                                                   │
//   └────────────────────────────────────────────────────────────────┘
//   [+ Add section]
//
// Sections: "Section 1:" then the name, with a pencil to rename it and a
// bin to delete it (asks first when it has lessons). A new section is
// "Untitled", its name selected, ready to type over. Students see only
// the name; the number is for the coach.
//
// Lessons: a click on a bar opens it in place (and closes the one that
// was open). Once it has something in it, a small icon before its name
// says what (KIND, lessonKinds.jsx). An empty one has "+ Content", which opens it. The
// pencil renames it in the bar; the bin deletes it (asks first).
// Add lesson adds a bar with a title box, as TagMango does: nothing is
// made until Save (Enter); Cancel (Escape) takes it away. Saved, it opens,
// ready for its content.
//
// No reordering for now (it comes later, as dragging).
//
// Unsaved text in an open lesson: opening another lesson, closing it, or
// adding one asks first, through guard().
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
  const [draftIn, setDraftIn] = useState(null); // the section with a new lesson's title box
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
  const openLesson = (id) => guard(() => setOpenId(id));

  // Save on a new lesson's bar: make it, and open it for its content
  const create = (section, title) => {
    const made = did(addLesson(course.id, section.id, title));
    if (!made) return false;
    setDraftIn(null);
    guard(() => setOpenId(made.lesson.id));
    return true;
  };

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

              <div className="cct__section-body">
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
                        onAddContent={() => openLesson(lesson.id)}
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

                {draftIn === section.id && (
                  <NewLesson
                    number={section.lessons.length + 1}
                    onSave={(title) => create(section, title)}
                    onCancel={() => setDraftIn(null)}
                  />
                )}

                {draftIn !== section.id && (
                  <button type="button" className="cct__add-lesson" onClick={() => setDraftIn(section.id)}>
                    <Plus size={17} aria-hidden="true" />
                    Add lesson
                    <span className="sr-only"> to {section.title}</span>
                  </button>
                )}
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

// One lesson's bar: ▸ "Lesson 1:" its icon (once it has content) and name;
// on the right, "+ Content" while it's empty, then ✎ and 🗑. A click
// anywhere on the bar but its buttons opens or closes it. While renaming,
// the name is a box (InlineTitle) in the bar.
// children: the open lesson's panel
function LessonRow({ number, lesson, open, renaming, onToggle, onAddContent, onRename, onRenamed, onRenameEnd, onDelete, children }) {
  const kind = lessonKind(lesson);
  const Icon = kind ? KIND[kind].icon : null;
  const panelId = `les-panel-${lesson.id}`;

  return (
    <li className={`cct__lesson ${open ? 'cct__lesson--open' : ''}`}>
      {/* The bar itself takes a click too, for the space around the words */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div className="cct__lesson-row" onClick={(e) => e.target === e.currentTarget && onToggle()}>
        <button
          type="button"
          className="cct__lesson-open"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          onClick={onToggle}
        >
          <span className="cct__caret" aria-hidden="true" />
          <span className="cct__lesson-num">Lesson {number}:</span>
          {Icon && (
            <Icon size={17} className="cct__lesson-kind" aria-label={KIND[kind].label} role="img" />
          )}
          {!renaming && <span className="cct__lesson-title">{lesson.title}</span>}
          {renaming && <span className="sr-only">{lesson.title}</span>}
        </button>

        {renaming && (
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
        )}

        <span className="cct__tools">
          {!kind && !open && (
            <button type="button" className="cct__content-btn" onClick={onAddContent}>
              <Plus size={16} aria-hidden="true" /> Content
              <span className="sr-only"> for {lesson.title}</span>
            </button>
          )}
          {!renaming && (
            <>
              <button type="button" className="ilt__tool" title="Rename" aria-label={`Rename ${lesson.title}`} onClick={onRename}>
                <Pencil size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="ilt__tool ilt__tool--delete"
                title="Delete lesson"
                aria-label={`Delete lesson: ${lesson.title}`}
                onClick={onDelete}
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </>
          )}
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

// Add lesson's bar, as on TagMango: "Lesson 3" and a title box, then
// Cancel and Save. Nothing is made until Save.
function NewLesson({ number, onSave, onCancel }) {
  const [title, setTitle] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (title.trim()) onSave(title);
  };

  return (
    <form className="cct__lesson cct__new" onSubmit={submit}>
      <div className="cct__new-row">
        <span className="cct__caret" aria-hidden="true" />
        <label className="cct__lesson-num" htmlFor="cct-new-title">
          Lesson {number}
        </label>
        <input
          id="cct-new-title"
          className="crs-input cct__new-input"
          value={title}
          maxLength={LESSON_TITLE_MAX}
          placeholder="Add a title…"
          autoComplete="off"
          autoFocus // eslint-disable-line jsx-a11y/no-autofocus
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              onCancel();
            }
          }}
        />
      </div>
      <div className="cct__new-actions">
        <button type="button" className="crs-btn crs-btn--quiet crs-btn--small" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="crs-btn crs-btn--primary crs-btn--small" disabled={!title.trim()}>
          Save
        </button>
      </div>
    </form>
  );
}