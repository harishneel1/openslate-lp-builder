import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, Cloud, FileText, Link2, RefreshCw, Trash2, Upload, PlayCircle } from 'lucide-react';
import { addFile, assetsOf, fileById, formatBytes, formatOf, onStorageChange, uniqueName, usageOf } from '../data/cloudStorage';
import { keepPreview, previewOf } from '../data/imagePreviews';
import { readLink, readVideoLink, LINK_MAX } from '../data/courses';
import { coverVideoOf } from '../data/courseExtras';
import { servicePrice } from '../data/mockServices';
import CoverArt from '../components/CoverArt';
import CloudPicker from './CloudPicker';
import './CourseExtras.css';

// ------------------------------------------------------------
// Two parts of a course's page (CoursePage.jsx):
//   CourseCover (the default): the cover, on the Landing page step. An
//     image or a video.
//   CourseAccess: a list of linked contracts, with Link contracts and
//     Remove (kept from before; not shown on any step now).
//
//   Cover (optional)
//   An image or a short video. …
//   ┌──────────────┐  Nothing yet:
//   │    cover     │  [⇪ Upload] [☁ Pick from Cloud Storage] [▶ Paste video link]
//   │      ▶       │  Set:  course-intro.mp4 · 48 MB
//   └──────────────┘        [↻ Replace] [🗑 Remove]
//   (with a video)
//   Thumbnail (optional)
//   Shown on course cards and before the video plays. …
//   thumb.jpg · 240 KB     [⇪ Upload image] [☁ Pick from Cloud Storage] [🗑 Remove]
//
// Upload: an image (JPG, PNG, WEBP) or a video (MP4, MOV) from the
//   computer. It goes into Cloud Storage first, with its progress here
//   (it shows there, and counts towards the 20 GB); storage full, or too
//   big for what's left, says so here.
// Pick from Cloud Storage: their images and videos (CloudPicker, 'cover').
// Paste video link: a YouTube or Vimeo link, checked as it's pasted, as
//   for a lesson's embedded video.
// Replace shows the three choices again (Cancel keeps what's there).
// Remove takes the cover off the course (the video and its thumbnail);
//   files stay in Cloud Storage.
//
// How it's saved (courseExtras.js): an image cover is course.cover. A
// video cover is course.coverVideo, and course.cover is then its
// thumbnail. So picking a video keeps an image that was the cover as the
// video's thumbnail; picking an image in place of a video takes the video
// off.
// Which picture shows (CoverArt.jsx): the thumbnail, else YouTube's own,
// else our orange with the title. (Vimeo's own needs the server: the real
// product fetches it; the prototype shows the orange.)
//
// The prototype keeps a small picture of images uploaded here
// (imagePreviews.js), so they can be seen; videos keep only their name.
//
// CourseCover: course, onSave(change) → true if it saved (CoursePage.jsx's
//   save: says "Saved")
// CourseAccess: contracts (to list), counts (sign-ups per contract),
//   onLink(): open Link contracts; onUnlink(contractId);
//   title, sub, empty: its heading, the line under it, and what it says
//   with none
// ------------------------------------------------------------

const COVER_ACCEPT = '.jpg,.jpeg,.png,.webp,.mp4,.mov';
const IMAGE_ACCEPT = '.jpg,.jpeg,.png,.webp';
const PROVIDER = { youtube: 'YouTube', vimeo: 'Vimeo' };

// Made-up upload speed, as on Cloud Storage
const UPLOAD_BYTES_PER_SEC = 60 * 1024 * 1024;
const UPLOAD_MIN_MS = 1200;
const UPLOAD_MAX_MS = 8000;
const TICK_MS = 120;

const plural = (n, word) => `${n.toLocaleString('en-IN')} ${word}${n === 1 ? '' : 's'}`;

