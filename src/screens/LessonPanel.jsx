import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, ExternalLink, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { assetsOf, addFile, fileById, formatBytes, formatOf, onStorageChange, uniqueName, usageOf } from '../data/cloudStorage';
import { lessonKindOfFile, readLink, readVideoLink, updateLesson, LINK_MAX } from '../data/courses';
import ConfirmDialog from '../components/ConfirmDialog';
import TextEditor, { TextView } from '../components/TextEditor';
import CloudPicker from './CloudPicker';
import LessonExtras from './LessonExtras';
import { KIND, KindTile } from './lessonKinds';

// ------------------------------------------------------------
// An open lesson, under its bar on the course's Content tab
// (CourseContent.jsx). As on TagMango: a lesson has one main type of
// content, picked here, and added right here, never on another page.
//
// Nothing in it yet: what goes in it, as tiles in TagMango's order, Text
// set apart at the end. Each has its name on it, and a line on hover
// (data-tip, tooltip.css) saying what it's for.
//
//   What goes in this lesson? Pick one.
//   [☁ Cloud Storage] [▶ Upload video] [📄 PDF] [📺 Embedded video] │ [¶ Text]
//
// Kept to these on purpose: bare bones for now (no audio, no images).
//
// Cloud Storage   a pop-up of the videos and PDFs already there (CloudPicker.jsx)
// Upload video, PDF
//                 the computer's file picker, for that kind only. The file
//                 goes into Cloud Storage first (so it shows there and
//                 counts towards the 20 GB), with its progress here, then
//                 becomes the lesson's. Storage full, or a file too big for
//                 what's left, says so here instead.
// Embedded video  a YouTube or Vimeo link (readVideoLink), checked as
//                 it's pasted
// Text            the text editor (TextEditor.jsx)
//
// With something in it: a preview, then what can be done with it.
//   Text            the text as students read it   [Edit text] [Remove]
//   Embedded video  the video's player             [Change video] [Remove]
//   Video           a player                       [Replace] [Remove]
//   PDF             the file                       [Replace] [Remove]
// Replace shows the tiles again (Cancel keeps what's there). Remove asks
// first; a file stays in Cloud Storage.
// Under what's in it: the lesson's description and resources
// (LessonExtras.jsx).
// The prototype keeps no files, only their names: a file picked from the
// computer plays for as long as this tab is open (previews, below); after
// that, or for one picked from Cloud Storage, the preview says so.
// A file deleted from Cloud Storage: the lesson says so, with Replace.
//
// course, lesson (with its content)
// onSaved(ok): after a change, so the page can say "Saved" or that it failed
// onDirtyChange(dirty): there are (or no longer are) unsaved changes here,
//   an upload under way included
// ------------------------------------------------------------

// The tiles, in TagMango's order. accept/type: what the computer's file
// picker offers, and what kind of file it has to be.
const CHOICES = [
  { id: 'cloud', tip: 'You can pick a video or PDF you’ve already uploaded to your Cloud Storage.' },
  { id: 'video', label: 'Upload video', accept: '.mp4,.mov', type: 'video', formats: 'an MP4 or MOV', tip: 'You can upload a video from your computer.' },
  { id: 'pdf', accept: '.pdf', type: 'document', formats: 'a PDF', tip: 'You can add a PDF that students read here and download.' },
  { id: 'embed', tip: 'Got a video on YouTube or Vimeo? You can paste its link here, and it plays right inside the lesson.' },
  { id: 'text', tip: 'You can write the lesson here, with headings, lists and links.', apart: true },
];
const labelOf = (choice) => choice.label ?? KIND[choice.id].label;
const tipAlign = (i) => (i === 0 ? 'start' : i === CHOICES.length - 1 ? 'end' : undefined);

// Files picked from the computer this visit, so they can play here: the
// prototype doesn't keep files, only their names. Asset id → object URL.
const previews = new Map();

