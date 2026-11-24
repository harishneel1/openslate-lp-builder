import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, ChevronDown, ChevronLeft, ChevronRight, Download, ExternalLink, FileText, FolderOpen, Link2, Play } from 'lucide-react';
import {
  academyHome,
  coursePlayerPath,
  getCourse,
  onCoursesChange,
  readVideoLink,
  studentLessons,
  studentSections,
} from '../data/courses';
import { onProgressChange, progressOf, setDone, setLast } from '../data/courseProgress';
import { canSee, onStudentChange } from '../data/students';
import { fileById, formatBytes, onStorageChange } from '../data/cloudStorage';
import { TextView } from '../components/TextEditor';
import { KIND, KindTile, tileKindOf } from './lessonKinds';
import './AcademyCoursesPage.css';
import './CoursePlayerPage.css';

// ------------------------------------------------------------
// One course, as a student takes it: /web/courses/<course>/learn?lesson=…
// Opened from a course's card on the academy's Courses page, and by
// "See it as a student" on the coach's course page. In focus mode: only
// the course, nothing else of the academy.
//
//   ← Back          AI Engineering Accelerator          ▓▓▓▓░░░░ 1 of 4
//   ─────────────────────────────────────────────────────────────────────
//   INTRODUCTION                                 │ Course content
//   How servers work                             │ ──────────────────────────
//   ┌────────────────────────────────────────┐   │ Introduction            ⌃
//   │  the lesson: video, PDF or text        │   │ 1 of 2 done
//   └────────────────────────────────────────┘   │ ░ ✓  What is MCP?        ░
//   ‹ Previous                            Next › │ ▒ Introduction            ⌃ ▒
//                              Install the SDK  │ ▒ 1 / 2 · 12 min          ▒
//   About this lesson  (its description, if any) │ ✓ 1. What is MCP?
//   Resources          (its files, if any)       │   ▶ 4 min
//                                                │ ○ 2. How servers work (lit)
//                                                │   ≡ 8 min    [Resources ⌄]
//                                                │ ▒ Building your server    ⌄ ▒
//
// Lesson names in the contents wrap to two lines; the course's name and
// the next lesson's name under Next keep to one. Any name cut short ends
// in "…", with the whole name in a tooltip (OverflowTip).
//
// The bar: Back (to the academy's Courses page), the course's name, and
// how much of it is done: a thin bar and "1 of 4". That's the only count
// on the page.
//
// The contents: down the right, the window's full height, scrolling on
// its own (the lesson scrolls on its own too). Each section a full-width
// row on light grey: its name in bold (wrapping, never cut), under it how
// many of its lessons are done and how long it is ("1 / 4 · 30 min"), and
// an arrow: the whole row folds it open or shut. Only the section they're
// in starts open; moving into another section opens that one too. An
// open section's lessons sit under it on white, a row each: a circle
// they can tick to mark it done (or untick), orange once done; then
// "5. Its name", wrapping to two lines; and under that its kind's icon
// and its length (lessonMinutes), or the kind's name when the length
// isn't known. A lesson with files has a small outlined "Resources ⌄"
// on the right, opening the list of its files to download. Lessons are
// numbered through the whole course. The open lesson is lit in orange,
// and kept in view. Students see sections by name only, and only
// lessons with something in them (studentSections).
//
// The lesson: its section and title, then the lesson itself:
//   Embedded video  the YouTube or Vimeo player
//   Video           a player (in the prototype, a stand-in: no files kept)
//   PDF             the file, to read and download (a stand-in for now)
//   Text            the text
// Under it, one row: ‹ Previous on the left, and the way forward on the
// right: Next › (plain text like Previous, only its arrow orange), the
// next lesson's name under it in small grey; or on the last lesson Finish
// course ✓, then "You've finished this course" once every lesson is done.
// Then, only when there's something: About this lesson (its description;
// a Text lesson never has one) and Resources (its files to download).
//
// Done: a lesson counts as done when they move on from it to a later one
// (Next, or a later lesson in the list), and the last one with Finish
// course. Going back changes nothing. They can also tick or untick any
// lesson's circle in the contents.
// Progress is each student's own (courseProgress.js).
//
// Where they are: ?lesson= in the address, so a lesson's link opens it,
// and Back and Forward move between lessons. With none, the course opens
// where they left off (the last lesson they opened), else at the first
// lesson not done.
//
// Phones and narrow windows: one column, the lesson first and the
// contents under it; the page scrolls as one.
//
// Only a course the student can see opens here (students.js): published,
// and on a contract they've signed up for. Any other link says the page
// isn't available, without saying what's there. Except with &preview=1:
// the coach's See it as a student, which opens drafts too and looks
// exactly as students see it (no strip, no labels). Its progress is kept
// apart from any student's ('preview'). The flag stays in the address as
// they move between lessons.
//
// courseId
// student: who's signed in (null while previewing)
// preview: the coach's See it as a student
// ------------------------------------------------------------

