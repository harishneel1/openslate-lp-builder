import { useEffect, useState } from 'react';
import { ArrowRight, Check, ExternalLink } from 'lucide-react';
import PageThumbnail from '../components/PageThumbnail';
import { getTheme, recommendedThemeId } from '../data/themes';
import './QuestionFlow.css'; // reuses .flow__next and the flow-in animation
import './BuildingStep.css';

// Shown once, right after the last question of a page: their page "comes
// together" (a short checklist ticks off while the thumbnail sharpens),
// then it's revealed with Preview (new tab) and Continue (to the overview).
// page: 'landing' (default) or 'thank-you'.
// Landing: the style was picked for them from their category; the reveal
// says which one and why. Thank you: it uses the landing page's style.

const PAGES = {
  landing: {
    name: 'landing page',
    steps: () => [
      'Picking the best style for your topic',
      'Laying out your sections',
      'Setting up your sign-up card',
      'Making it work on phones',
    ],
  },
  'thank-you': {
    name: 'thank you page',
    steps: (answers) => [
      'Matching your landing page style',
      'Adding your webinar details',
      answers.groupApp === 'No group' ? 'Adding a note about the email' : 'Setting up your group button',
      'Making it work on phones',
    ],
  },
};

const STEP_MS = 700;     // one tick every 0.7s
const READY_PAUSE = 400; // short beat after the last tick, then the reveal (~3.2s in all)

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function BuildingStep({
  page = 'landing',
  answers,
  themeId,
  previewHref,
  onPreview,
  onContinue,
}) {
  const { name } = PAGES[page] ?? PAGES.landing;
  // Fixed once it starts, so the list doesn't change mid-animation
  const [STEPS] = useState(() => (PAGES[page] ?? PAGES.landing).steps(answers));
  const isLanding = page === 'landing';

  // Reduced motion: skip straight to the finished page
  const [skip] = useState(prefersReducedMotion);
  const [done, setDone] = useState(skip ? STEPS.length : 0); // how many steps are ticked
  const [ready, setReady] = useState(skip);

  const theme = getTheme(themeId ?? recommendedThemeId(answers.category));
  // "Best for spirituality, …" → "best for spirituality, …" to read mid-sentence
  const bestFor = theme.description.charAt(0).toLowerCase() + theme.description.slice(1);

  useEffect(() => {
    if (skip) return undefined;
    const timers = STEPS.map((_, i) => setTimeout(() => setDone(i + 1), STEP_MS * (i + 1)));
    timers.push(setTimeout(() => setReady(true), STEP_MS * STEPS.length + READY_PAUSE));
    return () => timers.forEach(clearTimeout);
  }, [skip]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className={`building ${ready ? 'building--ready' : ''}`}
      style={{ '--building-progress': done / STEPS.length }}
    >
      <h1 className="building__title">
        {ready ? `Your ${name} is ready` : `Building your ${name}`}
      </h1>
      <p className="building__text">
        {!ready && 'This only takes a few seconds.'}
        {ready && 'Take a look at it before you move on. It opens in a new tab.'}
      </p>

      {/* Their real page, blurred at first and sharpening with each tick */}
      <div className="building__shot">
        <PageThumbnail answers={answers} themeId={themeId} page={page} />
      </div>

      {ready && isLanding && (
        <div className="building__style">
          <span
            className="building__swatch"
            aria-hidden="true"
            style={{ '--swatch-bg': theme.tokens['hero-bg'], '--swatch-accent': theme.tokens.accent }}
          />
          <p className="building__style-text">
            We styled it <strong>{theme.name}</strong>, {bestFor}.{' '}
            <span className="building__style-note">You can change it anytime.</span>
          </p>
        </div>
      )}

      {ready ? (
        <div className="building__actions">
          <a
            className="flow__next building__preview"
            href={previewHref}
            target="_blank"
            rel="noopener"
            onClick={onPreview}
            aria-label={`Preview your ${name} (opens in a new tab)`}
          >
            <ExternalLink size={18} /> Preview your page
          </a>
          <button type="button" className="building__continue" onClick={onContinue}>
            Continue <ArrowRight size={16} />
          </button>
        </div>
      ) : (
        <ul className="building__steps" aria-hidden="true">
          {STEPS.map((label, i) => {
            const state = i < done ? 'done' : i === done ? 'current' : 'todo';
            return (
              <li key={label} className={`building__step building__step--${state}`}>
                <span className="building__mark">
                  {state === 'done' && <Check size={14} strokeWidth={3} />}
                </span>
                {label}
              </li>
            );
          })}
        </ul>
      )}

      {/* Tells screen readers when the page is ready */}
      <p className="building__sr" aria-live="polite">
        {ready ? `Your ${name} is ready.` : ''}
      </p>
    </div>
  );
}