import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, ChevronDown, Copy, ExternalLink, Link2, Pencil } from 'lucide-react';
import { PAGE_DOMAIN, pageUrl } from '../data/myPage';
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
// url: its own link (a call's booking page, a course's landing page)
// blocked: why it can't be switched on yet (a class with no contract), or null
// picker: a choice under the short description while it's on, or null:
//   { label, options: [{ id, label }], value, note }, with onPick(value)
function OfferingRow({ offering, url, on, line, onSetOn, onLine, onEdit, blocked = null, notice = null, picker = null, onPick }) {
  const [copy, copyLink] = useCopy();
  const boxId = `oh-line-${offering.id}`;
  const empty = on && line.trim() === '';
  const panelId = `oh-set-${offering.id}`;

  // Its settings fold away. They start folded, except when they need doing
  // (no short description yet), and open by themselves when it's switched on.
  const [open, setOpen] = useState(empty);
  const wasOn = useRef(on);
  useEffect(() => {
    if (on && !wasOn.current) setOpen(true);
    wasOn.current = on;
  }, [on]);
  const canOpen = on;
  const toggle = () => canOpen && setOpen((o) => !o);
  // A click anywhere on the row opens or closes it, except on its own
  // controls (switch, buttons, links) and inside its open settings
  const onRowClick = (e) => {
    if (e.target.closest('button, a, input, textarea, select, label, .oh-row__line')) return;
    toggle();
  };

  return (
    <li className={`oh-row ${on ? '' : 'oh-row--off'} ${canOpen ? 'oh-row--folds' : ''}`} onClick={onRowClick}>
      <div className="oh-row__main">
        <div className="oh-row__text">
          {/* Just its name: kept clean and simple */}
          <h3 className="oh-row__name">{offering.title}</h3>
        </div>

        <div className="oh-row__actions">
          {/* On the storefront, or not: a switch, as it flips straight away */}
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={`Show ${offering.title} on your storefront`}
            className="oh-switch oh-switch--short"
            disabled={Boolean(blocked)}
            onClick={() => onSetOn(!on)}
          >
            <span className="oh-switch__track" aria-hidden="true">
              <span className="oh-switch__thumb" />
            </span>
            <span className="oh-switch__label" aria-hidden="true">
              {on ? 'On' : 'Off'}
            </span>
          </button>
          {url && (
          <button type="button" className="oh-card__copy" onClick={() => copyLink(url)} aria-label={`Copy link to ${offering.title}`}>
            {copy === 'copied' ? <Check size={16} strokeWidth={3} aria-hidden="true" /> : <Link2 size={16} aria-hidden="true" />}
            {copy === 'copied' ? 'Copied' : 'Copy link'}
          </button>
          )}
          <button type="button" className="oh__edit oh-card__edit" onClick={() => onEdit(offering.id)} aria-label={`Edit ${offering.title}`}>
            <Pencil size={15} aria-hidden="true" /> Edit
          </button>
          {url && (
          <a
            className="oh__edit oh-card__preview"
            href={url}
            target="_blank"
            rel="noopener"
            aria-label={`Preview ${offering.title} (opens in a new tab)`}
            data-tip="Preview"
            data-tip-align="end"
          >
            <ExternalLink size={16} aria-hidden="true" />
          </a>
          )}
          {/* Off: nothing to set, so no chevron (its room kept, so rows line up) */}
          {canOpen ? (
            <button
              type="button"
              className={`oh-row__fold ${open ? 'oh-row__fold--open' : ''}`}
              aria-expanded={open}
              aria-controls={panelId}
              aria-label={`${open ? 'Hide' : 'Show'} settings for ${offering.title}`}
              onClick={toggle}
            >
              <ChevronDown size={18} aria-hidden="true" />
            </button>
          ) : (
            <span className="oh-row__fold oh-row__fold--spacer" aria-hidden="true" />
          )}
        </div>
      </div>

      {/* Can't be switched on yet: says what to do first */}
      {blocked && <p className="oh-row__blocked">{blocked}</p>}

      {/* On, but not showing right now (a webinar with no session to come) */}
      {on && notice && <p className="oh-row__blocked">{notice}</p>}

      {/* Only for what's on the storefront: the line on its card */}
      {on && open && (
        <div className="oh-row__line" id={panelId}>
          <label className="oh-row__line-label" htmlFor={boxId}>
            Short description
          </label>
          <textarea
            id={boxId}
            className={`oh-field oh-row__line-box ${empty ? 'oh-field--error' : ''}`}
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

          {/* A live class: which of its contracts the card sells */}
          {picker && (
            <>
              <label className="oh-row__line-label oh-row__pick-label" htmlFor={`oh-pick-${offering.id}`}>
                {picker.label}
              </label>
              <select
                id={`oh-pick-${offering.id}`}
                className="oh-field oh-select oh-row__pick"
                value={picker.value}
                onChange={(e) => onPick(e.target.value)}
              >
                {picker.options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
              {picker.note && (
                <span className="oh-row__line-under">
                  <span>{picker.note}</span>
                </span>
              )}
            </>
          )}
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
//   Offerings   [1:1 calls · 2 of 3 on] [Courses · 1 of 2 on]   (a tab per type)
//               the chosen type's list: each with an On/Off switch and,
//               when on, the short description on its card
//
// Nothing is made here: calls are made in 1:1 calls, courses in Courses
// (only published ones are listed), and they show up here switched off.
// A tab per type (STOREFRONT_SOURCES), so webinars can join the same way,
// and nobody scrolls past one type to find the next. Each tab has its own
// note and "Go to …" button, and says so when there's nothing yet.
//
// onEditProfile: opens the profile editor (photo, name, bio, link)
// onEditOffering(id): opens the editor for one offering
// onSetOn(source, item, on): switch one on or off
// onSetLine(source, id, text): its short description changed
// onSetPick(source, id, value): its picker changed (a live class's contract)
// onGoToTab(tab): opens a sidebar tab ('calls', 'courses'); a course's Edit goes there too
// ------------------------------------------------------------
export default function OfferingsHome({ answers, onEditProfile, onEditOffering, onSetOn, onSetLine, onSetPick, onGoToTab }) {
  const link = `${PAGE_DOMAIN}/${answers.handle}`;
  const url = pageUrl(answers.handle);

  const [copy, copyLink] = useCopy();

  // The type showing in Offerings (a tab each)
  const [tab, setTab] = useState(STOREFRONT_SOURCES[0].kind);
  const current = STOREFRONT_SOURCES.find((src) => src.kind === tab) ?? STOREFRONT_SOURCES[0];

  // What's on goes first. The order is set when a tab opens and then held,
  // so a row doesn't jump away the moment its switch is flipped.
  const isShown = (source, item) => source.isOn(answers, item.id) && !source.blockedOf?.(answers, item);
  const onFirstIds = (source) => {
    const items = source.items(answers);
    return [...items.filter((i) => isShown(source, i)), ...items.filter((i) => !isShown(source, i))].map((i) => i.id);
  };
  const [order, setOrder] = useState(() => ({ kind: tab, ids: onFirstIds(current) }));
  const openTab = (source) => {
    setTab(source.kind);
    setOrder({ kind: source.kind, ids: onFirstIds(source) });
  };
  const rank = (id) => {
    const i = order.kind === current.kind ? order.ids.indexOf(id) : -1;
    return i === -1 ? Infinity : i;
  };
  const currentItems = current
    .items(answers)
    .map((item, i) => ({ item, i }))
    .sort((a, b) => rank(a.item.id) - rank(b.item.id) || a.i - b.i)
    .map(({ item }) => item);

  // Arrow keys move between the tabs, as tabs do
  const moveTab = (e) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    const i = STOREFRONT_SOURCES.findIndex((src) => src.kind === tab);
    const next = STOREFRONT_SOURCES[(i + step + STOREFRONT_SOURCES.length) % STOREFRONT_SOURCES.length];
    openTab(next);
    document.getElementById(`oh-tab-${next.kind}`)?.focus();
  };

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

      {/* ---------- Offerings: one card, a tab per type ---------- */}
      <section className="oh__panel" aria-labelledby="oh-offerings">
        <div className="oh__panel-head oh__panel-head--tabs">
          <h2 className="oh__panel-title" id="oh-offerings">
            Offerings
          </h2>
          <p className="oh__panel-sub">Switch on what people should see, and give each a short description.</p>
        </div>

        <div className="oh-tabs" role="tablist" aria-label="Kinds of offering">
          {STOREFRONT_SOURCES.map((source) => {
            const selected = source.kind === tab;
            return (
              <button
                key={source.kind}
                type="button"
                role="tab"
                id={`oh-tab-${source.kind}`}
                aria-selected={selected}
                aria-controls={`oh-pane-${source.kind}`}
                tabIndex={selected ? 0 : -1}
                className={`oh-tab ${selected ? 'oh-tab--on' : ''}`}
                onClick={() => openTab(source)}
                onKeyDown={moveTab}
              >
                {source.label}
              </button>
            );
          })}
        </div>

        {/* The chosen type's list */}
        <div
          className="oh__panel-body"
          role="tabpanel"
          id={`oh-pane-${current.kind}`}
          aria-labelledby={`oh-tab-${current.kind}`}
        >
          {/* With nothing listed, the empty note below already says it */}
          {currentItems.length > 0 && current.note && <p className="oh-pane__note">{current.note}</p>}

          {currentItems.length === 0 ? (
            <div className="oh__none">
              <p className="oh__none-title">Nothing here yet</p>
              <p className="oh__none-text">{current.empty}</p>
              {onGoToTab && (
                <button type="button" className="oh__btn oh__none-go" onClick={() => onGoToTab(current.tab)}>
                  Go to {current.tabLabel} <ArrowRight size={15} aria-hidden="true" />
                </button>
              )}
            </div>
          ) : (
            <ul className="oh__rows">
              {currentItems.map((item) => (
                <OfferingRow
                  key={item.id}
                  offering={item}
                  url={current.urlOf(answers, item.id)}
                  on={isShown(current, item)}
                  blocked={current.blockedOf?.(answers, item) ?? null}
                  notice={current.noticeOf?.(answers, item) ?? null}
                  picker={current.pickerOf?.(answers, item) ?? null}
                  onPick={(value) => onSetPick(current, item.id, value)}
                  line={current.lineOf(answers, item)}
                  onSetOn={(on) => onSetOn(current, item, on)}
                  onLine={(text) => onSetLine(current, item.id, text)}
                  // A call opens its editor here; a course is edited in Courses
                  onEdit={current.editsHere ? onEditOffering : () => onGoToTab?.(current.tab)}
                />
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