const lessonFromAddress = () => new URLSearchParams(window.location.search).get('lesson');

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
  const mainRef = useRef(null);

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

  // The address and "where they left off" follow the lesson open; a new
  // lesson starts at its top
  useEffect(() => {
    if (!currentId) return;
    if (lessonFromAddress() !== currentId) window.history.replaceState(null, '', coursePlayerPath(courseId, currentId, preview));
    setLast(who, courseId, currentId);
    mainRef.current?.scrollTo?.({ top: 0 });
    window.scrollTo?.({ top: 0 });
  }, [courseId, currentId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    document.title = current ? `${current.lesson.title} - ${course.title}` : course?.title ?? 'Course';
  }, [current?.lesson.title, course?.title]); // eslint-disable-line react-hooks/exhaustive-deps

  // Opens another lesson. Moving on to a later one counts this one as done.
  const go = (lessonId) => {
    if (lessonId === currentId) return;
    const to = lessons.findIndex((x) => x.lesson.id === lessonId);
    if (current && to > index) setDone(who, courseId, current.lesson.id, true);
    window.history.pushState(null, '', coursePlayerPath(courseId, lessonId, preview));
    setAsked(lessonId);
  };

  const doneCount = lessons.filter((x) => progress.done.has(x.lesson.id)).length;

  if (!course || lessons.length === 0) {
    return (
      <div className="acd cpl">
        <Bar home={home} title={course?.title ?? ''} />
        <OverflowTip />
        <main className="cpl__empty">
          <h1 className="acd__empty-title">{course ? course.title : 'This page isn’t available'}</h1>
          <p className="acd__empty-text">
            {course ? 'There are no lessons in this course yet. Check back soon.' : 'Check the link, or go back to your courses.'}
          </p>
        </main>
      </div>
    );
  }

  const allDone = doneCount === lessons.length;
  const link = (lesson) => ({
    href: coursePlayerPath(courseId, lesson.id, preview),
    onClick: (e) => {
      e.preventDefault();
      go(lesson.id);
    },
  });

  return (
    <div className="acd cpl">
      <Bar home={home} title={course.title} done={doneCount} total={lessons.length} />
      <OverflowTip />

      <div className="cpl__layout">
        <main className="cpl__main" ref={mainRef}>
          <div className="cpl__inner">
            <p className="cpl__eyebrow">{current.section.title}</p>
            <h1 className="cpl__title">{current.lesson.title}</h1>

            <LessonBody key={current.lesson.id} lesson={current.lesson} />

            {/* One row: back on the left, the way forward on the right */}
            <nav className="cpl__nav" aria-label="Lessons">
              {prev ? (
                <a className="cpl__prev" {...link(prev.lesson)}>
                  <ChevronLeft size={18} aria-hidden="true" />
                  Previous
                  <span className="sr-only">: {prev.lesson.title}</span>
                </a>
              ) : (
                <span aria-hidden="true" />
              )}

              {next ? (
                <a className="cpl__next" {...link(next.lesson)}>
                  <span className="cpl__next-label">
                    Next
                    <ChevronRight size={18} strokeWidth={2.5} className="cpl__next-arrow" aria-hidden="true" />
                  </span>
                  <span className="cpl__next-title" data-full={next.lesson.title}>
                    <span className="sr-only">: </span>
                    {next.lesson.title}
                  </span>
                </a>
              ) : allDone ? (
                <p className="cpl__finished" role="status">
                  <Check size={17} strokeWidth={3} aria-hidden="true" />
                  You’ve finished this course.
                  <a className="cpl__finished-link" href={home}>
                    Back to courses
                  </a>
                </p>
              ) : (
                <button type="button" className="cpl__next" onClick={() => setDone(who, courseId, current.lesson.id, true)}>
                  <span className="cpl__next-label">
                    Finish course
                    <Check size={18} strokeWidth={3} className="cpl__next-arrow" aria-hidden="true" />
                  </span>
                </button>
              )}
            </nav>

            <LessonMore key={`more-${current.lesson.id}`} lesson={current.lesson} />
          </div>
        </main>

        <Contents
          sections={sections}
          done={progress.done}
          currentId={currentId}
          currentSectionId={current.section.id}
          link={link}
          onTick={(lessonId, isDone) => setDone(who, courseId, lessonId, isDone)}
        />
      </div>
    </div>
  );
}

