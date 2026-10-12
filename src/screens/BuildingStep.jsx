import { useEffect, useState } from 'react';
import { ArrowRight, Check, ExternalLink } from 'lucide-react';
import PageThumbnail from '../components/PageThumbnail';
import './QuestionFlow.css'; // reuses .flow__next and the flow-in animation
import './BuildingStep.css';

// Shown once, right after they pick a style: their page "comes together"
// (a short checklist ticks off while the thumbnail sharpens), then it's
// revealed with Preview (new tab) and Continue (to the funnel overview).

const STEPS = [
  'Applying your style',
  'Laying out your sections',
  'Setting up your sign-up card',
  'Making it work on phones',
];

const STEP_MS = 700;     // one tick every 0.7s
const READY_PAUSE = 400; // short beat after the last tick, then the reveal (~3.2s in all)

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function BuildingStep({ answers, themeId, previewHref, onPreview, onContinue }) {
  // Reduced motion: skip straight to the finished page
  const [skip] = useState(prefersReducedMotion);
  const [done, setDone] = useState(skip ? STEPS.length : 0); // how many steps are ticked
  const [ready, setReady] = useState(skip);

  useEffect(() => {
    if (skip) return undefined;
    const timers = STEPS.map((_, i) => setTimeout(() => setDone(i + 1), STEP_MS * (i + 1)));
    timers.push(setTimeout(() => setReady(true), STEP_MS * STEPS.length + READY_PAUSE));
    return () => timers.forEach(clearTimeout);
  }, [skip]);

  return (
    <div
      className={`building ${ready ? 'building--ready' : ''}`}
      style={{ '--building-progress': done / STEPS.length }}
    >
      <h1 className="building__title">
        {ready ? 'Your landing page is ready' : 'Building your landing page'}
      </h1>
      <p className="building__text">
        {ready
          ? 'Take a look at it before you move on. It opens in a new tab.'
          : 'This only takes a few seconds.'}
      </p>

      {/* Their real page, blurred at first and sharpening with each tick */}
      <div className="building__shot">
        <PageThumbnail answers={answers} themeId={themeId} />
      </div>

      {ready ? (
        <div className="building__actions">
          <a
            className="flow__next building__preview"
            href={previewHref}
            target="_blank"
            rel="noopener"
            onClick={onPreview}
            aria-label="Preview your landing page (opens in a new tab)"
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
        {ready ? 'Your landing page is ready.' : ''}
      </p>
    </div>
  );
}