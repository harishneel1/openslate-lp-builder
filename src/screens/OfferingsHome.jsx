import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Copy, ExternalLink, Link2, Pencil } from 'lucide-react';
import { PAGE_DOMAIN, offeringUrl, pageUrl } from '../data/myPage';
import { SHORT_DESCRIPTION_MAX, STOREFRONT_SOURCES } from '../data/storefrontItems';
import { initials } from '../utils/initials';
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

// One thing they've made, as a full-width row: what it is on the left,
// its switch and actions on the right. Switched on, the short description
// on its card opens underneath, prefilled, to change in place:
//
//   Discovery call                      [● On ] [Copy link] [Edit] [↗]
//   Video call · 30 min · Free
//   Short description
//   ┌ A short call to get to know each other and see if… ┐
//   └────────────────────────────────────────────────────┘
//   Shows under its name on your storefront.          88/200
//
// Off, it isn't on the storefront, but its own link still works.
// url: its own link (offeringUrl)
function OfferingRow({ offering, url, on, line, onSetOn, onLine, onEdit }) {
  const details = offering.facts.map((f) => f.text).join(' · ');
  const [copy, copyLink] = useCopy();
  const boxId = `oh-line-${offering.id}`;
  const empty = on && line.trim() === '';

  return (
    <li className={`oh-row ${on ? '' : 'oh-row--off'}`}>
      <div className="oh-row__main">
        <div className="oh-row__text">
          <h3 className="oh-row__name">{offering.title}</h3>
          <p className="oh-row__detail">
            {details} ·{' '}
            <span className={offering.price.isFree ? 'oh-row__price oh-row__price--free' : 'oh-row__price'}>
              {offering.price.label}
            </span>
          </p>
        </div>

        <div className="oh-row__actions">
          {/* On the storefront, or not: a switch, as it flips straight away */}
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={`Show ${offering.title} on your storefront`}
            className="oh-switch oh-switch--short"
            onClick={() => onSetOn(!on)}
          >
            <span className="oh-switch__track" aria-hidden="true">
              <span className="oh-switch__thumb" />
            </span>
            <span className="oh-switch__label" aria-hidden="true">
              {on ? 'On' : 'Off'}
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
        </div>
      </div>

      {/* Only for what's on the storefront: the line on its card */}
      {on && (
        <div className="oh-row__line">
          <label className="oh-row__line-label" htmlFor={boxId}>
            Short description
          </label>
          <textarea
            id={boxId}
            className={`qinput__text oh-row__line-box ${empty ? 'qinput__text--error' : ''}`}
            rows={2}
            maxLength={SHORT_DESCRIPTION_MAX}
            value={line}
            placeholder="A line or two on what happens in it"
            aria-invalid={empty || undefined}
            onChange={(e) => onLine(e.target.value)}
          />
          <span className="oh-row__line-under">
            <span className={empty ? 'oh-row__line-error' : ''}>
              {empty ? 'Add a short description, so its card isn’t bare.' : 'Shows under its name on your storefront.'}
            </span>
            <span>
              {line.length}/{SHORT_DESCRIPTION_MAX}
            </span>
          </span>
        </div>
      )}

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
// The storefront page, once setup is done, as cards with the same frame:
//
//   Your page   ┌ (photo) Name, one line of bio          [Edit profile] ┐
//               └ Your storefront link  harishneel.page  [Copy link] [↗] ┘
//   1:1 calls   every call they've made, each with an On/Off switch and,
//               when on, the short description on its card
//
// Nothing is made here: calls are made in the 1:1 calls tab and show up
// here switched off. One card per type (STOREFRONT_SOURCES), so webinars
// and courses can join later the same way. A type with nothing made yet
// says so, with a way to its tab.
//
// onEditProfile: opens the profile editor (photo, name, bio, link)
// onEditOffering(id): opens the editor for one offering
// onSetOn(source, item, on): switch one on or off
// onSetLine(source, id, text): its short description changed
// onGoToTab(tab): opens a sidebar tab ('calls')
// ------------------------------------------------------------
export default function OfferingsHome({ answers, onEditProfile, onEditOffering, onSetOn, onSetLine, onGoToTab }) {
  const link = `${PAGE_DOMAIN}/${answers.handle}`;
  const url = pageUrl(answers.handle);

  const [copy, copyLink] = useCopy();

  return (
    <div className="oh">
      <h1 className="oh__title">Your storefront</h1>

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
          <span className="oh__row-label">Your storefront link</span>
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

        {/* Track record off: the one nudge, as on a course's page. It's in Edit profile. */}
        {!answers.trackRecord?.on && (
          <div className="oh__nudge">
            <p className="oh__nudge-text">
              <strong>Your track record isn’t shown.</strong> It’s recommended: your rating and how many people you’ve helped
              make people more likely to book.
            </p>
            <button type="button" className="oh__btn" onClick={onEditProfile}>
              Add it
            </button>
          </div>
        )}
      </section>

      {/* ---------- One card per type: everything they've made ---------- */}
      {STOREFRONT_SOURCES.map((source) => {
        const items = source.items(answers);
        const onCount = items.filter((i) => source.isOn(answers, i.id)).length;
        const headId = `oh-${source.kind}`;
        return (
          <section key={source.kind} className="oh__panel" aria-labelledby={headId}>
            <div className="oh__panel-head oh__panel-head--split">
              <div>
                <h2 className="oh__panel-title" id={headId}>
                  {source.label} <span className="oh__count">{onCount} of {items.length} on</span>
                </h2>
                <p className="oh__panel-sub">Switch on what people should see, and give each a short description.</p>
              </div>
              {onGoToTab && (
                <button type="button" className="oh__btn" onClick={() => onGoToTab(source.tab)}>
                  Go to {source.tabLabel} <ArrowRight size={15} aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="oh__panel-body">
              {items.length === 0 ? (
                <div className="oh__none">
                  <p className="oh__none-title">Nothing here yet</p>
                  <p className="oh__none-text">{source.empty}</p>
                </div>
              ) : (
                <ul className="oh__rows">
                  {items.map((item) => (
                    <OfferingRow
                      key={item.id}
                      offering={item}
                      url={offeringUrl(answers.handle, item.id)}
                      on={source.isOn(answers, item.id)}
                      line={source.lineOf(answers, item)}
                      onSetOn={(on) => onSetOn(source, item, on)}
                      onLine={(text) => onSetLine(source, item.id, text)}
                      onEdit={onEditOffering}
                    />
                  ))}
                </ul>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