// ---------- Names cut short: the whole name in a tooltip ----------
// The course's name in the bar and the next lesson's name under Next keep
// to one line, lesson names in the contents to two, ending in "…" when
// there isn't room. Pointing
// at one that's cut short (or tabbing to it) shows the whole name above
// it, in our dark tooltip (tooltip.css, .tip). Names that fit show none.
// The tooltip floats over the page, so the scrolling contents can't clip
// it; it goes below instead when there's no room above. Screen readers
// already get the whole name, so it's hidden from them.
// Each such name carries data-full (the whole name).
function OverflowTip() {
  const [tip, setTip] = useState(null); // { text, x, y, below }
  useEffect(() => {
    const nameIn = (target) => {
      if (!(target instanceof Element)) return null;
      const own = target.closest('[data-full]');
      if (own) return own;
      return target.closest('a, button, .cpl__bar-title')?.querySelector('[data-full]') ?? null;
    };
    const show = (e) => {
      const el = nameIn(e.target);
      if (!el || (el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1)) {
        setTip(null);
        return;
      }
      const box = el.getBoundingClientRect();
      const below = box.top < 64;
      setTip({
        text: el.dataset.full,
        x: Math.min(Math.max(box.left + box.width / 2, 150), window.innerWidth - 150),
        y: below ? box.bottom + 8 : box.top - 8,
        below,
      });
    };
    const hide = () => setTip(null);
    document.addEventListener('pointerover', show);
    document.addEventListener('focusin', show);
    document.addEventListener('focusout', hide);
    document.addEventListener('scroll', hide, true);
    window.addEventListener('blur', hide);
    return () => {
      document.removeEventListener('pointerover', show);
      document.removeEventListener('focusin', show);
      document.removeEventListener('focusout', hide);
      document.removeEventListener('scroll', hide, true);
      window.removeEventListener('blur', hide);
    };
  }, []);

  if (!tip) return null;
  return (
    <span
      className={`tip cpl__tip ${tip.below ? 'cpl__tip--below' : ''}`}
      style={{ left: tip.x, top: tip.y }}
      aria-hidden="true"
    >
      {tip.text}
    </span>
  );
}

// ---------- The bar: Back, the course, how much is done ----------
function Bar({ home, title, done = 0, total = 0 }) {
  return (
    <header className="cpl__bar">
      <a className="cpl__back" href={home}>
        <ArrowLeft size={17} aria-hidden="true" /> Back
      </a>
      <p className="cpl__bar-title" data-full={title}>
        {title}
      </p>
      {total > 0 ? (
        <div className="cpl__progress">
          <span
            className="cpl__progress-track"
            role="progressbar"
            aria-label="Course progress"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={done}
            aria-valuetext={`${done} of ${total} lessons done`}
          >
            <span className="cpl__progress-fill" style={{ width: `${(done / total) * 100}%` }} />
          </span>
          <span className="cpl__progress-text" aria-hidden="true">
            {done} of {total}
          </span>
        </div>
      ) : (
        <span aria-hidden="true" />
      )}
    </header>
  );
}

// ---------- How long a lesson is ----------
// In minutes, or null when it isn't known: a video's length when Cloud
// Storage knows it, a text's reading time (about 200 words a minute).
// PDFs, links and embedded videos have none; their row shows the kind.
const WORDS_PER_MINUTE = 200;

