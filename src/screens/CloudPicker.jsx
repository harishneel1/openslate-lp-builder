import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Cloud, Search, X } from 'lucide-react';
import { assetsOf, formatBytes, onStorageChange } from '../data/cloudStorage';
import { lessonKindOfFile } from '../data/courses';
import { KindTile } from './lessonKinds';

// ------------------------------------------------------------
// "Pick from Cloud Storage", for a lesson or a course's cover.
//   only 'lesson' (the Cloud Storage tile in a lesson, LessonPanel.jsx):
//        the videos and PDFs they've uploaded, to use as its content.
//        Images and other documents aren't listed: a lesson can't use them.
//   only 'image'  (Cover image in a course's Settings, CourseSettings.jsx):
//        their images.
// Newest first.
//
//   ┌──────────── Pick from Cloud Storage ──────────── ✕ ┐
//   │ [🔍 Search files            ]                       │
//   │ [All 4] [Videos 2] [PDFs 2]                          │
//   │ ◉ ▶MP4 Course intro, week 1.mp4      2.3 GB · 20 Oct │
//   │ ○ ▤PDF Vasthu home checklist.pdf     2.4 MB · 9 Nov  │
//   │ …                                                   │
//   ├─────────────────────────────────────────────────────┤
//   │                         [Cancel] [Use this file]    │
//   └─────────────────────────────────────────────────────┘
//
// One file at a time: a video becomes a video lesson, a PDF a PDF lesson
// (lessonKindOfFile). Webinar recordings aren't listed yet: they live
// with their sessions.
//
// only: 'lesson' | 'image'; onPick(asset), onCancel()
// ------------------------------------------------------------

const LABEL = { video: 'Video', pdf: 'PDF', image: 'Image' };
const TYPES = [
  { id: 'video', label: 'Videos' },
  { id: 'pdf', label: 'PDFs' },
];

export default function CloudPicker({ only = 'lesson', onPick, onCancel }) {
  const kindOf = (a) => (only === 'image' ? (a.type === 'image' ? 'image' : null) : lessonKindOfFile(a));
  const ref = useRef(null);
  const [tick, setTick] = useState(0);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [chosen, setChosen] = useState(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.open && dialog.close();
  }, []);
  useEffect(() => onStorageChange(() => setTick((n) => n + 1)), []);

  // Uploaded files of the kinds asked for (assetsOf without webinars), newest first
  const files = useMemo(
    () => assetsOf().filter((a) => a.kind === 'file' && kindOf(a)).sort((a, b) => b.at - a.at),
    [tick, only], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const needle = query.trim().toLowerCase();
  const matching = needle ? files.filter((f) => f.name.toLowerCase().includes(needle)) : files;
  const types = only === 'lesson' ? TYPES.filter((t) => matching.some((f) => kindOf(f) === t.id)) : [];
  const shown = matching.filter((f) => type === 'all' || kindOf(f) === type);
  const picked = files.find((f) => f.id === chosen) ?? null;

  return (
    <dialog
      ref={ref}
      className="crs-dialog cpk"
      aria-labelledby="cpk-title"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      <div className="crs-dialog__top">
        <h2 className="crs-dialog__title" id="cpk-title">
          {only === 'image' ? 'Pick a cover from Cloud Storage' : 'Pick from Cloud Storage'}
        </h2>
        <button type="button" className="crs-dialog__close" onClick={onCancel} aria-label="Close">
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="crs-dialog__body cpk__body">
        {files.length === 0 ? (
          <div className="cpk__empty">
            <Cloud size={24} aria-hidden="true" />
            <p className="cpk__empty-title">
              {only === 'image' ? 'No images in your Cloud Storage yet' : 'No videos or PDFs in your Cloud Storage yet'}
            </p>
            <p className="cpk__empty-text">
              {only === 'image' ? 'You can upload one with Upload image.' : 'You can upload one with Upload video or PDF in the lesson.'}
            </p>
          </div>
        ) : (
          <>
            <label className="cpk__search">
              <Search size={16} aria-hidden="true" />
              <span className="sr-only">Search files</span>
              <input
                type="search"
                value={query}
                placeholder="Search files"
                autoComplete="off"
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>

            {types.length > 1 && (
              <div className="cpk__filters" role="group" aria-label="Show">
                <button type="button" className="cpk__chip" aria-pressed={type === 'all'} onClick={() => setType('all')}>
                  All <span className="cpk__chip-count">{matching.length}</span>
                </button>
                {types.map((t) => (
                  <button key={t.id} type="button" className="cpk__chip" aria-pressed={type === t.id} onClick={() => setType(t.id)}>
                    {t.label} <span className="cpk__chip-count">{matching.filter((f) => kindOf(f) === t.id).length}</span>
                  </button>
                ))}
              </div>
            )}

            {shown.length === 0 ? (
              <p className="cpk__none">No files match “{query.trim()}”.</p>
            ) : (
              <ul className="cpk__list" role="radiogroup" aria-label="Files">
                {shown.map((f) => {
                  const kind = kindOf(f);
                  const on = chosen === f.id;
                  return (
                    <li key={f.id}>
                      <label className={`cpk__row ${on ? 'cpk__row--on' : ''}`}>
                        <input type="radio" name="cpk-file" checked={on} onChange={() => setChosen(f.id)} />
                        <span className="cpk__radio" aria-hidden="true">
                          {on && <Check size={13} strokeWidth={3.5} />}
                        </span>
                        <KindTile kind={kind} size="small" />
                        <span className="cpk__text">
                          <span className="cpk__name">{f.name}</span>
                          <span className="cpk__detail">
                            {LABEL[kind]} · {formatBytes(f.bytes)} · Added {f.day}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>

      <div className="crs-dialog__foot crs-dialog__foot--row">
        <button type="button" className="crs-btn crs-btn--quiet" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="crs-btn crs-btn--primary" disabled={!picked} onClick={() => picked && onPick(picked)}>
          Use this file
        </button>
      </div>
    </dialog>
  );
}