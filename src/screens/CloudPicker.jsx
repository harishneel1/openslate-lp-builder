import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Cloud, Search, X } from 'lucide-react';
import { ASSET_TYPES, assetsOf, formatBytes, onStorageChange, typeOf } from '../data/cloudStorage';
import { lessonKindOfFile } from '../data/courses';
import { KindTile, tileKindOf } from './lessonKinds';
import './CloudPicker.css';

// ------------------------------------------------------------
// "Pick from Cloud Storage", for a lesson or a course's cover.
//   only 'lesson' (the Cloud Storage tile in a lesson, LessonPanel.jsx):
//        the videos and PDFs they've uploaded, to use as its content.
//        Images and other documents aren't listed: a lesson can't use them.
//        One file.
//   only 'image'  (a cover video's thumbnail, CourseCover.jsx): their
//        images. One file.
//   only 'cover'  (the course's cover, CourseCover.jsx): their images and
//        videos, with Images / Videos filters. One file.
//   only 'any'    (Upload resources in a lesson, LessonExtras.jsx): any
//        file they've uploaded, ZIPs and all, with filters by kind.
//        Several at once (multiple).
// Newest first.
//
// One file (a lesson's content, a cover): round buttons, Use this file.
//
// Several (multiple, a lesson's resources): a checkbox on each row; a
// click anywhere on the row ticks or unticks it. What's ticked stays
// ticked through the search and the filters, so they can search
// "slides", tick two, search "worksheet", tick one more. Files already
// on this lesson (taken) show ticked and greyed, "Already added", and
// can't be clicked, so nothing is added twice.
//
//   ┌──────── Pick resources from Cloud Storage ──────── ✕ ┐
//   │ [🔍 Search files            ]                       │
//   │ [All 6] [Documents 3] [Images 2] [Other 1]           │
//   │ ☑ ▤PDF Slides week 1.pdf          2.4 MB · 9 Nov     │
//   │ ☐ ▤ZIP starter-code.zip           12 MB · 8 Nov      │
//   │ ▣ ▤PDF Workbook.pdf   Already added                 │
//   ├─────────────────────────────────────────────────────┤
//   │ 1 selected · Clear               [Cancel] [Add 1 file] │
//   └─────────────────────────────────────────────────────┘
// Add N files gives them back in the order they were ticked. With
// nothing ticked it reads Add files and can't be pressed.
//
// Webinar recordings aren't listed yet: they live with their sessions.
//
// only: 'lesson' | 'image' | 'cover' | 'any'
// multiple: tick several (onPick gets a list)
// taken: file ids already used here (multiple only): shown, not pickable
// onPick(asset) (one) or onPick([assets]) (multiple), onCancel()
// ------------------------------------------------------------

const LABEL = { video: 'Video', pdf: 'PDF', image: 'Image' };
const TYPES = [
  { id: 'video', label: 'Videos' },
  { id: 'pdf', label: 'PDFs' },
];
const COVER_TYPES = [
  { id: 'image', label: 'Images' },
  { id: 'video', label: 'Videos' },
];

// What a file counts as for each use (null: not offered)
const KIND_OF = {
  any: (a) => a.type,
  image: (a) => (a.type === 'image' ? 'image' : null),
  cover: (a) => (a.type === 'image' || a.type === 'video' ? a.type : null),
  lesson: (a) => lessonKindOfFile(a),
};

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export default function CloudPicker({ only = 'lesson', multiple = false, taken = [], onPick, onCancel }) {
  // What a file counts as here (null: not offered), and its filter
  const kindOf = KIND_OF[only] ?? KIND_OF.lesson;
  const chipTypes = only === 'lesson' ? TYPES : only === 'cover' ? COVER_TYPES : only === 'any' ? ASSET_TYPES : [];
  const tileOf = (a) => (only === 'lesson' ? kindOf(a) : tileKindOf(a));
  const labelOf = (a) => (only === 'lesson' || only === 'cover' ? LABEL[kindOf(a)] : a.ext ?? typeOf(a.type).one);
  const ref = useRef(null);
  const [tick, setTick] = useState(0);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [chosen, setChosen] = useState(null); // one file's id
  const [ticked, setTicked] = useState([]); // multiple: ids, in the order they were ticked
  const takenIds = useMemo(() => new Set(multiple ? taken : []), [multiple, taken]);

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
  const pickedMany = ticked.map((id) => files.find((f) => f.id === id)).filter(Boolean);

  const toggle = (id) => {
    if (takenIds.has(id)) return;
    setTicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const addLabel = pickedMany.length === 0 ? 'Add files' : `Add ${plural(pickedMany.length, 'file')}`;
  const title =
    only === 'image'
      ? 'Pick an image from Cloud Storage'
      : only === 'cover'
        ? 'Pick a cover from Cloud Storage'
        : only === 'any'
          ? 'Pick resources from Cloud Storage'
          : 'Pick from Cloud Storage';

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
          {title}
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
                : only === 'cover'
                  ? 'No images or videos in your Cloud Storage yet'
                  : only === 'any'
                  ? 'Nothing in your Cloud Storage yet'
                  : 'No videos or PDFs in your Cloud Storage yet'}
            </p>
            <p className="cldp__empty-text">
              {only === 'image'
                ? 'You can upload one with Upload image.'
                : only === 'cover'
                  ? 'You can upload one with Upload.'
                  : only === 'any'
                  ? 'You can upload from your computer instead.'
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
              <ul className="cldp__list" role={multiple ? 'group' : 'radiogroup'} aria-label="Files">
                {shown.map((f) => {
                  const isTaken = takenIds.has(f.id);
                  const on = multiple ? isTaken || ticked.includes(f.id) : chosen === f.id;
                  return (
                    <li key={f.id}>
                      <label
                        className={['cldp__row', on && 'cldp__row--on', isTaken && 'cldp__row--taken'].filter(Boolean).join(' ')}
                      >
                        {multiple ? (
                          <input type="checkbox" checked={on} disabled={isTaken} onChange={() => toggle(f.id)} />
                        ) : (
                          <input type="radio" name="cldp-file" checked={on} onChange={() => setChosen(f.id)} />
                        )}
                        <span className={multiple ? 'cldp__check' : 'cldp__radio'} aria-hidden="true">
                          {on && <Check size={13} strokeWidth={3.5} />}
                        </span>
                        <KindTile kind={tileOf(f)} size="small" />
                        <span className="cldp__text">
                          <span className="cldp__name">{f.name}</span>
                          <span className="cldp__detail">
                            {labelOf(f)} · {formatBytes(f.bytes)} · Added {f.day}
                          </span>
                        </span>
                        {isTaken && <span className="cldp__taken">Already added</span>}
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
        {multiple && pickedMany.length > 0 && (
          <p className="cldp__picked" aria-live="polite">
            {pickedMany.length} selected
            <button type="button" className="cldp__clear" onClick={() => setTicked([])}>
              Clear
            </button>
          </p>
        )}
        <button type="button" className="crs-btn crs-btn--quiet" onClick={onCancel}>
          Cancel
        </button>
        {multiple ? (
          <button
            type="button"
            className="crs-btn crs-btn--primary"
            disabled={pickedMany.length === 0}
            onClick={() => pickedMany.length > 0 && onPick(pickedMany)}
          >
            {addLabel}
          </button>
        ) : (
          <button type="button" className="crs-btn crs-btn--primary" disabled={!picked} onClick={() => picked && onPick(picked)}>
            Use this file
          </button>
        )}
      </div>
    </dialog>
  );
}