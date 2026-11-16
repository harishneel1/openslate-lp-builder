import { Fragment, useEffect, useState } from 'react';
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
import LessonPane from './LessonPane';

// ------------------------------------------------------------
// A course's Curriculum step (CoursePage.jsx): sections and their lessons
// on the left, and the lesson being worked on in a panel on the right.
//
// Nothing open: the outline has the full width. Each lesson is one bar,
// as TagMango's curriculum: "Lesson 1:" and its name, words only (no
// icon for what's in it: the outline is kept plain on purpose).
//
//   ┌────────────────────────────────────────────────────────────────┐
//   │ Section 1: Introduction ✎ 🗑                       2 lessons ⋮⋮ │
//   ├────────────────────────────────────────────────────────────────┤
//   │ │ Lesson 1:  What is MCP?                            ✎ 🗑 ⋮⋮ │ │
//   │ │ Lesson 2:  How servers work          [+ Content]   ✎ 🗑 ⋮⋮ │ │
//   │ + Add lesson                                                   │
//   └────────────────────────────────────────────────────────────────┘
//   [+ Add section]
//
// A lesson clicked: the lesson opens on the right (LessonPane.jsx), as
// wide as its content needs (780px at most, its content's reading width
// plus padding; down to 520px on smaller screens), and the outline keeps
// the rest (360px at least): a split view inside the step's card, one
// line between them, each column scrolling on its own (the Curriculum step is a workspace that fits the
// screen: CoursePage.css, .ced--workspace; CoursesPage.css). Only one
// lesson is ever open: clicking another swaps it. The open one's bar is
// lit orange. The page widens to make room (CoursePage.jsx, onPaneChange).
// On short screens, where the step scrolls as a page, the two sit side by
// side in a grid sized the same way, the lesson sticky as the outline scrolls.
//
//   ┌ outline ──────────────────┐ ┌ Section 1: Introduction · Lesson 2  ‹ › ✕ ┐
//   │ Section 1: Introduction   │ │ How servers work ✎                         │
//   │ │ Lesson 1: What is MCP?  │ │──────────────────────────────────────────│
//   │ ▌Lesson 2: How servers…   │ │ what goes in it (LessonPanel.jsx), its    │
//   │ + Add lesson              │ │ description and resources                 │
//   └───────────────────────────┘ └──────────────────────────────────────────┘
//
// The outline keeps working while the panel's open: rename, delete, drag
// to reorder, add lessons and sections. Narrower now, it gives lesson
// names the room: a bar's ✎ 🗑 ⋮⋮ show on hover, or with the keyboard in
// the bar; an empty lesson says "Empty" in place of
// + Content; sections drop their lesson count. Deleting the open lesson (or its
// section) closes the panel; moving it keeps it open.
// Closing: ✕ or Escape in the panel; focus goes back to its bar.
// Narrow screens (under 960px): no room for both, so the panel covers
// the screen from the right, over a dimmed page; a click on the dim closes it.
//
// Sections: "Section 1:" then the name, with a pencil to rename it and a
// bin to delete it (asks first when it has lessons). A new section is
// "Untitled", its name selected, ready to type over. Students see only
// the name; the number is for the coach.
//
// Lessons: an empty one has "+ Content", which opens it. The pencil
// renames it in the bar (the panel's title renames it too); the bin
// deletes it (asks first).
// Add lesson adds a bar with a title box, as TagMango does: nothing is
// made until Save (Enter); Cancel (Escape) takes it away. Saved, it's a
// bar like the others: the panel opens only when it's clicked (or its
// + Content). The panel opens on a click, never by itself.
//
// Reordering: ⋮⋮ at the end of a lesson's bar or a section's head, as
// TagMango has it. Drag a lesson up or down, or into another section
// (an empty one too); drag a section above or below another. An orange
// line shows where it will land. With the keyboard: focus ⋮⋮ and press
// ↑ or ↓ to move one place (a lesson at the top or bottom of its section
// moves into the one next to it); where it went is read out.
// Dragging needs a mouse or trackpad; on a touch screen, ⋮⋮ doesn't drag.
//
// + Add lesson and + Add section close the open lesson first: the new
// one's title is typed in the full-width outline, and it stays a bar until
// clicked. The panel's own + Add next lesson does the same, with the title
// box right under the lesson that was open. Renaming, dragging or deleting another lesson leaves it open.
//
// Unsaved text in the open lesson: opening another lesson, closing the
// panel, or adding a lesson or section asks first, through guard().
//
// course: the course (with its sections)
// onSaved(ok): after each change, so the page can say "Saved" or that it failed
// guard(fn): runs fn, or first asks "Leave without saving?" when the open
//   lesson has unsaved changes (CoursePage.jsx keeps that question)
// onDirtyChange(dirty): the open lesson has (or no longer has) unsaved changes
// onPaneChange(open): the lesson panel opened or closed, so the page can widen
// onDraftChange(open): a new lesson's title box opened or closed
// ------------------------------------------------------------

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Where focus goes back to when the panel closes: the lesson's bar
const focusBar = (lessonId) => requestAnimationFrame(() => document.getElementById(`les-open-${lessonId}`)?.focus());

