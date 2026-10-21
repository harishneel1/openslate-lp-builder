import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, ExternalLink, EyeOff, Link2, Pencil, Plus } from 'lucide-react';
import { getMyPage, getMyProfile, isOnPage, myCallIds } from '../data/myProfile';
import { buildProfileJson } from '../data/buildProfileJson';
import { PAGE_DOMAIN, offeringUrl, pageUrl } from '../data/myPage';
import { initials } from '../utils/initials';
import AddToPagePicker from '../components/AddToPagePicker';
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
// the link by hand. Also used by the 1:1 calls tab (CallsPage.jsx).
export function useCopy() {
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
// main button, "Edit" sits beside it, then two small icon buttons: Preview,
// for checking the page before sending it, and Remove from page.
// There's no "Live" tag: every offering listed here is on the page.
// Removing only takes it off the page; it stays in 1:1 calls.
// url: this offering's own link (offeringUrl)
// isNew: just added, so it's marked and lit up briefly
// onRemove(): take it off the page (the home offers Undo)
function OfferingCard({ offering, url, onEdit, onRemove, isNew = false }) {
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
        <button
          type="button"
          className="oh__edit oh-card__preview"
          onClick={onRemove}
          aria-label={`Remove ${offering.title} from your page`}
          data-tip="Remove from page"
          data-tip-align="end"
        >
          <EyeOff size={16} aria-hidden="true" />
        </button>
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
// Home for a live offerings page, as two cards with the same frame:
//
//   Your page   ┌ (photo) Name, one line of bio          [Edit profile] ┐
//               └ Your offerings page link  harishneel.page  [Copy link] [↗] ┘
//   Offerings   the calls that are on their page, each with its own link
//
// Every action lines up on the card's right edge.
// Add to your page is the one filled button on the page.
// This page only shows calls: they're made and changed in the 1:1 calls
// tab (CallsPage.jsx), with the calendar. "Add to your page" picks from
// the ones that aren't on it (AddToPagePicker), or makes a new one.
// Where creators land once setup is done; from here on, no step-by-step questions.
//
// onEditProfile: opens the profile editor (photo, name, bio, link)
// onEditOffering(id): opens the editor for one offering
// onAddCalls({ ids, descriptions }): put these calls on the page, with any card lines changed
// onCreateCall(): make a new call (the guided flow); it lands on the page
// onSetOnPage(id, on): take one off the page, or put it back (Undo)
// justAddedIds: the offerings just added, if they've come back from adding them
// ------------------------------------------------------------
const UNDO_MS = 6000;

export default function OfferingsHome({
  answers,
  onEditProfile,
  onEditOffering,
  onAddCalls,
  onCreateCall,
  onSetOnPage,
  justAddedIds = [],
}) {
  // Only the calls that are on their page (the rest are in the 1:1 calls tab)
  const offerings = useMemo(() => buildProfileJson(getMyPage(answers)).services, [answers]);
  // The calls that aren't, newest first: what "Add to your page" offers
  const offPage = useMemo(() => {
    const all = buildProfileJson(getMyProfile(answers)).services;
    return myCallIds(answers)
      .filter((id) => !isOnPage(answers, id))
      .map((id) => all.find((s) => s.id === id))
      .filter(Boolean);
  }, [answers]);
  const [choosing, setChoosing] = useState(false); // "Add to your page" showing
  const justAdded = offerings.filter((o) => justAddedIds.includes(o.id));

  // Just taken off: its name, for the note with Undo, until it fades
  const [removed, setRemoved] = useState(null);
  const undoTimer = useRef(null);
  useEffect(() => () => clearTimeout(undoTimer.current), []);
  const remove = (o) => {
    onSetOnPage(o.id, false);
    setRemoved({ id: o.id, title: o.title });
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setRemoved(null), UNDO_MS);
  };
  const undo = () => {
    clearTimeout(undoTimer.current);
    onSetOnPage(removed.id, true);
    setRemoved(null);
  };

  // No calls at all: nothing to pick, so straight to making one
  const add = () => (offPage.length === 0 && offerings.length === 0 ? onCreateCall() : setChoosing(true));
  const link = `${PAGE_DOMAIN}/${answers.handle}`;
  const url = pageUrl(answers.handle);

  const [copy, copyLink] = useCopy();

  return (
    <div className="oh">
      <h1 className="oh__title">Your offerings page</h1>

      {/* ---------- Your page: who they are, and their link ---------- */}
      <section className="oh__panel oh__me" aria-labelledby="oh-name">
        <div className="oh__me-head">
          <span className="oh__avatar" aria-hidden="true">
            {answers.photo ? <img src={answers.photo} alt="" /> : initials(answers.name)}
          </span>
          <div className="oh__me-text">
            <h2 className="oh__name" id="oh-name">
              {answers.name}
            </h2>
            {answers.bio && <p className="oh__bio">{answers.bio}</p>}
          </div>
          <button type="button" className="oh__btn oh__edit-profile" onClick={onEditProfile}>
            <Pencil size={15} aria-hidden="true" /> Edit profile
          </button>
        </div>

        {/* Label, value, actions */}
        <div className="oh__row">
          <span className="oh__row-label">Your offerings page link</span>
          <span className="oh__row-value oh__url" title={url}>
            {link}
          </span>
          <div className="oh__row-actions">
            <button type="button" className="oh__btn oh__copy" onClick={() => copyLink(url)}>
              {copy === 'copied' ? <Check size={15} strokeWidth={3} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
              {copy === 'copied' ? 'Copied' : 'Copy link'}
            </button>
            <a
              className="oh__btn oh__open"
              href={url}
              target="_blank"
              rel="noopener"
              aria-label="Open your page (opens in a new tab)"
              data-tip="Open your page"
              data-tip-align="end"
            >
              <ExternalLink size={15} aria-hidden="true" />
            </a>
          </div>
          <span className="oh__sr-only" aria-live="polite">
            {copy === 'copied' && 'Link copied'}
          </span>
          {copy === 'failed' && (
            <p className="oh__copy-error" role="alert">
              Couldn’t copy. Select the link and copy it yourself.
            </p>
          )}
        </div>
      </section>

      {/* ---------- Offerings ---------- */}
      <section className="oh__panel" aria-labelledby="oh-offerings">
        <div className="oh__panel-head oh__panel-head--split">
          <div>
            <h2 className="oh__panel-title" id="oh-offerings">
              Offerings <span className="oh__count">{offerings.length}</span>
            </h2>
            <p className="oh__panel-sub">Each one has its own link, to share on its own.</p>
          </div>
          <button type="button" className="oh__add" onClick={add}>
            <Plus size={16} strokeWidth={2.5} aria-hidden="true" /> Add to your page
          </button>
        </div>

        <div className="oh__panel-body">
          {offerings.length === 0 ? (
            <div className="oh__none">
              <p className="oh__none-title">Nothing on your page yet</p>
              <p className="oh__none-text">Add a 1:1 call so people have something to book.</p>
            </div>
          ) : (
            <div className="oh__grid">
              {offerings.map((o) => (
                <OfferingCard
                  key={o.id}
                  offering={o}
                  url={offeringUrl(answers.handle, o.id)}
                  onEdit={onEditOffering}
                  onRemove={() => remove(o)}
                  isNew={justAddedIds.includes(o.id)}
                />
              ))}
            </div>
          )}
          {/* Tells screen readers what's just been added */}
          <p className="oh__sr-only" aria-live="polite">
            {justAdded.length === 1
              ? `${justAdded[0].title} is now on your page.`
              : justAdded.length > 1
                ? `${justAdded.length} calls are now on your page.`
                : ''}
          </p>
        </div>
      </section>

      {/* Just taken off the page: a note with Undo, for a few seconds */}
      <div className="oh__notice-wrap" aria-live="polite">
        {removed && (
          <p className="oh__notice">
            <span className="oh__notice-text">“{removed.title}” is off your page</span>
            <button type="button" className="oh__notice-undo" onClick={undo}>
              Undo
            </button>
          </p>
        )}
      </div>

      {choosing && (
        <AddToPagePicker
          calls={offPage}
          onClose={() => setChoosing(false)}
          onAdd={(picked) => {
            setChoosing(false);
            onAddCalls(picked);
          }}
          onCreate={() => {
            setChoosing(false);
            onCreateCall();
          }}
        />
      )}
    </div>
  );
}