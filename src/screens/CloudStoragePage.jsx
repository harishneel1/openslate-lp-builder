import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpCircle,
  Check,
  ChevronDown,
  Cloud,
  Download,
  FileText,
  FlaskConical,
  Image as ImageIcon,
  Play,
  PlayCircle,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import RowMenu from '../components/RowMenu';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  ACCEPT,
  ASSET_TYPES,
  FREE_BYTES,
  PLANS_HREF,
  addFile,
  assetsOf,
  deleteAsset,
  extensionOf,
  formatBytes,
  formatOf,
  onStorageChange,
  pretendStorage,
  setPretendStorage,
  typeOf,
  uniqueName,
  usageOf,
} from '../data/cloudStorage';
import './OfferingsHome.css'; // the page frame, panels and buttons, as on 1:1 calls
import './CallsPage.css'; // the empty state
import '../components/PrototypeControls.css'; // the Prototype controls panel, as on a batch's page
import './CloudStoragePage.css';

// ------------------------------------------------------------
// The Cloud Storage tab: everything the coach keeps with us, and how
// much of their 20 GB free it uses (data/cloudStorage.js).
//
//   Cloud Storage
//   Your webinar recordings and files, in one place.
//   ┌───────────────────────────────────────────────────────────┐
//   │ 4.4 GB of 20 GB used                       15.6 GB left   │
//   │ ████████████▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
//   │ ● Videos 4.3 GB   ● Documents 21 MB   ● Images 5.3 MB     │
//   └───────────────────────────────────────────────────────────┘
//   ┌ Everything stored 8                  [Largest first ▾]    ┐
//   │ [All 8] [● Videos 3] [● Documents 3] [● Images 2]          │
//   │ ▶MP4 Course intro, week 1.mp4          2.3 GB  [Download][⋯]│
//   │      Video · Added Thu 11 Oct                              │
//   │ ▶MP4 Fix the Vasthu mistakes…          487 MB  [Download][⋯]│
//   │      Webinar recording · Sat 7 Nov, 7:00 pm IST · 58 min   │
//   │ ▤PDF Vasthu home checklist.pdf         2.4 MB  [Download][⋯]│
//   └────────────────────────────────────────────────────────────┘
//
// Each kind has its own colour, the same everywhere on the page: its
// file tiles, its filter's dot and its part of the meter. Videos are
// orange (the webinar date tiles' orange), documents blue, images green.
// A tile shows the kind's icon over the file's format (MP4, PDF, DOCX),
// so what a file is reads at a glance.
//
// Webinar recordings are videos: listed, filtered and counted with the
// videos they upload. "Webinar recording" leads their line, since only
// they open a session.
//
// Largest first by default: what a coach opens this for, when space runs
// short, is finding what to delete. Newest first is the other choice.
// The filters only show the kinds they have.
//
// A recording's name opens its session on the Recording tab
// (onOpenRecording); ⋯ has Open session too. Files have no preview yet.
// Delete is in ⋯ and always asks first (ConfirmDialog): it's for good.
// The meter moves straight away, and a line under it says what was freed.
//
// Download does nothing in the prototype (there are no files), and says so
// under the row, as the session's Recording tab does.
//
// Running out (data/cloudStorage.js):
//   almost full (80%+)  an amber line under the meter: what's left
//   full (20 GB+)       a red line: "Your storage is full." Nothing more:
//                       storage is shared by everything they keep with us
//                       (recordings, uploads, courses later), so the
//                       message never singles one out. How far over shows
//                       top right of the meter.
// Upgrade plan (top right) opens the plans page in a new tab
// (PLANS_HREF), a placeholder until plans are decided.
//
// Search (beside the sort) narrows the list to names that contain what's
// typed; the filters then count only what matches. Nothing matching says
// so, with Clear search.
//
// Selecting: each row has a checkbox, and the bar above the rows selects
// all of them (what's shown: the filter and search applied). With any
// selected, the bar says how many and how much space they take, with
// Delete. One confirmation for all of them; the meter's line then says
// how much was freed. Changing the filter or search drops anything
// selected that's no longer shown, so nothing hidden is ever deleted.
//
// Uploading: Upload (top right) or files dropped anywhere on the page
// ("Drop to upload" covers it while dragging). Each file shows at the top
// of the list while it uploads, with its progress and Cancel, then
// becomes a row like the rest. Before any starts, files are checked:
//   - a type that isn't accepted (FORMATS): "Can't upload .zip files"
//   - one that won't fit in what's left (counting files still uploading):
//     its size, and what's left
//   - storage full: nothing starts. The meter already says "Your storage
//     is full.", so rather than saying it twice, that line pulses once
//     and is read out (nudge)
// Refused files are listed in a note above the list until dismissed.
// A name already in use gets a number: 'checklist (2).pdf'.
// The prototype stores each file's name, type and size, not the file,
// and the upload's speed is made up (UPLOAD_BYTES_PER_SEC).
//
// At the bottom, Prototype controls (as on a batch's page): Pretend
// storage used, to see those states without filling 20 GB.
//
// webinars: every webinar session (App's funnels of type 'webinar')
// onOpenRecording(webinarId): open that session on its Recording tab
// ------------------------------------------------------------