export function CourseAccess({
  contracts,
  counts,
  onLink,
  onUnlink,
  title = 'Who gets this course',
  sub = 'People who sign up on any of these contracts get the course, including everyone who already has.',
  empty = 'No contracts linked yet, so no one can get this course.',
}) {
  return (
    <div className="cst">
      <section className="cst__part" aria-labelledby="cst-access">
        <div className="cst__head">
          <div>
            <h3 className="cst__title" id="cst-access">
              {title}
            </h3>
            <p className="cst__sub">{sub}</p>
          </div>
          <button type="button" className="crs-btn crs-btn--quiet crs-btn--small" onClick={onLink}>
            <Link2 size={16} aria-hidden="true" />
            Link contracts
          </button>
        </div>

        {contracts.length === 0 ? (
          <p className="cpg__nothing">{empty}</p>
        ) : (
          <ul className="cpg__contracts">
            {contracts.map((c) => {
              const n = counts[c.id] ?? 0;
              return (
                <li key={c.id} className="cpg__contract">
                  <span className="cpg__contract-icon" aria-hidden="true">
                    <FileText size={18} />
                  </span>
                  <span className="cpg__contract-text">
                    <span className="cpg__contract-title">{c.title}</span>
                    <span className="cpg__contract-meta">
                      {servicePrice(c)} · {n === 0 ? 'No sign-ups yet' : plural(n, 'sign-up')}
                    </span>
                  </span>
                  <button type="button" className="crs-btn crs-btn--quiet crs-btn--small" onClick={() => onUnlink(c.id)}>
                    Remove<span className="sr-only"> {c.title}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

// An image or a video from the computer, into Cloud Storage, then then(asset, 'image' | 'video')
function useUpload() {
  const [upload, setUpload] = useState(null); // { name, bytes, sent, rate, file, kind, then }
  const [problem, setProblem] = useState(null);

  const start = (file, kinds, then) => {
    setProblem(null);
    if (!file) return;
    const format = formatOf(file.name);
    const isImage = format?.type === 'image' && format.ext !== 'GIF';
    const isVideo = format?.type === 'video';
    const kind = isImage ? 'image' : isVideo ? 'video' : null;
    if (!kind || !kinds.includes(kind)) {
      setProblem(
        kinds.includes('video')
          ? `“${file.name}” isn’t an image (JPG, PNG, WEBP) or a video (MP4, MOV). You can pick one of those instead.`
          : `“${file.name}” isn’t a JPG, PNG or WEBP image. You can pick one of those instead.`,
      );
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
    setUpload({ name: uniqueName(file.name), bytes: file.size, sent: 0, rate: Math.max(1, file.size) / ms, file, kind, then });
  };

  // Moves the upload on; once it's all there, it's stored and handed on
  const going = Boolean(upload);
  useEffect(() => {
    if (!going) return undefined;
    const id = setInterval(() => setUpload((u) => (u ? { ...u, sent: Math.min(u.bytes, u.sent + u.rate * TICK_MS) } : u)), TICK_MS);
    return () => clearInterval(id);
  }, [going]);

  useEffect(() => {
    if (!upload || upload.sent < upload.bytes) return;
    const { name, bytes, file, kind, then } = upload;
    setUpload(null);
    const asset = addFile({ name, bytes });
    if (!asset) {
      setProblem('We couldn’t upload that just now. Try again.');
      return;
    }
    if (kind === 'image') keepPreview(asset.id, file).then(() => then(asset, 'image'));
    else then(asset, 'video');
  }, [upload]); // eslint-disable-line react-hooks/exhaustive-deps

  return { upload, problem, setProblem, start, cancel: () => setUpload(null) };
}

// What kind a Cloud Storage file is here: 'image', 'video', or null
const kindOfAsset = (a) => (a?.type === 'image' ? 'image' : a?.type === 'video' ? 'video' : null);
const asImage = (a) => ({ fileId: a.id, name: a.name, ext: a.ext, bytes: a.bytes });

// ---------- The cover ----------
export default function CourseCover({ course, onSave }) {
  const image = course.cover ?? null;
  const video = coverVideoOf(course);
  const [replacing, setReplacing] = useState(false);
  const [linking, setLinking] = useState(false);
  const [picking, setPicking] = useState(null); // 'cover' | 'thumb'
  const [, setTick] = useState(0);
  const main = useUpload();
  const thumbUp = useUpload();
  const coverInput = useRef(null);
  const thumbInput = useRef(null);
  useEffect(() => onStorageChange(() => setTick((n) => n + 1)), []);

  const has = Boolean(image || video);
  const choosing = !has || replacing;

  // An image as the cover: takes a video off. A video as the cover: an
  // image that was the cover stays, as its thumbnail.
  const setAsCover = (asset, kind) => {
    setReplacing(false);
    setLinking(false);
    if (kind === 'image') onSave({ cover: asImage(asset), coverVideo: null });
    else onSave({ coverVideo: { kind: 'video', fileId: asset.id, name: asset.name, ext: asset.ext, bytes: asset.bytes } });
  };
  const setLink = (url) => {
    const ok = onSave({ coverVideo: { kind: 'embed', url } });
    if (ok) {
      setReplacing(false);
      setLinking(false);
    }
    return ok;
  };
  const setAsThumb = (asset) => onSave({ cover: asImage(asset) });

  const imageMissing = image && !image.src && !fileById(image.fileId);
  const videoMissing = video?.kind === 'video' && !fileById(video.fileId);
  const pct = (u) => Math.floor((u.sent / Math.max(1, u.bytes)) * 100);

  return (
    <section className="cst__part" aria-labelledby="cst-cover">
      <h3 className="cst__title" id="cst-cover">
        Cover <span className="crs-field__optional">(optional)</span>
      </h3>
      <p className="cst__sub">
        An image or a short video, shown on your landing page. Course cards show the image, or the video’s thumbnail.
      </p>

      <div className="cst__cover">
        <div className="cst__cover-art">
          <CoverArt course={course} play />
        </div>

        <div className="cst__cover-side">
          {main.upload ? (
            <Uploading upload={main.upload} pct={pct(main.upload)} onCancel={main.cancel} />
          ) : linking ? (
            <LinkForm
              initial={video?.kind === 'embed' ? video.url : ''}
              onSave={setLink}
              onCancel={() => setLinking(false)}
            />
          ) : choosing ? (
            <>
              {!has && <p className="cst__file">No cover yet: the card shows the course’s title on our orange.</p>}
              {replacing && <p className="cst__file">What should replace it?</p>}
              <div className="cst__actions">
                <button type="button" className="crs-btn crs-btn--quiet crs-btn--small" onClick={() => coverInput.current?.click()}>
                  <Upload size={16} aria-hidden="true" /> Upload
                </button>
                <button type="button" className="crs-btn crs-btn--quiet crs-btn--small" onClick={() => setPicking('cover')}>
                  <Cloud size={16} aria-hidden="true" /> Pick from Cloud Storage
                </button>
                <button type="button" className="crs-btn crs-btn--quiet crs-btn--small" onClick={() => setLinking(true)}>
                  <PlayCircle size={16} aria-hidden="true" /> Paste video link
                </button>
                {replacing && (
                  <button type="button" className="crs-btn crs-btn--quiet crs-btn--small" onClick={() => setReplacing(false)}>
                    Cancel
                  </button>
                )}
              </div>
              <p className="cst__hint">
                Images: JPG, PNG or WEBP, 16:9 (like 1280 × 720) looks best. Videos: MP4 or MOV, or a YouTube or Vimeo link.
              </p>
            </>
          ) : (
            <>
              <p className={`cst__file ${imageMissing || videoMissing ? 'cst__file--missing' : ''}`}>
                {video?.kind === 'embed' && (
                  <>
                    <strong>{PROVIDER[video.provider]} video</strong> ·{' '}
                    <a href={video.url} target="_blank" rel="noopener noreferrer" className="cvx__link">
                      {video.url}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  </>
                )}
                {video?.kind === 'video' &&
                  (videoMissing ? (
                    <>
                      <AlertTriangle size={15} aria-hidden="true" /> <strong>{video.name}</strong> was deleted from your Cloud Storage. You can replace it.
                    </>
                  ) : (
                    <>
                      <strong>{video.name}</strong> · Video · {formatBytes(video.bytes)}
                    </>
                  ))}
                {!video &&
                  (imageMissing ? (
                    <>
                      <AlertTriangle size={15} aria-hidden="true" /> <strong>{image.name}</strong> was deleted from your Cloud Storage. You can replace it.
                    </>
                  ) : (
                    <>
                      <strong>{image.name}</strong> · Image{image.bytes ? ` · ${formatBytes(image.bytes)}` : ''}
                      {!image.src && !previewOf(image.fileId) && ' · The prototype has no picture of this file, so the card shows the orange.'}
                    </>
                  ))}
              </p>
              <div className="cst__actions">
                <button type="button" className="crs-btn crs-btn--quiet crs-btn--small" onClick={() => setReplacing(true)}>
                  <RefreshCw size={15} aria-hidden="true" /> Replace
                </button>
                <button
                  type="button"
                  className="crs-btn crs-btn--quiet crs-btn--small lp__remove"
                  onClick={() => onSave({ cover: null, coverVideo: null })}
                >
                  <Trash2 size={15} aria-hidden="true" /> Remove
                </button>
              </div>
            </>
          )}
          {main.problem && (
            <p className="lp__problem" role="alert">
              <AlertTriangle size={16} aria-hidden="true" /> {main.problem}
            </p>
          )}
        </div>
      </div>

      {/* With a video: its thumbnail, for cards and before it plays */}
      {video && (
        <div className="cvx__thumb">
          <p className="cvx__thumb-title">
            Thumbnail <span className="crs-field__optional">(optional)</span>
          </p>
          <p className="cst__hint">
            Shown on course cards and before the video plays. YouTube and Vimeo videos use their own thumbnail if you don’t add one.
          </p>
          {thumbUp.upload ? (
            <Uploading upload={thumbUp.upload} pct={pct(thumbUp.upload)} onCancel={thumbUp.cancel} />
          ) : (
            <div className="cvx__thumb-row">
              <p className="cst__file">
                {image ? (
                  <>
                    <strong>{image.name}</strong>
                    {image.bytes ? ` · ${formatBytes(image.bytes)}` : ''}
                  </>
                ) : (
                  'None yet'
                )}
              </p>
              <div className="cst__actions">
                <button type="button" className="crs-btn crs-btn--quiet crs-btn--small" onClick={() => thumbInput.current?.click()}>
                  <Upload size={16} aria-hidden="true" /> Upload image
                </button>
                <button type="button" className="crs-btn crs-btn--quiet crs-btn--small" onClick={() => setPicking('thumb')}>
                  <Cloud size={16} aria-hidden="true" /> Pick from Cloud Storage
                </button>
                {image && (
                  <button type="button" className="crs-btn crs-btn--quiet crs-btn--small lp__remove" onClick={() => onSave({ cover: null })}>
                    <Trash2 size={15} aria-hidden="true" /> Remove
                  </button>
                )}
              </div>
            </div>
          )}
          {thumbUp.problem && (
            <p className="lp__problem" role="alert">
              <AlertTriangle size={16} aria-hidden="true" /> {thumbUp.problem}
            </p>
          )}
        </div>
      )}

      <input
        ref={coverInput}
        type="file"
        accept={COVER_ACCEPT}
        hidden
        onChange={(e) => {
          main.start(e.target.files?.[0], ['image', 'video'], setAsCover);
          e.target.value = '';
        }}
      />
      <input
        ref={thumbInput}
        type="file"
        accept={IMAGE_ACCEPT}
        hidden
        onChange={(e) => {
          thumbUp.start(e.target.files?.[0], ['image'], setAsThumb);
          e.target.value = '';
        }}
      />

      {picking && (
        <CloudPicker
          only={picking === 'cover' ? 'cover' : 'image'}
          onCancel={() => setPicking(null)}
          onPick={(asset) => {
            const slot = picking;
            setPicking(null);
            main.setProblem(null);
            thumbUp.setProblem(null);
            if (slot === 'thumb') setAsThumb(asset);
            else setAsCover(asset, kindOfAsset(asset));
          }}
        />
      )}
    </section>
  );
}

// A file on its way to Cloud Storage: its name, how far along, Cancel
function Uploading({ upload, pct, onCancel }) {
  return (
    <div className="cst__uploading">
      <p className="cst__file">
        <strong>{upload.name}</strong> · Uploading to Cloud Storage · {pct}%
      </p>
      <span className="lp__bar" role="progressbar" aria-label={`Uploading ${upload.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <span className="cst__bar-fill" style={{ width: `${pct}%` }} />
      </span>
      <button type="button" className="crs-btn crs-btn--quiet crs-btn--small" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

// Paste video link: one box for a YouTube or Vimeo link, checked as it's pasted
function LinkForm({ initial, onSave, onCancel }) {
  const [text, setText] = useState(initial);
  const [tried, setTried] = useState(false);
  const video = readVideoLink(text);
  const error =
    !video && (tried || (text.trim() && readLink(text)))
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
      <label className="crs-field__label" htmlFor="cvx-link">
        Video link
      </label>
      <input
        id="cvx-link"
        className="crs-input"
        type="url"
        inputMode="url"
        value={text}
        maxLength={LINK_MAX}
        placeholder="https://youtube.com/watch?v=…"
        autoComplete="off"
        autoFocus // eslint-disable-line jsx-a11y/no-autofocus
        aria-describedby="cvx-link-said"
        aria-invalid={Boolean(error) || undefined}
        onChange={(e) => {
          setText(e.target.value);
          setTried(false);
        }}
      />
      <p id="cvx-link-said" className={video ? 'lp__ok' : 'lp__error'} aria-live="polite">
        {video ? (
          <>
            <Check size={15} strokeWidth={3} aria-hidden="true" /> {PROVIDER[video.provider]} video. It plays on your landing page.
          </>
        ) : (
          error
        )}
      </p>
      <div className="cst__actions">
        <button type="button" className="crs-btn crs-btn--quiet crs-btn--small" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="crs-btn crs-btn--primary crs-btn--small" disabled={!text.trim()}>
          Use this video
        </button>
      </div>
    </form>
  );
}