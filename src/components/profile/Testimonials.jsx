import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, User } from 'lucide-react';
import './Testimonials.css';

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// A row of reviews that scrolls sideways, with arrows on wider screens.
// showService: name the call each review is for (off when they're all for one call)
export default function Testimonials({ items, titleId, showService = true }) {
  const track = useRef(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  // Which ends the row is at, so an arrow with nowhere to go is disabled
  useEffect(() => {
    const el = track.current;
    if (!el) return undefined;
    const update = () =>
      setEdges({
        start: el.scrollLeft <= 4,
        end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
      });
    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [items.length]);

  const move = (dir) =>
    track.current?.scrollBy({
      left: dir * track.current.clientWidth * 0.85,
      behavior: reduceMotion() ? 'auto' : 'smooth',
    });

  const scrolls = !(edges.start && edges.end);

  return (
    <>
      <div className="tm-head">
        <h2 id={titleId} className="pf__section-title">What clients say</h2>
        {scrolls && (
          <div className="tm-arrows">
            <button type="button" className="tm-arrow" onClick={() => move(-1)} disabled={edges.start} aria-label="Previous reviews">
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <button type="button" className="tm-arrow" onClick={() => move(1)} disabled={edges.end} aria-label="More reviews">
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      <ul className="tm-track" ref={track}>
        {items.map((t) => (
          <li key={t.id} className="tm">
            <figure className="tm__inner">
              <blockquote className="tm__text">{t.text}</blockquote>
              <figcaption className="tm__by">
                <span className="tm__avatar" aria-hidden="true">
                  {t.initials || <User size={16} />}
                </span>
                <span className="tm__who">
                  <span className="tm__name">{t.name}</span>
                  <span className="tm__detail">{showService && t.service ? `${t.service}, ${t.date}` : t.date}</span>
                </span>
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </>
  );
}