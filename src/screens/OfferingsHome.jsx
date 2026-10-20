import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, ExternalLink, Link2, Pencil, Plus } from 'lucide-react';
import { getMyProfile } from '../data/myProfile';
import { buildProfileJson } from '../data/buildProfileJson';
import { PAGE_DOMAIN, offeringUrl, pageUrl } from '../data/myPage';
import { initials } from '../utils/initials';
import OfferingKindPicker from '../components/OfferingKindPicker';
import './OfferingsHome.css';

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

// Copy, with its "Copied" or "Couldn't copy" state. "Copied" fades after a
// moment; a failure stays until they try again, so there's time to select
// the link by hand.
function useCopy() {
  const [state, setState] = useState('idle'); // 'idle' | 'copied' | 'failed'
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy(text) {
    clearTimeout(timer.current);
    const ok = await copyText(text);
    setState(ok ? 'copied' : 'failed');
    if (ok) timer.current = setTimeout(() => setState('idle'), 2500);
  }

  return [state, copy];
}

// One offering, in two parts: what it is (name with its price opposite,
// details under) and what you can do with it (one row of buttons). Everything
// shares the card's left edge. There's no kind icon: every offering is a
// call, and the details already say "Video call". When other kinds arrive,
// a small icon can go in the details line. Creators often
// share a single call rather than their whole page, so "Copy link" is the
// main button, "Edit" sits beside it, and Preview is the small icon button
// at the end, for checking the page before sending it.
// There's no "Live" tag: every offering listed here is live, so it told them
// nothing. When offerings can be hidden, the hidden ones get a tag instead.
// url: this offering's own link (offeringUrl)
// isNew: just added, so it's marked and lit up briefly
function OfferingCard({ offering, url, onEdit, isNew = false }) {
  const details = offering.facts.map((f) => f.text).join(' · ');
  const [copy, copyLink] = useCopy();

  return (
    <article className={`oh-card ${isNew ? 'oh-card--new' : ''}`}>
      <div className="oh-card__head">
        {isNew && <span className="oh-card__new">Just added</span>}
        <div className="oh-card__title-row">
          <h3 className="oh-card__name">{offering.title}</h3>
          <span className={`oh-card__price ${offering.price.isFree ? 'oh-card__price--free' : ''}`}>
            {offering.price.label}
          </span>
        </div>
        <p className="oh-card__detail">{details}</p>
      </div>

      <div className="oh-card__actions">
        <button
          type="button"
          className="oh-card__copy"
          onClick={() => copyLink(url)}
          aria-label={`Copy link to ${offering.title}`}
        >
          {copy === 'copied' ? <Check size={16} strokeWidth={3} aria-hidden="true" /> : <Link2 size={16} aria-hidden="true" />}
          {copy === 'copied' ? 'Copied' : 'Copy link'}
        </button>
        <button
          type="button"
          className="oh__edit oh-card__edit"
          onClick={() => onEdit(offering.id)}
          aria-label={`Edit ${offering.title}`}
        >
          <Pencil size={15} aria-hidden="true" /> Edit
        </button>
        <a
          className="oh__edit oh-card__preview"
          href={url}
          target="_blank"
          rel="noopener"
          aria-label={`Preview the booking page for ${offering.title} (opens in a new tab)`}
          data-tip="Preview"
          data-tip-align="end"
        >
          <ExternalLink size={16} aria-hidden="true" />
        </a>
      </div>

      <span className="oh__sr-only" aria-live="polite">
        {copy === 'copied' && `Link to ${offering.title} copied`}
      </span>
      {copy === 'failed' && (
        <p className="oh__copy-error oh-card__error" role="alert">
          Couldn’t copy. Select the link and copy it yourself:{' '}
          <span className="oh-card__url">{url}</span>
        </p>
      )}
    </article>
  );
}

// ------------------------------------------------------------
// Home for a live offerings page: the page's link, and every
// offering on it, each with its own link. Where creators land once setup is done; from
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

  const [copy, copyLink] = useCopy();

  return (
    <div className="oh">
      <h1 className="oh__title">Your offerings page</h1>

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
              <h2 className="oh__panel-title" id="oh-link">Your page link</h2>
              <p className="oh__panel-sub">Your profile with every offering. Changes show up straight away.</p>
            </div>
          </div>
          <div className="oh__panel-body">
            <div className="oh__link">
              <span className="oh__url" title={url}>{link}</span>
              <button type="button" className="oh__copy" onClick={() => copyLink(url)}>
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
            <p className="oh__panel-sub">Each one has its own link, to share on its own.</p>
          </div>
          <button type="button" className="oh__add" onClick={() => setChoosing(true)}>
            <Plus size={16} strokeWidth={2.5} aria-hidden="true" /> Add a new offering
          </button>
        </div>

        <div className="oh__panel-body">
          <div className="oh__grid">
            {offerings.map((o) => (
              <OfferingCard
                key={o.id}
                offering={o}
                url={offeringUrl(answers.handle, o.id)}
                onEdit={onEditOffering}
                isNew={o.id === justAddedId}
              />
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