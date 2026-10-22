import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, ExternalLink, Link2, Pencil, Plus, Trash2 } from 'lucide-react';
import { getListedOnPage, getMyProfile, isHiddenOnPage, isOnPage, myCallIds } from '../data/myProfile';
import { buildProfileJson } from '../data/buildProfileJson';
import { PAGE_DOMAIN, offeringUrl, pageUrl } from '../data/myPage';
import { initials } from '../utils/initials';
import AddToPagePicker from '../components/AddToPagePicker';
import RowMenu from '../components/RowMenu';
import ConfirmDialog from '../components/ConfirmDialog';
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

// One offering, as a full-width row (the same rows as 1:1 calls): what it
// is on the left, then what you can do with it:
//
//   Discovery call  [Hidden]          [● Visible] [Copy link] [Edit] [↗] [⋯]
//   Video call · 30 min · Free
//
// Visible: a switch. Off, it stays in this list (faded, tagged Hidden) but
// visitors don't see it on the page; on, it's back. Its own link works
// either way. ⋯ holds Remove from page, which asks first and takes it off
// this list only: it stays in 1:1 calls, where it can be deleted for good.
// There's no kind icon: every offering is a call, and the details already
// say "Video call".
// url: this offering's own link (offeringUrl)
// isNew: just added, so it's marked and lit up briefly
// hidden: on the list but not shown to visitors
function OfferingRow({ offering, url, hidden, isNew = false, menuOpen, onMenu, onEdit, onSetHidden, onRemove }) {
  const details = offering.facts.map((f) => f.text).join(' · ');
  const [copy, copyLink] = useCopy();

  return (
    <li className={`oh-row ${isNew ? 'oh-row--new' : ''} ${menuOpen ? 'oh-row--menu' : ''} ${hidden ? 'oh-row--hidden' : ''}`}>
      <div className="oh-row__text">
        {isNew && <span className="oh-card__new">Just added</span>}
        <h3 className="oh-row__name">
          {offering.title}
          {hidden && <span className="oh-row__tag">Hidden</span>}
        </h3>
        <p className="oh-row__detail">
          {details} ·{' '}
          <span className={offering.price.isFree ? 'oh-row__price oh-row__price--free' : 'oh-row__price'}>
            {offering.price.label}
          </span>
        </p>
      </div>

      <div className="oh-row__actions">
        {/* Shown on the page, or not: a switch, as it flips straight away */}
        <button
          type="button"
          role="switch"
          aria-checked={!hidden}
          aria-label={`Show ${offering.title} on your page`}
          className="oh-switch"
          onClick={() => onSetHidden(!hidden)}
        >
          <span className="oh-switch__track" aria-hidden="true">
            <span className="oh-switch__thumb" />
          </span>
          <span className="oh-switch__label" aria-hidden="true">
            {hidden ? 'Hidden' : 'Visible'}
          </span>
        </button>
        <button type="button" className="oh-card__copy" onClick={() => copyLink(url)} aria-label={`Copy link to ${offering.title}`}>
          {copy === 'copied' ? <Check size={16} strokeWidth={3} aria-hidden="true" /> : <Link2 size={16} aria-hidden="true" />}
          {copy === 'copied' ? 'Copied' : 'Copy link'}
        </button>
        <button type="button" className="oh__edit oh-card__edit" onClick={() => onEdit(offering.id)} aria-label={`Edit ${offering.title}`}>
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
        <RowMenu
          title={offering.title}
          open={menuOpen}
          onOpenChange={onMenu}
          items={[{ label: 'Remove from page', icon: Trash2, danger: true, onSelect: onRemove }]}
        />
      </div>

      <span className="oh__sr-only" aria-live="polite">
        {copy === 'copied' && `Link to ${offering.title} copied`}
      </span>
      {copy === 'failed' && (
        <p className="oh__copy-error oh-row__error" role="alert">
          Couldn’t copy. Select the link and copy it yourself: <span className="oh-card__url">{url}</span>
        </p>
      )}
    </li>
  );
}

// ------------------------------------------------------------
// Home for a live offerings page, as two cards with the same frame:
//
//   Your page   ┌ (photo) Name, one line of bio          [Edit profile] ┐
//               └ Your offerings page link  harishneel.page  [Copy link] [↗] ┘
//   Offerings   the calls that are on their page, each with its own link
//
// Every action lines up on the card's right edge. Each offering is a
// full-width row (OfferingRow), with a Visible switch and ⋯ → Remove from page.
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
// onSetHidden(id, hidden): hide one from visitors, or show it again
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
  onSetHidden,
  justAddedIds = [],
}) {
  // The calls on their page, hidden ones too (the rest are in the 1:1 calls tab)
  const offerings = useMemo(() => buildProfileJson(getListedOnPage(answers)).services, [answers]);
  const [menuFor, setMenuFor] = useState(null); // the row whose ⋯ menu is open
  const [removing, setRemoving] = useState(null); // { id, title } while the pop-up asks
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
            <ul className="oh__rows">
              {offerings.map((o) => (
                <OfferingRow
                  key={o.id}
                  offering={o}
                  url={offeringUrl(answers.handle, o.id)}
                  hidden={isHiddenOnPage(answers, o.id)}
                  isNew={justAddedIds.includes(o.id)}
                  menuOpen={menuFor === o.id}
                  onMenu={(open) => setMenuFor(open ? o.id : null)}
                  onEdit={onEditOffering}
                  onSetHidden={(hide) => onSetHidden(o.id, hide)}
                  onRemove={() => {
                    setMenuFor(null);
                    setRemoving({ id: o.id, title: o.title });
                  }}
                />
              ))}
            </ul>
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

      {/* Remove from page: asked first. Only this page: deleting for good is in 1:1 calls */}
      {removing && (
        <ConfirmDialog
          title="Remove from your page?"
          confirmLabel="Remove from page"
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            remove(removing);
            setRemoving(null);
          }}
        >
          <p>
            <strong>“{removing.title}”</strong> will be removed from your offerings page only. 
          </p>
          <p>
            To delete it permantly, go to <strong>1:1 calls</strong> in the sidebar.
          </p>
        </ConfirmDialog>
      )}

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