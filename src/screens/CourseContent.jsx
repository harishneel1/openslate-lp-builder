import { useEffect, useState } from 'react';
import { GripVertical, Layers, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  LESSON_TITLE_MAX,
  SECTION_TITLE_MAX,
  addLesson,
  addSection,
  deleteLesson,
  deleteSection,
  lessonKind,
  moveLessonBefore,
  moveSectionBefore,
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
//   │ Section 1: Introduction ✎ 🗑                       2 lessons ⋮⋮ │
//   ├────────────────────────────────────────────────────────────────┤
//   │ ┌────────────────────────────────────────────────────────────┐ │
//   │ │ ▸ Lesson 1:  ¶ What is MCP?                         ✎ 🗑 ⋮⋮ │ │
//   │ └────────────────────────────────────────────────────────────┘ │
//   │ ┌────────────────────────────────────────────────────────────┐ │
//   │ │ ▾ Lesson 2:  How servers work         [+ Content]  ✎ 🗑 ⋮⋮ │ │
//   │ │   what goes in it, edited right here (LessonPanel.jsx)     │ │
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
// says what (KIND, lessonKinds.jsx). An empty one has "+ Content", which
// opens it. The pencil renames it in the bar; the bin deletes it (asks
// first).
// Add lesson adds a bar with a title box, as TagMango does: nothing is
// made until Save (Enter); Cancel (Escape) takes it away. Saved, it opens,
// ready for its content.
//
// Reordering: ⋮⋮ at the end of a lesson's bar or a section's head, as
// TagMango has it. Drag a lesson up or down, or into another section
// (an empty one too); drag a section above or below another. An orange
// line shows where it will land. With the keyboard: focus ⋮⋮ and press
// ↑ or ↓ to move one place (a lesson at the top or bottom of its section
// moves into the one next to it); where it went is read out.
// Dragging needs a mouse or trackpad; on a touch screen, ⋮⋮ doesn't drag.
//
// Unsaved text in an open lesson: opening another lesson, closing it,
// adding one, or moving it to another section asks first, through guard().
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

  // ---------- Dragging ----------
  const [armed, setArmed] = useState(null); // { type, id }: ⋮⋮ is pressed, so its item may be dragged
  const [drag, setDrag] = useState(null); // { type: 'lesson' | 'section', id }: being dragged
  const [drop, setDrop] = useState(null); // where it would land: { sectionId, beforeId } | { beforeId }
  const [said, setSaid] = useState(''); // read out after a move with the keyboard

  // Letting go of ⋮⋮ without dragging: nothing is armed any more
  useEffect(() => {
    if (!armed) return undefined;
    const off = () => setArmed(null);
    window.addEventListener('pointerup', off);
    return () => window.removeEventListener('pointerup', off);
  }, [armed]);

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

  // Where a lesson sits: its section and place
  const placeOf = (lessonId) => {
    for (const s of sections) {
      const i = s.lessons.findIndex((l) => l.id === lessonId);
      if (i !== -1) return { section: s, index: i };
    }
    return null;
  };

  // Moves a lesson into a section, before another lesson there (or to its
  // end). A move that changes nothing does nothing. The open lesson moving
  // to another section is shown afresh there, so unsaved text asks first.
  const moveLesson = (lessonId, sectionId, beforeId) => {
    const from = placeOf(lessonId);
    if (!from) return false;
    const next = from.section.lessons[from.index + 1]?.id ?? null;
    if (from.section.id === sectionId && (beforeId === lessonId || beforeId === next)) return false;
    const go = () => did(moveLessonBefore(course.id, lessonId, sectionId, beforeId));
    if (lessonId === openId && from.section.id !== sectionId) guard(go);
    else go();
    return true;
  };

  const moveSection = (sectionId, beforeId) => {
    const i = sections.findIndex((s) => s.id === sectionId);
    const next = sections[i + 1]?.id ?? null;
    if (beforeId === sectionId || beforeId === next) return false;
    did(moveSectionBefore(course.id, sectionId, beforeId));
    return true;
  };

  const endDrag = () => {
    setDrag(null);
    setDrop(null);
    setArmed(null);
  };

  const onDrop = (e) => {
    if (!drag || !drop) return;
    e.preventDefault();
    if (drag.type === 'lesson') moveLesson(drag.id, drop.sectionId, drop.beforeId);
    else moveSection(drag.id, drop.beforeId);
    endDrag();
  };

  // Over a lesson's bar: before it (top half) or after it (bottom half)
  const overLesson = (e, section, j) => {
    if (drag?.type !== 'lesson') return;
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const before = e.clientY < rect.top + rect.height / 2;
    const beforeId = before ? section.lessons[j].id : section.lessons[j + 1]?.id ?? null;
    setDrop({ sectionId: section.id, beforeId });
  };

  // Over a section's body, but not over a lesson: its end
  const overSectionBody = (e, section) => {
    if (drag?.type !== 'lesson') return;
    e.preventDefault();
    e.stopPropagation();
    setDrop({ sectionId: section.id, beforeId: null });
  };

  // Dragging a section, over another: before it (top half) or after it
  const overSection = (e, i) => {
    if (drag?.type !== 'section') return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const before = e.clientY < rect.top + rect.height / 2;
    setDrop({ beforeId: before ? sections[i].id : sections[i + 1]?.id ?? null });
  };

  // ---------- With the keyboard: ⋮⋮ and ↑ / ↓ ----------
  const refocus = (id) => requestAnimationFrame(() => document.getElementById(`grip-${id}`)?.focus());

  const keyLesson = (e, lessonId) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const { section, index } = placeOf(lessonId);
    const si = sections.indexOf(section);
    let to = null; // { sectionId, beforeId, s: its section's index, n: its place there }
    if (e.key === 'ArrowUp') {
      if (index > 0) to = { sectionId: section.id, beforeId: section.lessons[index - 1].id, s: si, n: index };
      else if (si > 0) to = { sectionId: sections[si - 1].id, beforeId: null, s: si - 1, n: sections[si - 1].lessons.length + 1 };
    } else if (index < section.lessons.length - 1) {
      to = { sectionId: section.id, beforeId: section.lessons[index + 2]?.id ?? null, s: si, n: index + 2 };
    } else if (si < sections.length - 1) {
      to = { sectionId: sections[si + 1].id, beforeId: sections[si + 1].lessons[0]?.id ?? null, s: si + 1, n: 1 };
    }
    if (!to) return;
    if (moveLesson(lessonId, to.sectionId, to.beforeId)) {
      setSaid(`Moved to section ${to.s + 1}, ${sections[to.s].title}, as lesson ${to.n}.`);
      refocus(lessonId);
    }
  };

  const keySection = (e, sectionId) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const i = sections.findIndex((s) => s.id === sectionId);
    const up = e.key === 'ArrowUp';
    if ((up && i === 0) || (!up && i === sections.length - 1)) return;
    const beforeId = up ? sections[i - 1].id : sections[i + 2]?.id ?? null;
    if (moveSection(sectionId, beforeId)) {
      setSaid(`Moved to section ${up ? i : i + 2} of ${sections.length}.`);
      refocus(sectionId);
    }
  };

  // ⋮⋮: press to drag, or focus and use ↑ ↓
  const grip = (type, id, label, onKey) => (
    <button
      type="button"
      id={`grip-${id}`}
      className="cct__grip"
      title="Drag to move"
      aria-label={`Move ${label}. Use the up and down arrows.`}
      onPointerDown={() => setArmed({ type, id })}
      onKeyDown={onKey}
    >
      <GripVertical size={18} aria-hidden="true" />
    </button>
  );

  // What a draggable item needs: draggable only while its ⋮⋮ is pressed
  const dragProps = (type, id) => ({
    draggable: armed?.type === type && armed.id === id,
    onDragStart: (e) => {
      if (!(armed?.type === type && armed.id === id)) {
        e.preventDefault();
        return;
      }
      e.stopPropagation();
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', id);
      setDrag({ type, id });
    },
    onDragEnd: endDrag,
  });

  const sectionDropLine = drag?.type === 'section' && drop;

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div className={`cct ${drag ? 'cct--dragging' : ''}`} onDrop={onDrop} onDragOver={(e) => drag && drop && e.preventDefault()}>
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
          {sections.map((section, i) => {
            const lessonDrop = drag?.type === 'lesson' && drop?.sectionId === section.id ? drop : null;
            return (
              <li
                key={section.id}
                className={[
                  'cct__section',
                  drag?.type === 'section' && drag.id === section.id && 'cct__section--dragging',
                  sectionDropLine && drop.beforeId === section.id && 'cct__section--drop-before',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onDragOver={(e) => overSection(e, i)}
                {...dragProps('section', section.id)}
              >
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
                  {sections.length > 1 && grip('section', section.id, `section ${i + 1}, ${section.title}`, (e) => keySection(e, section.id))}
                </div>

                {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
                <div className="cct__section-body" onDragOver={(e) => overSectionBody(e, section)}>
                  {section.lessons.length > 0 && (
                    <ol className="cct__lessons">
                      {section.lessons.map((lesson, j) => (
                        <LessonRow
                          key={lesson.id}
                          number={j + 1}
                          lesson={lesson}
                          open={openId === lesson.id}
                          renaming={renamingId === lesson.id}
                          dragging={drag?.type === 'lesson' && drag.id === lesson.id}
                          dropBefore={lessonDrop?.beforeId === lesson.id}
                          dragProps={dragProps('lesson', lesson.id)}
                          onDragOver={(e) => overLesson(e, section, j)}
                          grip={grip('lesson', lesson.id, `lesson ${j + 1}, ${lesson.title}`, (e) => keyLesson(e, lesson.id))}
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

                  {/* A lesson dropped at the end of this section lands here */}
                  {lessonDrop && lessonDrop.beforeId === null && (
                    <div className={`cct__drop-end ${section.lessons.length === 0 ? 'cct__drop-end--empty' : ''}`} aria-hidden="true">
                      {section.lessons.length === 0 && 'Drop here'}
                    </div>
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
            );
          })}
          {sectionDropLine && drop.beforeId === null && <li className="cct__section-drop-end" aria-hidden="true" />}
        </ol>
      )}

      <button type="button" className="crs-btn crs-btn--quiet cct__add-section" onClick={add}>
        <Plus size={18} aria-hidden="true" />
        {sections.length === 0 ? 'Add your first section' : 'Add section'}
      </button>

      <p className="sr-only" aria-live="polite">
        {said}
      </p>

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
// on the right, "+ Content" while it's empty, then ✎, 🗑 and ⋮⋮. A click
// anywhere on the bar but its buttons opens or closes it. While renaming,
// the name is a box (InlineTitle) in the bar.
// dragging: it's being dragged; dropBefore: a dragged lesson would land
// just above it; dragProps, onDragOver, grip: from the list (see above)
// children: the open lesson's panel
function LessonRow({
  number,
  lesson,
  open,
  renaming,
  dragging,
  dropBefore,
  dragProps,
  onDragOver,
  grip,
  onToggle,
  onAddContent,
  onRename,
  onRenamed,
  onRenameEnd,
  onDelete,
  children,
}) {
  const kind = lessonKind(lesson);
  const Icon = kind ? KIND[kind].icon : null;
  const panelId = `les-panel-${lesson.id}`;

  return (
    <li
      className={['cct__lesson', open && 'cct__lesson--open', dragging && 'cct__lesson--dragging', dropBefore && 'cct__lesson--drop-before']
        .filter(Boolean)
        .join(' ')}
      onDragOver={onDragOver}
      {...dragProps}
    >
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
          {Icon && <Icon size={17} className="cct__lesson-kind" aria-label={KIND[kind].label} role="img" />}
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
          {grip}
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