function lessonMinutes(lesson) {
  const c = lesson.content;
  if (c.kind === 'video') {
    const ms = fileById(c.fileId)?.duration;
    return Number.isFinite(ms) && ms > 0 ? Math.max(1, Math.round(ms / 60000)) : null;
  }
  if (c.kind === 'text') {
    const words = String(c.html)
      .replace(/<[^>]*>/g, ' ')
      .replace(/&[a-z#0-9]+;/gi, ' ')
      .split(/\s+/)
      .filter(Boolean).length;
    return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
  }
  return null;
}

// "8 min", "1 hr 7 min", "2 hr"
function formatMinutes(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

// ---------- The contents: sections that fold, a row for each lesson ----------
function Contents({ sections, done, currentId, currentSectionId, link, onTick }) {
  // Lengths come partly from Cloud Storage
  const [, setTick] = useState(0);
  useEffect(() => onStorageChange(() => setTick((n) => n + 1)), []);

  // Only the section they're in starts open; moving into another opens it too
  const [open, setOpen] = useState(() => new Set([currentSectionId]));
  useEffect(() => {
    setOpen((prev) => (prev.has(currentSectionId) ? prev : new Set([...prev, currentSectionId])));
  }, [currentSectionId]);

  // The open lesson stays in view in a long list
  const sideRef = useRef(null);
  useEffect(() => {
    sideRef.current?.querySelector('.cpl__lesson--on')?.scrollIntoView?.({ block: 'nearest' });
  }, [currentId, open]);

  // One lesson's Resources list open at a time
  const [filesOf, setFilesOf] = useState(null);

  const toggle = (id) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  let number = 0; // lessons are numbered through the whole course
  return (
    <nav className="cpl__side" aria-labelledby="cpl-side-title" ref={sideRef}>
      <h2 className="cpl__side-title" id="cpl-side-title">
        Course content
      </h2>
      {sections.map((section) => {
        const isOpen = open.has(section.id);
        const first = number;
        number += section.lessons.length;
        const sectionDone = section.lessons.filter((l) => done.has(l.id)).length;
        const minutes = section.lessons.reduce((n, l) => n + (lessonMinutes(l) ?? 0), 0);
        return (
          <section key={section.id} className={`cpl__section ${isOpen ? 'cpl__section--open' : ''}`}>
            <h3 className="cpl__section-head">
              <button
                type="button"
                className="cpl__section-btn"
                aria-expanded={isOpen}
                aria-controls={`cpl-sec-${section.id}`}
                onClick={() => toggle(section.id)}
              >
                <span className="cpl__section-text">
                  <span className="cpl__section-title">{section.title}</span>
                  <span className="cpl__section-count">
                    <span aria-hidden="true">
                      {sectionDone} / {section.lessons.length}
                      {minutes > 0 && ` · ${formatMinutes(minutes)}`}
                    </span>
                    <span className="sr-only">
                      {sectionDone} of {section.lessons.length} done
                      {minutes > 0 && `, ${formatMinutes(minutes)}`}
                    </span>
                  </span>
                </span>
                <ChevronDown size={20} className="cpl__chev" aria-hidden="true" />
              </button>
            </h3>
            {isOpen && (
              <ol className="cpl__lessons" id={`cpl-sec-${section.id}`}>
                {section.lessons.map((lesson, i) => (
                  <LessonRow
                    key={lesson.id}
                    lesson={lesson}
                    number={first + i + 1}
                    on={lesson.id === currentId}
                    isDone={done.has(lesson.id)}
                    link={link}
                    onTick={onTick}
                    filesOpen={filesOf === lesson.id}
                    setFilesOpen={(isOpen) => setFilesOf(isOpen ? lesson.id : null)}
                  />
                ))}
              </ol>
            )}
          </section>
        );
      })}
    </nav>
  );
}

// One lesson in the contents. The whole row opens it (the link stretches
// over it); the circle and Resources sit above the link, so they work on
// their own.
function LessonRow({ lesson, number, on, isDone, link, onTick, filesOpen, setFilesOpen }) {
  const kind = KIND[lesson.content.kind] ?? KIND.text;
  const KindIcon = kind.icon;
  const minutes = lessonMinutes(lesson);
  const files = lesson.resources.filter((r) => fileById(r.fileId)); // deleted ones aren't offered
  const menuId = `cpl-files-${lesson.id}`;

  return (
    <li className={`cpl__lesson ${on ? 'cpl__lesson--on' : ''} ${isDone ? 'cpl__lesson--done' : ''}`}>
      <button
        type="button"
        className="cpl__tick"
        role="checkbox"
        aria-checked={isDone}
        aria-label={`${lesson.title}: done`}
        title={isDone ? 'Mark as not done' : 'Mark as done'}
        onClick={() => onTick(lesson.id, !isDone)}
      >
        {isDone && <Check size={13} strokeWidth={3.25} aria-hidden="true" />}
      </button>

      <div className="cpl__lesson-body">
        <a className="cpl__lesson-link" aria-current={on ? 'page' : undefined} {...link(lesson)}>
          <span className="cpl__lesson-name" data-full={`${number}. ${lesson.title}`}>
            {number}. {lesson.title}
          </span>
          {isDone && <span className="sr-only">, done</span>}
        </a>

        <div className="cpl__lesson-meta">
          <span className="cpl__lesson-kind">
            <KindIcon size={14} aria-hidden="true" />
            {minutes ? formatMinutes(minutes) : kind.label}
          </span>
          {files.length > 0 && (
            <button
              type="button"
              className={`cpl__files-btn ${filesOpen ? 'cpl__files-btn--open' : ''}`}
              aria-expanded={filesOpen}
              aria-controls={menuId}
              onClick={() => setFilesOpen(!filesOpen)}
            >
              <FolderOpen size={14} aria-hidden="true" />
              Resources
              <ChevronDown size={14} className="cpl__files-chev" aria-hidden="true" />
              <span className="sr-only"> for {lesson.title}</span>
            </button>
          )}
        </div>

        {filesOpen && files.length > 0 && <FilesMenu id={menuId} files={files} onClose={() => setFilesOpen(false)} />}
      </div>
    </li>
  );
}

// A lesson's files, under its Resources button. Closes on Escape or a
// click anywhere else.
function FilesMenu({ id, files, onClose }) {
  const ref = useRef(null);
  const [noted, setNoted] = useState(null); // the file whose Download was pressed
  useEffect(() => {
    const away = (e) => {
      if (!ref.current?.contains(e.target) && !e.target.closest?.('.cpl__files-btn')) onClose();
    };
    const esc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [onClose]);

  return (
    <ul className="cpl__files" id={id} ref={ref}>
      {files.map((r) => (
        <li key={r.id}>
          <button type="button" className="cpl__file" onClick={() => setNoted(r.id)}>
            <Download size={15} className="cpl__file-icon" aria-hidden="true" />
            <span className="cpl__file-text">
              <span className="cpl__file-name">{r.name}</span>
              <span className="cpl__file-detail">
                {noted === r.id ? 'The prototype keeps only the file’s name, so nothing downloads.' : `${r.ext ?? 'File'} · ${formatBytes(r.bytes)}`}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
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

// ---------- About this lesson, Resources: only when there's something ----------
function LessonMore({ lesson }) {
  const [, setTick] = useState(0);
  useEffect(() => onStorageChange(() => setTick((n) => n + 1)), []);
  const [noted, setNoted] = useState(null); // the resource whose Download was pressed
  const hasDescription = Boolean(lesson.description) && lesson.content.kind !== 'text';
  const files = lesson.resources.filter((r) => fileById(r.fileId)); // deleted ones aren't offered
  if (!hasDescription && files.length === 0) return null;

  return (
    <div className="cpl__more">
      {hasDescription && (
        <section className="cpl__part" aria-labelledby="cpl-about">
          <h2 className="cpl__part-title" id="cpl-about">
            About this lesson
          </h2>
          <div className="cpl__description">
            <TextView html={lesson.description} />
          </div>
        </section>
      )}

      {files.length > 0 && (
        <section className="cpl__part" aria-labelledby="cpl-resources">
          <h2 className="cpl__part-title" id="cpl-resources">
            Resources
          </h2>
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
        </section>
      )}
    </div>
  );
}