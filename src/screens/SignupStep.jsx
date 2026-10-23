import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, ExternalLink, FileText, Lock } from 'lucide-react';
import { lengthLabel, webinarPrice, webinarWhen } from '../data/webinar';
import { mockAccount } from '../data/myPage';
import './QuestionFlow.css'; // reuses .flow__next and the flow-in animation
import './BuildingStep.css'; // the same build-then-reveal look as the landing page
import './SignupStep.css';

// ------------------------------------------------------------
// Sign-up page (the funnel's second page). Nothing to fill in: it's made
// from the landing page's event details and price, and saved as a
// contract (what OpenSlate calls the page people sign up and pay on).
// The coach can't change it here; this screen just tells them it's done.
//
//   Creating your sign-up page        →   Your sign-up page is ready
//   (sketch, blurred, sharpening)          (sketch)
//   ✓ Reading your event details           It's also saved as a contract:
//   ✓ Setting your price (₹899)            sidebar → Contracts
//   ◌ Creating your sign-up contract       [Save & continue →]
//
// made: the webinar already has its own contract (coming back via Review),
//       so there's nothing to build: straight to the result
// legacy: a contract picked by hand on an older webinar, or null. It gets
//         swapped for one made from the event details; the old one stays.
// onCreate(): makes (or updates) the contract, when the build starts
// onReady(): marks the page done, at the reveal
// onDone(): back to the overview (where the thank you page card is next)
// ------------------------------------------------------------

const STEP_MS = 450;     // one tick every 0.45s
const READY_PAUSE = 300; // short beat after the last tick (~2s in all)

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// previewHref: the full sign-up page in a new tab; onPreview(): just before it opens
export default function SignupStep({ answers, made = false, legacy: legacyNow = null, previewHref, onPreview, onCreate, onReady, onDone }) {
  // Kept from the start: once the new contract is made, the old one is no longer linked
  const [legacy] = useState(legacyNow);
  const when = webinarWhen(answers);
  const price = webinarPrice(answers);
  const length = lengthLabel(answers);
  const title = String(answers.headline ?? '').trim() || 'Your webinar';

  // Fixed once it starts, so the list doesn't change mid-animation
  const [steps] = useState(() => [
    'Reading your event details',
    price.isFree ? 'Making it free to join' : `Setting your price (${price.label})`,
    'Creating your sign-up contract',
    'Making it work on phones',
  ]);

  // Already made, or reduced motion: straight to the result
  const [skip] = useState(() => made || prefersReducedMotion());
  const [done, setDone] = useState(skip ? steps.length : 0);
  const [ready, setReady] = useState(skip);

  // The contract is made as the build starts, and the page counts as done
  // at the reveal, so leaving halfway never leaves anything half-made.
  // (Refs: in development React runs effects twice; this must happen once.)
  const created = useRef(false);
  const reported = useRef(false);
  useEffect(() => {
    if (!made && !created.current) {
      created.current = true;
      onCreate();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (ready && !reported.current) {
      reported.current = true;
      onReady();
    }
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (skip) return undefined;
    const timers = steps.map((_, i) => setTimeout(() => setDone(i + 1), STEP_MS * (i + 1)));
    timers.push(setTimeout(() => setReady(true), STEP_MS * steps.length + READY_PAUSE));
    return () => timers.forEach(clearTimeout);
  }, [skip]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    document.title = 'Sign-up page';
  }, []);

  return (
    <div
      className={`building signup ${ready ? 'building--ready' : ''}`}
      style={{ '--building-progress': done / steps.length }}
    >
      <h1 className="building__title">{ready ? 'Your sign-up page is ready' : 'Creating your sign-up page'}</h1>
      <p className="building__text">
        {ready
          ? 'We automatically created it from your event details. Your customers provide their information and sign up on this page.'
          : 'This only takes a moment.'}
      </p>

      {/* A picture of the page, blurred at first and sharpening with each
          tick, like the landing page. Once it's ready, clicking it opens the
          full sign-up page in a new tab. */}
      <Shot ready={ready} href={previewHref} onPreview={onPreview}>
        <div className="signup__sheet">
          <div className="signup__sheet-head">
            {when && (
              <span className="signup__tile" aria-hidden="true">
                <span className="signup__tile-month">{when.month}</span>
                <span className="signup__tile-day">{when.day}</span>
              </span>
            )}
            <div className="signup__sheet-text">
              <p className="signup__sheet-title">{title}</p>
              <p className="signup__sheet-meta">
                {when ? when.line : 'Date not set'}
                {length ? `, ${length}` : ''}
              </p>
              <p className="signup__sheet-host">with {mockAccount.name}</p>
            </div>
          </div>

          <div className="signup__sheet-form" aria-hidden="true">
            {['Your name', 'Email', 'Phone number'].map((label) => (
              <span key={label} className="signup__field">
                <span className="signup__field-label">{label}</span>
                <span className="signup__field-box" />
              </span>
            ))}
            <span className="signup__pay">
              {price.isFree ? 'Register for free' : `Pay ${price.label}`}
              {price.was && <s className="signup__pay-was">{price.was}</s>}
            </span>
            {!price.isFree && (
              <span className="signup__secure">
                <Lock size={12} /> Secure payment
              </span>
            )}
          </div>
        </div>
      </Shot>

      {ready ? (
        <>
          <p className="signup__saved">
            <FileText size={18} aria-hidden="true" />
            <span>
              It’s also saved as a contract, so you’ll find it in the sidebar under <strong>Contracts</strong>.
              {legacy && ` Your old contract, “${legacy.title}”, is still there too.`}
            </span>
          </p>

          <div className="building__actions">
            {/* Back to the overview, where the thank you page card is next */}
            <button type="button" className="flow__next building__continue" onClick={onDone}>
              Save &amp; continue <ArrowRight size={17} aria-hidden="true" />
            </button>
          </div>
        </>
      ) : (
        <ul className="building__steps" aria-hidden="true">
          {steps.map((label, i) => {
            const state = i < done ? 'done' : i === done ? 'current' : 'todo';
            return (
              <li key={label} className={`building__step building__step--${state}`}>
                <span className="building__mark">{state === 'done' && <Check size={14} strokeWidth={3} />}</span>
                {label}
              </li>
            );
          })}
        </ul>
      )}

      {/* Tells screen readers when it's ready */}
      <p className="building__sr" aria-live="polite">
        {ready ? 'Your sign-up page is ready. It’s also saved under Contracts.' : ''}
      </p>
    </div>
  );
}

// The picture: a link to the full page once it's ready, always dimmed a
// little with "Open preview" in the middle (a bit darker on hover)
function Shot({ ready, href, onPreview, children }) {
  if (!ready || !href) return <div className="building__shot signup__shot">{children}</div>;
  return (
    <a
      className="building__shot building__shot--link signup__shot"
      href={href}
      target="_blank"
      rel="noopener"
      onClick={onPreview}
      aria-label="Open your sign-up page (opens in a new tab)"
    >
      {children}
      {/* Always there: the picture dimmed a little, "Open preview" in the middle */}
      <span className="building__overlay" aria-hidden="true">
        <span className="building__overlay-btn">
          <ExternalLink size={16} /> Open preview
        </span>
      </span>
    </a>
  );
}