import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Cloud, Search, X } from 'lucide-react';
import { ASSET_TYPES, assetsOf, formatBytes, onStorageChange, typeOf } from '../data/cloudStorage';
import { lessonKindOfFile } from '../data/courses';
import { KindTile, tileKindOf } from './lessonKinds';

// ------------------------------------------------------------
// "Pick from Cloud Storage", for a lesson or a course's cover.
//   only 'lesson' (the Cloud Storage tile in a lesson, LessonPanel.jsx):
//        the videos and PDFs they've uploaded, to use as its content.
//        Images and other documents aren't listed: a lesson can't use them.
//   only 'image'  (Cover image in a course's Settings, CourseSettings.jsx):
//        their images.
//   only 'any'    (Upload resources in a lesson, LessonPanel.jsx): any
//        file they've uploaded, ZIPs and all, with filters by kind.
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
// only: 'lesson' | 'image' | 'any'; onPick(asset), onCancel()
// ------------------------------------------------------------

const LABEL = { video: 'Video', pdf: 'PDF', image: 'Image' };
const TYPES = [
  { id: 'video', label: 'Videos' },
  { id: 'pdf', label: 'PDFs' },
];

export default function CloudPicker({ only = 'lesson', onPick, onCancel }) {
  // What a file counts as here (null: not offered), and its filter
  const kindOf = (a) => (only === 'any' ? a.type : only === 'image' ? (a.type === 'image' ? 'image' : null) : lessonKindOfFile(a));
  const chipTypes = only === 'lesson' ? TYPES : only === 'any' ? ASSET_TYPES : [];
  const tileOf = (a) => (only === 'lesson' ? kindOf(a) : tileKindOf(a));
  const labelOf = (a) => (only === 'lesson' ? LABEL[kindOf(a)] : a.ext ?? typeOf(a.type).one);
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
  const types = chipTypes.filter((t) => matching.some((f) => kindOf(f) === t.id));
  const shown = matching.filter((f) => type === 'all' || kindOf(f) === type);
  const picked = files.find((f) => f.id === chosen) ?? null;

  return (
    <dialog
      ref={ref}
      className="crs-dialog cldp"
      aria-labelledby="cldp-title"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      <div className="crs-dialog__top">
        <h2 className="crs-dialog__title" id="cldp-title">
          {only === 'image' ? 'Pick a cover from Cloud Storage' : only === 'any' ? 'Pick a resource from Cloud Storage' : 'Pick from Cloud Storage'}
        </h2>
        <button type="button" className="crs-dialog__close" onClick={onCancel} aria-label="Close">
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="crs-dialog__body cldp__body">
        {files.length === 0 ? (
          <div className="cldp__empty">
            <Cloud size={24} aria-hidden="true" />
            <p className="cldp__empty-title">
              {only === 'image'
                ? 'No images in your Cloud Storage yet'
                : only === 'any'
                  ? 'Nothing in your Cloud Storage yet'
                  : 'No videos or PDFs in your Cloud Storage yet'}
            </p>
            <p className="cldp__empty-text">
              {only === 'image'
                ? 'You can upload one with Upload image.'
                : only === 'any'
                  ? 'You can upload one from your computer instead.'
                  : 'You can upload one with Upload video or PDF in the lesson.'}
            </p>
          </div>
        ) : (
          <>
            <label className="cldp__search">
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
              <div className="cldp__filters" role="group" aria-label="Show">
                <button type="button" className="cldp__chip" aria-pressed={type === 'all'} onClick={() => setType('all')}>
                  All <span className="cldp__chip-count">{matching.length}</span>
                </button>
                {types.map((t) => (
                  <button key={t.id} type="button" className="cldp__chip" aria-pressed={type === t.id} onClick={() => setType(t.id)}>
                    {t.label} <span className="cldp__chip-count">{matching.filter((f) => kindOf(f) === t.id).length}</span>
                  </button>
                ))}
              </div>
            )}

            {shown.length === 0 ? (
              <p className="cldp__none">No files match “{query.trim()}”.</p>
            ) : (
              <ul className="cldp__list" role="radiogroup" aria-label="Files">
                {shown.map((f) => {
                  const on = chosen === f.id;
                  return (
                    <li key={f.id}>
                      <label className={`cldp__row ${on ? 'cldp__row--on' : ''}`}>
                        <input type="radio" name="cldp-file" checked={on} onChange={() => setChosen(f.id)} />
                        <span className="cldp__radio" aria-hidden="true">
                          {on && <Check size={13} strokeWidth={3.5} />}
                        </span>
                        <KindTile kind={tileOf(f)} size="small" />
                        <span className="cldp__text">
                          <span className="cldp__name">{f.name}</span>
                          <span className="cldp__detail">
                            {labelOf(f)} · {formatBytes(f.bytes)} · Added {f.day}
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