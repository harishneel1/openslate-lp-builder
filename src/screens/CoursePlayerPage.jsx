import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, ChevronDown, ChevronLeft, ChevronRight, Download, ExternalLink, Eye, FileText, Link2, Play, Share2 } from 'lucide-react';
import {
  academyHome,
  coursePlayerPath,
  coursePlayerUrl,
  getCourse,
  isPublished,
  onCoursesChange,
  readVideoLink,
  studentLessons,
  studentSections,
} from '../data/courses';
import { onProgressChange, progressOf, setDone, setLast } from '../data/courseProgress';
import { canSee, onStudentChange } from '../data/students';
import { fileById, formatBytes, onStorageChange } from '../data/cloudStorage';
import { copyText } from '../utils/copyText';
import { TextView } from '../components/TextEditor';
import { KIND, KindTile, tileKindOf } from './lessonKinds';
import AcademyTop from '../components/AcademyTop';
import './AcademyCoursesPage.css';
import './CoursePlayerPage.css';

// ------------------------------------------------------------
// One course, as a student takes it: /web/courses/<course>/learn?lesson=…
// Laid out as TagMango's player, in our colours. Opened from a course's
// card on the academy's Courses page, and by "Preview as student" on the
// coach's course page.
//
//   [HN]                    [📖 Courses]
//   ┌ ← Back ─────────────┐  INTRODUCTION                 1 of 4 complete
//   │ COURSE CONTENT      │  How servers work
//   │ 1 / 4 lessons done  │  ┌──────────────────────────────────────────┐
//   ├─────────────────────┤  │        the lesson: video, PDF or text    │
//   │ Introduction      ⌃ │  └──────────────────────────────────────────┘
//   │ 1 / 3 lessons       │  [Mark as complete]          ┌ NEXT ───────┐
//   │ ┌ ✓ 01 What is MCP? │                              │ Setting up… › │
//   │ │ ▶ 02 How servers… │                              └──────────────┘
//   │ Building your…    ⌄ │
//   └─────────────────────┘
//
// Students see sections by name only (no "Section 1"), and only lessons
// with something in them (studentSections).
//
// Sidebar: each section folds open or shut, with how many of its lessons
// are done; the one you're in opens by itself. Each lesson: a round icon
// for its kind (a tick once done), its number and name, its kind under
// it, and Share (copies the lesson's link). The lesson you're on is lit.
//
// Main: the section's name, the lesson's title, how much of the course is
// done, then the lesson itself:
//   Embedded video  the YouTube or Vimeo player
//   Video           a player (in the prototype, a stand-in: no files kept)
//   PDF             the file, to read and download (a stand-in for now)
//   Text            the text
// Mark as complete (and undo) sits by how much is done, top right.
// Under the lesson, as on TagMango: PREVIOUS and NEXT, side by side, each
// with its lesson's name. NEXT marks this one done and opens that; on the
// last lesson, Finish course instead.
// Then its tabs: Description (when it has one; a Text lesson never does)
// and Resources (its files to download, or "No additional resources").
// No Q&A or comments.
//
// Where they are: ?lesson= in the address, so a lesson's link opens it,
// and Back and Forward move between lessons. With none, the course opens
// where they left off (the last lesson they opened), else at the first
// lesson not done. Progress is each student's own (courseProgress.js).
//
// Phones: one column, the lesson first and the course's contents under it.
//
// Only a course the student can see opens here (students.js): published,
// and on a contract they've signed up for. Any other link says the page
// isn't available, without saying what's there. Except with &preview=1: the coach's
// Preview as student, which opens drafts too, with a strip on top saying
// it's a preview (and, for a draft, that students can't see it yet). The
// preview flag stays in the address as they move between lessons; the
// links Share copies are students' links, without it.
//
// courseId
// student: who's signed in (null while previewing)
// preview: the coach's Preview as student
// ------------------------------------------------------------

