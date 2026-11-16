import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Copy, ExternalLink, MessageCircle, PartyPopper } from 'lucide-react';
import { buyContractOf, courseLandingUrl, publishCheck } from '../data/courses';
import { copyText } from '../utils/copyText';
import { whatsappShareHref } from '../utils/whatsapp';
import { priceOf } from './CoursePricing';
import './BuildingStep.css'; // the same build-then-reveal look as a webinar's pages
import './CoursePublished.css';

// ------------------------------------------------------------
// Just published (CoursePage.jsx): in place of the course's steps, once
// they've confirmed Publish. The course is already published when this
// opens, so leaving halfway never leaves anything half-done.
//
// The first time (animate), a short build, as a webinar's sign-up page
// has (SignupStep.jsx, BuildingStep.css):
//
//   Publishing your course
//   This only takes a moment.
//   [ their landing page, blurred, sharpening with each tick ]
//   ✓ Checking your 12 lessons
//   ✓ Setting your price (₹2,499)
//   ✓ Building your landing page
//   ◌ Making it live
//
// then, about 3 seconds in, or straight away when published again after
// unpublishing (or with reduced motion on):
//
//   🎉 Your course is live
//   Share the link and people can buy it straight away.
//   [ their landing page: Open preview ]
//   ┌──────────────────────────────────────────────────────────┐
//   │ openslate…/web/course/ai-engineering   [Copy link] [↗]   │
//   └──────────────────────────────────────────────────────────┘
//   [Share on WhatsApp]   [Go to your course →]
//
// The picture is their real landing page as buyers see it (it's live by
// now), small and still.
// Share on WhatsApp opens WhatsApp with a message ready to send, and
// lets them pick who to send it to (whatsappShareHref).
//
// course; animate: play the build first; onDone(): back to the course
// ------------------------------------------------------------

const STEP_MS = 600; // one tick every 0.6s
const READY_PAUSE = 400; // a short beat after the last tick (~2.8s in all)

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export default function CoursePublished({ course, animate = true, onDone }) {
  // Fixed once it starts, so the list doesn't change mid-animation
  const [steps] = useState(() => {
    const price = priceOf(buyContractOf(course));
    return [
      `Checking your ${plural(publishCheck(course).lessons, 'lesson')}`,
      price.free ? 'Making it free to join' : `Setting your price (${price.now})`,
      'Building your landing page',
      'Making it live',
    ];
  });
  const [skip] = useState(() => !animate || prefersReducedMotion());
  const [done, setDone] = useState(skip ? steps.length : 0);
  const [ready, setReady] = useState(skip);
  const url = courseLandingUrl(course.id);

  useEffect(() => {
    if (skip) return undefined;
    const timers = steps.map((_, i) => setTimeout(() => setDone(i + 1), STEP_MS * (i + 1)));
    timers.push(setTimeout(() => setReady(true), STEP_MS * steps.length + READY_PAUSE));
    return () => timers.forEach(clearTimeout);
  }, [skip]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    document.title = ready ? 'Your course is live' : 'Publishing your course';
    return () => {
      document.title = course.title;
    };
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const message = [
    `My course is live: *${course.title}*`,
    course.subtitle ? course.subtitle : null,
    '',
    `Join here: ${url}`,
  ]
    .filter((line) => line !== null)
    .join('\n');

  return (
    <div className={`building cpub ${ready ? 'building--ready' : ''}`} style={{ '--building-progress': done / steps.length }}>
      {ready && (
        <span className="cpub__badge" aria-hidden="true">
          <PartyPopper size={26} />
        </span>
      )}
      <h1 className="building__title">{ready ? 'Your course is live' : 'Publishing your course'}</h1>
      <p className="building__text">
        {ready ? 'Share the link and people can buy it straight away.' : 'This only takes a moment.'}
      </p>

      <Shot ready={ready} href={url} />

      {ready ? (
        <>
          <LiveLink url={url} />
          <div className="building__actions cpub__actions">
            <a className="cpub__btn" href={whatsappShareHref(message)} target="_blank" rel="noopener">
              <MessageCircle size={17} aria-hidden="true" />
              Share on WhatsApp
              <span className="sr-only"> (opens WhatsApp)</span>
            </a>
            <button type="button" className="cpub__btn" onClick={onDone}>
              Go to your course <ArrowRight size={17} aria-hidden="true" />
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

      {/* Tells screen readers when it's live */}
      <p className="building__sr" aria-live="polite">
        {ready ? 'Your course is live. Copy its link to share it.' : 'Publishing your course.'}
      </p>
    </div>
  );
}

// Their landing page, small and still (it can't be clicked into): once
// it's live, the whole picture opens it in a new tab
function Shot({ ready, href }) {
  const page = (
    <span className="thumb cpub__thumb" aria-hidden="true">
      <iframe className="cpub__frame" src={href} title="Your course's landing page" tabIndex={-1} loading="eager" />
    </span>
  );
  if (!ready) return <div className="building__shot cpub__shot">{page}</div>;
  return (
    <a
      className="building__shot building__shot--link cpub__shot"
      href={href}
      target="_blank"
      rel="noopener"
      aria-label="Open your landing page (opens in a new tab)"
    >
      {page}
      <span className="building__overlay" aria-hidden="true">
        <span className="building__overlay-btn">
          <ExternalLink size={16} /> Open preview
        </span>
      </span>
    </a>
  );
}

// The link, with Copy link (the one filled button) and Open ↗
function LiveLink({ url }) {
  const [state, setState] = useState('idle'); // 'idle' | 'copied' | 'failed'
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    const ok = await copyText(url);
    setState(ok ? 'copied' : 'failed');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), 2500);
  };

  return (
    <div className="cpub__link">
      <div className="cpub__link-row">
        <span className="cpub__url" title={url}>
          {url.replace(/^https?:\/\//i, '')}
        </span>
        <button type="button" className={`cpub__copy ${state === 'copied' ? 'cpub__copy--done' : ''}`} onClick={copy}>
          {state === 'copied' ? <Check size={16} strokeWidth={3} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
          {state === 'copied' ? 'Copied' : 'Copy link'}
        </button>
        <a className="cpub__open" href={url} target="_blank" rel="noopener" title="Open" aria-label="Open your landing page (opens in a new tab)">
          <ExternalLink size={17} aria-hidden="true" />
        </a>
      </div>
      <span className="sr-only" aria-live="polite">
        {state === 'copied' && 'Link copied'}
      </span>
      {state === 'failed' && (
        <p className="cpub__error" role="alert">
          Couldn’t copy. Select the link and copy it yourself.
        </p>
      )}
    </div>
  );
}