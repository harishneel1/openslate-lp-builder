import { useRef, useState } from 'react';
import { Bell, Check, Upload, X } from 'lucide-react';
import BrandMark from '../components/BrandMark';
import { DEFAULT_NAME, brandingDemo, saveBranding, useBranding } from '../data/branding';
import { readPhoto } from '../utils/readPhoto';
import './BrandingSettings.css';

// ------------------------------------------------------------
// Settings → Branding: how the coach's dashboard looks (student pages
// come next). All mocked (data/branding.js).
//
//   Branding
//   Your name and logo on your dashboard.
//   ──────────────────────────────────────────────────────────────────
//   Business name                               ┌ Preview ───────────┐
//   [ Harish Neel                    ]          │ [HN]           🔔  │
//   Logo                                        │ ┌──────────────┐   │
//   [img]  [Upload]  Square, PNG or JPG          │ │▣ Harish Neel ✕│   │
//   Favicon                                     │ └──────────────┘   │
//   [ico]  [Upload]  Shows in the browser tab    └────────────────────┘
//   Brand colour  Coming soon
//   ● ● ● ● ● ●   (greyed, can't be picked)
//   [Save]
//
// Until the first Save the dashboard shows OpenSlate's logo; the preview
// shows what it'll look like once saved.
// ------------------------------------------------------------

// Shown greyed out until brand colour is built
const COLOURS = ['#ef8a3c', '#2563eb', '#16a34a', '#9333ea', '#db2777', '#111111'];

export default function BrandingSettings() {
  const saved = useBranding();
  const [draft, setDraft] = useState(() => ({
    name: saved.name || DEFAULT_NAME,
    logo: saved.logo,
    favicon: saved.favicon,
  }));
  const [justSaved, setJustSaved] = useState(false);
  const set = (patch) => {
    setDraft((d) => ({ ...d, ...patch }));
    setJustSaved(false);
  };

  const changed =
    !saved.saved || draft.name.trim() !== saved.name || draft.logo !== saved.logo || draft.favicon !== saved.favicon;
  const nameMissing = !draft.name.trim();

  const save = (e) => {
    e.preventDefault();
    if (nameMissing) return;
    saveBranding(draft);
    setJustSaved(true);
  };

  return (
    <>
      <div className="oh__panel-head">
        <h2 className="oh__panel-title">Branding</h2>
        <p className="oh__panel-sub">Your name and logo on your dashboard.</p>
      </div>

      <div className="brd">
        <form className="brd-form" onSubmit={save} noValidate>
          <div className="brd-field">
            <label className="brd-label" htmlFor="brd-name">
              Business name
            </label>
            <input
              id="brd-name"
              className={`po-input ${nameMissing ? 'po-input--error' : ''}`}
              type="text"
              maxLength={60}
              value={draft.name}
              aria-invalid={nameMissing}
              onChange={(e) => set({ name: e.target.value })}
            />
            {nameMissing && <p className="brd-note brd-note--error">Enter your business name</p>}
          </div>

          <ImageField
            id="brd-logo"
            label="Logo"
            hint="Square, PNG or JPG."
            value={draft.logo}
            maxSide={256}
            onChange={(logo) => set({ logo })}
          />

          <ImageField
            id="brd-favicon"
            label="Favicon"
            hint="Shows in the browser tab."
            value={draft.favicon}
            maxSide={64}
            small
            onChange={(favicon) => set({ favicon })}
          />

          <div className="brd-field">
            <p className="brd-label">
              Brand colour <span className="brd-soon">Coming soon</span>
            </p>
            <div className="brd-colours" aria-disabled="true">
              {COLOURS.map((c) => (
                <span key={c} className="brd-colour" style={{ background: c }} aria-hidden="true" />
              ))}
            </div>
          </div>

          <div className="brd-actions">
            <button type="submit" className="brd-btn brd-btn--primary" disabled={!changed || nameMissing}>
              Save
            </button>
            {justSaved && !changed && (
              <span className="brd-saved" role="status">
                <Check size={16} aria-hidden="true" /> Saved
              </span>
            )}
          </div>
        </form>

        <Preview draft={draft} firstTime={!saved.saved} />
      </div>
    </>
  );
}

// ---------- Logo or favicon: the picture, and Upload ----------
// value: a data URL, or null. small: the favicon's smaller box.
function ImageField({ id, label, hint, value, maxSide, small = false, onChange }) {
  const input = useRef(null);
  const [error, setError] = useState(null);

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      onChange(await readPhoto(file, { maxSide }));
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="brd-field">
      <p className="brd-label" id={`${id}-label`}>
        {label}
      </p>
      <div className="brd-image">
        <span className={`brd-image__box ${small ? 'brd-image__box--small' : ''}`}>
          {value ? <img src={value} alt="" /> : <Upload size={small ? 14 : 18} aria-hidden="true" />}
        </span>
        <button
          type="button"
          className="brd-btn brd-btn--quiet"
          aria-describedby={`${id}-label`}
          onClick={() => input.current?.click()}
        >
          {value ? 'Replace' : 'Upload'}
        </button>
        {value && (
          <button type="button" className="brd-clear" aria-label={`Clear ${label.toLowerCase()}`} onClick={() => onChange(null)}>
            <X size={16} aria-hidden="true" />
          </button>
        )}
        <span className="brd-note">{hint}</span>
        <input ref={input} id={id} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" hidden onChange={pick} />
      </div>
      {error && (
        <p className="brd-note brd-note--error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// ---------- On the right: what the dashboard will look like ----------
function Preview({ draft, firstTime }) {
  const brand = { saved: true, name: draft.name.trim() || DEFAULT_NAME, logo: draft.logo };
  const tabIcon = draft.favicon || draft.logo;
  return (
    <aside className="settings__help brd-preview" aria-labelledby="brd-preview-title">
      <h3 className="settings__help-title" id="brd-preview-title">
        Preview
      </h3>

      {/* A small browser window: the tab, then the dashboard's top bar */}
      <div className="brd-win" aria-hidden="true">
        <div className="brd-win__strip">
          <span className="brd-win__dots">
            <i />
            <i />
            <i />
          </span>
          <span className="brd-win__tab">
            <span className="brd-win__favicon">
              {tabIcon ? <img src={tabIcon} alt="" /> : <BrandMark brand={brand} size={14} />}
            </span>
            <span className="brd-win__tabname">{brand.name}</span>
            <X size={11} className="brd-win__close" />
          </span>
        </div>
        <div className="brd-win__bar">
          <BrandMark brand={brand} size={28} />
          <Bell size={15} className="brd-win__bell" />
        </div>
        <div className="brd-win__page">
          <span className="brd-win__rail" />
          <span className="brd-win__lines">
            <i />
            <i />
            <i />
          </span>
        </div>
      </div>

      {firstTime && <p className="brd-preview__note">Your dashboard shows OpenSlate’s logo until you save.</p>}
    </aside>
  );
}

// ---------- Prototype controls: not part of the product ----------
export function BrandingControlRows() {
  const saved = useBranding();
  return (
    <div className="proto__row">
      <span className="proto__label">Branding</span>
      <div className="proto__controls">
        <button type="button" className="proto__btn" aria-pressed={!saved.saved} onClick={brandingDemo.reset}>
          Not set (OpenSlate)
        </button>
        <button
          type="button"
          className="proto__btn"
          aria-pressed={saved.saved && !saved.logo}
          onClick={brandingDemo.initialsOnly}
        >
          Saved, no logo (initials)
        </button>
      </div>
    </div>
  );
}