export default function CourseContent({ course, onSaved, guard, onDirtyChange, onPaneChange, onDraftChange }) {
  const sections = sectionsOf(course);
  const [openId, setOpenId] = useState(null); // the lesson in the panel
  const [renamingId, setRenamingId] = useState(null); // the lesson whose name is being changed in its bar
  const [draftIn, setDraftIn] = useState(null); // the section with a new lesson's title box
  const [draftAfter, setDraftAfter] = useState(null); // the lesson it goes after (Add next lesson), or null: the section's end
  const [focusSection, setFocusSection] = useState(null); // a new section, to rename straight away
  const [deletingSection, setDeletingSection] = useState(null);
  const [deletingLesson, setDeletingLesson] = useState(null);

  // Every lesson in order, with where it sits: for the panel's heading and ‹ ›
  const all = sections.flatMap((section, si) =>
    section.lessons.map((lesson, j) => ({ lesson, section, sectionNumber: si + 1, number: j + 1 })),
  );
  const at = all.findIndex((x) => x.lesson.id === openId);
  const open = at === -1 ? null : all[at];

  // The open lesson is gone (deleted here or in another tab): the panel closes
  useEffect(() => {
    if (openId && !open) {
      setOpenId(null);
      onDirtyChange(false);
    }
  }, [openId, open]); // eslint-disable-line react-hooks/exhaustive-deps

  // The page widens while the panel's open, and goes back when this step closes
  useEffect(() => onPaneChange?.(Boolean(openId)), [openId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onPaneChange?.(false), []); // eslint-disable-line react-hooks/exhaustive-deps

  // A new lesson's title box is open (the page quiets its Continue meanwhile)
  useEffect(() => onDraftChange?.(Boolean(draftIn)), [draftIn]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onDraftChange?.(false), []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Adding a lesson or a section closes the open lesson first (asking
  // first if it has unsaved changes), so the outline has the full width
  // for what's being added
  const closeThen = (fn) =>
    openId
      ? guard(() => {
          setOpenId(null);
          fn();
        })
      : fn();

  const add = () =>
    closeThen(() => {
      const made = did(addSection(course.id));
      if (made) setFocusSection(made.section.id);
    });

  // A bar clicked (or ‹ › in the panel): that lesson in the panel
  const openLesson = (id) => id !== openId && guard(() => setOpenId(id));

  const closePane = () =>
    guard(() => {
      const id = openId;
      setOpenId(null);
      if (id) focusBar(id);
    });

  // Save on a new lesson's bar: make it (at the section's end, then moved
  // up to sit right after the lesson it was added from, for Add next
  // lesson). It stays a bar (the panel opens only when it's clicked), with
  // the keyboard on it.
  const create = (section, title) => {
    const made = did(addLesson(course.id, section.id, title));
    if (!made) return false;
    if (draftAfter) {
      const at = section.lessons.findIndex((l) => l.id === draftAfter);
      const nextId = at === -1 ? null : section.lessons[at + 1]?.id;
      if (nextId) did(moveLessonBefore(course.id, made.lesson.id, section.id, nextId));
    }
    endDraft();
    focusBar(made.lesson.id);
    return true;
  };

  const startDraft = (sectionId, afterId = null) => {
    setDraftIn(sectionId);
    setDraftAfter(afterId);
  };
  const endDraft = () => {
    setDraftIn(null);
    setDraftAfter(null);
  };

  // The panel's + Add next lesson: it closes, and a new lesson's title box
  // opens right under the one that was open, in the same section
  const addNext = () => {
    if (!open) return;
    const { lesson, section } = open;
    const last = section.lessons[section.lessons.length - 1]?.id === lesson.id;
    closeThen(() => startDraft(section.id, last ? null : lesson.id));
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
  // end). A move that changes nothing does nothing. The open lesson stays
  // open in the panel wherever it goes, so nothing unsaved is lost.
  const moveLesson = (lessonId, sectionId, beforeId) => {
    const from = placeOf(lessonId);
    if (!from) return false;
    const next = from.section.lessons[from.index + 1]?.id ?? null;
    if (from.section.id === sectionId && (beforeId === lessonId || beforeId === next)) return false;
    did(moveLessonBefore(course.id, lessonId, sectionId, beforeId));
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
    <div className={['cct', drag && 'cct--dragging', open && 'cct--split'].filter(Boolean).join(' ')}>
      {/* ---------- The outline: sections and their lessons ---------- */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div className="cct__outline" onDrop={onDrop} onDragOver={(e) => drag && drop && e.preventDefault()}>
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
              // Add next lesson's title box sits after this lesson: the ones under it count on by one
              const draftAt = draftIn === section.id && draftAfter ? section.lessons.findIndex((l) => l.id === draftAfter) : -1;
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
                          <Fragment key={lesson.id}>
                            <LessonRow
                              number={j + 1 + (draftAt !== -1 && j > draftAt ? 1 : 0)}
                              lesson={lesson}
                              selected={openId === lesson.id}
                              renaming={renamingId === lesson.id}
                              dragging={drag?.type === 'lesson' && drag.id === lesson.id}
                              dropBefore={lessonDrop?.beforeId === lesson.id}
                              dragProps={dragProps('lesson', lesson.id)}
                              onDragOver={(e) => overLesson(e, section, j)}
                              grip={grip('lesson', lesson.id, `lesson ${j + 1}, ${lesson.title}`, (e) => keyLesson(e, lesson.id))}
                              onSelect={() => openLesson(lesson.id)}
                              onRename={() => setRenamingId(lesson.id)}
                              onRenamed={(title) => did(updateLesson(course.id, lesson.id, { title }))}
                              onRenameEnd={() => setRenamingId(null)}
                              onDelete={() => setDeletingLesson(lesson)}
                            />
                            {/* Add next lesson: its title box right under the lesson it came from */}
                            {draftIn === section.id && draftAfter === lesson.id && (
                              <li className="cct__draft">
                                <NewLesson number={j + 2} onSave={(title) => create(section, title)} onCancel={endDraft} />
                              </li>
                            )}
                          </Fragment>
                        ))}
                      </ol>
                    )}

                    {/* A lesson dropped at the end of this section lands here */}
                    {lessonDrop && lessonDrop.beforeId === null && (
                      <div className={`cct__drop-end ${section.lessons.length === 0 ? 'cct__drop-end--empty' : ''}`} aria-hidden="true">
                        {section.lessons.length === 0 && 'Drop here'}
                      </div>
                    )}

                    {draftIn === section.id && !draftAfter && (
                      <NewLesson
                        number={section.lessons.length + 1}
                        onSave={(title) => create(section, title)}
                        onCancel={endDraft}
                      />
                    )}

                    {draftIn !== section.id && (
                      <button type="button" className="cct__add-lesson" onClick={() => closeThen(() => startDraft(section.id))}>
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
      </div>

      {/* ---------- The open lesson, in its panel ---------- */}
      {open && (
        <>
          {/* Narrow screens only: the dimmed page behind the panel */}
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
          <div className="cct__scrim" aria-hidden="true" onClick={closePane} />
          <LessonPane
            course={course}
            entry={open}
            prev={all[at - 1] ?? null}
            next={all[at + 1] ?? null}
            onGo={openLesson}
            onClose={closePane}
            onAddNext={addNext}
            onRename={(title) => did(updateLesson(course.id, open.lesson.id, { title }))}
            onSaved={onSaved}
            onDirtyChange={onDirtyChange}
          />
        </>
      )}

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

// One lesson's bar: "Lesson 1:" and its name (no kind icon, on purpose);
// on the right, "+ Content" while it's empty, then ✎, 🗑 and ⋮⋮. A click
// anywhere on the bar but its buttons opens it in the panel; the one in
// the panel is lit. While renaming, the name is a box (InlineTitle) in the bar.
// dragging: it's being dragged; dropBefore: a dragged lesson would land
// just above it; dragProps, onDragOver, grip: from the list (see above)
function LessonRow({
  number,
  lesson,
  selected,
  renaming,
  dragging,
  dropBefore,
  dragProps,
  onDragOver,
  grip,
  onSelect,
  onRename,
  onRenamed,
  onRenameEnd,
  onDelete,
}) {
  const kind = lessonKind(lesson);

  return (
    <li
      className={['cct__lesson', selected && 'cct__lesson--on', dragging && 'cct__lesson--dragging', dropBefore && 'cct__lesson--drop-before']
        .filter(Boolean)
        .join(' ')}
      onDragOver={onDragOver}
      {...dragProps}
    >
      {/* The bar itself takes a click too, for the space around the words */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div className="cct__lesson-row" onClick={(e) => e.target === e.currentTarget && onSelect()}>
        <button
          type="button"
          id={`les-open-${lesson.id}`}
          className="cct__lesson-open"
          aria-expanded={selected}
          aria-controls={selected ? 'cct-pane' : undefined}
          onClick={onSelect}
        >
          <span className="cct__lesson-num">Lesson {number}:</span>
          {!renaming && <span className="cct__lesson-title">{lesson.title}</span>}
          {renaming && <span className="sr-only">{lesson.title}</span>}
          {/* With the panel open, + Content steps aside: this says it's empty instead */}
          {!kind && !renaming && <span className="cct__lesson-empty">Empty</span>}
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
          {!kind && !selected && (
            <button type="button" className="cct__content-btn" onClick={onSelect}>
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