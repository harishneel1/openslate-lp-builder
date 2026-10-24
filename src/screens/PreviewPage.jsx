import { useEffect, useState } from 'react';
import { ArrowRight, CalendarX, Eye, Monitor, Pencil, Smartphone, X } from 'lucide-react';
import SimpleDesign from '../components/designs/SimpleDesign';
import ThankYouDesign from '../components/designs/ThankYouDesign';
import SignupDesign from '../components/designs/SignupDesign';
import { buildPageJson } from '../data/buildPageJson';
import { getTheme, recommendedThemeId } from '../data/themes';
import { funnelTypes } from '../data/funnelTypes';
import { loadSaved } from '../utils/storage';
import { funnelName } from '../utils/funnelName';
import { requestEdit } from '../utils/editRequest';
import { lengthLabel, nextOpenRun, webinarEnd, webinarPrice, webinarWhen } from '../data/webinar';
import { addSignup } from '../data/webinarSignups';
import './PreviewPage.css';

// Full-screen preview of one funnel's landing page, opened in a new tab
// at ?preview=<funnelId> (see main.jsx). A new tab starts with no state,
// so everything is read from the save (localStorage).
//
// This is also the link they share, for now. Once a published webinar is
// over, its landing and sign-up pages show "This webinar has ended"
// instead (EndedPage), so nobody signs up for a date that's gone. If the
// coach has run it again, that page points to the new date. The top bar
// keeps "See the page anyway", since the coach previews here too.
//
// While a published webinar is still to come, its link works end to end:
// the landing page's button opens the sign-up page, and registering there
// saves them to the webinar's People (data/webinarSignups.js) and shows
// the thank you page.

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

  // Run again since: the newest copy that's still to come (data/webinar.js)
  const next = nextOpenRun(f, funnels.filter((item) => item && typeof item === 'object'));
  const nextAnswers = next?.answers && typeof next.answers === 'object' ? next.answers : {};

  return {
    answers,
    themeId: typeof f.themeId === 'string' ? f.themeId : null,
    donePages: Array.isArray(f.donePages) ? f.donePages : [],
    name: funnelName({ answers }, type),
    publishedAt: Number.isFinite(f.publishedAt) ? f.publishedAt : null,
    nextRun: next ? { id: next.id, answers: nextAnswers } : null,
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
  const [showAnyway, setShowAnyway] = useState(false); // the coach looking past "This webinar has ended"

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

  // Published and over: visitors can't sign up any more (the thank you page is only seen after signing up)
  const end = webinarEnd(funnel.answers);
  const ended = Boolean(funnel.publishedAt) && end !== null && end <= Date.now() && !isThankYou;
  // Published and still to come: people can register from here
  const open = Boolean(funnel.publishedAt) && (end === null || end > Date.now());
  const pageHref = (id) => `?preview=${encodeURIComponent(funnelId)}&page=${id}`;
  const canRegister = open && funnel.donePages.includes('registration');

  // Saves them to People, then shows the thank you page. false if it couldn't save.
  const register = ({ name, email, phone }) => {
    const price = webinarPrice(funnel.answers);
    const amount = price.isFree ? 0 : Number(funnel.answers.price) || 0;
    const person = addSignup({ webinarId: funnelId, name, email, phone, amount });
    if (!person) return false;
    window.location.assign(pageHref('thank-you'));
    return true;
  };

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

        {ended && (
          <button type="button" className="preview__close" aria-pressed={showAnyway} onClick={() => setShowAnyway((v) => !v)}>
            <Eye size={16} /> {showAnyway ? 'Show what visitors see' : 'See the page anyway'}
          </button>
        )}

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
          {ended && !showAnyway ? (
            <EndedPage name={funnel.name} answers={funnel.answers} nextRun={funnel.nextRun} />
          ) : isThankYou ? (
            <ThankYouDesign answers={funnel.answers} theme={getTheme(resolvedId)} />
          ) : pageId === 'signup' ? (
            <SignupDesign answers={funnel.answers} onRegister={canRegister ? register : null} />
          ) : (
            <SimpleDesign page={page} theme={getTheme(resolvedId)} signupHref={canRegister ? pageHref('signup') : null} />
          )}
        </div>
      </main>
    </div>
  );
}

// What visitors see on an ended webinar's link. With a newer run that's
// still to come, it points there; otherwise it just says it's over.
//   This webinar has ended
//   "Fix the Vasthu mistakes…" was on Sat 31 Oct, 7:00 pm IST.
//   ┌ A new date is open ──────────────────────┐
//   │ Sat 7 Nov, 7:00 pm IST · 60 min · Free   │
//   │ [Sign up for Sat 7 Nov →]                │
//   └──────────────────────────────────────────┘
function EndedPage({ name, answers, nextRun }) {
  const was = webinarWhen(answers);
  const next = nextRun ? webinarWhen(nextRun.answers) : null;
  const nextDay = next ? `${next.weekday} ${next.day} ${next.month}` : null;
  const nextDetails = nextRun
    ? [next?.line, lengthLabel(nextRun.answers), webinarPrice(nextRun.answers).label].filter(Boolean).join(' · ')
    : '';

  return (
    <div className="ended">
      <span className="ended__icon" aria-hidden="true">
        <CalendarX size={24} />
      </span>
      <h1 className="ended__title">This webinar has ended</h1>
      <p className="ended__text">
        “{name}” was on {was ? was.line : 'an earlier date'}.
      </p>

      {nextRun ? (
        <section className="ended__next" aria-labelledby="ended-next-title">
          <h2 className="ended__next-title" id="ended-next-title">
            A new date is open
          </h2>
          <p className="ended__next-when">{nextDetails}</p>
          <a className="ended__next-btn" href={`?preview=${encodeURIComponent(nextRun.id)}`}>
            Sign up for {nextDay ?? 'the new date'} <ArrowRight size={16} aria-hidden="true" />
          </a>
        </section>
      ) : (
        <p className="ended__text">There’s no new date yet.</p>
      )}
    </div>
  );
}