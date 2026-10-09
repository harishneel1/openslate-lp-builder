import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ExternalLink, MoreHorizontal, Trash2 } from 'lucide-react';
import PageThumbnail from './PageThumbnail';
import { funnelTypes } from '../data/funnelTypes';
import { funnelName } from '../utils/funnelName';
import './SavedFunnelCard.css';

// "Edited 5 min ago" (worked out when the picker opens; doesn't tick live)
function editedAgo(timestamp) {
  const mins = Math.floor((Date.now() - timestamp) / 60000);
  if (mins < 1) return 'Edited just now';
  if (mins < 60) return `Edited ${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Edited ${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Edited ${days} ${days === 1 ? 'day' : 'days'} ago`;
  return `Edited ${new Date(timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
}

// The ⋯ button and its small menu: Preview (once the landing page is done) and Delete.
// Delete asks first. Closes on a click outside or Escape. Duplicate can join later.
// previewHref: address of the full-screen preview, or null when there's nothing to preview.
function CardMenu({ name, previewHref, onDelete }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);
  const firstRef = useRef(null); // first item in the menu (focused when it opens)

  const close = (returnFocus = false) => {
    setOpen(false);
    setConfirming(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) close();
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') close(true);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard users land inside the menu (on Cancel when confirming)
  useEffect(() => {
    if (open) firstRef.current?.focus();
  }, [open, confirming]);

  return (
    <div className="saved-card__menu" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className="saved-card__more"
        aria-label={`More options for ${name}`}
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <MoreHorizontal size={18} />
      </button>

      {open && (
        <div className="saved-card__popover">
          {confirming ? (
            <div className="saved-card__confirm">
              <p className="saved-card__confirm-title">Delete this funnel?</p>
              <p className="saved-card__confirm-text">
                Everything you entered will be gone. This can't be undone.
              </p>
              <div className="saved-card__confirm-actions">
                <button
                  ref={firstRef}
                  type="button"
                  className="saved-card__confirm-cancel"
                  onClick={() => close(true)}
                >
                  Cancel
                </button>
                <button type="button" className="saved-card__confirm-delete" onClick={onDelete}>
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <>
              {previewHref && (
                <a
                  ref={firstRef}
                  className="saved-card__item"
                  href={previewHref}
                  target="_blank"
                  rel="noopener"
                  aria-label="Preview landing page (opens in a new tab)"
                  // Close after the click has opened the tab (closing straight away
                  // would remove the link before the browser follows it)
                  onClick={() => setTimeout(() => close(), 0)}
                >
                  <ExternalLink size={16} /> Preview
                </a>
              )}
              <button
                ref={previewHref ? undefined : firstRef}
                type="button"
                className="saved-card__item saved-card__item--danger"
                onClick={() => setConfirming(true)}
              >
                <Trash2 size={16} /> Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// One funnel they've started: the card opens it, ⋯ has Preview and Delete.
export default function SavedFunnelCard({ funnel, onOpen, onDelete }) {
  const type = funnelTypes.find((t) => t.id === funnel.type);
  if (!type) return null;

  const { pages, icon: Icon } = type;
  const name = funnelName(funnel, type);
  const done = pages.filter((p) => funnel.donePages.includes(p.id));
  const ready = done.length === pages.length;
  const landingDone = funnel.donePages.includes('landing');

  let detail;
  if (ready) {
    detail = `All ${pages.length} pages done`;
  } else if (done.length > 0) {
    detail = `${done[done.length - 1].name} done · ${done.length} of ${pages.length} pages`;
  } else {
    detail = `${pages[0].name} in progress`;
  }

  return (
    <div className="saved-card">
      <button type="button" className="saved-card__open" onClick={() => onOpen(funnel.id)}>
        {landingDone ? (
          <PageThumbnail answers={funnel.answers} themeId={funnel.themeId} />
        ) : (
          // No design picked yet, so no page picture: just the funnel's icon
          <div className="saved-card__placeholder" aria-hidden="true">
            <span className="saved-card__icon">
              <Icon size={22} strokeWidth={2} />
            </span>
          </div>
        )}

        <div className="saved-card__body">
          <span className={`saved-card__status ${ready ? 'saved-card__status--ready' : ''}`}>
            {ready ? 'Ready to publish' : 'In progress'}
          </span>
          <h3 className="saved-card__name">{name}</h3>
          <p className="saved-card__detail">{detail}</p>

          <div className="saved-card__footer">
            <span className="saved-card__edited">{editedAgo(funnel.updatedAt)}</span>
            <span className="saved-card__cta">
              {ready ? 'Review and publish' : 'Continue'} <ArrowRight size={16} />
            </span>
          </div>
        </div>
      </button>

      <CardMenu
        name={name}
        previewHref={landingDone ? `?preview=${encodeURIComponent(funnel.id)}` : null}
        onDelete={() => onDelete(funnel.id)}
      />
    </div>
  );
}