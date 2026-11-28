import { initials } from '../utils/initials';
import { useStudentBrand } from '../data/branding';
import openslateLogo from '../assets/openslate-logo.png';
import './BrandMark.css';

// ------------------------------------------------------------
// The square logo at the left of the dashboard's top bar (AppLayout.jsx),
// and in Settings → Branding's preview.
//
// brand: { saved, name, logo } (data/branding.js)
//   Not saved yet: OpenSlate's logo
//   Saved with a logo: their logo
//   Saved without one: their initials (HN)
// size: in px (40 in the top bar)
//
// OpenSlate's logo: src/assets/openslate-logo.png
// ------------------------------------------------------------
export default function BrandMark({ brand, size = 40 }) {
  const style = { width: size, height: size };
  if (!brand.saved) {
    return <img className="brd-mark brd-mark--openslate" style={style} src={openslateLogo} alt="OpenSlate" />;
  }
  if (brand.logo) {
    return <img className="brd-mark brd-mark--img" style={style} src={brand.logo} alt={brand.name || 'Logo'} />;
  }
  return (
    <span
      className="brd-mark brd-mark--initials"
      style={{ ...style, fontSize: Math.round(size * 0.38) }}
      role="img"
      aria-label={brand.name}
    >
      {initials(brand.name)}
    </span>
  );
}

// ---------- Student pages ----------
// Inside a page's own logo square (the academy's, sign-in's, an invoice's):
// their logo filling it, else the initials it always showed. Give the
// square boxStyle(brand) so a logo sits on white, edge to edge.
export function LogoFill({ brand }) {
  if (!brand.logo) return initials(brand.name);
  return (
    <img src={brand.logo} alt="" style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain' }} />
  );
}
export const boxStyle = (brand) =>
  brand.logo ? { overflow: 'hidden', padding: 0, background: '#fff', border: '1px solid #ececec' } : undefined;

// Their logo on its own at the top left of the checkouts and the
// payment-done page, no bar (as TagMango's). Only once branding's saved: until
// then those pages look as they always have.
export function BrandBar() {
  const brand = useStudentBrand();
  if (!brand.branded) return null;
  return (
    <div className="brd-bar">
      <div className="brd-bar__in">
        <span className="brd-bar__logo" style={boxStyle(brand)} role="img" aria-label={brand.name}>
          <LogoFill brand={brand} />
        </span>
      </div>
    </div>
  );
}
