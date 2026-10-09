import { useEffect, useRef } from 'react';
import { CalendarDays, Clock, Globe, Video, Check, Monitor, Smartphone, Info } from 'lucide-react';
import { landingSections, defaultCtaLabel } from '../data/webinarQuestions';
import './PagePreview.css';

const isFilled = (v) =>
  Array.isArray(v) ? v.length > 0 : String(v ?? '').trim() !== '';

// Lists (learnings, personas...) only count entries whose main field is filled
const filledItems = (list, key) =>
  Array.isArray(list) ? list.filter((item) => isFilled(item?.[key])) : [];

function formatDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

function whenText(a) {
  const date = isFilled(a.date) ? formatDate(a.date) : '';
  const time = [a.time, a.timeZone].filter(isFilled).join(' ');
  return [date, time].filter(Boolean).join(' at ');
}

// Their own text if they changed it, otherwise the Free/Paid default
const buttonLabel = (a) => String(a.ctaLabel ?? '').trim() || defaultCtaLabel(a.pricing);

// ------------------------------------------------------------
// One renderer per landing section. Returns null when there is
// nothing to show yet, and the section shows a placeholder instead.
// ------------------------------------------------------------
function renderHero(a) {
  if (!isFilled(a.headline)) return null;
  return (
    <>
      <h1 className="pv__headline">{a.headline}</h1>
      {isFilled(a.subheadline) && <p className="pv__sub">{a.subheadline}</p>}
    </>
  );
}

function renderEvent(a) {
  const when = whenText(a);
  const chips = [
    when && { icon: CalendarDays, text: when },
    isFilled(a.duration) && { icon: Clock, text: a.duration },
    isFilled(a.language) && { icon: Globe, text: a.language },
    isFilled(a.format) && { icon: Video, text: a.format },
  ].filter(Boolean);

  if (!chips.length) return null;
  return (
    <div className="pv__chips">
      {chips.map(({ icon: Icon, text }) => (
        <span key={text} className="pv__chip">
          <Icon size={13} /> {text}
        </span>
      ))}
    </div>
  );
}

function renderCta(a) {
  if (!isFilled(a.pricing)) return null;
  const showPrice = a.pricing === 'Paid' && isFilled(a.price);
  return (
    <div className="pv__cta">
      {showPrice && (
        <p className="pv__price">
          ₹{a.price}
                              {Number(a.oldPrice) > Number(a.price) && <s>₹{a.oldPrice}</s>}
        </p>
      )}
      <span className="pv__button">{buttonLabel(a)}</span>
    </div>
  );
}

