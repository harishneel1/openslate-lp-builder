import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, ExternalLink, MessageSquare, Pencil, Phone, Plus, Video } from 'lucide-react';
import { getMyProfile } from '../data/myProfile';
import { buildProfileJson } from '../data/buildProfileJson';
import { PAGE_DOMAIN, pageUrl } from '../data/myPage';
import { initials } from '../utils/initials';
import OfferingKindPicker from '../components/OfferingKindPicker';
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

// One offering, laid out like a funnel card on the funnel list, but the
// card itself does nothing: only its two controls do. People didn't know
// what clicking the card meant, so editing is a plain "Edit" button and
// previewing is "Open", as on the link above.
// isNew: just added, so it's marked and lit up briefly
function OfferingCard({ offering, onEdit, isNew = false }) {
  const Icon = KIND_ICONS[offering.facts[0]?.icon] ?? Video;
  const details = offering.facts.map((f) => f.text).join(' · ');

  return (
    <article className={`oh-card ${isNew ? 'oh-card--new' : ''}`}>
      <div className="oh-card__panel" aria-hidden="true">
        <span className="oh-card__icon">
          <Icon size={22} strokeWidth={2} />
        </span>
      </div>

      <a
        className="oh__open oh-card__preview"
        href={offering.href}
        target="_blank"
        rel="noopener"
        aria-label={`Open the booking page for ${offering.title} (opens in a new tab)`}
      >
        <ExternalLink size={16} aria-hidden="true" /> Open
      </a>

      <div className="oh-card__body">
        <span className="oh-card__tags">
          <span className="oh-card__status">
            <span className="oh-card__live-dot" aria-hidden="true" /> Live
          </span>
          {isNew && <span className="oh-card__new">Just added</span>}
        </span>
        <h3 className="oh-card__name">{offering.title}</h3>
        <p className="oh-card__detail">{details}</p>

        <div className="oh-card__footer">
          <span className={`oh-card__price ${offering.price.isFree ? 'oh-card__price--free' : ''}`}>
            {offering.price.label}
          </span>
          <button
            type="button"
            className="oh-card__edit"
            onClick={() => onEdit(offering.id)}
            aria-label={`Edit ${offering.title}`}
          >
            <Pencil size={15} aria-hidden="true" /> Edit
          </button>
        </div>
      </div>
    </article>
  );
}

// ------------------------------------------------------------
// Home for a live offerings page: the link to share, and every
// offering on it. Where creators land once setup is done; from
// here on, no step-by-step questions.
//
// onEditProfile: opens the profile editor (photo, name, bio, link)
// onEditOffering(id): opens the editor for one offering
// onAddOffering(kind): starts a new one of that kind, picked in the
//   "What do you want to offer?" pop-up
// justAddedId: the offering just added, if they've come back from adding it
// ------------------------------------------------------------
export default function OfferingsHome({ answers, onEditProfile, onEditOffering, onAddOffering, justAddedId = null }) {
  const offerings = useMemo(() => buildProfileJson(getMyProfile(answers)).services, [answers]);
  const [choosing, setChoosing] = useState(false); // "What do you want to offer?" showing
  const justAdded = offerings.find((o) => o.id === justAddedId) ?? null;
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
      <h1 className="oh__title">Your services page</h1>

      {/* ---------- Profile and link, side by side, so offerings stay in view ---------- */}
      <div className="oh__top">
        {/* ---------- Their profile: the top of their page ---------- */}
        <section className="oh__panel" aria-labelledby="oh-profile">
          <div className="oh__panel-head oh__panel-head--split">
            <h2 className="oh__panel-title" id="oh-profile">Your profile</h2>
            <button type="button" className="oh__edit" onClick={onEditProfile}>
              <Pencil size={15} aria-hidden="true" /> Edit your profile
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
      </div>

      {/* ---------- Offerings ---------- */}
      <section className="oh__panel" aria-labelledby="oh-offerings">
        <div className="oh__panel-head oh__panel-head--split">
          <div>
            <h2 className="oh__panel-title" id="oh-offerings">
              Offerings <span className="oh__count">{offerings.length}</span>
            </h2>
            <p className="oh__panel-sub">What people can book from your page.</p>
          </div>
          <button type="button" className="oh__add" onClick={() => setChoosing(true)}>
            <Plus size={16} strokeWidth={2.5} aria-hidden="true" /> Add a new offering
          </button>
        </div>

        <div className="oh__panel-body">
          <div className="oh__grid">
            {offerings.map((o) => (
              <OfferingCard key={o.id} offering={o} onEdit={onEditOffering} isNew={o.id === justAddedId} />
            ))}
          </div>
          {/* Tells screen readers the new offering is on the page */}
          <p className="oh__sr-only" aria-live="polite">
            {justAdded ? `${justAdded.title} is now on your page.` : ''}
          </p>
        </div>
      </section>

      {choosing && (
        <OfferingKindPicker
          onClose={() => setChoosing(false)}
          onPick={(kind) => {
            setChoosing(false);
            onAddOffering(kind);
          }}
        />
      )}
    </div>
  );
}