const SORTS = [
  { id: 'largest', label: 'Largest first', compare: (a, b) => b.bytes - a.bytes || b.at - a.at },
  { id: 'newest', label: 'Newest first', compare: (a, b) => b.at - a.at },
];

const ICONS = { video: Play, document: FileText, image: ImageIcon };

// Made-up upload speed, so progress can be seen: about 60 MB a second,
// and never under 1.5 seconds or over 8 for one file
const UPLOAD_BYTES_PER_SEC = 60 * 1024 * 1024;
const UPLOAD_MIN_MS = 1500;
const UPLOAD_MAX_MS = 8000;
const TICK_MS = 150;

// One file starting to upload: { id, name, bytes, type, ext, sent, rate }
function newUpload(file, name) {
  const format = formatOf(name);
  const ms = Math.min(UPLOAD_MAX_MS, Math.max(UPLOAD_MIN_MS, (file.size / UPLOAD_BYTES_PER_SEC) * 1000));
  return {
    id: `u-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name,
    bytes: file.size,
    type: format.type,
    ext: format.ext,
    sent: 0,
    rate: Math.max(1, file.size) / ms, // bytes per ms
  };
}

// Re-reads when something stored changes (here or in another tab), and
// every half minute, so a recording that finished processing turns up
function useStorage(webinars) {
  const [tick, setTick] = useState(0);
  useEffect(() => onStorageChange(() => setTick((n) => n + 1)), []);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  return useMemo(() => assetsOf({ webinars }), [webinars, tick]); // eslint-disable-line react-hooks/exhaustive-deps
}

export default function CloudStoragePage({ webinars = [], onOpenRecording }) {
  const assets = useStorage(webinars);
  const usage = usageOf(assets);

  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('largest');
  const [menuFor, setMenuFor] = useState(null); // the row whose ⋯ is open
  const [noteFor, setNoteFor] = useState(null); // the row whose Download was pressed
  const [deleting, setDeleting] = useState(null); // the asset being asked about
  const [freed, setFreed] = useState(null); // { name, bytes } after a delete
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState(''); // search, as typed
  const [selected, setSelected] = useState(() => new Set()); // ids of the rows ticked
  const [deletingMany, setDeletingMany] = useState(null); // the selected assets, while asking
  const [uploads, setUploads] = useState([]); // files uploading now (newUpload)
  const [refused, setRefused] = useState([]); // [{ key, text }] files that weren't uploaded
  const [dragging, setDragging] = useState(false); // files are being dragged over the page
  const dragDepth = useRef(0); // enter/leave fire for every child: counted, so the cover doesn't flicker
  const picker = useRef(null);

  // Checks the files, then starts the ones that can go (see the top)
  const startUploads = (files) => {
    const list = Array.from(files ?? []);
    if (list.length === 0) return;
    if (usage.level === 'full') {
      sayFull();
      return;
    }
    let room = usage.left - uploads.reduce((sum, u) => sum + (u.bytes - u.sent), 0);
    const taken = uploads.map((u) => u.name);
    const started = [];
    const notes = [];
    list.forEach((file, i) => {
      const ext = extensionOf(file.name);
      if (!formatOf(file.name)) {
        notes.push({
          key: `${i}-${file.name}`,
          text: ext ? `${file.name}: can’t upload .${ext} files.` : `${file.name}: can’t upload this kind of file.`,
        });
        return;
      }
      if (file.size > room) {
        notes.push({
          key: `${i}-${file.name}`,
          text: `${file.name} is ${formatBytes(file.size)}, and you have ${formatBytes(Math.max(0, room))} left.`,
        });
        return;
      }
      room -= file.size;
      const name = uniqueName(file.name, taken);
      taken.push(name);
      started.push(newUpload(file, name));
    });
    setRefused(notes);
    if (started.length) setUploads((prev) => [...started, ...prev]);
  };

  // Moves every upload on, while any are going
  const uploading = uploads.length > 0;
  useEffect(() => {
    if (!uploading) return undefined;
    const id = setInterval(() => {
      setUploads((prev) => prev.map((u) => ({ ...u, sent: Math.min(u.bytes, u.sent + u.rate * TICK_MS) })));
    }, TICK_MS);
    return () => clearInterval(id);
  }, [uploading]);

  // Finished ones are stored, and leave the uploading rows
  useEffect(() => {
    const done = uploads.filter((u) => u.sent >= u.bytes);
    if (done.length === 0) return;
    done.forEach((u) => addFile({ name: u.name, bytes: u.bytes }));
    setUploads((prev) => prev.filter((u) => u.sent < u.bytes));
  }, [uploads]);

  const cancelUpload = (id) => setUploads((prev) => prev.filter((u) => u.id !== id));

  // The "freed" line goes after a while; a new delete starts it again
  useEffect(() => {
    if (!freed) return undefined;
    const id = setTimeout(() => setFreed(null), 8000);
    return () => clearTimeout(id);
  }, [freed]);

  // What matches the search (all of it, with nothing typed)
  const needle = query.trim().toLowerCase();
  const matching = useMemo(
    () => (needle ? assets.filter((a) => a.name.toLowerCase().includes(needle)) : assets),
    [assets, needle],
  );

  const counts = useMemo(() => {
    const out = {};
    matching.forEach((a) => {
      out[a.type] = (out[a.type] ?? 0) + 1;
    });
    return out;
  }, [matching]);

  // Only the kinds they have, in a fixed order
  const filters = ASSET_TYPES.filter((t) => counts[t.id] > 0);

  // A filter whose last item was deleted falls back to All
  const activeFilter = filter === 'all' || counts[filter] > 0 ? filter : 'all';

  const shown = useMemo(() => {
    const compare = SORTS.find((s) => s.id === sort).compare;
    return matching.filter((a) => activeFilter === 'all' || a.type === activeFilter).sort(compare);
  }, [matching, activeFilter, sort]);

  // Only what's shown stays selected (see the top)
  const shownKey = shown.map((a) => a.id).join('|');
  useEffect(() => {
    const ids = new Set(shownKey ? shownKey.split('|') : []);
    setSelected((prev) => {
      const kept = [...prev].filter((id) => ids.has(id));
      return kept.length === prev.size ? prev : new Set(kept);
    });
  }, [shownKey]);

  const picked = shown.filter((a) => selected.has(a.id));
  const pickedBytes = picked.reduce((sum, a) => sum + a.bytes, 0);
  const allPicked = shown.length > 0 && picked.length === shown.length;
  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () => setSelected(allPicked ? new Set() : new Set(shown.map((a) => a.id)));

  const confirmDeleteMany = () => {
    const list = deletingMany;
    setDeletingMany(null);
    const gone = list.filter((a) => deleteAsset(a));
    setSelected(new Set());
    if (gone.length === 0) {
      setFailed(true);
      return;
    }
    setFailed(gone.length < list.length);
    setFreed({
      name: gone.length === 1 ? gone[0].name : null,
      count: gone.length,
      bytes: gone.reduce((sum, a) => sum + a.bytes, 0),
    });
  };

  const confirmDelete = () => {
    const asset = deleting;
    setDeleting(null);
    if (deleteAsset(asset)) {
      setFailed(false);
      setFreed({ name: asset.name, bytes: asset.bytes });
    } else {
      setFailed(true);
    }
  };

  // Storage full and they tried to upload: the meter's "Your storage is
  // full." pulses (each nudge restarts it) and is read out
  const [nudge, setNudge] = useState(0);
  const sayFull = () => {
    setRefused([]);
    setNudge((n) => n + 1);
  };

  // Dragging files anywhere over the window while this page is open: the
  // cover shows, and a drop uploads them. Listened for on the window, so a
  // drop on the sidebar or top bar uploads too, rather than the browser
  // opening the file. Only files count (not dragged text or links).
  const startRef = useRef(startUploads);
  startRef.current = startUploads;
  useEffect(() => {
    const hasFiles = (e) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
    const onEnter = (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth.current += 1;
      setDragging(true);
    };
    const onOver = (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    };
    const onLeave = (e) => {
      if (!hasFiles(e)) return;
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragging(false);
    };
    const onDrop = (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      startRef.current(e.dataTransfer.files);
    };
    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragover', onOver);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  return (
    <div className="oh cs">
      <div className="cs__top">
        <div>
          <h1 className="oh__title">Cloud Storage</h1>
          <p className="calls__lead">Your recordings and files, in one place.</p>
        </div>
        <div className="cs__top-actions">
          <a className="oh__edit" href={PLANS_HREF} target="_blank" rel="noopener">
            <ArrowUpCircle size={16} aria-hidden="true" /> Upgrade plan
          </a>
          <UploadButton full={usage.level === 'full'} picker={picker} onFull={sayFull} />
        </div>
      </div>

      <input
        ref={picker}
        type="file"
        multiple
        accept={ACCEPT}
        hidden
        onChange={(e) => {
          startUploads(e.target.files);
          e.target.value = ''; // so picking the same file again still works
        }}
      />

      <Meter usage={usage} freed={freed} failed={failed} nudge={nudge} />

      {refused.length > 0 && <RefusedNote notes={refused} onClose={() => setRefused([])} />}

      <section className="oh__panel" aria-labelledby="cs-list-title">
        <div className="oh__panel-head cs__head">
          <div className="cs__head-row">
            <h2 className="oh__panel-title" id="cs-list-title">
              Everything stored {assets.length > 0 && <span className="oh__count">{assets.length}</span>}
            </h2>
            {assets.length > 1 && (
              <div className="cs__tools">
                <label className="cs__search">
                  <Search size={16} aria-hidden="true" />
                  <span className="oh__sr-only">Search files</span>
                  <input
                    type="search"
                    value={query}
                    placeholder="Search files"
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
                  />
                </label>
              <label className="cs__sort">
                <span className="oh__sr-only">Sort by</span>
                <select value={sort} onChange={(e) => setSort(e.target.value)}>
                  {SORTS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              </div>
            )}
          </div>

          {filters.length > 1 && (
            <div className="cs__filters" role="group" aria-label="Show">
              <FilterChip label="All" count={matching.length} on={activeFilter === 'all'} onClick={() => setFilter('all')} />
              {filters.map((t) => (
                <FilterChip
                  key={t.id}
                  type={t.id}
                  label={t.label}
                  count={counts[t.id]}
                  on={activeFilter === t.id}
                  onClick={() => setFilter(t.id)}
                />
              ))}
            </div>
          )}
        </div>

        {assets.length === 0 && uploads.length === 0 ? (
          <div className="oh__panel-body">
            <div className="calls__empty">
              <span className="calls__empty-icon" aria-hidden="true">
                <Cloud size={22} />
              </span>
              <h3 className="calls__empty-title">Nothing stored yet</h3>
              <p className="calls__empty-text">
                Upload videos, documents and images, or drop them here. Webinar recordings show up here too. You have{' '}
                {formatBytes(usage.free)} free.
              </p>
              <UploadButton full={usage.level === 'full'} picker={picker} onFull={sayFull} />
            </div>
          </div>
        ) : shown.length === 0 && uploads.length === 0 ? (
          <div className="oh__panel-body">
            <div className="calls__empty">
              <span className="calls__empty-icon" aria-hidden="true">
                <Search size={22} />
              </span>
              <h3 className="calls__empty-title">No files match “{query.trim()}”</h3>
              <button type="button" className="oh__edit" onClick={() => setQuery('')}>
                Clear search
              </button>
            </div>
          </div>
        ) : (
          <>
          {shown.length > 0 && (
            <SelectBar
              count={picked.length}
              bytes={pickedBytes}
              all={allPicked}
              onToggleAll={toggleAll}
              onClear={() => setSelected(new Set())}
              onDelete={() => setDeletingMany(picked)}
            />
          )}
          <ul className="cs__list">
            {uploads.map((u) => (
              <UploadRow key={u.id} upload={u} onCancel={() => cancelUpload(u.id)} />
            ))}
            {shown.map((a) => (
              <AssetRow
                key={a.id}
                asset={a}
                selected={selected.has(a.id)}
                onSelect={() => toggle(a.id)}
                menuOpen={menuFor === a.id}
                onMenu={(open) => setMenuFor(open ? a.id : null)}
                noteOpen={noteFor === a.id}
                onDownload={() => setNoteFor(a.id)}
                onOpen={a.kind === 'recording' ? () => onOpenRecording?.(a.webinarId) : null}
                onDelete={() => {
                  setMenuFor(null);
                  setDeleting(a);
                }}
              />
            ))}
          </ul>
          </>
        )}
      </section>

      {deleting && <DeleteDialog asset={deleting} onCancel={() => setDeleting(null)} onConfirm={confirmDelete} />}
      {deletingMany && (
        <DeleteManyDialog assets={deletingMany} onCancel={() => setDeletingMany(null)} onConfirm={confirmDeleteMany} />
      )}
      {dragging && (
        <div className="cs-drop" aria-hidden="true">
          <div className="cs-drop__box">
            <Upload size={28} />
            <p className="cs-drop__title">Drop to upload</p>
            <p className="cs-drop__text">Videos, documents and images</p>
          </div>
        </div>
      )}

      <StorageTestControls usage={usage} />
    </div>
  );
}

// ---------- How full it is ----------
// One bar for the whole 20 GB, in a colour per kind: videos, documents,
// images. A sliver always shows for a kind that has anything, so a few
// small files are still visible beside gigabytes of video.
// nudge: bumped when they try to add something while full (see the top)
function Meter({ usage, freed, failed, nudge = 0 }) {
  const { used, free, left, over, level, byType } = usage;
  const pct = (bytes) => (bytes > 0 ? Math.max(0.6, (bytes / free) * 100) : 0);
  const sharePct = Math.round((used / free) * 100);

  return (
    <section className={`oh__panel cs-meter cs-meter--${level}`} aria-labelledby="cs-meter-title">
      <div className="cs-meter__top">
        <h2 className="cs-meter__used" id="cs-meter-title">
          <span className="cs-meter__big">{formatBytes(used)}</span> of {formatBytes(free)} used
        </h2>
        <p className="cs-meter__left">
          {over > 0 ? `${formatBytes(over)} over` : left > 0 ? `${formatBytes(left)} left` : 'Nothing left'}
        </p>
      </div>

      <div
        className="cs-meter__bar"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={sharePct}
        aria-valuetext={`${formatBytes(used)} of ${formatBytes(free)} used, ${sharePct}%`}
        aria-label="Storage used"
      >
        {ASSET_TYPES.filter((t) => byType[t.id] > 0).map((t) => (
          <span key={t.id} className={`cs-meter__seg cs-kind--${t.id}`} style={{ width: `${pct(byType[t.id])}%` }} />
        ))}
      </div>

      <ul className="cs-meter__key">
        {ASSET_TYPES.map((t) => (
          <li key={t.id}>
            <span className={`cs-meter__swatch cs-kind--${t.id}`} aria-hidden="true" />
            {t.label} <strong>{amount(byType[t.id])}</strong>
          </li>
        ))}
      </ul>

      {level !== 'ok' && (
        <p
          key={level === 'full' ? nudge : 'alert'}
          className={`cs-meter__alert cs-meter__alert--${level} ${level === 'full' && nudge > 0 ? 'cs-meter__alert--nudge' : ''}`}
          role={level === 'full' && nudge > 0 ? 'alert' : undefined}
        >
          <AlertTriangle size={16} aria-hidden="true" />
          <span>
            {level === 'almost' ? (
              <>
                <strong>Your storage is almost full.</strong> {formatBytes(left)} left.
              </>
            ) : (
              <strong>Your storage is full.</strong>
            )}
          </span>
        </p>
      )}

      <p className={`cs-meter__said ${failed ? 'cs-meter__said--error' : ''}`} role="status">
        {failed
          ? 'Some of that couldn’t be deleted. Try again.'
          : freed && (
              <>
                {freed.name ? `Deleted “${freed.name}”` : `Deleted ${freed.count} files`} and freed up{' '}
                {formatBytes(freed.bytes)}.
              </>
            )}
      </p>
    </section>
  );
}

// A kind's total in the key: 'None' rather than '0 bytes'
const amount = (bytes) => (bytes > 0 ? formatBytes(bytes) : 'None');

// A filter: its kind's colour as a dot (none for All), name, count
function FilterChip({ type = null, label, count, on, onClick }) {
  return (
    <button type="button" className={`cs__chip ${on ? 'cs__chip--on' : ''}`} aria-pressed={on} onClick={onClick}>
      {type && <span className={`cs__chip-dot cs-kind--${type}`} aria-hidden="true" />}
      {label} <span className="cs__chip-count">{count}</span>
    </button>
  );
}

// ---------- One thing stored ----------
// Its kind as an icon, its name and what it is, its size, and what can
// be done with it. On a narrow screen the size and actions go under.
// selected / onSelect(): its checkbox (for deleting several at once)
function AssetRow({ asset, selected, onSelect, menuOpen, onMenu, noteOpen, onDownload, onOpen, onDelete }) {
  const Icon = ICONS[asset.type] ?? FileText;
  const isRecording = asset.kind === 'recording';
  // The format is on the tile, so the line doesn't repeat it
  const detail = isRecording
    ? ['Webinar recording', asset.when, lengthOf(asset.duration)].filter(Boolean).join(' · ')
    : [typeOf(asset.type).one, `Added ${asset.day}`].join(' · ');

  const items = [
    ...(onOpen ? [{ label: 'Open session', icon: PlayCircle, onSelect: () => { onMenu(false); onOpen(); } }] : []),
    { label: 'Delete', icon: Trash2, danger: true, onSelect: onDelete },
  ];

  return (
    <li className={['cs-row', menuOpen && 'cs-row--menu', selected && 'cs-row--selected'].filter(Boolean).join(' ')}>
      <Checkbox checked={selected} onChange={onSelect} label={`Select ${asset.name}`} />
      <span className={`cs-tile cs-tile--${asset.type}`} aria-hidden="true">
        <Icon size={16} strokeWidth={2.25} fill={asset.type === 'video' ? 'currentColor' : 'none'} />
        {asset.ext && <span className="cs-tile__ext">{asset.ext}</span>}
      </span>

      <div className="cs-row__text">
        <h3 className="cs-row__name" title={asset.name}>
          {onOpen ? (
            <button type="button" className="cs-row__open" onClick={onOpen}>
              {asset.name}
            </button>
          ) : (
            asset.name
          )}
        </h3>
        <p className="cs-row__detail">{detail}</p>
      </div>

      <p className="cs-row__size">{formatBytes(asset.bytes)}</p>

      <div className="cs-row__actions">
        <button type="button" className="oh__edit" onClick={onDownload} aria-label={`Download ${asset.name}`}>
          <Download size={15} aria-hidden="true" /> Download
        </button>
        <RowMenu title={asset.name} open={menuOpen} onOpenChange={onMenu} items={items} />
      </div>

      <p className="cs-row__note" aria-live="polite">
        {noteOpen && 'There’s no real file in the prototype yet, so nothing downloads.'}
      </p>
    </li>
  );
}

// ---------- Selecting several ----------

// A checkbox drawn like the rest of the app's, over a real one
function Checkbox({ checked, mixed = false, onChange, label }) {
  return (
    <label className="cs-check">
      <input
        type="checkbox"
        checked={checked}
        ref={(el) => {
          if (el) el.indeterminate = mixed;
        }}
        onChange={onChange}
        aria-label={label}
      />
      <span className={`cs-check__box ${checked || mixed ? 'cs-check__box--on' : ''}`} aria-hidden="true">
        {mixed ? <span className="cs-check__dash" /> : checked && <Check size={12} strokeWidth={3.5} />}
      </span>
    </label>
  );
}

// Above the rows: Select all, or, with some selected, how many and how
// much space they take, with Clear and Delete
//
//   [ ] Select all
//   [■] 3 selected · 2.6 GB                     [Clear]  [Delete 3 files]
function SelectBar({ count, bytes, all, onToggleAll, onClear, onDelete }) {
  return (
    <div className={`cs-select ${count > 0 ? 'cs-select--on' : ''}`}>
      <Checkbox
        checked={all}
        mixed={count > 0 && !all}
        onChange={onToggleAll}
        label={all ? 'Clear selection' : 'Select all'}
      />
      <p className="cs-select__text" aria-live="polite">
        {count > 0 ? (
          <>
            <strong>{count} selected</strong> · {formatBytes(bytes)}
          </>
        ) : (
          'Select all'
        )}
      </p>
      {count > 0 && (
        <div className="cs-select__actions">
          <button type="button" className="oh__edit" onClick={onClear}>
            Clear
          </button>
          <button type="button" className="cs-select__delete" onClick={onDelete}>
            <Trash2 size={15} aria-hidden="true" /> Delete {count === 1 ? '1 file' : `${count} files`}
          </button>
        </div>
      )}
    </div>
  );
}

// Several at once: one question, with how much comes back. Recordings
// among them are called out, since their sessions stay.
function DeleteManyDialog({ assets, onCancel, onConfirm }) {
  const n = assets.length;
  const bytes = assets.reduce((sum, a) => sum + a.bytes, 0);
  const recordings = assets.filter((a) => a.kind === 'recording').length;
  return (
    <ConfirmDialog
      title={n === 1 ? 'Delete this file?' : `Delete ${n} files?`}
      confirmLabel={n === 1 ? 'Delete file' : `Delete ${n} files`}
      danger
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      <p>
        {n === 1 ? 'It' : 'They'} will be deleted for good, freeing up <strong>{formatBytes(bytes)}</strong>.
        {recordings > 0 &&
          ` ${recordings === 1 ? 'One is a webinar recording' : `${recordings} are webinar recordings`}: ${
            recordings === 1 ? 'its session and people stay' : 'their sessions and people stay'
          }.`}{' '}
        This can’t be undone.
      </p>
    </ConfirmDialog>
  );
}

// ---------- Delete: always asked first ----------
// Says what goes, how much space comes back, and that it's for good.
// A recording's session and its people stay; only the video goes.
function DeleteDialog({ asset, onCancel, onConfirm }) {
  const isRecording = asset.kind === 'recording';
  return (
    <ConfirmDialog
      title={isRecording ? 'Delete this recording?' : 'Delete this file?'}
      confirmLabel={isRecording ? 'Delete recording' : 'Delete file'}
      danger
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      {isRecording ? (
        <p>
          The recording of <strong>“{asset.name}”</strong>
          {asset.when ? ` from the ${asset.when} session` : ''} will be deleted for good, freeing up {formatBytes(asset.bytes)}. The
          session and its people stay. This can’t be undone.
        </p>
      ) : (
        <p>
          <strong>“{asset.name}”</strong> will be deleted for good, freeing up {formatBytes(asset.bytes)}. This can’t be
          undone.
        </p>
      )}
    </ConfirmDialog>
  );
}

// '58 min', '1 hr 5 min'
function lengthOf(ms) {
  if (!Number.isFinite(ms)) return null;
  const mins = Math.round(ms / 60_000);
  if (mins < 1) return 'under a minute';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!h) return `${m} min`;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

// ---------- Uploading ----------

// Upload: the page's one orange button. Opens the file picker; with
// storage full it doesn't, and says so instead (onFull).
function UploadButton({ full, picker, onFull }) {
  return (
    <button type="button" className="oh__add" onClick={() => (full ? onFull() : picker.current?.click())}>
      <Upload size={16} strokeWidth={2.5} aria-hidden="true" /> Upload
    </button>
  );
}

// A file uploading: its tile, name, how far along, and Cancel
function UploadRow({ upload, onCancel }) {
  const Icon = ICONS[upload.type] ?? FileText;
  const pct = Math.floor((upload.sent / Math.max(1, upload.bytes)) * 100);
  return (
    <li className="cs-row cs-row--uploading">
      <span className="cs-check cs-check--none" aria-hidden="true" />
      <span className={`cs-tile cs-tile--${upload.type}`} aria-hidden="true">
        <Icon size={16} strokeWidth={2.25} fill={upload.type === 'video' ? 'currentColor' : 'none'} />
        <span className="cs-tile__ext">{upload.ext}</span>
      </span>

      <div className="cs-row__text">
        <h3 className="cs-row__name" title={upload.name}>
          {upload.name}
        </h3>
        <p className="cs-row__detail">
          Uploading · {pct}% · {formatBytes(upload.sent)} of {formatBytes(upload.bytes)}
        </p>
        <div
          className="cs-up__bar"
          role="progressbar"
          aria-label={`Uploading ${upload.name}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
        >
          <span className={`cs-kind--${upload.type}`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      <p className="cs-row__size">{formatBytes(upload.bytes)}</p>

      <div className="cs-row__actions">
        <button type="button" className="oh__edit" onClick={onCancel} aria-label={`Cancel uploading ${upload.name}`}>
          Cancel
        </button>
      </div>
    </li>
  );
}

// Files that weren't uploaded, and why, until dismissed
function RefusedNote({ notes, onClose }) {
  return (
    <div className="cs-refused" role="alert">
      <AlertTriangle size={16} aria-hidden="true" />
      <div className="cs-refused__text">
        <strong>{notes.length === 1 ? 'This file wasn’t uploaded' : `These ${notes.length} files weren’t uploaded`}</strong>
        <ul className="cs-refused__list">
          {notes.map((n) => (
            <li key={n.key}>{n.text}</li>
          ))}
        </ul>
      </div>
      <button type="button" className="cs-refused__close" onClick={onClose} aria-label="Dismiss">
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

// ---------- Prototype controls: not part of the product ----------
// The same panel as on a batch's page (PrototypeControls.css). Pretend
// storage used makes everything act as if that share of the 20 GB is
// used, here and on "Ready to join?" in the meeting tab, until Real.
const PRETEND_LEVELS = [
  { percent: 85, hint: 'Almost full' },
  { percent: 100, hint: 'Full' },
  { percent: 105, hint: 'Full, 1 GB over' },
];
const OPEN_KEY = 'pagebuilder:storage-controls-open';

function StorageTestControls({ usage }) {
  const [open, setOpen] = useState(() => {
    try {
      return sessionStorage.getItem(OPEN_KEY) === '1';
    } catch {
      return false;
    }
  });
  const toggle = () =>
    setOpen((o) => {
      try {
        sessionStorage.setItem(OPEN_KEY, o ? '0' : '1');
      } catch {
        // fine: it just won't be remembered
      }
      return !o;
    });
  const pretend = pretendStorage();

  return (
    <section className={`proto cs-proto ${open ? 'proto--open' : ''}`} aria-label="Prototype controls">
      <button type="button" className="proto__head" aria-expanded={open} onClick={toggle}>
        <FlaskConical size={16} aria-hidden="true" />
        <span className="proto__title">Prototype controls</span>
        <span className="proto__tag">For testing, not part of the product</span>
        {pretend !== null && <span className="proto__now">Pretending {pretend}% used</span>}
        <ChevronDown size={16} className="proto__chevron" aria-hidden="true" />
      </button>

      {open && (
        <div className="proto__body">
          <div className="proto__row">
            <span className="proto__label">Pretend storage used</span>
            <div className="proto__controls">
              <button
                type="button"
                className="proto__btn"
                aria-pressed={pretend === null}
                onClick={() => setPretendStorage(null)}
              >
                Real
              </button>
              {PRETEND_LEVELS.map(({ percent, hint }) => (
                <button
                  key={percent}
                  type="button"
                  className="proto__btn"
                  aria-pressed={pretend === percent}
                  title={hint}
                  onClick={() => setPretendStorage(percent)}
                >
                  {percent}%
                </button>
              ))}
              <p className="proto__note">
                {pretend === null
                  ? `Real: ${formatBytes(usage.used)} of ${formatBytes(FREE_BYTES)} used. `
                  : `Testing as ${formatBytes(usage.used)} of ${formatBytes(FREE_BYTES)} used (${pretend}%). `}
                85% is almost full, 100% is full, 105% is full and 1 GB over. The meeting’s “Ready to join?” screen
                follows it too. It stays on until you press Real.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}