// Made-up upload speed, as on Cloud Storage: about 60 MB a second, never
// under 1.5 seconds or over 8 for one file
const UPLOAD_BYTES_PER_SEC = 60 * 1024 * 1024;
const UPLOAD_MIN_MS = 1500;
const UPLOAD_MAX_MS = 8000;
const TICK_MS = 150;

const PROVIDER = { youtube: 'YouTube', vimeo: 'Vimeo' };

export default function LessonPanel({ course, lesson, onSaved, onDirtyChange }) {
  const content = lesson.content;
  const [mode, setMode] = useState(content ? 'view' : 'pick'); // 'pick' | 'view' | 'text' | 'embed' | 'uploading'
  const [problem, setProblem] = useState(null); // why a file couldn't be added
  const [upload, setUpload] = useState(null); // { name, bytes, sent, rate, choice, file }
  const [cloud, setCloud] = useState(false); // the Cloud Storage pop-up
  const [removing, setRemoving] = useState(false);
  const [discard, setDiscard] = useState(null); // what to do once they agree to lose their changes
  const picker = useRef(null);
  const pending = useRef(null); // the tile whose file picker is open

  // Emptied or filled from elsewhere (another tab): show what's there now
  useEffect(() => {
    if (mode === 'view' && !content) setMode('pick');
    if (mode === 'pick' && content && !problem) setMode('view');
  }, [content]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = (next) => {
    const ok = Boolean(updateLesson(course.id, lesson.id, { content: next }));
    onSaved(ok);
    if (ok) setMode(next ? 'view' : 'pick');
    return ok;
  };

  const back = () => {
    setProblem(null);
    setMode(content ? 'view' : 'pick');
  };

  // A file from Cloud Storage (picked there, or just uploaded) becomes the lesson's
  const attachFile = (asset) =>
    save({ kind: lessonKindOfFile(asset), fileId: asset.id, name: asset.name, ext: asset.ext, bytes: asset.bytes });

  // ---------- Uploading ----------
  const choose = (choice) => {
    setProblem(null);
    if (choice.id === 'cloud') setCloud(true);
    else if (choice.id === 'text' || choice.id === 'embed') setMode(choice.id);
    else {
      pending.current = choice;
      picker.current.accept = choice.accept;
      picker.current.click();
    }
  };

  const startUpload = (file) => {
    const choice = pending.current;
    if (!file || !choice) return;
    const format = formatOf(file.name);
    if (!format || format.type !== choice.type || (choice.id === 'pdf' && format.ext !== 'PDF')) {
      setProblem(`“${file.name}” isn’t ${choice.formats} file. You can pick ${choice.formats} file instead.`);
      return;
    }
    const usage = usageOf(assetsOf());
    if (usage.level === 'full') {
      setProblem('Your Cloud Storage is full, so nothing more can be uploaded. You can free up space in Cloud Storage.');
      return;
    }
    if (file.size > usage.left) {
      setProblem(`“${file.name}” is ${formatBytes(file.size)}, and you have ${formatBytes(usage.left)} left in Cloud Storage.`);
      return;
    }
    const ms = Math.min(UPLOAD_MAX_MS, Math.max(UPLOAD_MIN_MS, (file.size / UPLOAD_BYTES_PER_SEC) * 1000));
    setUpload({ name: uniqueName(file.name), bytes: file.size, sent: 0, rate: Math.max(1, file.size) / ms, choice, file });
    setMode('uploading');
  };

  // Moves the upload on; once it's all there, it's stored and becomes the lesson's
  const uploading = mode === 'uploading' && upload;
  useEffect(() => {
    if (!uploading) return undefined;
    onDirtyChange(true);
    const id = setInterval(() => {
      setUpload((u) => (u ? { ...u, sent: Math.min(u.bytes, u.sent + u.rate * TICK_MS) } : u));
    }, TICK_MS);
    return () => {
      clearInterval(id);
      onDirtyChange(false);
    };
  }, [Boolean(uploading)]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!upload || upload.sent < upload.bytes) return;
    const { name, bytes, file } = upload;
    setUpload(null);
    const asset = addFile({ name, bytes });
    if (!asset) {
      setProblem('We couldn’t upload that just now. Try again.');
      setMode('pick');
      return;
    }
    previews.set(asset.id, URL.createObjectURL(file));
    if (!attachFile(asset)) setMode('pick');
  }, [upload]); // eslint-disable-line react-hooks/exhaustive-deps

  const cancelUpload = () => {
    setUpload(null);
    back();
  };

  return (
    <div className="lp">
      <input
        ref={picker}
        type="file"
        hidden
        onChange={(e) => {
          startUpload(e.target.files?.[0]);
          e.target.value = ''; // so picking the same file again still works
        }}
      />

      {mode === 'pick' && (
        <div className="lp__pick">
          <div className="lp__pick-head">
            <p className="lp__pick-title">{content ? 'What should replace it? Pick one.' : 'What goes in this lesson? Pick one.'}</p>
            {content && (
              <button type="button" className="crs-btn crs-btn--quiet crs-btn--small" onClick={back}>
                Cancel
              </button>
            )}
          </div>
          <div className="lp__tiles">
            {CHOICES.map((choice, i) => (
              <span key={choice.id} className={`lp__tile-wrap ${choice.apart ? 'lp__tile-wrap--apart' : ''}`} data-tip={choice.tip} data-tip-align={tipAlign(i)}>
                <button type="button" className="lp__choice" onClick={() => choose(choice)} aria-describedby={`lp-tip-${choice.id}`}>
                  <KindTile kind={choice.id} size="big" />
                  <span className="lp__choice-label">{labelOf(choice)}</span>
                </button>
                <span className="sr-only" id={`lp-tip-${choice.id}`}>
                  {choice.tip}
                </span>
              </span>
            ))}
          </div>
          {problem && (
            <p className="lp__problem" role="alert">
              <AlertTriangle size={16} aria-hidden="true" /> {problem}
            </p>
          )}
        </div>
      )}

      {mode === 'uploading' && upload && <Uploading upload={upload} onCancel={cancelUpload} />}

      {mode === 'text' && (
        <TextEditor
          initialHtml={content?.kind === 'text' ? content.html : ''}
          onSave={(html) => save({ kind: 'text', html })}
          onCancel={back}
          onDirtyChange={onDirtyChange}
          onAskDiscard={(then) => setDiscard(() => then)}
        />
      )}

      {mode === 'embed' && (
        <EmbedForm
          initial={content?.kind === 'embed' ? content.url : ''}
          onSave={(url) => save({ kind: 'embed', url })}
          onCancel={back}
          onDirtyChange={onDirtyChange}
          onAskDiscard={(then) => setDiscard(() => then)}
        />
      )}

      {mode === 'view' && content && (
        <>
          <Filled
            content={content}
            onEdit={() => setMode(content.kind === 'text' ? 'text' : content.kind === 'embed' ? 'embed' : 'pick')}
            onReplace={() => setMode('pick')}
            onRemove={() => setRemoving(true)}
          />
          {/* Under it: its description and resources, as on TagMango */}
          <LessonExtras course={course} lesson={lesson} onSaved={onSaved} onDirtyChange={onDirtyChange} />
        </>
      )}

      {cloud && (
        <CloudPicker
          onCancel={() => setCloud(false)}
          onPick={(asset) => {
            setCloud(false);
            attachFile(asset);
          }}
        />
      )}

      {removing && content && (
        <ConfirmDialog
          title={`Remove the ${content.kind === 'text' ? 'text' : KIND[content.kind].label.toLowerCase()}?`}
          confirmLabel="Remove"
          danger
          onCancel={() => setRemoving(false)}
          onConfirm={() => {
            setRemoving(false);
            save(null);
          }}
        >
          <p>
            {content.kind === 'text'
              ? 'The text in this lesson will be deleted. You can then add something else. This can’t be undone.'
              : content.fileId
                ? 'It comes off this lesson, and stays in your Cloud Storage. You can then add something else.'
                : 'It comes off this lesson. You can then add something else.'}
          </p>
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
    </div>
  );
}

// A file on its way to Cloud Storage: its tile, name, how far along, Cancel
function Uploading({ upload, onCancel }) {
  const pct = Math.floor((upload.sent / Math.max(1, upload.bytes)) * 100);
  const kind = upload.choice.id;
  return (
    <div className="lp__file lp__file--uploading">
      <KindTile kind={kind} size="small" />
      <span className="lp__file-text">
        <span className="lp__file-name">{upload.name}</span>
        <span className="lp__file-detail">
          Uploading to Cloud Storage · {pct}% · {formatBytes(upload.sent)} of {formatBytes(upload.bytes)}
        </span>
        <span className="lp__bar" role="progressbar" aria-label={`Uploading ${upload.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <span className={`cct__tile--${kind}`} style={{ width: `${pct}%` }} />
        </span>
      </span>
      <button type="button" className="crs-btn crs-btn--quiet crs-btn--small" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

// What's in the lesson: a preview, then its buttons
function Filled({ content, onEdit, onReplace, onRemove }) {
  const [, setTick] = useState(0);
  useEffect(() => (content.fileId ? onStorageChange(() => setTick((n) => n + 1)) : undefined), [content.fileId]);
  const missing = content.fileId && !fileById(content.fileId);
  const src = content.fileId ? previews.get(content.fileId) : null;

  const removeButton = (
    <button type="button" className="crs-btn crs-btn--quiet crs-btn--small lp__remove" onClick={onRemove}>
      <Trash2 size={15} aria-hidden="true" /> Remove
    </button>
  );

  if (content.kind === 'text') {
    return (
      <div className="lp__has">
        <div className="lp__text">
          <TextView html={content.html} />
        </div>
        <div className="lp__actions">
          <button type="button" className="crs-btn crs-btn--quiet crs-btn--small" onClick={onEdit}>
            <Pencil size={15} aria-hidden="true" /> Edit text
          </button>
          {removeButton}
        </div>
      </div>
    );
  }

  if (content.kind === 'embed') {
    const video = readVideoLink(content.url);
    return (
      <div className="lp__has">
        <div className="lp__frame">
          <iframe
            src={video.embedUrl}
            title={`${PROVIDER[video.provider]} video`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
        <p className="lp__caption">
          <KindTile kind="embed" size="small" />
          <span>
            <strong>{PROVIDER[video.provider]} video</strong> ·{' '}
            <a href={content.url} target="_blank" rel="noopener noreferrer">
              {content.url}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </span>
        </p>
        <div className="lp__actions">
          <button type="button" className="crs-btn crs-btn--quiet crs-btn--small" onClick={onEdit}>
            <Pencil size={15} aria-hidden="true" /> Change video
          </button>
          {removeButton}
        </div>
      </div>
    );
  }

  if (content.kind === 'link') {
    return (
      <div className="lp__has">
        <div className="lp__file">
          <KindTile kind="link" size="small" />
          <span className="lp__file-text">
            <span className="lp__file-name">{content.url}</span>
            <span className="lp__file-detail">A link saved before embedded videos. You can replace it with a video.</span>
          </span>
          <a className="crs-btn crs-btn--quiet crs-btn--small" href={content.url} target="_blank" rel="noopener noreferrer">
            Open <ExternalLink size={15} aria-hidden="true" />
          </a>
        </div>
        <div className="lp__actions">
          <button type="button" className="crs-btn crs-btn--quiet crs-btn--small" onClick={onReplace}>
            <RefreshCw size={15} aria-hidden="true" /> Replace
          </button>
          {removeButton}
        </div>
      </div>
    );
  }

  // A file from Cloud Storage: a video or a PDF
  return (
    <div className="lp__has">
      {!missing && content.kind === 'video' && (src ? <video className="lp__media" src={src} controls /> : <NoPreview kind="video" />)}

      <div className={`lp__file ${missing ? 'lp__file--missing' : ''}`}>
        <KindTile kind={content.kind} size="small" />
        <span className="lp__file-text">
          <span className="lp__file-name">{content.name}</span>
          <span className="lp__file-detail">
            {missing
              ? 'This was deleted from your Cloud Storage, so students can’t see it. You can replace it.'
              : `${KIND[content.kind].label}${content.kind === 'video' && content.ext ? ` · ${content.ext}` : ''} · ${formatBytes(content.bytes)} · In your Cloud Storage`}
          </span>
        </span>
        {missing && <AlertTriangle size={18} className="lp__missing-icon" aria-hidden="true" />}
      </div>

      <div className="lp__actions">
        <button type="button" className="crs-btn crs-btn--quiet crs-btn--small" onClick={onReplace}>
          <RefreshCw size={15} aria-hidden="true" /> Replace
        </button>
        {removeButton}
      </div>
    </div>
  );
}

// Where the player would be, when the prototype has no file to show
function NoPreview({ kind }) {
  return (
    <div className={`lp__no-preview lp__no-preview--${kind}`}>
      <KindTile kind={kind} size="small" />
      <span>The prototype keeps only the file’s name, so there’s no preview here. Students will see it in the lesson.</span>
    </div>
  );
}

// Embedded video: one box for a YouTube or Vimeo link, checked as it's pasted
function EmbedForm({ initial, onSave, onCancel, onDirtyChange, onAskDiscard }) {
  const [text, setText] = useState(initial);
  const [tried, setTried] = useState(false);
  const dirty = text.trim() !== initial;
  const video = readVideoLink(text);

  useEffect(() => onDirtyChange(dirty), [dirty]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onDirtyChange(false), []); // eslint-disable-line react-hooks/exhaustive-deps

  const error = !video && (tried || (text.trim() && readLink(text)))
    ? readLink(text)
      ? 'This only works with YouTube or Vimeo links for now.'
      : 'That doesn’t look like a link. You can copy it from the address bar, or the Share button on the video.'
    : null;

  const submit = (e) => {
    e.preventDefault();
    setTried(true);
    if (video) onSave(video.url);
  };

  return (
    <form className="lp__form" onSubmit={submit} noValidate>
      <label className="crs-field__label" htmlFor="lp-video">
        Video link
      </label>
      <p className="crs-field__help" id="lp-video-help">
        You can paste a link from YouTube or Vimeo, like youtube.com/watch?v=… or vimeo.com/123456.
      </p>
      <input
        id="lp-video"
        className="crs-input"
        type="url"
        inputMode="url"
        value={text}
        maxLength={LINK_MAX}
        placeholder="https://youtube.com/watch?v=…"
        autoComplete="off"
        autoFocus // eslint-disable-line jsx-a11y/no-autofocus
        aria-describedby="lp-video-help lp-video-said"
        aria-invalid={Boolean(error) || undefined}
        onChange={(e) => {
          setText(e.target.value);
          setTried(false);
        }}
      />
      <p id="lp-video-said" className={video ? 'lp__ok' : 'lp__error'} aria-live="polite">
        {video ? (
          <>
            <Check size={15} strokeWidth={3} aria-hidden="true" /> {PROVIDER[video.provider]} video. Students will watch it right here.
          </>
        ) : (
          error
        )}
      </p>
      <div className="tte__foot">
        <span className="tte__status" />
        <button type="button" className="crs-btn crs-btn--quiet crs-btn--small" onClick={() => (dirty ? onAskDiscard(onCancel) : onCancel())}>
          Cancel
        </button>
        <button type="submit" className="crs-btn crs-btn--primary crs-btn--small" disabled={!text.trim() || !dirty}>
          Save video
        </button>
      </div>
    </form>
  );
}