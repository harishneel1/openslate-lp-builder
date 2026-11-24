import { Fragment, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, GripVertical, Layers, Plus, Trash2 } from 'lucide-react';
import {
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
import OverflowTip from '../components/OverflowTip';
import LessonPane from './LessonPane';
import SectionPane from './SectionPane';
import './CourseCurriculum.css';

// ------------------------------------------------------------
// A course's Curriculum step (CoursePage.jsx): sections and their lessons
// on the left (the outline), and what's being worked on in a panel on the
// right: a lesson, or a section.
//
// The outline is for seeing the course, moving around it and putting
// things in order. Nothing in it is edited: names are changed, and
// lessons and sections deleted, only in the panel (one place for it).
//
// Each section is a card with a solid dark header bar across its top,
// and its lessons inside, under it (CourseCurriculum.css).
//
//   ┌──────────────────────────────────────────────┐
//   │▓ SECTION 1                                   ▓│
//   │▓ Introduction              2 lessons  ⋮⋮  ⌄ ▓│
//   ├──────────────────────────────────────────────┤
//   │   1.  What is MCP?                        ⋮⋮ │
//   │   2.  How servers work       [+ Content]  ⋮⋮ │
//   │   + Add lesson                                │
//   └──────────────────────────────────────────────┘
//   ▓ SECTION 2 · Building        3 lessons  ⋮⋮  › ▓   (folded: just its bar)
//   [+ Add section]
//
// The bar: "SECTION 1" and the name, which opens the section in the
// panel; how many lessons it has; ⋮⋮ (on hover); ⌄ / › on the right folds
// the section to just its bar or opens it again. Every section starts
// open, a new one too. Moving into a lesson of a folded section (‹ ›, a
// new lesson) unfolds it. Folds last for this visit to the step.
//
// A new course starts with no sections: "No sections yet", then
// + Add your first section (createCourse in courses.js).
// Lessons: "1." (numbered again in each section) and the name; "+ Content"
// while it's empty and the panel isn't open ("Empty" while it is); a
// click anywhere on the row opens it in the panel. The one in the panel
// is lit orange.
// Long names end in "…" and show the whole name in a tooltip
// (OverflowTip). The ⋮⋮ handles show on hover or with the keyboard on them.
//
// The panel (Change 1): once it opens, it stays open for this visit to
// the step: nothing closes it (no ✕, no Escape, no Done). It opens the
// first time a lesson is clicked (or its + Content), a section's name is
// clicked, or a lesson or section is added. Leaving the step and coming
// back starts with it closed.
//   Lesson view   LessonPane.jsx: ‹ › to the lesson before or after,
//                 🗑 Delete lesson, its name (✎), its content, + Add next lesson
//   Section view  SectionPane.jsx: 🗑 Delete section, its name (✎), how many
//                 lessons it has, + Add lesson
// Under 1100px wide there's no room for both, so the panel covers the
// page from the right, and can be closed there (✕, Escape, a click on
// the dim), as before.
//
// Adding:
//   + Add section   (under the last section) makes "Untitled section"
//                   at the end, and opens it in the panel with its name
//                   selected, ready to type over
//   + Add lesson    (in a section's card, or the section view) makes
//                   "Untitled lesson" at the end of that section, and
//                   opens it with its name selected, under it the
//                   "What goes in this lesson?" tiles
//   + Add next lesson (in the lesson view) the same, right after the
//                   lesson that was open
// A name left as it is stays "Untitled lesson": the lesson is kept.
//
// Deleting (from the panel): a lesson always asks first; a section asks
// first when it has lessons. Then the panel moves to the nearest lesson:
// the next one in course order, else the one before (for a section, the
// nearest outside it). With no lessons left, the first section's view;
// with no sections left, the panel closes.
//
// Reordering: ⋮⋮ at the end of a lesson's row or on a section's tab.
// Drag a lesson up or down, or into another section (an empty one too, or
// onto a folded section's tab: it goes to that section's end); drag a
// section above or below another. An orange line shows where it will
// land. With the keyboard: focus ⋮⋮ and press ↑ or ↓ to move one place (a
// lesson at the top or bottom of its section moves into the one next to
// it); where it went is read out. Moving the open lesson keeps it open.
//
// Unsaved text in the open lesson: opening something else in the panel,
// or adding a lesson or section, asks first, through guard().
//
// course: the course (with its sections)
// onSaved(ok): after each change, so the page can say "Saved" or that it failed
// guard(fn): runs fn, or first asks "Leave without saving?" when the open
//   lesson has unsaved changes (CoursePage.jsx keeps that question)
// onDirtyChange(dirty): the open lesson has (or no longer has) unsaved changes
// onPaneChange(open): the panel opened or closed, so the page can widen
// ------------------------------------------------------------

const NEW_LESSON_TITLE = 'Untitled lesson';
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Under this, the panel covers the page and can be closed (CoursesPage.css)
const NARROW = '(max-width: 1099px)';
function useNarrow() {
  const [narrow, setNarrow] = useState(() => window.matchMedia?.(NARROW).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(NARROW);
    if (!mq) return undefined;
    const on = () => setNarrow(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return narrow;
}

// Where focus goes back to when the panel closes (narrow screens): the lesson's row
const focusRow = (lessonId) => requestAnimationFrame(() => document.getElementById(`les-open-${lessonId}`)?.focus());

export default function CourseContent({ course, onSaved, guard, onDirtyChange, onPaneChange }) {
  const sections = sectionsOf(course);
  const narrow = useNarrow();
  const [view, setView] = useState(null); // { type: 'lesson' | 'section', id }: what the panel shows
  const [paneOpen, setPaneOpen] = useState(false); // once open, it stays open (wide screens)
  const [focusTitle, setFocusTitle] = useState(null); // a new lesson or section: its name selected in the panel
  const [folded, setFolded] = useState(() => new Set()); // sections folded to just their tab
  const [deletingSection, setDeletingSection] = useState(null);
  const [deletingLesson, setDeletingLesson] = useState(null);

  // Every lesson in order, with where it sits: for the panel's heading and ‹ ›
  const all = sections.flatMap((section, si) =>
    section.lessons.map((lesson, j) => ({ lesson, section, sectionNumber: si + 1, number: j + 1 })),
  );
  const at = view?.type === 'lesson' ? all.findIndex((x) => x.lesson.id === view.id) : -1;
  const open = at === -1 ? null : all[at];
  const sectionAt = view?.type === 'section' ? sections.findIndex((s) => s.id === view.id) : -1;
  const openSection = sectionAt === -1 ? null : sections[sectionAt];
  const showing = paneOpen && Boolean(open || openSection);
  const openId = open?.lesson.id ?? null;

  // What the panel shows is gone (deleted in another tab): the nearest
  // thing there is, or the panel closes
  useEffect(() => {
    if (!paneOpen || !view || open || openSection) return;
    onDirtyChange(false);
    if (all[0]) setView({ type: 'lesson', id: all[0].lesson.id });
    else if (sections[0]) setView({ type: 'section', id: sections[0].id });
    else {
      setView(null);
      setPaneOpen(false);
    }
  }, [paneOpen, view, open, openSection]); // eslint-disable-line react-hooks/exhaustive-deps

  // The page widens while the panel's open, and goes back when this step closes
  useEffect(() => onPaneChange?.(showing), [showing]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onPaneChange?.(false), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Moving into a folded section unfolds it
  const viewSectionId = open?.section.id ?? openSection?.id ?? null;
  useEffect(() => {
    if (!viewSectionId || !folded.has(viewSectionId)) return;
    setFolded((prev) => {
      const next = new Set(prev);
      next.delete(viewSectionId);
      return next;
    });
  }, [viewSectionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleFold = (id) =>
    setFolded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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

  // ---------- The panel ----------
  // Shows a lesson or a section, asking first if the open lesson has unsaved text
  const show = (next) => {
    if (paneOpen && view?.type === next.type && view.id === next.id) return;
    guard(() => {
      setView(next);
      setPaneOpen(true);
    });
  };
  const openLesson = (id) => show({ type: 'lesson', id });
  const openSectionView = (id) => show({ type: 'section', id });

  // Narrow screens only: the panel covers the page, so it can be closed
  const closePane = () =>
    guard(() => {
      setPaneOpen(false);
      if (openId) focusRow(openId);
    });

  // ---------- Adding ----------
  const addNewSection = () =>
    guard(() => {
      const made = did(addSection(course.id));
      if (!made) return;
      setView({ type: 'section', id: made.section.id });
      setPaneOpen(true);
      setFocusTitle(made.section.id);
    });

  // A new lesson in a section: at its end, or right after afterId. It opens
  // in the panel with its name selected.
  const addNewLesson = (section, afterId = null) =>
    guard(() => {
      const made = did(addLesson(course.id, section.id, NEW_LESSON_TITLE));
      if (!made) return;
      if (afterId) {
        const i = section.lessons.findIndex((l) => l.id === afterId);
        const nextId = i === -1 ? null : section.lessons[i + 1]?.id;
        if (nextId) did(moveLessonBefore(course.id, made.lesson.id, section.id, nextId));
      }
      setView({ type: 'lesson', id: made.lesson.id });
      setPaneOpen(true);
      setFocusTitle(made.lesson.id);
    });

  // + Add next lesson in the lesson view: right after the open one
  const addNext = () => open && addNewLesson(open.section, open.lesson.id);

  // ---------- Deleting ----------
  // Where the panel goes once these lessons are gone: the next lesson in
  // course order after them, else the one before; else a section that's
  // left; else nothing (the panel closes)
  const moveAfterDelete = ({ lessonIds, sectionId = null }) => {
    const gone = new Set(lessonIds);
    const firstAt = all.findIndex((x) => gone.has(x.lesson.id));
    const lastAt = all.reduce((n, x, i) => (gone.has(x.lesson.id) ? i : n), -1);
    let target = null;
    if (firstAt !== -1) {
      target = all.slice(lastAt + 1).find((x) => !gone.has(x.lesson.id)) ?? all.slice(0, firstAt).reverse().find((x) => !gone.has(x.lesson.id));
    } else if (sectionId) {
      // An empty section: the nearest lesson after it, else before it
      const si = sections.findIndex((s) => s.id === sectionId);
      target = all.find((x) => sections.indexOf(x.section) > si) ?? [...all].reverse().find((x) => sections.indexOf(x.section) < si);
    }
    onDirtyChange(false);
    if (target) {
      setView({ type: 'lesson', id: target.lesson.id });
      return;
    }
    const left = sections.filter((s) => s.id !== sectionId);
    const home = left.find((s) => s.lessons.some((l) => gone.has(l.id))) ?? left[0];
    if (home) setView({ type: 'section', id: home.id });
    else {
      setView(null);
      setPaneOpen(false);
    }
  };

  const askDeleteSection = (section) => {
    if (section.lessons.length > 0) {
      setDeletingSection(section);
      return;
    }
    const wasOpen = view?.type === 'section' && view.id === section.id;
    if (did(deleteSection(course.id, section.id)) && wasOpen) moveAfterDelete({ lessonIds: [], sectionId: section.id });
  };

  const confirmDeleteSection = () => {
    const section = deletingSection;
    setDeletingSection(null);
    const ids = section.lessons.map((l) => l.id);
    const wasOpen = (view?.type === 'section' && view.id === section.id) || ids.includes(openId);
    if (did(deleteSection(course.id, section.id)) && wasOpen) moveAfterDelete({ lessonIds: ids, sectionId: section.id });
  };

  const confirmDeleteLesson = () => {
    const lesson = deletingLesson;
    setDeletingLesson(null);
    const wasOpen = lesson.id === openId;
    if (did(deleteLesson(course.id, lesson.id)) && wasOpen) moveAfterDelete({ lessonIds: [lesson.id] });
  };

  // ---------- Moving ----------
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

  // Over a lesson's row: before it (top half) or after it (bottom half)
  const overLesson = (e, section, j) => {
    if (drag?.type !== 'lesson') return;
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const before = e.clientY < rect.top + rect.height / 2;
    const beforeId = before ? section.lessons[j].id : section.lessons[j + 1]?.id ?? null;
    setDrop({ sectionId: section.id, beforeId });
  };

  // Over a section's card, but not over a lesson: its end
  const overSectionBody = (e, section) => {
    if (drag?.type !== 'lesson') return;
    e.preventDefault();
    e.stopPropagation();
    setDrop({ sectionId: section.id, beforeId: null });
  };

  // A lesson over a folded section's tab: the end of that section
  const overTab = (e, section) => {
    if (drag?.type !== 'lesson' || !folded.has(section.id)) return;
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
      setSaid(`Moved to ${sections[to.s].title}, as lesson ${to.n}.`);
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
    <div className={['cct', 'cct--folders', drag && 'cct--dragging', showing && 'cct--split'].filter(Boolean).join(' ')}>
      <OverflowTip />

      {/* ---------- The outline: sections as folders, their lessons inside ---------- */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div className="cct__outline" onDrop={onDrop} onDragOver={(e) => drag && drop && e.preventDefault()}>
        {sections.length === 0 ? (
          <div className="cct__none">
            <Layers size={22} aria-hidden="true" />
            <p className="cct__none-title">No sections yet</p>
            <p className="cct__none-text">Add a section, then add lessons to it.</p>
          </div>
        ) : (
          <ol className="cct__sections">
            {sections.map((section, i) => {
              const isFolded = folded.has(section.id);
              const lessonDrop = drag?.type === 'lesson' && drop?.sectionId === section.id ? drop : null;
              const tabOn = showing && view?.type === 'section' && view.id === section.id;
              // While something is open in the panel, only its section's bar
              // stays orange; the others turn grey (CourseCurriculum.css)
              const isCurrent = tabOn || (showing && open?.section.id === section.id);
              const isMuted = showing && !isCurrent;
              return (
                <li
                  key={section.id}
                  className={[
                    'cct__section',
                    isFolded && 'cct__section--folded',
                    drag?.type === 'section' && drag.id === section.id && 'cct__section--dragging',
                    sectionDropLine && drop.beforeId === section.id && 'cct__section--drop-before',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onDragOver={(e) => overSection(e, i)}
                  {...dragProps('section', section.id)}
                >
                  {/* The section's header bar: "SECTION 1" and its name (opens it
                      in the panel), how many lessons, ⋮⋮, then fold on the right */}
                  {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
                  <div
                    className={[
                      'cct__tab',
                      tabOn && 'cct__tab--on',
                      isMuted && 'cct__tab--muted',
                      isFolded && lessonDrop && 'cct__tab--drop',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onDragOver={(e) => overTab(e, section)}
                  >
                    <button
                      type="button"
                      className="cct__tab-name"
                      aria-current={tabOn ? 'true' : undefined}
                      onClick={() => openSectionView(section.id)}
                    >
                      <span className="cct__tab-eyebrow">Section {i + 1}</span>
                      <span className="cct__tab-text" data-full={section.title}>
                        {section.title}
                      </span>
                    </button>
                    <span className="cct__tab-count">{plural(section.lessons.length, 'lesson')}</span>
                    {sections.length > 1 && grip('section', section.id, `section ${i + 1}, ${section.title}`, (e) => keySection(e, section.id))}
                    <button
                      type="button"
                      className="cct__fold"
                      aria-expanded={!isFolded}
                      aria-controls={`cct-sec-${section.id}`}
                      title={isFolded ? 'Show lessons' : 'Hide lessons'}
                      onClick={() => toggleFold(section.id)}
                    >
                      {isFolded ? <ChevronRight size={20} aria-hidden="true" /> : <ChevronDown size={20} aria-hidden="true" />}
                      <span className="sr-only">
                        {isFolded ? 'Show' : 'Hide'} the lessons in {section.title}
                      </span>
                    </button>
                  </div>

                  {/* The folder: its lessons, then + Add lesson */}
                  {!isFolded && (
                    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
                    <div className="cct__card" id={`cct-sec-${section.id}`} onDragOver={(e) => overSectionBody(e, section)}>
                      {section.lessons.length > 0 && (
                        <ol className="cct__lessons">
                          {section.lessons.map((lesson, j) => (
                            <Fragment key={lesson.id}>
                              <LessonRow
                                number={j + 1}
                                lesson={lesson}
                                selected={showing && openId === lesson.id}
                                split={showing}
                                dragging={drag?.type === 'lesson' && drag.id === lesson.id}
                                dropBefore={lessonDrop?.beforeId === lesson.id}
                                dragProps={dragProps('lesson', lesson.id)}
                                onDragOver={(e) => overLesson(e, section, j)}
                                grip={grip('lesson', lesson.id, `lesson ${j + 1}, ${lesson.title}`, (e) => keyLesson(e, lesson.id))}
                                onSelect={() => openLesson(lesson.id)}
                                onDelete={() => setDeletingLesson(lesson)}
                              />
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

                      <button type="button" className="cct__add-lesson" onClick={() => addNewLesson(section)}>
                        <Plus size={17} aria-hidden="true" />
                        Add lesson
                        <span className="sr-only"> to {section.title}</span>
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
            {sectionDropLine && drop.beforeId === null && <li className="cct__section-drop-end" aria-hidden="true" />}
          </ol>
        )}

        <button type="button" className="crs-btn crs-btn--quiet cct__add-section" onClick={addNewSection}>
          <Plus size={18} aria-hidden="true" />
          {sections.length === 0 ? 'Add your first section' : 'Add section'}
        </button>

        <p className="sr-only" aria-live="polite">
          {said}
        </p>
      </div>

      {/* ---------- The panel: a lesson, or a section ---------- */}
      {showing && (
        <>
          {/* Narrow screens only: the dimmed page behind the panel */}
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
          <div className="cct__scrim" aria-hidden="true" onClick={closePane} />
          {open ? (
            <LessonPane
              course={course}
              entry={open}
              prev={all[at - 1] ?? null}
              next={all[at + 1] ?? null}
              onGo={openLesson}
              onAddNext={addNext}
              onDelete={() => setDeletingLesson(open.lesson)}
              onRename={(title) => did(updateLesson(course.id, open.lesson.id, { title }))}
              onSaved={onSaved}
              onDirtyChange={onDirtyChange}
              selectTitle={focusTitle === open.lesson.id}
              onTitleSelected={() => setFocusTitle(null)}
              closable={narrow}
              onClose={closePane}
            />
          ) : (
            <SectionPane
              section={openSection}
              number={sectionAt + 1}
              onRename={(title) => did(renameSection(course.id, openSection.id, title))}
              onAddLesson={() => addNewLesson(openSection)}
              onDelete={() => askDeleteSection(openSection)}
              selectTitle={focusTitle === openSection.id}
              onTitleSelected={() => setFocusTitle(null)}
              closable={narrow}
              onClose={closePane}
            />
          )}
        </>
      )}

      {deletingSection && (
        <ConfirmDialog
          title="Delete this section?"
          confirmLabel="Delete section"
          danger
          onCancel={() => setDeletingSection(null)}
          onConfirm={confirmDeleteSection}
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
          onConfirm={confirmDeleteLesson}
        >
          <p>
            <strong>{deletingLesson.title}</strong> and what’s in it will be deleted. This can’t be undone.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}

// One lesson's row: "1." and its name (cut with "…" when long, the whole
// name in a tooltip); on the right, "+ Content" while it's empty and the
// panel isn't open ("Empty" by the name while it is), then ⋮⋮. A click
// anywhere on the row but ⋮⋮ opens it in the panel; the one in the panel
// is lit. 🗑 (on hover, or with the keyboard in the row) deletes it,
// asking first, the same as the panel's 🗑. Editing it is the panel's.
// split: the panel is open; dragging: it's being dragged; dropBefore: a
// dragged lesson would land just above it; dragProps, onDragOver, grip:
// from the list (see above)
function LessonRow({ number, lesson, selected, split, dragging, dropBefore, dragProps, onDragOver, grip, onSelect, onDelete }) {
  const kind = lessonKind(lesson);

  return (
    <li
      className={['cct__lesson', selected && 'cct__lesson--on', dragging && 'cct__lesson--dragging', dropBefore && 'cct__lesson--drop-before']
        .filter(Boolean)
        .join(' ')}
      onDragOver={onDragOver}
      {...dragProps}
    >
      {/* The row itself takes a click too, for the space around the words */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div className="cct__lesson-row" onClick={(e) => e.target === e.currentTarget && onSelect()}>
        <button
          type="button"
          id={`les-open-${lesson.id}`}
          className="cct__lesson-open"
          aria-current={selected ? 'true' : undefined}
          aria-controls={selected ? 'cct-pane' : undefined}
          onClick={onSelect}
        >
          <span className="cct__lesson-num">{number}.</span>
          <span className="cct__lesson-title" data-full={lesson.title}>
            {lesson.title}
          </span>
          {!kind && <span className="cct__lesson-empty">Empty</span>}
        </button>

        <span className="cct__tools">
          {!kind && !split && (
            <button type="button" className="cct__content-btn" onClick={onSelect}>
              <Plus size={16} aria-hidden="true" /> Content
              <span className="sr-only"> for {lesson.title}</span>
            </button>
          )}
          <button
            type="button"
            className="cct__lesson-del"
            aria-label={`Delete lesson: ${lesson.title}`}
            title="Delete lesson"
            onClick={onDelete}
          >
            <Trash2 size={17} aria-hidden="true" />
          </button>
          {grip}
        </span>
      </div>
    </li>
  );
}