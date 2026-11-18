import { useEffect, useState } from 'react';
import './OverflowTip.css';

// ------------------------------------------------------------
// Names cut short: the whole name in a tooltip.
// Any element with data-full (the whole name) that's cut off with "…"
// shows the whole name above it, in our dark tooltip, while it's pointed
// at, or while it (or the button or link it sits in) has keyboard focus.
// Names that fit show none. The tooltip floats over the page, so a
// scrolling column can't clip it; it goes below instead when there's no
// room above. Screen readers already get the whole name, so it's hidden
// from them.
//
// Render it once on a page (CourseContent.jsx does, for the curriculum
// outline). The student player (CoursePlayerPage.jsx) has its own copy of
// the same thing; it can switch to this one later.
// ------------------------------------------------------------

export default function OverflowTip() {
  const [tip, setTip] = useState(null); // { text, x, y, below }

  useEffect(() => {
    const nameIn = (target) => {
      if (!(target instanceof Element)) return null;
      const own = target.closest('[data-full]');
      if (own) return own;
      return target.closest('a, button')?.querySelector('[data-full]') ?? null;
    };
    const show = (e) => {
      const el = nameIn(e.target);
      if (!el || el.scrollWidth <= el.clientWidth + 1) {
        setTip(null);
        return;
      }
      const box = el.getBoundingClientRect();
      const below = box.top < 64;
      setTip({
        text: el.dataset.full,
        x: Math.min(Math.max(box.left + box.width / 2, 170), window.innerWidth - 170),
        y: below ? box.bottom + 8 : box.top - 8,
        below,
      });
    };
    const hide = () => setTip(null);
    document.addEventListener('pointerover', show);
    document.addEventListener('focusin', show);
    document.addEventListener('focusout', hide);
    document.addEventListener('scroll', hide, true);
    document.addEventListener('dragstart', hide, true);
    window.addEventListener('blur', hide);
    return () => {
      document.removeEventListener('pointerover', show);
      document.removeEventListener('focusin', show);
      document.removeEventListener('focusout', hide);
      document.removeEventListener('scroll', hide, true);
      document.removeEventListener('dragstart', hide, true);
      window.removeEventListener('blur', hide);
    };
  }, []);

  if (!tip) return null;
  return (
    <span className={`oft ${tip.below ? 'oft--below' : ''}`} style={{ left: tip.x, top: tip.y }} aria-hidden="true">
      {tip.text}
    </span>
  );
}