import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Cloud, Pencil, Plus, Trash2, Upload, UploadCloud, X } from 'lucide-react';
import { addFile, assetsOf, fileById, formatBytes, onStorageChange, uniqueName, usageOf } from '../data/cloudStorage';
import { addResource, removeResource, updateLesson } from '../data/courses';
import ConfirmDialog from '../components/ConfirmDialog';
import TextEditor, { TextView } from '../components/TextEditor';
import CloudPicker from './CloudPicker';
import { KindTile, tileKindOf } from './lessonKinds';

// ------------------------------------------------------------
// Under an open lesson's main content (LessonPanel.jsx), as on TagMango:
// its description, and its resources.
//
//   Lesson description                                       (not for Text)
//   ┌──────────────────────────────────────────────────────────┐
//   │ A beginner-friendly introduction to…                     │
//   └──────────────────────────────────────────────────────────┘
//   [✎ Edit description] [🗑 Remove]       (or [+ Add a description])
//
//   Resources
//   Files students can download from this lesson.
//   [▤ PDF] Slides.pdf · 2.4 MB                                  🗑
//   [📎 ZIP] starter-code.zip · Uploading · 40%             [Cancel]
//   [⇪ Upload resources]
//
// Description: written in the text editor (TextEditor.jsx); optional.
// Students see it on the lesson's Description tab. A Text lesson has
// none: its content is already text.
//
// Upload resources: a pop-up with two choices, as TagMango's:
//   Upload from computer    any file, several at once. Each goes into
//                           Cloud Storage first (it shows there and counts
//                           towards the 20 GB), with its progress here,
//                           then joins the lesson's resources. Storage
//                           full, or a file too big for what's left, says
//                           so here.
//   Pick from Cloud Storage anything already there, several at once
//                           (CloudPicker, 'any', multiple). Files already
//                           on this lesson show as "Already added" there,
//                           so nothing is added twice. The ones picked
//                           join the resources in the order they were
//                           ticked.
// 🗑 takes a resource off the lesson; the file stays in Cloud Storage.
// One deleted from Cloud Storage says so, in red.
//
// course, lesson, onSaved(ok), onDirtyChange(dirty): unsaved description
// text, or a file still uploading
// ------------------------------------------------------------

// Made-up upload speed, as on Cloud Storage
const UPLOAD_BYTES_PER_SEC = 60 * 1024 * 1024;
const UPLOAD_MIN_MS = 1200;
const UPLOAD_MAX_MS = 8000;
const TICK_MS = 150;

export default function LessonExtras({ course, lesson, onSaved, onDirtyChange }) {
  const [descDirty, setDescDirty] = useState(false);
  const [uploads, setUploads] = useState([]); // [{ id, name, bytes, sent, rate }]

  // The page knows while anything here isn't saved yet
  const busy = descDirty || uploads.length > 0;
  useEffect(() => onDirtyChange(busy), [busy]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onDirtyChange(false), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="lx">
      {lesson.content?.kind !== 'text' && (
        <Description course={course} lesson={lesson} onSaved={onSaved} onDirtyChange={setDescDirty} />
      )}
      <Resources course={course} lesson={lesson} onSaved={onSaved} uploads={uploads} setUploads={setUploads} />
    </div>
  );
}

// ---------- Lesson description ----------
function Description({ course, lesson, onSaved, onDirtyChange }) {
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [discard, setDiscard] = useState(null);
  const html = lesson.description;

  const save = (next) => {
    const ok = Boolean(updateLesson(course.id, lesson.id, { description: next }));
    onSaved(ok);
    if (ok) setEditing(false);
    return ok;
  };

  return (
    <section className="lx__part" aria-labelledby={`lx-desc-${lesson.id}`}>
      <h3 className="lx__title" id={`lx-desc-${lesson.id}`}>
        Lesson description
      </h3>

      {editing ? (
        <TextEditor
          initialHtml={html}
          onSave={save}
          onCancel={() => setEditing(false)}
          onDirtyChange={onDirtyChange}
          onAskDiscard={(then) => setDiscard(() => then)}
        />
      ) : html ? (
        <>
          <div className="lp__text">
            <TextView html={html} />
          </div>
          <div className="lp__actions">
            <button type="button" className="crs-btn crs-btn--quiet crs-btn--small" onClick={() => setEditing(true)}>
              <Pencil size={15} aria-hidden="true" /> Edit description
            </button>
            <button type="button" className="crs-btn crs-btn--quiet crs-btn--small lp__remove" onClick={() => setRemoving(true)}>
              <Trash2 size={15} aria-hidden="true" /> Remove
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="lx__sub">Optional. What this lesson is about, shown to students under it.</p>
          <button type="button" className="crs-btn crs-btn--quiet crs-btn--small lx__add" onClick={() => setEditing(true)}>
            <Plus size={16} aria-hidden="true" /> Add a description
          </button>
        </>
      )}

      {removing && (
        <ConfirmDialog
          title="Remove the description?"
          confirmLabel="Remove"
          danger
          onCancel={() => setRemoving(false)}
          onConfirm={() => {
            setRemoving(false);
            save('');
          }}
        >
          <p>This lesson’s description will be deleted. This can’t be undone.</p>
        </ConfirmDialog>
      )}

      {discard && (
        <ConfirmDialog
          title="Discard your changes?"
          confirmLabel="Discard changes"
          cancelLabel="Keep editing"
          danger
          onCancel={() => setDiscard(null)}
          onConfirm={() => {
            const then = discard;
            setDiscard(null);
            then();
          }}
        >
          <p>What you’ve changed here won’t be saved.</p>
        </ConfirmDialog>
      )}
    </section>
  );
}

