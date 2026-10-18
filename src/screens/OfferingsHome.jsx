import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, Copy, ExternalLink, MessageSquare, Pencil, Phone, Plus, Video } from 'lucide-react';
import { getMyProfile } from '../data/myProfile';
import { buildProfileJson } from '../data/buildProfileJson';
import { PAGE_DOMAIN, pageUrl } from '../data/myPage';
import { initials } from '../utils/initials';
import './OfferingsHome.css';

// The offering's look, from its first fact (see serviceKinds.js)
const KIND_ICONS = { video: Video, phone: Phone, message: MessageSquare };

// Copies text, with a fallback where the Clipboard API isn't allowed
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

// One offering, laid out like a funnel card on the funnel list:
// the whole card opens the editor; the round button previews it.
function OfferingCard({ offering, onEdit }) {
  const Icon = KIND_ICONS[offering.facts[0]?.icon] ?? Video;
  const details = offering.facts.map((f) => f.text).join(' · ');

  return (
    <div className="oh-card">
      <button type="button" className="oh-card__open" onClick={() => onEdit(offering.id)}>
        <div className="oh-card__panel" aria-hidden="true">
          <span className="oh-card__icon">
            <Icon size={22} strokeWidth={2} />
          </span>
        </div>

        <div className="oh-card__body">
          <span className="oh-card__status">
            <span className="oh-card__live-dot" aria-hidden="true" /> Live
          </span>
          <h3 className="oh-card__name">{offering.title}</h3>
          <p className="oh-card__detail">{details}</p>

          <div className="oh-card__footer">
            <span className={`oh-card__price ${offering.price.isFree ? 'oh-card__price--free' : ''}`}>
              {offering.price.label}
            </span>
            <span className="oh-card__cta">
              Edit <ArrowRight size={16} />
            </span>
          </div>
        </div>
      </button>

      <a
        className="oh-card__preview"
        href={offering.href}
        target="_blank"
        rel="noopener"
        aria-label={`Preview the booking page for ${offering.title} (opens in a new tab)`}
        title="Preview"
      >
        <ExternalLink size={16} aria-hidden="true" />
      </a>
    </div>
  );
}

// ------------------------------------------------------------
// Home for a live offerings page: the link to share, and every
// offering on it. Where creators land once setup is done; from
// here on, no step-by-step questions.
//
// onEditProfile: opens the profile editor (photo, name, bio, link)
// onEditOffering(id): opens the editor for one offering
// onAddOffering: starts a new one
// ------------------------------------------------------------
export default function OfferingsHome({ answers, onEditProfile, onEditOffering, onAddOffering }) {
  const offerings = useMemo(() => buildProfileJson(getMyProfile(answers)).services, [answers]);
  const link = `${PAGE_DOMAIN}/${answers.handle}`;
  const url = pageUrl(answers.handle);

  const [copy, setCopy] = useState('idle'); // 'idle' | 'copied' | 'failed'
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function handleCopy() {
    const ok = await copyText(url);
    setCopy(ok ? 'copied' : 'failed');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopy('idle'), 2500);
  }

  return (
    <div className="oh">
      <h1 className="oh__title">Your offerings page</h1>

      {/* ---------- Their profile: the top of their page ---------- */}
      <section className="oh__panel" aria-labelledby="oh-profile">
        <div className="oh__panel-head oh__panel-head--split">
          <div>
            <h2 className="oh__panel-title" id="oh-profile">Your profile</h2>
            <p className="oh__panel-sub">The first thing visitors see on your page.</p>
          </div>
          <button type="button" className="oh__edit" onClick={onEditProfile}>
            <Pencil size={15} aria-hidden="true" /> Edit profile
          </button>
        </div>
        <div className="oh__panel-body oh__profile">
          <span className="oh__avatar" aria-hidden="true">
            {answers.photo ? <img src={answers.photo} alt="" /> : initials(answers.name)}
          </span>
          <div className="oh__profile-text">
            <p className="oh__name">{answers.name}</p>
            {answers.bio && <p className="oh__bio">{answers.bio}</p>}
          </div>
        </div>
      </section>

      {/* ---------- The link ---------- */}
      <section className="oh__panel" aria-labelledby="oh-link">
        <div className="oh__panel-head">
          <div>
            <h2 className="oh__panel-title" id="oh-link">Your link</h2>
            <p className="oh__panel-sub">Any change you make shows up on your page straight away.</p>
          </div>
        </div>
        <div className="oh__panel-body">
          <div className="oh__link">
        <span className="oh__url" title={url}>{link}</span>
        <button type="button" className="oh__copy" onClick={handleCopy}>
          {copy === 'copied' ? <Check size={16} strokeWidth={3} /> : <Copy size={16} />}
          {copy === 'copied' ? 'Copied' : 'Copy link'}
        </button>
        <a className="oh__open" href={url} target="_blank" rel="noopener" aria-label="Open your page (opens in a new tab)">
          <ExternalLink size={16} aria-hidden="true" /> Open
        </a>
        <span className="oh__sr-only" aria-live="polite">{copy === 'copied' && 'Link copied'}</span>
        {copy === 'failed' && (
          <p className="oh__copy-error" role="alert">
            Couldn’t copy. Select the link and copy it yourself.
          </p>
        )}
          </div>
        </div>
      </section>

      {/* ---------- Offerings ---------- */}
      <section className="oh__panel" aria-labelledby="oh-offerings">
        <div className="oh__panel-head oh__panel-head--split">
          <div>
            <h2 className="oh__panel-title" id="oh-offerings">
              Offerings <span className="oh__count">{offerings.length}</span>
            </h2>
            <p className="oh__panel-sub">What people can book from your page.</p>
          </div>
          <button type="button" className="oh__add" onClick={onAddOffering}>
            <Plus size={16} strokeWidth={2.5} aria-hidden="true" /> Add a new offering
          </button>
        </div>

        <div className="oh__panel-body">
          <div className="oh__grid">
            {offerings.map((o) => (
              <OfferingCard key={o.id} offering={o} onEdit={onEditOffering} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}