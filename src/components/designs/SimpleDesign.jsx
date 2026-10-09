import { CalendarDays } from 'lucide-react';
import './SimpleDesign.css';

// One finished design. Renders ONLY from the page JSON (buildPageJson),
// never from raw answers. The real renderer will replace this.

const formatPrice = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

function Hero({ hero, event, pricing }) {
  const isPaid = pricing.type === 'paid' && pricing.price !== null;

  return (
    <header className="sd__hero">
      <div className="sd__hero-text">
        <h1 className="sd__headline">{hero.title}</h1>
        {hero.subtitle && <p className="sd__sub">{hero.subtitle}</p>}
      </div>

      {/* The "ticket": when + details on top, price + button on the stub */}
      <div className="sd__ticket">
        {event.label && (
          <p className="sd__when">
            <CalendarDays size={18} /> {event.label}
          </p>
        )}
        {hero.details.length > 0 && (
          <ul className="sd__details">
            {hero.details.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        )}

        <div className="sd__stub">
          <p className="sd__price">
            {isPaid ? formatPrice(pricing.price) : 'Free'}
            {isPaid && pricing.oldPrice !== null && <s>{formatPrice(pricing.oldPrice)}</s>}
          </p>
          <span className="sd__button">{pricing.ctaLabel}</span>
        </div>
      </div>
    </header>
  );
}

export default function SimpleDesign({ page }) {
  return (
    <div className="sd">
      <Hero {...page} />

      {/* TEMPORARY: replaced by the other sections in the next chunk */}
      <p className="sd__todo">The rest of your page appears here in the next step.</p>
    </div>
  );
}