const lessonFromAddress = () => new URLSearchParams(window.location.search).get('lesson');
const two = (n) => String(n).padStart(2, '0');
const kindLabel = (lesson) => (lesson.content.kind === 'embed' ? 'Video' : KIND[lesson.content.kind]?.label ?? 'Lesson');

function useLive(read, subscribe) {
  const [value, setValue] = useState(read);
  useEffect(() => subscribe(() => setValue(read())), []); // eslint-disable-line react-hooks/exhaustive-deps
  return value;
}

export default function CoursePlayerPage({ courseId, student = null, preview = false }) {
  const who = preview ? 'preview' : student?.id;
  const home = academyHome(preview);
  const found = useLive(() => getCourse(courseId), onCoursesChange);
  const allowed = useLive(() => preview || canSee(student, getCourse(courseId)), (fn) => {
    const a = onCoursesChange(fn);
    const b = onStudentChange(fn);
    return () => {
      a();
      b();
    };
  });
  const course = found && allowed ? found : null;
  const progress = useLive(() => progressOf(who, courseId), onProgressChange);
  const sections = useMemo(() => (course ? studentSections(course) : []), [course]);
  const lessons = useMemo(() => (course ? studentLessons(course) : []), [course]);

  // The lesson open: the address's, else where they left off, else the first not done
  const [asked, setAsked] = useState(lessonFromAddress);
  const pick = () => {
    const has = (id) => lessons.some((x) => x.lesson.id === id);
    if (asked && has(asked)) return asked;
    if (progress.last && has(progress.last)) return progress.last;
    return (lessons.find((x) => !progress.done.has(x.lesson.id)) ?? lessons[0])?.lesson.id ?? null;
  };
  const currentId = pick();
  const index = lessons.findIndex((x) => x.lesson.id === currentId);
  const current = lessons[index] ?? null;
  const prev = index > 0 ? lessons[index - 1] : null;
  const next = lessons[index + 1] ?? null;

  // Back and Forward move between lessons
  useEffect(() => {
    const onPop = () => setAsked(lessonFromAddress());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // The address and "where they left off" follow the lesson open
  useEffect(() => {
    if (!currentId) return;
    if (lessonFromAddress() !== currentId) window.history.replaceState(null, '', coursePlayerPath(courseId, currentId, preview));
    setLast(who, courseId, currentId);
    window.scrollTo?.({ top: 0 });
  }, [courseId, currentId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    document.title = current ? `${current.lesson.title} - ${course.title}` : course?.title ?? 'Course';
  }, [current?.lesson.title, course?.title]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (lessonId) => {
    if (lessonId === currentId) return;
    window.history.pushState(null, '', coursePlayerPath(courseId, lessonId, preview));
    setAsked(lessonId);
  };

  const doneCount = lessons.filter((x) => progress.done.has(x.lesson.id)).length;

  if (!course || lessons.length === 0) {
    return (
      <div className="acd">
        <AcademyTop student={student} home={home} />
        <main className="acd__main">
          <a className="cpl__back" href={home}>
            <ArrowLeft size={16} aria-hidden="true" /> Back to courses
          </a>
          <section className="acd__empty">
            <h1 className="acd__empty-title">{course ? course.title : 'This page isn’t available'}</h1>
            <p className="acd__empty-text">
              {course ? 'There are no lessons in this course yet. Check back soon.' : 'Check the link, or go back to your courses.'}
            </p>
          </section>
        </main>
      </div>
    );
  }

  const isDone = progress.done.has(current.lesson.id);

  return (
    <div className="acd cpl">
      <AcademyTop student={student} home={home} />
      {preview && (
        <p className={`cpl__preview ${isPublished(course) ? '' : 'cpl__preview--draft'}`} role="status">
          <Eye size={17} aria-hidden="true" />
          {isPublished(course)
            ? 'Preview: this is what students see. This course is published.'
            : 'Preview: this course is a draft, so students can’t see it yet.'}
        </p>
      )}

      <div className="cpl__layout">
        <main className="cpl__main">
          <div className="cpl__head">
            <div className="cpl__head-text">
              <p className="cpl__eyebrow">{current.section.title}</p>
              <h1 className="cpl__title">{current.lesson.title}</h1>
            </div>
            <div className="cpl__head-side">
              <p className="cpl__overall">
                {doneCount} of {lessons.length} complete
              </p>
              <button
                type="button"
                className={`cpl__mark ${isDone ? 'cpl__mark--done' : ''}`}
                aria-pressed={isDone}
                onClick={() => setDone(who, courseId, current.lesson.id, !isDone)}
              >
                <Check size={16} strokeWidth={isDone ? 3 : 2} aria-hidden="true" />
                {isDone ? 'Completed' : 'Mark as complete'}
              </button>
            </div>
          </div>

          <LessonBody key={current.lesson.id} lesson={current.lesson} />

          {/* PREVIOUS and NEXT, side by side, as on TagMango */}
          <nav className="cpl__nav" aria-label="Lessons">
            {prev ? (
              <a
                className="cpl__nav-card cpl__nav-card--prev"
                href={coursePlayerPath(courseId, prev.lesson.id, preview)}
                onClick={(e) => {
                  e.preventDefault();
                  go(prev.lesson.id);
                }}
              >
                <span className="cpl__nav-arrow" aria-hidden="true">
                  <ChevronLeft size={20} />
                </span>
                <span className="cpl__nav-text">
                  <span className="cpl__nav-label">Previous</span>
                  <span className="cpl__nav-title">{prev.lesson.title}</span>
                </span>
              </a>
            ) : (
              <span className="cpl__nav-gap" aria-hidden="true" />
            )}

            {next ? (
              <a
                className="cpl__nav-card cpl__nav-card--next"
                href={coursePlayerPath(courseId, next.lesson.id, preview)}
                onClick={(e) => {
                  e.preventDefault();
                  setDone(who, courseId, current.lesson.id, true);
                  go(next.lesson.id);
                }}
              >
                <span className="cpl__nav-text">
                  <span className="cpl__nav-label">Next</span>
                  <span className="cpl__nav-title">{next.lesson.title}</span>
                </span>
                <span className="cpl__nav-arrow cpl__nav-arrow--on" aria-hidden="true">
                  <ChevronRight size={20} />
                </span>
              </a>
            ) : doneCount === lessons.length ? (
              <div className="cpl__finished">
                <span>You’ve finished this course.</span>
                <a className="cpl__finished-link" href={home}>
                  Back to courses
                </a>
              </div>
            ) : (
              <button type="button" className="cpl__finish" onClick={() => setDone(who, courseId, current.lesson.id, true)}>
                Finish course <Check size={18} strokeWidth={3} aria-hidden="true" />
              </button>
            )}
          </nav>

          <LessonTabs key={`tabs-${current.lesson.id}`} lesson={current.lesson} />
        </main>

        <Contents
          courseId={courseId}
          preview={preview}
          sections={sections}
          total={lessons.length}
          doneCount={doneCount}
          done={progress.done}
          currentId={currentId}
          currentSectionId={current.section.id}
          onGo={go}
        />
      </div>
    </div>
  );
}

// ---------- The sidebar: the course's contents ----------
function Contents({ courseId, preview, sections, total, doneCount, done, currentId, currentSectionId, onGo }) {
  const [open, setOpen] = useState(() => new Set([currentSectionId]));
  const [copied, setCopied] = useState(null); // the lesson whose link was just copied

  // The section you're in opens by itself
  useEffect(() => {
    setOpen((prev) => (prev.has(currentSectionId) ? prev : new Set([...prev, currentSectionId])));
  }, [currentSectionId]);

  useEffect(() => {
    if (!copied) return undefined;
    const id = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(id);
  }, [copied]);

  const toggle = (id) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  let number = 0;

  return (
    <aside className="cpl__side" aria-label="Course content">
      <a className="cpl__back" href={academyHome(preview)}>
        <ArrowLeft size={16} aria-hidden="true" /> Back
      </a>
      <h2 className="cpl__side-title">Course content</h2>
      <p className="cpl__side-count">
        {doneCount} / {total} lessons complete
      </p>

      <ol className="cpl__sections">
        {sections.map((section) => {
          const isOpen = open.has(section.id);
          const sectionDone = section.lessons.filter((l) => done.has(l.id)).length;
          const first = number;
          number += section.lessons.length;
          return (
            <li key={section.id} className="cpl__section">
              <button
                type="button"
                className="cpl__section-head"
                aria-expanded={isOpen}
                aria-controls={`cpl-sec-${section.id}`}
                onClick={() => toggle(section.id)}
              >
                <span className="cpl__section-text">
                  <span className="cpl__section-title">{section.title}</span>
                  <span className="cpl__section-count">
                    {sectionDone} / {section.lessons.length} lessons
                  </span>
                </span>
                <ChevronDown size={18} className={`cpl__chev ${isOpen ? 'cpl__chev--open' : ''}`} aria-hidden="true" />
              </button>

              {isOpen && (
                <ol className="cpl__lessons" id={`cpl-sec-${section.id}`}>
                  {section.lessons.map((lesson, i) => {
                    const on = lesson.id === currentId;
                    const isDone = done.has(lesson.id);
                    const Icon = isDone ? Check : lesson.content.kind === 'text' ? FileText : lesson.content.kind === 'link' ? Link2 : lesson.content.kind === 'pdf' ? FileText : Play;
                    return (
                      <li key={lesson.id} className={`cpl__lesson ${on ? 'cpl__lesson--on' : ''} ${isDone ? 'cpl__lesson--done' : ''}`}>
                        <a
                          className="cpl__lesson-link"
                          href={coursePlayerPath(courseId, lesson.id, preview)}
                          aria-current={on ? 'page' : undefined}
                          onClick={(e) => {
                            e.preventDefault();
                            onGo(lesson.id);
                          }}
                        >
                          <span className="cpl__lesson-icon" aria-hidden="true">
                            <Icon size={17} strokeWidth={isDone ? 3 : 2} />
                          </span>
                          <span className="cpl__lesson-text">
                            <span className="cpl__lesson-name">
                              <span className="cpl__lesson-num">{two(first + i + 1)}</span> {lesson.title}
                            </span>
                            <span className="cpl__lesson-kind">
                              {kindLabel(lesson)}
                              {isDone && <span className="sr-only">, completed</span>}
                            </span>
                          </span>
                        </a>
                        <button
                          type="button"
                          className="cpl__share"
                          aria-label={`Copy the link to ${lesson.title}`}
                          data-tip={copied === lesson.id ? 'Link copied' : 'Copy link'}
                          data-tip-align="end"
                          onClick={async () => {
                            if (await copyText(coursePlayerUrl(courseId, lesson.id))) setCopied(lesson.id);
                          }}
                        >
                          <Share2 size={16} aria-hidden="true" />
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

// ---------- The lesson itself ----------
function LessonBody({ lesson }) {
  const c = lesson.content;
  const [, setTick] = useState(0);
  useEffect(() => (c.fileId ? onStorageChange(() => setTick((n) => n + 1)) : undefined), [c.fileId]);

  if (c.kind === 'embed') {
    const video = readVideoLink(c.url);
    return (
      <div className="cpl__frame">
        <iframe
          src={video.embedUrl}
          title={lesson.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    );
  }

  if (c.kind === 'text') {
    return (
      <div className="cpl__text">
        <TextView html={c.html} />
      </div>
    );
  }

  if (c.kind === 'link') {
    return (
      <div className="cpl__doc">
        <span className="cpl__doc-icon" aria-hidden="true">
          <Link2 size={26} />
        </span>
        <p className="cpl__doc-name">{c.url}</p>
        <a className="cpl__doc-btn" href={c.url} target="_blank" rel="noopener noreferrer">
          Open link <ExternalLink size={16} aria-hidden="true" />
        </a>
      </div>
    );
  }

  // A file from Cloud Storage
  if (!fileById(c.fileId)) {
    return (
      <div className="cpl__doc">
        <p className="cpl__doc-name">This lesson isn’t available right now.</p>
        <p className="cpl__doc-note">Check back soon.</p>
      </div>
    );
  }

  if (c.kind === 'video') {
    return (
      <div className="cpl__frame cpl__frame--stand-in">
        <span className="cpl__play" aria-hidden="true">
          <Play size={30} fill="currentColor" />
        </span>
        <p className="cpl__stand-in-name">{c.name}</p>
        <p className="cpl__stand-in-note">The prototype keeps only the video’s name, so it can’t play here yet.</p>
      </div>
    );
  }

  // PDF
  return (
    <div className="cpl__doc">
      <span className="cpl__doc-icon cpl__doc-icon--pdf" aria-hidden="true">
        <FileText size={26} />
      </span>
      <p className="cpl__doc-name">{c.name}</p>
      <p className="cpl__doc-note">PDF · {formatBytes(c.bytes)}</p>
      <button type="button" className="cpl__doc-btn" disabled title="The prototype keeps only the file’s name">
        <Download size={16} aria-hidden="true" /> Download PDF
      </button>
      <p className="cpl__doc-note">The PDF shows here to read once files are kept. The prototype keeps only its name.</p>
    </div>
  );
}

// ---------- Description | Resources ----------
// Description only when there is one; Resources always, as TagMango has it
function LessonTabs({ lesson }) {
  const [, setTick] = useState(0);
  useEffect(() => onStorageChange(() => setTick((n) => n + 1)), []);
  const hasDescription = Boolean(lesson.description) && lesson.content.kind !== 'text';
  const files = lesson.resources.filter((r) => fileById(r.fileId)); // deleted ones aren't offered
  const tabs = [...(hasDescription ? [{ id: 'description', label: 'Description' }] : []), { id: 'resources', label: 'Resources' }];
  const [tab, setTab] = useState(tabs[0].id);
  const [noted, setNoted] = useState(null); // the resource whose Download was pressed

  const onKey = (e) => {
    if (tabs.length < 2 || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    const next = tabs[(tabs.findIndex((t) => t.id === tab) + 1) % tabs.length].id;
    setTab(next);
    requestAnimationFrame(() => document.getElementById(`cpl-tab-${next}`)?.focus());
  };

  return (
    <section className="cpl__tabs-wrap">
      <div className="cpl__tabs" role="tablist" aria-label="About this lesson" onKeyDown={onKey}>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`cpl-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`cpl-panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            className="cpl__tab"
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === 'resources' && files.length > 0 && <span className="cpl__tab-count">{files.length}</span>}
          </button>
        ))}
      </div>

      {tab === 'description' && (
        <div className="cpl__tab-panel cpl__description" role="tabpanel" id="cpl-panel-description" aria-labelledby="cpl-tab-description">
          <TextView html={lesson.description} />
        </div>
      )}

      {tab === 'resources' && (
        <div className="cpl__tab-panel" role="tabpanel" id="cpl-panel-resources" aria-labelledby="cpl-tab-resources">
          {files.length === 0 ? (
            <p className="cpl__no-resources">No additional resources for this lesson.</p>
          ) : (
            <ul className="cpl__resources">
              {files.map((r) => (
                <li key={r.id} className="cpl__resource">
                  <KindTile kind={tileKindOf(r)} size="small" />
                  <span className="cpl__resource-text">
                    <span className="cpl__resource-name">{r.name}</span>
                    <span className="cpl__resource-detail">
                      {noted === r.id ? 'The prototype keeps only the file’s name, so nothing downloads.' : `${r.ext ?? 'File'} · ${formatBytes(r.bytes)}`}
                    </span>
                  </span>
                  <button type="button" className="cpl__download" onClick={() => setNoted(r.id)}>
                    <Download size={16} aria-hidden="true" /> Download<span className="sr-only"> {r.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}