import { useEffect, useState } from 'react';
import { ArrowRight, Monitor, Pencil, Smartphone, X } from 'lucide-react';
import SimpleDesign from '../components/designs/SimpleDesign';
import ThankYouDesign from '../components/designs/ThankYouDesign';
import SignupDesign from '../components/designs/SignupDesign';
import { buildPageJson } from '../data/buildPageJson';
import { getTheme, recommendedThemeId } from '../data/themes';
import { funnelTypes } from '../data/funnelTypes';
import { loadSaved } from '../utils/storage';
import { funnelName } from '../utils/funnelName';
import { requestEdit } from '../utils/editRequest';
import './PreviewPage.css';

// Full-screen preview of one funnel's landing page, opened in a new tab
// at ?preview=<funnelId> (see main.jsx). A new tab starts with no state,
// so everything is read from the save (localStorage).

const MODES = [
  { id: 'mobile', label: 'Mobile', icon: Smartphone },
  { id: 'desktop', label: 'Desktop', icon: Monitor },
];

// The Funnels page's own address (this one without ?preview=…)
const builderUrl = () => window.location.pathname;

// One funnel from the save → what the preview needs. null if it's missing or unreadable.
function readFunnel(id) {
  const { funnels } = loadSaved();
  if (!Array.isArray(funnels)) return null;

  const f = funnels.find((item) => item && typeof item === 'object' && item.id === id);
  if (!f) return null;

  const type = funnelTypes.find((t) => t.id === f.type);
  if (!type) return null;

  const answers =
    f.answers && typeof f.answers === 'object' && !Array.isArray(f.answers) ? f.answers : {};

  return {
    answers,
    themeId: typeof f.themeId === 'string' ? f.themeId : null,
    donePages: Array.isArray(f.donePages) ? f.donePages : [],
    name: funnelName({ answers }, type),
  };
}

// Tabs opened from Funnels can close themselves. If this one can't
// (the address was typed or bookmarked), go to Funnels instead.
function closePreview() {
  window.close();
  setTimeout(() => window.location.assign(builderUrl()), 150);
}

// Shown instead of the page when there's nothing to preview
function Message({ title, text }) {
  return (
    <div className="preview">
      <div className="preview__message">
        <h1 className="preview__message-title">{title}</h1>
        <p className="preview__message-text">{text}</p>
        <a className="preview__home" href={builderUrl()}>
          Go to Webinars <ArrowRight size={18} />
        </a>
      </div>
    </div>
  );
}

// The three pages: which donePages entry each needs, and what the bar says
const PAGE_INFO = {
  landing: { done: 'landing', label: 'Preview', name: 'landing page' },
  signup: { done: 'registration', label: 'Preview: Sign-up page', name: 'sign-up page' },
  'thank-you': { done: 'thank-you', label: 'Preview: Thank you page', name: 'thank you page' },
};

// page: 'landing' (default), 'signup' or 'thank-you'
export default function PreviewPage({ funnelId, page: pageId = 'landing' }) {
  const isThankYou = pageId === 'thank-you';
  const info = PAGE_INFO[pageId] ?? PAGE_INFO.landing;
  const [funnel] = useState(() => readFunnel(funnelId));
  const [mode, setMode] = useState('desktop');

  // Tab title: "Preview: <their headline>"
  useEffect(() => {
    if (!funnel) document.title = 'Preview';
    else document.title = pageId === 'landing' ? `Preview: ${funnel.name}` : `${info.label} · ${funnel.name}`;
  }, [funnel, pageId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!funnel) {
    return (
      <Message
        title="This webinar isn't here anymore"
        text="It may have been deleted. You'll find your other webinars under Webinars."
      />
    );
  }

  if (!funnel.donePages.includes(info.done)) {
    return (
      <Message
        title={`This ${info.name} isn't finished yet`}
        text="Finish it in Webinars, then you can preview it here."
      />
    );
  }

  // The design they chose (falls back to the one recommended for their topic)
  const resolvedId =
    funnel.themeId ?? recommendedThemeId(String(funnel.answers.category ?? '').trim());
  const page = buildPageJson(funnel.answers, resolvedId);

  return (
    <div className={`preview preview--${mode}`}>
      <div className="preview__bar">
        <span className="preview__label">{info.label}</span>
        <p className="preview__name">{funnel.name}</p>

        <div className="preview__toggle" role="group" aria-label="Preview size">
          {MODES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={mode === id}
              className={`preview__toggle-btn ${mode === id ? 'preview__toggle-btn--active' : ''}`}
              onClick={() => setMode(id)}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {/* The landing page's card says "Preview & edit": editing is one click from here */}
        {pageId === 'landing' && (
          <button type="button" className="preview__edit" onClick={() => requestEdit(funnelId)}>
            <Pencil size={16} /> Edit page
          </button>
        )}

        <button type="button" className="preview__close" onClick={closePreview}>
          <X size={16} /> Close preview
        </button>
      </div>

      <main className="preview__stage">
        <div className="preview__page">
          {isThankYou ? (
            <ThankYouDesign answers={funnel.answers} theme={getTheme(resolvedId)} />
          ) : pageId === 'signup' ? (
            <SignupDesign answers={funnel.answers} />
          ) : (
            <SimpleDesign page={page} theme={getTheme(resolvedId)} />
          )}
        </div>
      </main>
    </div>
  );
}