// ---------- Resources ----------
function Resources({ course, lesson, onSaved, uploads, setUploads }) {
  const [choosing, setChoosing] = useState(false); // the two-choice pop-up
  const [picking, setPicking] = useState(false); // Pick from Cloud Storage
  const [problems, setProblems] = useState([]);
  const [, setTick] = useState(0);
  const input = useRef(null);
  useEffect(() => onStorageChange(() => setTick((n) => n + 1)), []);

  const attach = (asset) => {
    const ok = Boolean(addResource(course.id, lesson.id, asset));
    onSaved(ok);
    return ok;
  };

  // Several picked from Cloud Storage, in the order they were ticked: one
  // "Saved" (or "Couldn't save") for them all
  const attachAll = (assets) => {
    let ok = true;
    assets.forEach((asset) => {
      if (!addResource(course.id, lesson.id, asset)) ok = false;
    });
    onSaved(ok);
  };

  // Files from the computer: each checked against what's left, then uploaded
  const start = (files) => {
    const list = Array.from(files ?? []);
    if (list.length === 0) return;
    const usage = usageOf(assetsOf());
    if (usage.level === 'full') {
      setProblems(['Your Cloud Storage is full, so nothing more can be uploaded. You can free up space in Cloud Storage.']);
      return;
    }
    let room = usage.left - uploads.reduce((sum, u) => sum + (u.bytes - u.sent), 0);
    const taken = uploads.map((u) => u.name);
    const started = [];
    const notes = [];
    list.forEach((file) => {
      if (file.size > room) {
        notes.push(`“${file.name}” is ${formatBytes(file.size)}, and you have ${formatBytes(Math.max(0, room))} left in Cloud Storage.`);
        return;
      }
      room -= file.size;
      const name = uniqueName(file.name, taken);
      taken.push(name);
      const ms = Math.min(UPLOAD_MAX_MS, Math.max(UPLOAD_MIN_MS, (file.size / UPLOAD_BYTES_PER_SEC) * 1000));
      started.push({ id: `up-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name, bytes: file.size, sent: 0, rate: Math.max(1, file.size) / ms });
    });
    setProblems(notes);
    if (started.length) setUploads((prev) => [...prev, ...started]);
  };

  // Moves uploads on; finished ones are stored and join the lesson
  const going = uploads.length > 0;
  useEffect(() => {
    if (!going) return undefined;
    const id = setInterval(() => setUploads((prev) => prev.map((u) => ({ ...u, sent: Math.min(u.bytes, u.sent + u.rate * TICK_MS) }))), TICK_MS);
    return () => clearInterval(id);
  }, [going]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const done = uploads.filter((u) => u.sent >= u.bytes);
    if (done.length === 0) return;
    done.forEach((u) => {
      const asset = addFile({ name: u.name, bytes: u.bytes });
      if (asset) attach(asset);
      else onSaved(false);
    });
    setUploads((prev) => prev.filter((u) => u.sent < u.bytes));
  }, [uploads]); // eslint-disable-line react-hooks/exhaustive-deps

  const resources = lesson.resources;

  return (
    <section className="lx__part" aria-labelledby={`lx-res-${lesson.id}`}>
      <h3 className="lx__title" id={`lx-res-${lesson.id}`}>
        Resources
      </h3>
      <p className="lx__sub">Files students can download from this lesson: slides, worksheets, code, anything.</p>

      {(resources.length > 0 || uploads.length > 0) && (
        <ul className="lx__list">
          {resources.map((r) => {
            const missing = !fileById(r.fileId);
            return (
              <li key={r.id} className={`lx__row ${missing ? 'lx__row--missing' : ''}`}>
                <KindTile kind={tileKindOf(r)} size="small" />
                <span className="lp__file-text">
                  <span className="lp__file-name">{r.name}</span>
                  <span className="lp__file-detail">
                    {missing ? 'Deleted from your Cloud Storage, so students can’t download it.' : `${r.ext ?? 'File'} · ${formatBytes(r.bytes)}`}
                  </span>
                </span>
                {missing && <AlertTriangle size={17} className="lp__missing-icon" aria-hidden="true" />}
                <button
                  type="button"
                  className="ilt__tool ilt__tool--delete"
                  title="Remove from this lesson"
                  aria-label={`Remove ${r.name} from this lesson`}
                  onClick={() => onSaved(Boolean(removeResource(course.id, lesson.id, r.id)))}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </li>
            );
          })}
          {uploads.map((u) => {
            const pct = Math.floor((u.sent / Math.max(1, u.bytes)) * 100);
            return (
              <li key={u.id} className="lx__row">
                <KindTile kind="file" size="small" />
                <span className="lp__file-text">
                  <span className="lp__file-name">{u.name}</span>
                  <span className="lp__file-detail">
                    Uploading to Cloud Storage · {pct}% · {formatBytes(u.sent)} of {formatBytes(u.bytes)}
                  </span>
                  <span className="lp__bar" role="progressbar" aria-label={`Uploading ${u.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                    <span className="lx__bar-fill" style={{ width: `${pct}%` }} />
                  </span>
                </span>
                <button
                  type="button"
                  className="crs-btn crs-btn--quiet crs-btn--small"
                  onClick={() => setUploads((prev) => prev.filter((x) => x.id !== u.id))}
                >
                  Cancel<span className="sr-only"> uploading {u.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {problems.length > 0 && (
        <div className="lp__problem" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>
            {problems.map((p) => (
              <span key={p} className="lx__problem-line">
                {p}
              </span>
            ))}
          </span>
        </div>
      )}

      <button type="button" className="crs-btn crs-btn--quiet crs-btn--small lx__add" onClick={() => setChoosing(true)}>
        <Upload size={16} aria-hidden="true" /> Upload resources
      </button>

      <input
        ref={input}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          start(e.target.files);
          e.target.value = '';
        }}
      />

      {choosing && (
        <UploadChoice
          onCancel={() => setChoosing(false)}
          onComputer={() => {
            setChoosing(false);
            setProblems([]);
            input.current?.click();
          }}
          onCloud={() => {
            setChoosing(false);
            setProblems([]);
            setPicking(true);
          }}
        />
      )}

      {picking && (
        <CloudPicker
          only="any"
          multiple
          taken={resources.map((r) => r.fileId)}
          onCancel={() => setPicking(false)}
          onPick={(assets) => {
            setPicking(false);
            attachAll(assets);
          }}
        />
      )}
    </section>
  );
}

// "Upload resources": two big choices, as TagMango's pop-up
function UploadChoice({ onCancel, onComputer, onCloud }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.open && dialog.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className="crs-dialog lx__dialog"
      aria-labelledby="lx-upload-title"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      onClick={(e) => e.target === ref.current && onCancel()}
    >
      <div className="crs-dialog__top">
        <h2 className="crs-dialog__title" id="lx-upload-title">
          Upload resources
        </h2>
        <button type="button" className="crs-dialog__close" onClick={onCancel} aria-label="Close">
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <div className="crs-dialog__body">
        <div className="lx__choices">
          <button type="button" className="lx__choice" onClick={onComputer}>
            <UploadCloud size={32} aria-hidden="true" />
            <span className="lx__choice-label">Upload from computer</span>
            <span className="lx__choice-sub">Any file, several at once. It’s kept in your Cloud Storage too.</span>
          </button>
          <button type="button" className="lx__choice" onClick={onCloud}>
            <Cloud size={32} aria-hidden="true" />
            <span className="lx__choice-label">Pick from Cloud Storage</span>
            <span className="lx__choice-sub">Files you’ve already uploaded. Pick several at once.</span>
          </button>
        </div>
      </div>
    </dialog>
  );
}