function renderLearn(a) {
  const items = filledItems(a.learnings, 'title');
  if (!items.length) return null;
  return (
    <>
      <h2 className="pv__h2">What you'll learn</h2>
      <ul className="pv__list">
        {items.map((item, i) => (
          <li key={i} className="pv__item">
            <Check size={15} className="pv__check" />
            <div>
              <strong>{item.title}</strong>
              {isFilled(item.description) && <p className="pv__muted">{item.description}</p>}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function renderAudience(a) {
  const items = filledItems(a.personas, 'title');
  if (!items.length) return null;
  return (
    <>
      <h2 className="pv__h2">Who it's for</h2>
      <div className="pv__stack">
        {items.map((p, i) => (
          <div key={i} className="pv__card">
            <strong>{p.title}</strong>
            {isFilled(p.text) && <p className="pv__muted">{p.text}</p>}
          </div>
        ))}
      </div>
    </>
  );
}

function renderHost(a) {
  if (![a.hostName, a.hostRole, a.hostBio].some(isFilled)) return null;
  const initial = String(a.hostName ?? '').trim().charAt(0).toUpperCase();
  return (
    <>
      <h2 className="pv__h2">Your host</h2>
      {/* Wrapper lets desktop put the photo beside the bio */}
      <div className="pv__host-grid">
        <div className="pv__host">
          {isFilled(a.hostPhoto) ? (
            <img className="pv__avatar" src={a.hostPhoto} alt="" />
          ) : (
            <div className="pv__avatar">{initial}</div>
          )}
          <div>
            {isFilled(a.hostName) && <strong>{a.hostName}</strong>}
            {isFilled(a.hostRole) && <p className="pv__muted">{a.hostRole}</p>}
          </div>
        </div>
        {isFilled(a.hostBio) && <p className="pv__bio">{a.hostBio}</p>}
      </div>
    </>
  );
}

function renderProof(a) {
  const items = filledItems(a.testimonials, 'quote');
  if (!items.length) return null;
  return (
    <>
      <h2 className="pv__h2">What people say</h2>
      <div className="pv__stack">
        {items.map((t, i) => (
          <div key={i} className="pv__card">
            <p>“{t.quote}”</p>
            <div className="pv__reviewer">
              {isFilled(t.photo) && <img className="pv__reviewer-photo" src={t.photo} alt="" />}
              <p className="pv__muted">{[t.name, t.from].filter(isFilled).join(', ')}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function renderFaq(a) {
  const items = filledItems(a.faqs, 'question');
  if (!items.length) return null;
  return (
    <>
      <h2 className="pv__h2">Common questions</h2>
      <div className="pv__stack">
        {items.map((f, i) => (
          <div key={i} className="pv__card">
            <strong>{f.question}</strong>
            {isFilled(f.answer) && <p className="pv__muted">{f.answer}</p>}
          </div>
        ))}
      </div>
    </>
  );
}

// Built automatically from event details + price
function renderFinalCta(a) {
  if (!isFilled(a.pricing)) return null;
  const when = whenText(a);
  return (
    <div className="pv__cta">
      <h2 className="pv__h2">Save your seat</h2>
      {when && <p className="pv__muted">{when}</p>}
      <span className="pv__button">{buttonLabel(a)}</span>
    </div>
  );
}

const RENDERERS = {
  hero: renderHero,
  event: renderEvent,
  cta: renderCta,
  learn: renderLearn,
  audience: renderAudience,
  host: renderHost,
  proof: renderProof,
  faq: renderFaq,
  finalCta: renderFinalCta,
};

// Which skeleton shape each unfilled section shows
const PLACEHOLDERS = {
  hero: 'hero',
  cta: 'button',
  finalCta: 'button',
  learn: 'list',
  audience: 'list',
  proof: 'list',
  faq: 'list',
};

// Headline, event details and price sit together in one top band
const heroSections = landingSections.filter((s) => s.themeSection === 'hero');
const otherSections = landingSections.filter((s) => s.themeSection !== 'hero');

const MODES = [
  { id: 'mobile', label: 'Mobile', icon: Smartphone },
  { id: 'desktop', label: 'Desktop', icon: Monitor },
];

function Placeholder({ name, variant }) {
  return (
    <div className="pv__placeholder">
      <span className="pv__placeholder-name">{name}</span>
      {variant === 'hero' && (
        <>
          <div className="pv__bar pv__bar--xl" />
          <div className="pv__bar pv__bar--xl pv__bar--short" />
          <div className="pv__bar" />
        </>
      )}
      {variant === 'button' && <div className="pv__bar pv__bar--button" />}
      {variant === 'list' && (
        <div className="pv__bar-grid">
          {[0, 1, 2].map((i) => (
            <div key={i} className="pv__bar-card">
              <div className="pv__bar" />
              <div className="pv__bar pv__bar--short" />
            </div>
          ))}
        </div>
      )}
      {!variant && (
        <>
          <div className="pv__bar" />
          <div className="pv__bar pv__bar--short" />
        </>
      )}
    </div>
  );
}

export default function PagePreview({ answers, currentSection, mode = 'mobile', onModeChange }) {  
  const screenRef = useRef(null);
  const sectionRefs = useRef({});

  // Scroll the preview (not the whole app) to the section being worked on.
  // Runs again when switching Desktop/Mobile, since the layout changes.
  useEffect(() => {
    const screen = screenRef.current;
    const el = sectionRefs.current[currentSection];
    if (!screen || !el) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    screen.scrollTo({ top: Math.max(el.offsetTop - 24, 0), behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [currentSection, mode]);

  const renderSection = (s) => {
    const content = RENDERERS[s.id](answers);
    return (
      <section
        key={s.id}
        data-section={s.id}
        ref={(el) => {
          sectionRefs.current[s.id] = el;
        }}
        className={[
          'pv__section',
          `pv__section--${s.themeSection}`,
          s.id === currentSection && 'pv__section--current',
        ].filter(Boolean).join(' ')}
      >
        {content ?? <Placeholder name={s.name} variant={PLACEHOLDERS[s.id]} />}
      </section>
    );
  };

  return (
    <div className={`pv pv--${mode}`}>
      <div className="pv__header">
        <p className="pv__caption">Page outline</p>
        <div className="pv__toggle" role="group" aria-label="Preview size">
          {MODES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={mode === id}
              className={`pv__toggle-btn ${mode === id ? 'pv__toggle-btn--active' : ''}`}
              onClick={() => onModeChange?.(id)}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      </div>

       <p className="pv__note">
        <Info size={14} /> Shows where your content goes. You'll choose a design after this.
      </p>

      <div className="pv__frame">
        {mode === 'desktop' && (
          <div className="pv__browserbar">
            <span className="pv__dots"><span /><span /><span /></span>
            <span className="pv__url">openslate.ai/your-webinar</span>
          </div>
        )}
        <div className="pv__screen" ref={screenRef}>
          <div className="pv__heroband">{heroSections.map(renderSection)}</div>
          {otherSections.map(renderSection)}
        </div>
      </div>
    </div>
  );
}