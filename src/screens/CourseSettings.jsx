import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Cloud, FileText, Link2, Trash2, Upload } from 'lucide-react';
import { addFile, assetsOf, fileById, formatBytes, formatOf, onStorageChange, uniqueName, usageOf } from '../data/cloudStorage';
import { keepPreview, previewOf } from '../data/imagePreviews';
import { servicePrice } from '../data/mockServices';
import CoverArt from '../components/CoverArt';
import CloudPicker from './CloudPicker';

// ------------------------------------------------------------
// Two parts of a course's page (CoursePage.jsx) that used to be its tabs:
//   CourseCover (the default): the cover image, on the Landing page step.
//   CourseAccess: a list of linked contracts, with Link contracts and
//     Remove, on the Pricing step under "Also give access through other
//     contracts" (CoursePricing.jsx).
//
//   Cover image
//   Shown on this course's card in your academy, and on its landing page.
//   ┌──────────────┐  course-cover.jpg · 240 KB
//   │    cover     │  [☁ Pick from Cloud Storage] [⇪ Upload image] [🗑 Remove]
//   └──────────────┘  A 16:9 image, like 1280 × 720, looks best.
//
//   Also give access through other contracts          [Link contracts]
//   People who sign up on any of these get the course too…
//   ▣ AI Engineering Accelerator   ₹2,500 · 12 sign-ups   [Remove]
//
// Cover image: an image from their Cloud Storage. Upload image puts the
// file in Cloud Storage first (it shows there, and counts towards the
// 20 GB), then makes it the cover; storage full, or too big for what's
// left, says so here. Until there's a cover, the card shows our orange
// with the title (CoverArt.jsx). Remove takes it off the course; the
// image stays in Cloud Storage. A cover deleted from Cloud Storage says
// so, here. The prototype keeps a small picture of images uploaded here
// (imagePreviews.js), so the cover can be seen; others show the orange.
//
// CourseCover: course, onSave(change) → true if it saved (CoursePage.jsx's
//   save: says "Saved")
// CourseAccess: contracts (to list), counts (sign-ups per contract),
//   onLink(): open Link contracts; onUnlink(contractId);
//   title, sub, empty: its heading, the line under it, and what it says
//   with none
// ------------------------------------------------------------

const IMAGE_ACCEPT = '.jpg,.jpeg,.png,.webp';

// Made-up upload speed, as on Cloud Storage
const UPLOAD_BYTES_PER_SEC = 60 * 1024 * 1024;
const UPLOAD_MIN_MS = 1200;
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

// ---------- Cover image ----------
export default function CourseCover({ course, onSave }) {
  const cover = course.cover ?? null;
  const [picking, setPicking] = useState(false);
  const [upload, setUpload] = useState(null); // { name, bytes, sent, rate, file }
  const [problem, setProblem] = useState(null);
  const [, setTick] = useState(0);
  const input = useRef(null);
  useEffect(() => onStorageChange(() => setTick((n) => n + 1)), []);

  const missing = cover && !fileById(cover.fileId);
  const setCover = (asset) => onSave({ cover: { fileId: asset.id, name: asset.name, ext: asset.ext, bytes: asset.bytes } });

  const start = (file) => {
    setProblem(null);
    if (!file) return;
    const format = formatOf(file.name);
    if (!format || format.type !== 'image' || format.ext === 'GIF') {
      setProblem(`“${file.name}” isn’t a JPG, PNG or WEBP image. You can pick one of those instead.`);
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
    const ms = Math.max(UPLOAD_MIN_MS, (file.size / UPLOAD_BYTES_PER_SEC) * 1000);
    setUpload({ name: uniqueName(file.name), bytes: file.size, sent: 0, rate: Math.max(1, file.size) / ms, file });
  };

  // Moves the upload on; once it's all there, it's stored and becomes the cover
  const going = Boolean(upload);
  useEffect(() => {
    if (!going) return undefined;
    const id = setInterval(() => setUpload((u) => (u ? { ...u, sent: Math.min(u.bytes, u.sent + u.rate * TICK_MS) } : u)), TICK_MS);
    return () => clearInterval(id);
  }, [going]);

  useEffect(() => {
    if (!upload || upload.sent < upload.bytes) return;
    const { name, bytes, file } = upload;
    setUpload(null);
    const asset = addFile({ name, bytes });
    if (!asset) {
      setProblem('We couldn’t upload that just now. Try again.');
      return;
    }
    keepPreview(asset.id, file).then(() => setCover(asset));
  }, [upload]); // eslint-disable-line react-hooks/exhaustive-deps

  const pct = upload ? Math.floor((upload.sent / Math.max(1, upload.bytes)) * 100) : 0;

  return (
    <section className="cst__part" aria-labelledby="cst-cover">
      <h3 className="cst__title" id="cst-cover">
        Cover image <span className="crs-field__optional">(optional)</span>
      </h3>
      <p className="cst__sub">Shown on this course’s card in your academy, and on its landing page.</p>

      <div className="cst__cover">
        <div className="cst__cover-art">
          <CoverArt course={course} />
        </div>

        <div className="cst__cover-side">
          {upload ? (
            <div className="cst__uploading">
              <p className="cst__file">
                <strong>{upload.name}</strong> · Uploading to Cloud Storage · {pct}%
              </p>
              <span className="lp__bar" role="progressbar" aria-label={`Uploading ${upload.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                <span className="cst__bar-fill" style={{ width: `${pct}%` }} />
              </span>
              <button type="button" className="crs-btn crs-btn--quiet crs-btn--small" onClick={() => setUpload(null)}>
                Cancel
              </button>
            </div>
          ) : (
            <>
              <p className={`cst__file ${missing ? 'cst__file--missing' : ''}`}>
                {!cover && 'No cover yet: the card shows the course’s title on our orange.'}
                {cover && !missing && (
                  <>
                    <strong>{cover.name}</strong> · {formatBytes(cover.bytes)}
                    {!previewOf(cover.fileId) && ' · The prototype has no picture of this file, so the card shows the orange.'}
                  </>
                )}
                {missing && (
                  <>
                    <AlertTriangle size={15} aria-hidden="true" /> <strong>{cover.name}</strong> was deleted from your Cloud Storage. You can pick another.
                  </>
                )}
              </p>
              <div className="cst__actions">
                <button type="button" className="crs-btn crs-btn--quiet crs-btn--small" onClick={() => setPicking(true)}>
                  <Cloud size={16} aria-hidden="true" /> Pick from Cloud Storage
                </button>
                <button type="button" className="crs-btn crs-btn--quiet crs-btn--small" onClick={() => input.current?.click()}>
                  <Upload size={16} aria-hidden="true" /> Upload image
                </button>
                {cover && (
                  <button type="button" className="crs-btn crs-btn--quiet crs-btn--small lp__remove" onClick={() => onSave({ cover: null })}>
                    <Trash2 size={15} aria-hidden="true" /> Remove
                  </button>
                )}
              </div>
              <p className="cst__hint">A 16:9 image, like 1280 × 720, looks best. JPG, PNG or WEBP.</p>
            </>
          )}
          {problem && (
            <p className="lp__problem" role="alert">
              <AlertTriangle size={16} aria-hidden="true" /> {problem}
            </p>
          )}
        </div>
      </div>

      <input
        ref={input}
        type="file"
        accept={IMAGE_ACCEPT}
        hidden
        onChange={(e) => {
          start(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      {picking && (
        <CloudPicker
          only="image"
          onCancel={() => setPicking(false)}
          onPick={(asset) => {
            setPicking(false);
            setProblem(null);
            setCover(asset);
          }}
        />
      )}
    </section>
  );
}