import { useEffect } from 'react';
import { CalendarDays } from 'lucide-react';
import './SimpleDesign.css';
import { loadThemeFont } from '../../data/themes';

// One renderer for every theme. Renders ONLY from the page JSON
// (buildPageJson); the look comes from the theme (themes.js).
// The real renderer will replace this.

const formatPrice = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

// Theme tokens → CSS variables: { accent: '#f4b223' } → { '--sd-accent': '#f4b223' }
const themeStyle = (theme) =>
  Object.fromEntries(Object.entries(theme.tokens).map(([key, value]) => [`--sd-${key}`, value]));

// Loads a theme's Google Fonts once; switching back doesn't reload them
// Loads a theme's Google Fonts once; switching back doesn't reload them
function useThemeFont(theme) {
  useEffect(() => {
    loadThemeFont(theme);
  }, [theme]);
}

function Hero({ hero, event, pricing }) {
  const isPaid = pricing.type === 'paid' && pricing.price !== null;

  return (
    <header className="sd__hero">
      <div className="sd__hero-text">
        <h1 className="sd__headline">{hero.title}</h1>
        {hero.subtitle && <p className="sd__sub">{hero.subtitle}</p>}
      </div>

      {/* Sign-up card: when + details on top, price + button below */}
      <div className="sd__card">
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

export default function SimpleDesign({ page, theme }) {
  useThemeFont(theme);

  return (
    <div
      className={`sd sd--hero-${theme.layout.hero} sd--card-${theme.layout.card}`}
      style={themeStyle(theme)}
    >
      <Hero {...page} />

      {/* TEMPORARY: replaced by the other sections in chunk 3 */}
      <p className="sd__todo">The rest of your page appears here in the next step.</p>
    </div>
  );
}